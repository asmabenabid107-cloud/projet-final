import re
import time
from datetime import datetime
from math import radians, sin, cos, sqrt, atan2

import numpy as np
import requests
from ortools.constraint_solver import pywrapcp, routing_enums_pb2
from sklearn.cluster import AgglomerativeClustering
from sqlalchemy.orm import Session

from app.models.colis import Colis
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.geocode_cache import GeocodeCache
from app.models.tournee import Tournee


DEPOTS = {
    "kairouan": {
        "label": "Dépôt Kairouan AFH 4",
        "adresse": "AFH 4, Kairouan, Tunisie",
        "latitude": 35.68779123889766,
        "longitude": 10.083732874866017,
    },
    "sousse": {
        "label": "Dépôt Sousse Msaken",
        "adresse": "Msaken, Sousse, Tunisie",
        "latitude": 35.77005959180682,
        "longitude": 10.594931528518906,
    },
}

# ── Day-off mapping: day_off DB value → Python weekday() ────────────────────
# weekday(): 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday,
#            5=Saturday, 6=Sunday
DAY_OFF_MAP = {
    "lundi":    0,
    "mardi":    1,
    "mercredi": 2,
    "jeudi":    3,
    "vendredi": 4,
    "samedi":   5,
    "dimanche": 6,
    # English aliases (just in case)
    "monday":    0,
    "tuesday":   1,
    "wednesday": 2,
    "thursday":  3,
    "friday":    4,
    "saturday":  5,
    "sunday":    6,
}

MIN_COLIS_POUR_TOURNEE = 30
MAX_COLIS_PAR_TOURNEE = 300
MAX_GOUVERNORATS_PAR_TOURNEE = 4
MAX_GOV_DISTANCE_IN_TOURNEE_KM = 140
MIN_CAPACITY_USAGE = 0.75
MAX_CLUSTER_DISTANCE_KM = 80

DEPOT_PREFERENCE_BONUS_KM = 25
DEPOT_SWITCH_THRESHOLD_KM = 40


GOVERNORATE_COORDS = {
    "Tunis": (36.8065, 10.1815),
    "Ariana": (36.8665, 10.1647),
    "Ben Arous": (36.7531, 10.2189),
    "Manouba": (36.8080, 10.0972),
    "Bizerte": (37.2746, 9.8739),
    "Nabeul": (36.4513, 10.7350),
    "Sousse": (35.8256, 10.6370),
    "Monastir": (35.7643, 10.8113),
    "Kairouan": (35.6781, 10.0963),
    "Le Kef": (36.1742, 8.7049),
    "Kef": (36.1742, 8.7049),
    "Sfax": (34.7406, 10.7603),
    "Mahdia": (35.5047, 11.0622),
    "Béja": (36.7333, 9.1833),
    "Beja": (36.7333, 9.1833),
    "Jendouba": (36.5011, 8.7802),
    "Zaghouan": (36.4029, 10.1429),
    "Siliana": (36.0833, 9.3667),
    "Kasserine": (35.1676, 8.8365),
    "Sidi Bouzid": (35.0382, 9.4849),
    "Gabès": (33.8815, 10.0982),
    "Gabes": (33.8815, 10.0982),
    "Médenine": (33.3549, 10.5055),
    "Medenine": (33.3549, 10.5055),
    "Tataouine": (32.9297, 10.4518),
    "Gafsa": (34.4250, 8.7842),
    "Tozeur": (33.9197, 8.1335),
    "Kebili": (33.7044, 8.9690),
}


def clean_region(value):
    if not value:
        return "Sans Région"

    value = str(value).strip().lower()

    value = value.replace("_", " ")
    value = value.replace("-", " ")

    value = value.replace("gouvernorat de", "")
    value = value.replace("gouvernorat", "")
    value = value.replace("governorate", "")
    value = value.replace("ولاية", "")

    value = re.sub(r"\s+", " ", value).strip()

    return value.title()


def limit_text(value, max_length=120):
    value = str(value or "").strip()
    if len(value) <= max_length:
        return value
    return value[: max_length - 3] + "..."


def normalize_address_key(address, region=None, delegation=None):
    parts = [
        str(address or "").strip().lower(),
        str(delegation or "").strip().lower(),
        str(region or "").strip().lower(),
        "tunisie",
    ]
    return " | ".join([p for p in parts if p])


def search_nominatim(query):
    response = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={
            "q": query,
            "format": "json",
            "limit": 1,
            "countrycodes": "tn",
            "addressdetails": 1,
            "accept-language": "fr",
        },
        headers={"User-Agent": "mz-logistic-pfe/1.0"},
        timeout=10,
    )
    data = response.json()
    if data:
        return float(data[0]["lat"]), float(data[0]["lon"])
    return None, None


def get_coordinates_smart(db, address, region=None, delegation=None):
    region = clean_region(region)
    delegation = str(delegation or "").strip()
    address = str(address or "").strip()
    address_key = normalize_address_key(address, region, delegation)

    cached = (
        db.query(GeocodeCache)
        .filter(GeocodeCache.address_key == address_key)
        .first()
    )
    if cached:
        return cached.latitude, cached.longitude

    queries = []
    if address:
        queries.append(f"{address}, Tunisie")
    if delegation and region and region != "Sans Région":
        queries.append(f"{delegation}, {region}, Tunisie")
    if region and region != "Sans Région":
        queries.append(f"{region}, Tunisie")

    lat = lon = None
    for q in queries:
        try:
            lat, lon = search_nominatim(q)
            if lat is not None and lon is not None:
                break
            time.sleep(1)
        except Exception as e:
            print("Erreur geocoding:", q, e)

    if lat is None or lon is None:
        return None, None

    cache = GeocodeCache(
        address_key=address_key, latitude=lat, longitude=lon, source="nominatim"
    )
    db.add(cache)
    db.commit()
    return lat, lon


def haversine_distance_km(lat1, lon1, lat2, lon2):
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return max(1, int(R * c))


def get_region_coords(region):
    region = clean_region(region)
    return GOVERNORATE_COORDS.get(region)


def distance_between_regions(region_a, region_b):
    coords_a = get_region_coords(region_a)
    coords_b = get_region_coords(region_b)
    if not coords_a or not coords_b:
        return 999999
    return haversine_distance_km(coords_a[0], coords_a[1], coords_b[0], coords_b[1])

def volume_total_colis(colis_list):
    return sum(float(c.get("volume") or 0) for c in colis_list)

def poids_total_colis(colis_list):
    return sum(float(c.get("poids") or 0) for c in colis_list)


def get_colis_center(colis_list):
    colis_valides = [
        c for c in colis_list
        if c.get("latitude") is not None and c.get("longitude") is not None
    ]
    if not colis_valides:
        return None
    return {
        "latitude": sum(c["latitude"] for c in colis_valides) / len(colis_valides),
        "longitude": sum(c["longitude"] for c in colis_valides) / len(colis_valides),
    }


def get_majority_depot_from_colis(colis_zone):
    counts = {}
    for c in colis_zone:
        depot_key = str(c.get("depot_depart") or "").lower().strip()
        if depot_key not in DEPOTS:
            continue
        counts[depot_key] = counts.get(depot_key, 0) + 1
    if not counts:
        return None
    return max(counts.items(), key=lambda x: x[1])[0]


def choose_depot_intelligent(colis_zone):
    center = get_colis_center(colis_zone)
    if not center:
        return "sousse", DEPOTS["sousse"]

    majority_depot = get_majority_depot_from_colis(colis_zone)
    depot_scores = []

    for depot_key, depot in DEPOTS.items():
        distance = haversine_distance_km(
            center["latitude"], center["longitude"],
            depot["latitude"], depot["longitude"],
        )
        score = distance
        if majority_depot == depot_key:
            score -= DEPOT_PREFERENCE_BONUS_KM
        depot_scores.append({
            "depot_key": depot_key, "depot": depot,
            "distance": distance, "score": score,
        })

    closest_by_gps = sorted(depot_scores, key=lambda x: x["distance"])[0]
    best_by_score  = sorted(depot_scores, key=lambda x: x["score"])[0]

    if majority_depot:
        majority_item = next(x for x in depot_scores if x["depot_key"] == majority_depot)
        difference = majority_item["distance"] - closest_by_gps["distance"]
        if difference >= DEPOT_SWITCH_THRESHOLD_KM:
            return closest_by_gps["depot_key"], closest_by_gps["depot"]

    return best_by_score["depot_key"], best_by_score["depot"]

def choose_depot_alternative_if_refused(depot_key, depot, region_label, refused_rules):
    current_depot = str(depot_key or "").lower().strip()

    for rule in refused_rules:
        reason = rule.get("reason")
        refused_depot = str(rule.get("depot_depart") or "").lower().strip()
        refused_region = str(rule.get("region") or "").strip()

        same_region = normalize_region_set(region_label) == normalize_region_set(refused_region)

        if reason == "depot" and same_region and current_depot == refused_depot:
            for alt_key, alt_depot in DEPOTS.items():
                if alt_key != current_depot:
                    print(
                        f"DEPOT REFUSE PAR ADMIN: {current_depot} | "
                        f"nouveau depot choisi: {alt_key} | region={region_label}"
                    )
                    return alt_key, alt_depot

    return depot_key, depot


def can_add_gouvernorat_to_zone(current_zone, new_colis):
    gouvernorats = set(
        clean_region(c.get("gouvernorat"))
        for c in current_zone + [new_colis]
        if c.get("gouvernorat")
    )
    gouvernorats = list(gouvernorats)
    if len(gouvernorats) <= 1:
        return True
    for i in range(len(gouvernorats)):
        for j in range(i + 1, len(gouvernorats)):
            if distance_between_regions(gouvernorats[i], gouvernorats[j]) > MAX_GOV_DISTANCE_IN_TOURNEE_KM:
                return False
    return True


def split_zone_by_rules(colis_zone, vehicle_capacity):
    colis_zone = sorted(
        colis_zone,
        key=lambda c: (
            clean_region(c.get("gouvernorat")),
            c.get("latitude") or 0,
            c.get("longitude") or 0,
            c["id"],
        )
    )
    zones = []
    current_zone = []
    current_weight = 0

    for c in colis_zone:
        poids = float(c.get("poids") or 0)
        gouvernorats_if_added = set(
            clean_region(x.get("gouvernorat")) for x in current_zone + [c]
        )
        should_split = (
            current_zone
            and (
                len(current_zone) >= MAX_COLIS_PAR_TOURNEE
                or current_weight + poids > vehicle_capacity
                or len(gouvernorats_if_added) > MAX_GOUVERNORATS_PAR_TOURNEE
                or not can_add_gouvernorat_to_zone(current_zone, c)
                or not can_merge_by_preferred_group(current_zone, [c])
            )
        )
        if should_split:
            zones.append(current_zone)
            current_zone = []
            current_weight = 0
        current_zone.append(c)
        current_weight += poids

    if current_zone:
        zones.append(current_zone)
    return zones


def merge_small_zones(zones, vehicle_capacity):
    zones = [z for z in zones if z]
    zones.sort(key=lambda z: len(z))
    changed = True

    while changed:
        changed = False
        new_zones = []
        used = set()

        for i, zone in enumerate(zones):
            if i in used:
                continue
            if len(zone) >= MIN_COLIS_POUR_TOURNEE:
                new_zones.append(zone)
                used.add(i)
                continue

            best_j = None
            best_distance = 999999
            center_zone = get_colis_center(zone)

            for j, other in enumerate(zones):
                if j == i or j in used:
                    continue
                merged = zone + other
                if len(merged) > MAX_COLIS_PAR_TOURNEE:
                    continue
                if poids_total_colis(merged) > vehicle_capacity:
                    continue
                gouvernorats_merged = set(
                    clean_region(c.get("gouvernorat")) for c in merged if c.get("gouvernorat")
                )
                if len(gouvernorats_merged) > MAX_GOUVERNORATS_PAR_TOURNEE:
                    continue
                can_merge = True
                gouvernorats_list = list(gouvernorats_merged)
                for a in range(len(gouvernorats_list)):
                    for b in range(a + 1, len(gouvernorats_list)):
                        if distance_between_regions(gouvernorats_list[a], gouvernorats_list[b]) > MAX_GOV_DISTANCE_IN_TOURNEE_KM:
                            can_merge = False
                            break
                    if not can_merge:
                        break
                if not can_merge:
                    continue
                center_other = get_colis_center(other)
                if not center_zone or not center_other:
                    continue
                distance = haversine_distance_km(
                    center_zone["latitude"], center_zone["longitude"],
                    center_other["latitude"], center_other["longitude"],
                )
                if distance <= MAX_CLUSTER_DISTANCE_KM and distance < best_distance:
                    best_distance = distance
                    best_j = j

            if best_j is not None:
                new_zones.append(zone + zones[best_j])
                used.add(i)
                used.add(best_j)
                changed = True
            else:
                new_zones.append(zone)
                used.add(i)

        zones = new_zones

    return zones


def create_agglomerative_model(distance_threshold):
    try:
        return AgglomerativeClustering(
            n_clusters=None, metric="precomputed",
            linkage="complete", distance_threshold=distance_threshold,
        )
    except TypeError:
        return AgglomerativeClustering(
            n_clusters=None, affinity="precomputed",
            linkage="complete", distance_threshold=distance_threshold,
        )


PREFERRED_GOV_GROUPS = [
    ["Tunis", "Ariana", "Ben Arous", "Manouba"],
    ["Nabeul", "Zaghouan"],
    ["Sousse", "Monastir", "Mahdia"],
    ["Bizerte", "Béja"],
    ["Jendouba", "Le Kef", "Siliana"],
    ["Kairouan", "Sidi Bouzid", "Kasserine"],
    ["Sfax"],
    ["Gabès", "Médenine", "Tataouine"],
    ["Gafsa", "Tozeur", "Kebili"],
]


def get_group_id_for_gouvernorat(gouvernorat):
    gouvernorat = clean_region(gouvernorat)
    for index, group in enumerate(PREFERRED_GOV_GROUPS):
        if gouvernorat in [clean_region(g) for g in group]:
            return index
    return None


def is_same_preferred_group(gouvernorats):
    gouvernorats = [clean_region(g) for g in gouvernorats if g]
    if not gouvernorats:
        return True
    group_ids = set()
    for gov in gouvernorats:
        group_id = get_group_id_for_gouvernorat(gov)
        if group_id is None:
            return False
        group_ids.add(group_id)
    return len(group_ids) == 1


def can_merge_by_preferred_group(zone_a, zone_b):
    merged = zone_a + zone_b
    gouvernorats = set(
        clean_region(c.get("gouvernorat")) for c in merged if c.get("gouvernorat")
    )
    return is_same_preferred_group(gouvernorats)


def get_preferred_group_for_gov(gouvernorat):
    gouvernorat = clean_region(gouvernorat)
    for group in PREFERRED_GOV_GROUPS:
        cleaned_group = [clean_region(g) for g in group]
        if gouvernorat in cleaned_group:
            return cleaned_group
    return [gouvernorat]


def can_merge_zones(zone_a, zone_b, vehicle_capacity, vehicle_volume_capacity=None):
    merged = zone_a + zone_b

    if len(merged) > MAX_COLIS_PAR_TOURNEE:
        return False

    if poids_total_colis(merged) > vehicle_capacity:
        return False

    if vehicle_volume_capacity and vehicle_volume_capacity > 0:
        if volume_total_colis(merged) > vehicle_volume_capacity:
            return False

    if not can_merge_by_preferred_group(zone_a, zone_b):
        return False

    gouvernorats = list(set(
        clean_region(c.get("gouvernorat")) for c in merged if c.get("gouvernorat")
    ))

    if len(gouvernorats) > MAX_GOUVERNORATS_PAR_TOURNEE:
        return False

    for i in range(len(gouvernorats)):
        for j in range(i + 1, len(gouvernorats)):
            if distance_between_regions(gouvernorats[i], gouvernorats[j]) > MAX_GOV_DISTANCE_IN_TOURNEE_KM:
                return False

    return True

def merge_same_gouvernorat_zones(zones, vehicle_capacity):
    grouped = {}
    for zone in zones:
        if not zone:
            continue
        gouvernorats = list(set(
            clean_region(c.get("gouvernorat")) for c in zone if c.get("gouvernorat")
        ))
        key = gouvernorats[0] if len(gouvernorats) == 1 else f"mixed_{len(grouped)}"
        grouped.setdefault(key, []).append(zone)

    result = []
    for _, group_zones in grouped.items():
        current = []
        for zone in group_zones:
            if not current:
                current = list(zone)
                continue
            if can_merge_zones(current, zone, vehicle_capacity):
                current.extend(zone)
            else:
                result.append(current)
                current = list(zone)
        if current:
            result.append(current)
    return result


def merge_preferred_governorate_groups(zones, vehicle_capacity):
    zones = [z for z in zones if z]
    changed = True

    while changed:
        changed = False
        result = []
        used = set()

        for i, zone in enumerate(zones):
            if i in used:
                continue
            govs_zone = list(set(
                clean_region(c.get("gouvernorat")) for c in zone if c.get("gouvernorat")
            ))
            if not govs_zone:
                result.append(zone)
                used.add(i)
                continue

            preferred_group = get_preferred_group_for_gov(govs_zone[0])
            best_j = None
            best_score = 999999
            center_zone = get_colis_center(zone)

            for j, other in enumerate(zones):
                if j == i or j in used:
                    continue
                govs_other = list(set(
                    clean_region(c.get("gouvernorat")) for c in other if c.get("gouvernorat")
                ))
                if not govs_other:
                    continue
                if not any(g in preferred_group for g in govs_other):
                    continue
                if not can_merge_zones(zone, other, vehicle_capacity):
                    continue
                center_other = get_colis_center(other)
                if not center_zone or not center_other:
                    continue
                distance = haversine_distance_km(
                    center_zone["latitude"], center_zone["longitude"],
                    center_other["latitude"], center_other["longitude"],
                )
                if distance < best_score:
                    best_score = distance
                    best_j = j

            if best_j is not None:
                result.append(zone + zones[best_j])
                used.add(i)
                used.add(best_j)
                changed = True
            else:
                result.append(zone)
                used.add(i)

        zones = result
    return zones


def get_preferred_group_key(gouvernorat):
    gouvernorat = clean_region(gouvernorat)
    for index, group in enumerate(PREFERRED_GOV_GROUPS):
        if gouvernorat in [clean_region(g) for g in group]:
            return index
    return f"solo_{gouvernorat}"


def get_ordered_gouvernorats_for_group(group_key, gov_map):
    if isinstance(group_key, int):
        ordered = [clean_region(g) for g in PREFERRED_GOV_GROUPS[group_key]]
        existing_ordered = [g for g in ordered if g in gov_map]
        extras = sorted([g for g in gov_map.keys() if g not in existing_ordered])
        return existing_ordered + extras
    return sorted(gov_map.keys())


def split_big_gouvernorat_if_needed(colis_gov, vehicle_capacity, vehicle_volume_capacity=None):
    colis_gov = sorted(
        colis_gov,
        key=lambda c: (c.get("latitude") or 0, c.get("longitude") or 0, c["id"]),
    )

    zones = []
    current_zone = []
    current_weight = 0
    current_volume = 0

    for c in colis_gov:
        poids = float(c.get("poids") or 0)
        volume = float(c.get("volume") or 0)

        should_split = (
            current_zone
            and (
                len(current_zone) >= MAX_COLIS_PAR_TOURNEE
                or current_weight + poids > vehicle_capacity
                or (
                    vehicle_volume_capacity
                    and vehicle_volume_capacity > 0
                    and current_volume + volume > vehicle_volume_capacity
                )
            )
        )

        if should_split:
            zones.append(current_zone)
            current_zone = []
            current_weight = 0
            current_volume = 0

        current_zone.append(c)
        current_weight += poids
        current_volume += volume

    if current_zone:
        zones.append(current_zone)

    return zones

def creer_zones_par_adresses(colis, vehicle_capacity):
    colis_valides = [
        c for c in colis
        if c.get("latitude") is not None
        and c.get("longitude") is not None
        and float(c.get("poids") or 0) <= float(vehicle_capacity)
    ]

    if len(colis_valides) < MIN_COLIS_POUR_TOURNEE:
        print(f"STOP IA: seulement {len(colis_valides)} colis (< {MIN_COLIS_POUR_TOURNEE})")
        return []

    groups = {}
    for c in colis_valides:
        gouvernorat = clean_region(c.get("gouvernorat"))
        group_key = get_preferred_group_key(gouvernorat)
        if group_key not in groups:
            groups[group_key] = {}
        if gouvernorat not in groups[group_key]:
            groups[group_key][gouvernorat] = []
        groups[group_key][gouvernorat].append(c)

    zones = []
    for group_key, gov_map in groups.items():
        ordered_govs = get_ordered_gouvernorats_for_group(group_key, gov_map)
        units = []
        for gov in ordered_govs:
            gov_units = split_big_gouvernorat_if_needed(gov_map[gov], vehicle_capacity)
            units.extend(gov_units)

        current_zone = []
        for unit in units:
            if not current_zone:
                current_zone = list(unit)
                continue
            if can_merge_zones(current_zone, unit, vehicle_capacity):
                current_zone.extend(unit)
            else:
                if len(current_zone) >= MIN_COLIS_POUR_TOURNEE:
                    zones.append(current_zone)
                current_zone = list(unit)
        if current_zone and len(current_zone) >= MIN_COLIS_POUR_TOURNEE:
            zones.append(current_zone)

    zones = [z for z in zones if len(z) >= MIN_COLIS_POUR_TOURNEE]
    zones.sort(key=lambda z: (-len(z), -poids_total_colis(z)))
    return zones


def create_distance_matrix_from_gps(colis_zone, depot):
    points = [depot] + colis_zone
    matrix = []
    for i in range(len(points)):
        row = []
        for j in range(len(points)):
            if i == j:
                row.append(0)
            else:
                row.append(haversine_distance_km(
                    points[i]["latitude"], points[i]["longitude"],
                    points[j]["latitude"], points[j]["longitude"],
                ))
        matrix.append(row)
    return matrix


def optimize_cluster_with_ortools(colis_cluster, vehicle_capacity, depot):
    colis_cluster = [
        c for c in colis_cluster
        if c.get("latitude") is not None and c.get("longitude") is not None
    ]

    if len(colis_cluster) < MIN_COLIS_POUR_TOURNEE:
        return {
            "ids": [], "poids": 0, "distance": 0,
            "ordered_colis": [],
            "parcours_text": "Tournée refusée: moins de 30 colis",
        }

    colis_cluster.sort(key=lambda c: (
        0 if str(c.get("priorite", "")).lower() == "urgent" else 1,
        0 if str(c.get("sensibilite", "")).lower() == "fragile" else 1,
        c["id"],
    ))

    distance_matrix = create_distance_matrix_from_gps(colis_cluster, depot)
    demands = [0] + [max(1, int(round(float(c["poids"] or 0)))) for c in colis_cluster]

    manager = pywrapcp.RoutingIndexManager(len(distance_matrix), 1, 0)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        return distance_matrix[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    def demand_callback(from_index):
        return demands[manager.IndexToNode(from_index)]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index, 0, [int(vehicle_capacity)], True, "Capacity"
    )

    for node in range(1, len(colis_cluster) + 1):
        colis_item = colis_cluster[node - 1]
        priorite    = str(colis_item.get("priorite", "")).lower()
        sensibilite = str(colis_item.get("sensibilite", "")).lower()
        if priorite == "urgent" and sensibilite == "fragile":
            penalty = 100000
        elif priorite == "urgent":
            penalty = 50000
        elif sensibilite == "fragile":
            penalty = 20000
        else:
            penalty = 1000
        routing.AddDisjunction([manager.NodeToIndex(node)], penalty)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.seconds = 2

    solution = routing.SolveWithParameters(search_parameters)
    if not solution:
        return {
            "ids": [], "poids": 0, "distance": 0,
            "ordered_colis": [], "parcours_text": "Aucune solution trouvée",
        }

    index = routing.Start(0)
    route_load    = 0
    route_distance = 0
    ordered_colis = []
    ids = []
    parcours_parts = [depot["label"]]

    while not routing.IsEnd(index):
        node = manager.IndexToNode(index)
        if node != 0:
            c = colis_cluster[node - 1]
            ordered_colis.append(c)
            ids.append(c["id"])
            route_load += float(c["poids"] or 0)
            parcours_parts.append(
                f"{c['adresse']} (1 colis, poids: {float(c['poids'] or 0)}kg)"
            )
        previous_index = index
        index = solution.Value(routing.NextVar(index))
        route_distance += routing.GetArcCostForVehicle(previous_index, index, 0)

    parcours_parts.append(depot["label"])

    if len(ordered_colis) < MIN_COLIS_POUR_TOURNEE:
        return {
            "ids": [], "poids": 0, "distance": 0,
            "ordered_colis": [],
            "parcours_text": "Tournée refusée après optimisation: moins de 30 colis",
        }

    return {
        "ids": ids, "poids": route_load, "distance": route_distance,
        "ordered_colis": ordered_colis,
        "parcours_text": " -> ".join(parcours_parts),
    }


def prepare_colis_data(db: Session):
    colis_rows = (
        db.query(Colis)
        .join(User, Colis.shipper_id == User.id)
        .filter(
            Colis.statut == "en_attente",
            User.role == "shipper",
            User.email != "admin@mz.com",
        )
        .order_by(Colis.id)
        .all()
    )

    colis = []
    for c in colis_rows:
        delegation     = getattr(c, "delegation", None)
        gouvernorat    = getattr(c, "gouvernorat", None)
        zone_label     = clean_region(delegation or gouvernorat or getattr(c, "zone", None) or "Sans Région")
        gouvernorat_clean  = clean_region(gouvernorat)
        delegation_clean   = clean_region(delegation)
        latitude  = c.latitude
        longitude = c.longitude

        if latitude is None or longitude is None:
            continue

        depot_depart = str(getattr(c, "depot_depart", None) or "").lower().strip()
        if depot_depart not in DEPOTS:
            depot_depart = "kairouan"

        colis.append({
            "id":          c.id,
            "adresse":     c.adresse_livraison,
            "poids":       float(c.poids or 0),
            "zone":        zone_label,
            "gouvernorat": gouvernorat_clean,
            "delegation":  delegation_clean,
            "latitude":    latitude,
            "longitude":   longitude,
            "depot_depart": depot_depart,
            "priorite":    getattr(c, "priorite_colis", None) or "normal",
            "sensibilite": getattr(c, "sensibilite_colis", None) or "standard",
            "longueur": float(c.longueur or 0),
            "largeur": float(c.largeur or 0),
            "hauteur": float(c.hauteur or 0),
            "volume": float(c.longueur or 0) * float(c.largeur or 0) * float(c.hauteur or 0),
        })
    return colis


# ── Day-off helpers ───────────────────────────────────────────────────────────

def _today_weekday_tunisia(target_date=None) -> int:
    """
    Returns the weekday in Tunisia (UTC+1, no DST) for the given date.
    If target_date is None, uses today (Tunisia time).
    0=Monday … 6=Sunday
    """
    from datetime import timezone, timedelta, date
    TZ_TUNISIA = timezone(timedelta(hours=1))
    if target_date is not None:
        # target_date is a date object — use its weekday directly
        if hasattr(target_date, 'weekday'):
            return target_date.weekday()
    return datetime.now(tz=TZ_TUNISIA).weekday()


def _is_day_off_today(day_off_value: str, target_date=None) -> bool:
    """
    Returns True if the target_date (or today) matches the livreur's day off.
    Accepts French or English day names, case-insensitive.
    target_date: a datetime.date object, or None for today Tunisia time.
    """
    if not day_off_value:
        return False
    key = day_off_value.strip().lower()
    day_off_weekday = DAY_OFF_MAP.get(key)
    if day_off_weekday is None:
        print(f"DAY_OFF INCONNU: '{day_off_value}' — livreur non exclu")
        return False
    return _today_weekday_tunisia(target_date) == day_off_weekday


def prepare_livreurs(db: Session, execution_date=None):
    """
    execution_date: datetime.date of when the tournée will be executed.
    If None, uses today (Tunisia time). Pass tomorrow's date when generating
    tournées that will run the next day.
    """
    livreurs_rows = (
        db.query(User)
        .filter(
            User.role == "courier",
            User.is_active == True,
            User.is_approved == True,
        )
        .order_by(User.id)
        .all()
    )

    target_wd = _today_weekday_tunisia(execution_date)
    day_names = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"]
    date_str  = str(execution_date) if execution_date else "aujourd'hui"
    print(f"GENERATION — jour d'exécution: {day_names[target_wd]} ({date_str})")

    livreurs = []
    skipped  = 0

    for l in livreurs_rows:
        day_off        = str(getattr(l, "day_off", None) or "").strip()
        livreur_status = str(getattr(l, "status",  None) or "").strip().lower()

        # ── Exclude livreur if their day_off matches execution day ──────────
        if _is_day_off_today(day_off, execution_date):
            print(
                f"LIVREUR REPOS (day_off): {l.name} (id={l.id}) "
                f"— jour de repos = '{day_off}'"
            )
            skipped += 1
            continue

        # ── Also exclude livreurs whose DB status is explicitly 'day_off' ──
        # (Some livreurs have status='day_off' set manually by the admin)
        if livreur_status == "day_off":
            print(
                f"LIVREUR REPOS (status): {l.name} (id={l.id}) "
                f"— status DB = '{livreur_status}'"
            )
            skipped += 1
            continue

        livreurs.append({
            "id":              l.id,
            "name":            l.name,
            "assigned_region": clean_region(getattr(l, "assigned_region", None)),
            "assigned_depot":  str(getattr(l, "assigned_depot", "") or "").lower().strip(),
            "day_off":         day_off,
        })

    print(f"LIVREURS DISPONIBLES: {len(livreurs)} | EN REPOS: {skipped}")
    return livreurs


def prepare_vehicles(db: Session):
    vehicles_rows = (
        db.query(Vehicle)
        .filter(Vehicle.status == "actif")
        .order_by(Vehicle.id)
        .all()
    )

    vehicles = []

    for v in vehicles_rows:
        max_capacity = float(v.max_length or 0)
        if max_capacity <= 0:
            continue

        longueur = float(getattr(v, "longueur", None) or 0)
        largeur = float(getattr(v, "largeur", None) or 0)
        hauteur = float(getattr(v, "hauteur", None) or 0)

        max_volume = float(getattr(v, "max_volume", None) or 0)

        # Si max_volume n'est pas rempli mais les dimensions existent,
        # on le calcule automatiquement.
        if max_volume <= 0 and longueur > 0 and largeur > 0 and hauteur > 0:
            max_volume = longueur * largeur * hauteur

        vehicles.append({
            "id": v.id,
            "name": v.name,
            "matricule": v.matricule,

            # Capacité poids en kg
            "min_capacity": float(v.min_length or 0),
            "max_capacity": max_capacity,

            # Dimensions internes du véhicule en cm
            "longueur": longueur,
            "largeur": largeur,
            "hauteur": hauteur,

            # Capacité volume en cm³
            "max_volume": max_volume,
        })

    return vehicles

def normalize_refuse_reason(reason):
    reason = str(reason or "").lower().strip()

    if "livreur" in reason:
        return "livreur"
    if "vehicle" in reason or "véhicule" in reason or "vehicule" in reason:
        return "vehicle"
    if "depot" in reason or "dépôt" in reason:
        return "depot"
    if "parcours" in reason or "trajet" in reason:
        return "parcours"

    return reason

def extract_region_from_tournee_name(nom, fallback_region):
    nom = str(nom or "").strip()

    if " - " in nom:
        return nom.split(" - ", 1)[1].strip()

    return str(fallback_region or "").strip()


def get_refused_rules(db: Session):
    refused = (
        db.query(Tournee)
        .filter(
            Tournee.status == "refused",
            Tournee.refuse_reason != None
        )
        .all()
    )

    rules = []

    for t in refused:
        rules.append({
            "tournee_id": t.id,
            "livreur_id": t.livreur_id,
            "vehicle_id": t.vehicle_id,
            "depot_depart": str(t.depot_depart or "").lower().strip(),
            "region": extract_region_from_tournee_name(t.nom, t.region),
            "reason": normalize_refuse_reason(t.refuse_reason),
            "parcours_text": str(t.parcours_text or ""),
        })

    print("REFUSED RULES:", rules)
    return rules


def normalize_region_set(value):
    return set(
        clean_region(part)
        for part in str(value or "").split("+")
        if part.strip()
    )


def is_refused_combination(livreur, vehicle, depot_key, region, refused_rules):
    current_regions = normalize_region_set(region)
    current_depot = str(depot_key or "").lower().strip()

    for rule in refused_rules:
        reason = rule["reason"]
        refused_regions = normalize_region_set(rule["region"])
        refused_depot = str(rule["depot_depart"] or "").lower().strip()

        same_regions = current_regions == refused_regions
        same_depot = current_depot == refused_depot

        if reason == "livreur":
            if (
                livreur["id"] == rule["livreur_id"]
                and same_regions
                and same_depot
            ):
                print(
                    f"BLOCAGE LIVREUR REFUSE: "
                    f"{livreur['name']} | regions={region} | depot={depot_key}"
                )
                return True

        elif reason == "vehicle":
            # Le refus véhicule est traité par choose_vehicle_alternative_if_refused.
            continue

        elif reason == "depot":
            # Le refus dépôt est traité par choose_depot_alternative_if_refused.
            continue

        elif reason == "parcours":
            # Le refus parcours est traité après l'optimisation du trajet.
            continue

    return False


def is_refused_parcours(resultat, region_label, depot_key, refused_rules):
    current_parcours = str(resultat.get("parcours_text") or "").strip()
    current_depot = str(depot_key or "").lower().strip()
    current_regions = normalize_region_set(region_label)

    if not current_parcours:
        return False

    for rule in refused_rules:
        if rule.get("reason") != "parcours":
            continue

        same_depot = (
            current_depot
            == str(rule.get("depot_depart") or "").lower().strip()
        )

        same_region = (
            current_regions
            == normalize_region_set(rule.get("region"))
        )

        same_parcours = (
            current_parcours
            == str(rule.get("parcours_text") or "").strip()
        )

        if same_depot and same_region and same_parcours:
            print(
                f"PARCOURS REFUSE DETECTE: "
                f"region={region_label} | depot={depot_key}"
            )
            return True

    return False


def choose_livreur_alternative(
    livreurs,
    used_livreur_ids,
    region_name,
    depot_key,
    vehicle,
    refused_rules,
):
    candidates = []

    for l in livreurs:
        if l["id"] in used_livreur_ids:
            continue

        blocked = is_refused_combination(
            livreur=l,
            vehicle=vehicle,
            depot_key=depot_key,
            region=region_name,
            refused_rules=refused_rules,
        )

        if blocked:
            print(
                f"LIVREUR EXCLU SUITE REFUS ADMIN: "
                f"{l['name']} | region={region_name} | depot={depot_key}"
            )
            continue

        score = 0

        if l.get("assigned_depot") == depot_key:
            score -= 100

        if clean_region(l.get("assigned_region")) in normalize_region_set(region_name):
            score -= 50

        # Pour une tournée multi-régions, on prend la distance minimale
        # entre la région affectée au livreur et l'une des régions de la tournée.
        region_distances = [
            distance_between_regions(
                clean_region(l.get("assigned_region")),
                region_part,
            )
            for region_part in normalize_region_set(region_name)
        ]
        score += min(region_distances) if region_distances else 999999

        candidates.append((score, l))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[0])

    print(
        f"LIVREUR CHOISI APRES REFUS: "
        f"{candidates[0][1]['name']} | region={region_name} | depot={depot_key}"
    )

    return candidates[0][1]


def choose_vehicle_for_zone(vehicles, zone_weight, zone_volume=0, used_vehicle_ids=None):
    """
    Choisit le plus petit véhicule actif disponible capable de porter:
    - le poids total de la zone
    - le volume total de la zone

    used_vehicle_ids empêche d'utiliser le même véhicule dans plusieurs tournées
    pendant la même génération.
    """
    used_vehicle_ids = used_vehicle_ids or set()
    fitting = []

    for v in vehicles:
        if v["id"] in used_vehicle_ids:
            continue

        max_weight = float(v.get("max_capacity") or 0)
        max_volume = float(v.get("max_volume") or 0)

        if zone_weight > max_weight:
            continue

        if max_volume > 0 and zone_volume > max_volume:
            continue

        fitting.append(v)

    if not fitting:
        print(
            f"AUCUN VEHICULE DISPONIBLE pour poids={zone_weight}kg "
            f"| volume={zone_volume}cm3 | used={list(used_vehicle_ids)}"
        )
        return None

    exact = [
        v for v in fitting
        if zone_weight >= float(v.get("min_capacity") or 0)
    ]

    candidates = exact or fitting

    selected = min(
        candidates,
        key=lambda v: (
            float(v.get("max_capacity") or 999999999),
            float(v.get("max_volume") or 999999999999),
        )
    )

    if not exact:
        print(
            f"VEHICULE SOUS-CAPACITE: poids={zone_weight}kg, "
            f"volume={zone_volume}cm3, "
            f"vehicle={selected['name']} min={selected['min_capacity']}kg"
        )

    print(
        f"VEHICULE CHOISI: {selected['name']} | id={selected['id']} | "
        f"poids={round(float(zone_weight or 0), 1)}kg | "
        f"volume={round(float(zone_volume or 0), 1)}cm3 | "
        f"used_before={list(used_vehicle_ids)}"
    )

    return selected

def is_vehicle_refused(vehicle, depot_key, region_label, refused_rules):
    current_depot = str(depot_key or "").lower().strip()
    current_regions = normalize_region_set(region_label)

    for rule in refused_rules:
        if rule.get("reason") != "vehicle":
            continue

        same_vehicle = vehicle["id"] == rule.get("vehicle_id")
        same_depot = current_depot == str(rule.get("depot_depart") or "").lower().strip()
        same_region = current_regions == normalize_region_set(rule.get("region"))

        if same_vehicle and same_depot and same_region:
            print(
                f"VEHICULE REFUSE DETECTE: "
                f"{vehicle['name']} | region={region_label} | depot={depot_key}"
            )
            return True

    return False


def choose_vehicle_alternative_if_refused(
    vehicle,
    vehicles,
    zone_weight,
    zone_volume,
    depot_key,
    region_label,
    refused_rules,
    used_vehicle_ids=None,
):
    used_vehicle_ids = used_vehicle_ids or set()

    if vehicle is None:
        return None

    if not is_vehicle_refused(
        vehicle=vehicle,
        depot_key=depot_key,
        region_label=region_label,
        refused_rules=refused_rules,
    ):
        return vehicle

    candidates = []

    for v in vehicles:
        if v["id"] == vehicle["id"]:
            continue

        if v["id"] in used_vehicle_ids:
            continue

        if zone_weight > float(v.get("max_capacity") or 0):
            continue

        max_volume = float(v.get("max_volume") or 0)
        if max_volume > 0 and zone_volume > max_volume:
            continue

        if is_vehicle_refused(
            vehicle=v,
            depot_key=depot_key,
            region_label=region_label,
            refused_rules=refused_rules,
        ):
            continue

        candidates.append(v)

    if not candidates:
        print(
            f"AUCUN VEHICULE ALTERNATIF DISPONIBLE: "
            f"region={region_label} | depot={depot_key} | "
            f"poids={zone_weight}kg | volume={zone_volume}cm3 | "
            f"used={list(used_vehicle_ids)}"
        )
        return None

    exact = [
        v for v in candidates
        if zone_weight >= float(v.get("min_capacity") or 0)
    ]

    selected = min(
        exact or candidates,
        key=lambda v: (
            float(v.get("max_capacity") or 999999999),
            float(v.get("max_volume") or 999999999999),
        )
    )

    print(
        f"VEHICULE ALTERNATIF CHOISI: "
        f"{selected['name']} au lieu de {vehicle['name']} | "
        f"region={region_label} | depot={depot_key}"
    )

    return selected

def choose_livreur_for_region(
    livreurs,
    used_livreur_ids,
    region_name,
    depot_key,
    allow_autre_depot=False,
):
    """
    livreurs here are already filtered (day-off excluded by prepare_livreurs).
    used_livreur_ids blocks one tournée per livreur per generation run.
    """
    region_name = clean_region(region_name)
    depot_key   = str(depot_key or "").lower().strip()

    # 1. Perfect match: same region + same depot
    for l in livreurs:
        if l["id"] in used_livreur_ids:
            continue
        if (
            l.get("assigned_depot") == depot_key
            and clean_region(l["assigned_region"]) == region_name
        ):
            return l, "region_depot"

    # 2. Same depot, closest region
    livreurs_meme_depot = [
        l for l in livreurs
        if l["id"] not in used_livreur_ids
        and l.get("assigned_depot") == depot_key
    ]
    if livreurs_meme_depot:
        livreurs_meme_depot.sort(
            key=lambda l: distance_between_regions(
                clean_region(l["assigned_region"]), region_name
            )
        )
        return livreurs_meme_depot[0], "meme_depot_hors_region"

    if not allow_autre_depot:
        return None, None

    # 3. Any available livreur
    available = [l for l in livreurs if l["id"] not in used_livreur_ids]
    if not available:
        return None, None
    available.sort(
        key=lambda l: distance_between_regions(
            clean_region(l["assigned_region"]), region_name
        )
    )
    return available[0], "autre_depot"


def build_tournee_map_points(ordered_colis, depot):
    points = [{
        "type": "depot", "label": depot["label"], "adresse": depot["adresse"],
        "latitude": depot["latitude"], "longitude": depot["longitude"], "ordre": 0,
    }]
    for ordre, c in enumerate(ordered_colis, start=1):
        points.append({
            "type": "colis", "colis_id": c["id"], "label": c["adresse"],
            "adresse": c["adresse"], "latitude": c["latitude"],
            "longitude": c["longitude"], "ordre": ordre,
        })
    points.append({
        "type": "depot", "label": depot["label"], "adresse": depot["adresse"],
        "latitude": depot["latitude"], "longitude": depot["longitude"],
        "ordre": len(ordered_colis) + 1,
    })
    return points


def build_gouvernorat_label(gouvernorats):
    gouvernorats = sorted(set(clean_region(g) for g in gouvernorats if g))
    return " + ".join(gouvernorats)


# ---------------------------------------------------------------------------
# MAIN GENERATION
# ---------------------------------------------------------------------------

def generate_tournees_ai(db: Session, execution_date=None):
    """
    execution_date: datetime.date of when tournées will be executed.
    Defaults to today (Tunisia time). Pass tomorrow to pre-generate for next day.
    """
    colis    = prepare_colis_data(db)
    livreurs = prepare_livreurs(db, execution_date=execution_date)  # ← day-off filtered
    vehicles = prepare_vehicles(db)
    refused_rules = get_refused_rules(db)

    if not colis or not livreurs or not vehicles:
        return []

    results            = []
    assigned_colis_ids = set()
    used_livreur_ids   = set()
    used_vehicle_ids   = set()
    warnings = []
    numero_tournee     = 1
    max_vehicle_capacity = max(v["max_capacity"] for v in vehicles)
    max_vehicle_volume = max(
        float(v.get("max_volume") or 0)
        for v in vehicles
    )

    # ── Helper: build all zones from a colis pool ─────────────────────────────
    def build_all_zones(colis_pool):
        colis_valides = [
            c for c in colis_pool
            if c.get("latitude") is not None
            and c.get("longitude") is not None
            and float(c.get("poids") or 0) <= max_vehicle_capacity
            and (
                max_vehicle_volume <= 0
                or float(c.get("volume") or 0) <= max_vehicle_volume
            )
        ]
        if not colis_valides:
            return [], []

        groups = {}
        for c in colis_valides:
            gouvernorat = clean_region(c.get("gouvernorat"))
            group_key   = get_preferred_group_key(gouvernorat)
            groups.setdefault(group_key, {}).setdefault(gouvernorat, []).append(c)

        valid_zones = []
        small_zones = []

        for group_key, gov_map in groups.items():
            ordered_govs = get_ordered_gouvernorats_for_group(group_key, gov_map)
            units = []
            for gov in ordered_govs:
                units.extend(
                    split_big_gouvernorat_if_needed(
                        gov_map[gov],
                        max_vehicle_capacity,
                        max_vehicle_volume,
                    )
                )

            current_zone = []
            for unit in units:
                if not current_zone:
                    current_zone = list(unit)
                    continue
                if can_merge_zones(current_zone, unit, max_vehicle_capacity, max_vehicle_volume):
                    current_zone.extend(unit)
                else:
                    (valid_zones if len(current_zone) >= MIN_COLIS_POUR_TOURNEE else small_zones).append(current_zone)
                    current_zone = list(unit)
            if current_zone:
                (valid_zones if len(current_zone) >= MIN_COLIS_POUR_TOURNEE else small_zones).append(current_zone)

        valid_zones.sort(key=lambda z: (-len(z), -poids_total_colis(z)))
        return valid_zones, small_zones

    def apply_lifo_loading_order(ordered_colis):
        """
        ordered_colis = ordre livraison
        loading_order = ordre chargement camion

        LIFO:
        premier colis à livrer = dernier colis chargé
        """
        delivery_order = list(ordered_colis)
        loading_order = list(reversed(delivery_order))

        return delivery_order, loading_order


    # ── Helper: turn a zone into a tournée ────────────────────────────────────
    def try_create_tournee(colis_zone, accept_low_weight=False):
        nonlocal numero_tournee

        zone_weight = poids_total_colis(colis_zone)
        zone_volume = volume_total_colis(colis_zone)
        vehicle = choose_vehicle_for_zone(
            vehicles,
            zone_weight,
            zone_volume,
            used_vehicle_ids,
        )

        if vehicle is None:
            print(f"AUCUN VEHICULE ADAPTE pour zone poids={zone_weight}kg")
            return None

        vehicle_capacity = vehicle["max_capacity"]
        vehicle_min_capacity = vehicle["min_capacity"]

        gouvernorats_dans_tournee_tmp = sorted(
            set(clean_region(c.get("gouvernorat")) for c in colis_zone)
        )

        gouvernorat_label_tmp = build_gouvernorat_label(
            gouvernorats_dans_tournee_tmp
        )

        depot_key, depot = choose_depot_intelligent(colis_zone)

        depot_key, depot = choose_depot_alternative_if_refused(
            depot_key=depot_key,
            depot=depot,
            region_label=gouvernorat_label_tmp,
            refused_rules=refused_rules,
        )

        vehicle = choose_vehicle_alternative_if_refused(
            vehicle=vehicle,
            vehicles=vehicles,
            zone_weight=zone_weight,
            zone_volume=zone_volume,
            depot_key=depot_key,
            region_label=gouvernorat_label_tmp,
            refused_rules=refused_rules,
            used_vehicle_ids=used_vehicle_ids,
        )

        if vehicle is None:
            warning_msg = (
                f"Aucun véhicule alternatif disponible pour "
                f"{gouvernorat_label_tmp} | dépôt={depot_key}"
            )
            print(warning_msg)
            warnings.append(warning_msg)
            return None

        vehicle_capacity = vehicle["max_capacity"]
        vehicle_min_capacity = vehicle["min_capacity"]

        resultat = optimize_cluster_with_ortools(
            colis_zone,
            vehicle_capacity,
            depot
        )

        if is_refused_parcours(
            resultat=resultat,
            region_label=gouvernorat_label_tmp,
            depot_key=depot_key,
            refused_rules=refused_rules,
        ):
            print(
                "PARCOURS IDENTIQUE AU REFUS ADMIN — "
                "tentative parcours alternatif"
            )

            colis_zone = list(reversed(colis_zone))

            resultat = optimize_cluster_with_ortools(
                colis_zone,
                vehicle_capacity,
                depot
            )

            if is_refused_parcours(
                resultat=resultat,
                region_label=gouvernorat_label_tmp,
                depot_key=depot_key,
                refused_rules=refused_rules,
            ):
                warning_msg = (
                    f"Aucun parcours alternatif disponible pour "
                    f"{gouvernorat_label_tmp} | dépôt={depot_key}"
                )
                print(warning_msg)
                warnings.append(warning_msg)
                return None

        ordered_colis = [
            c for c in resultat["ordered_colis"]
            if c["id"] not in assigned_colis_ids
        ]

        ordered_colis, loading_order = apply_lifo_loading_order(ordered_colis)

        if len(ordered_colis) < MIN_COLIS_POUR_TOURNEE:
            print(
                f"ZONE IGNOREE: seulement {len(ordered_colis)} colis "
                f"après optimisation (< {MIN_COLIS_POUR_TOURNEE})"
            )
            return None

        poids_total = round(
            sum(float(c["poids"] or 0) for c in ordered_colis),
            1
        )

        minimum_required_weight = vehicle_capacity * MIN_CAPACITY_USAGE

        # Important:
        # On ne bloque pas la génération si le poids est inférieur au seuil.
        # On affiche seulement un avertissement et on laisse l'admin décider.
        if poids_total < minimum_required_weight and not accept_low_weight:
            print(
                f"AVERTISSEMENT poids bas: "
                f"{poids_total}kg < {minimum_required_weight}kg — "
                f"tournée acceptée quand même"
            )

        zones_dans_tournee = sorted(
            set(clean_region(c.get("zone")) for c in ordered_colis)
        )

        gouvernorats_dans_tournee = sorted(
            set(clean_region(c.get("gouvernorat")) for c in ordered_colis)
        )

        region_label = " + ".join(zones_dans_tournee)
        gouvernorat_label = build_gouvernorat_label(gouvernorats_dans_tournee)

        livreur_region = gouvernorat_label

        livreur = choose_livreur_alternative(
            livreurs=livreurs,
            used_livreur_ids=used_livreur_ids,
            region_name=livreur_region,
            depot_key=depot_key,
            vehicle=vehicle,
            refused_rules=refused_rules,
        )

        if livreur is None:
            warning_msg = (
                f"Aucun livreur alternatif disponible pour "
                f"{livreur_region} | dépôt={depot_key}"
            )

            print(warning_msg)
            warnings.append(warning_msg)

            return None
        used_livreur_ids.add(livreur["id"])

        # Feedback admin:
        # Pour l'instant on détecte la combinaison refusée, mais on ne bloque pas
        # toute la génération afin d'éviter RESULTATS IA: 0.


        map_points = build_tournee_map_points(
            ordered_colis=ordered_colis,
            depot=depot
        )

        distance_km = round(float(resultat["distance"] or 0), 1)

        tournee = {
            "nom": f"Tournée IA GPS {numero_tournee} - {gouvernorat_label}",
            "region": gouvernorat_label,
            "depot_depart": depot_key,
            "depot_label": depot["label"],
            "depot_adresse": depot["adresse"],

            "livreur_id": livreur["id"],
            "vehicle_id": vehicle["id"],

            "vehicle_min_capacity": vehicle_min_capacity,
            "vehicle_capacity": vehicle_capacity,

            "cluster_ia": numero_tournee,
            "nombre_colis": len(ordered_colis),
            "distance_km": distance_km,
            "poids_total": poids_total,

            "parcours_text": resultat.get("parcours_text", ""),
            "map_points": map_points,
            "colis": [],
        }

        loading_order_map = {
            c["id"]: index
            for index, c in enumerate(loading_order, start=1)
        }

        for ordre, c in enumerate(ordered_colis, start=1):
            tournee["colis"].append({
                "colis_id": c["id"],
                "ordre": ordre,
                "ordre_chargement": loading_order_map.get(c["id"]),
                "distance_depuis_precedent": 0,
                "latitude": c["latitude"],
                "longitude": c["longitude"],
                "adresse": c["adresse"],
                "longueur": c.get("longueur"),
                "largeur": c.get("largeur"),
                "hauteur": c.get("hauteur"),
                "volume": c.get("volume"),
            })

            assigned_colis_ids.add(c["id"])

        print(
            f"TOURNEE CREEE: {tournee['nom']} | "
            f"{len(ordered_colis)} colis | {poids_total}kg | "
            f"volume={round(volume_total_colis(ordered_colis), 1)}cm3 | "
            f"vehicle={vehicle['name']} | "
            f"vehicle_volume={round(float(vehicle.get('max_volume') or 0), 1)}cm3 | "
            f"depot={depot_key} | livreur={livreur['name']}"
        )

        used_vehicle_ids.add(vehicle["id"])
        print(
            f"VEHICULE MARQUE UTILISE: {vehicle['name']} | "
            f"used={list(used_vehicle_ids)}"
        )

        numero_tournee += 1
        return tournee

    # ── PASS 1: valid zones (>= MIN_COLIS_POUR_TOURNEE) ──────────────────────
    colis_pool = [
        c for c in colis
        if c.get("latitude") is not None and c.get("longitude") is not None
    ]
    valid_zones, small_zones = build_all_zones(colis_pool)
    print(f"PASS 1 — ZONES VALIDES: {len(valid_zones)} | PETITES: {len(small_zones)}")

    for zone in valid_zones:
        zone = [c for c in zone if c["id"] not in assigned_colis_ids]
        if len(zone) < MIN_COLIS_POUR_TOURNEE:
            continue
        t = try_create_tournee(zone, accept_low_weight=False)
        if t:
            results.append(t)

    # ── PASS 2: re-check remaining after Pass 1 ───────────────────────────────
    remaining2 = [
        c for c in colis
        if c["id"] not in assigned_colis_ids
        and c.get("latitude") is not None
        and c.get("longitude") is not None
    ]
    print(f"PASS 2 — {len(remaining2)} colis restants")

    if len(remaining2) >= MIN_COLIS_POUR_TOURNEE:
        valid_zones2, small_zones2 = build_all_zones(remaining2)
        for zone in valid_zones2:
            zone = [c for c in zone if c["id"] not in assigned_colis_ids]
            if len(zone) < MIN_COLIS_POUR_TOURNEE:
                continue
            t = try_create_tournee(zone, accept_low_weight=False)
            if t:
                results.append(t)

    # ── PASS 3: isolated regions — force accept low weight ────────────────────
    remaining3 = [
        c for c in colis
        if c["id"] not in assigned_colis_ids
        and c.get("latitude") is not None
        and c.get("longitude") is not None
    ]
    print(f"PASS 3 — {len(remaining3)} colis restants (zones isolées)")

    if len(remaining3) >= MIN_COLIS_POUR_TOURNEE:
        valid_zones3, small_zones3 = build_all_zones(remaining3)
        for zone in valid_zones3 + small_zones3:
            zone = [c for c in zone if c["id"] not in assigned_colis_ids]
            if len(zone) < MIN_COLIS_POUR_TOURNEE:
                continue
            t = try_create_tournee(zone, accept_low_weight=True)
            if t:
                results.append(t)

    return {
        "results": results,
        "warnings": warnings,
    }
