import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { api } from "../../api/client.js";
import tourneeService from "../../api/tourneeService.js";
import trackingService from "../../api/trackingService.js";
import {
  configureGoogleMapsOnce,
  loadMapsLibrary,
} from "../../lib/googleMapsLoader.js";

const DEFAULT_CENTER = { lat: 36.8065, lng: 10.1815 };
const DEPOT_COORDS = {
  kairouan: {
    lat: 35.68779123889766,
    lng: 10.083732874866017,
  },
  sousse: {
    lat: 35.77005959180682,
    lng: 10.594931528518906,
  },
};
const ROUTE_PROGRESS_COLOR = "#16a34a";
const ROUTE_DEVIATION_COLOR = "#dc2626";
const ROUTE_DEVIATION_MIN_METERS = 25;
const MAX_GOOGLE_MAPS_TABS = 8;
const ACCEPTED_TOURNEES_REFRESH_MS = 60 * 1000;
const EMPTY_STATUS = {
  tone: "info",
  message: "Selectionnez une tournee, un livreur, ou affichez tous les trajets.",
};
const STOP_STATUS_META = {
  delivered: {
    label: "Livre",
    color: "#16a34a",
  },
  returned: {
    label: "Retour",
    color: "#dc2626",
  },
  rescheduled: {
    label: "A relivrer demain",
    color: "#f97316",
  },
};

function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const k = (n) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  return [f(0), f(8), f(4)]
    .map((value) =>
      Math.round(255 * value)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .replace(/^/, "#");
}

function getTourneeRouteColor(tournee, index = 0) {
  const id = Number(tournee?.id);
  const basis = Number.isFinite(id) ? id : index + 1;
  return hslToHex((basis * 47 + 214) % 360, 78, 43);
}

function normalizeValue(value) {
  return String(value || "").trim();
}

function toCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatCoordinate(value) {
  const coordinate = toCoordinate(value);
  return coordinate == null ? "" : coordinate.toFixed(6);
}

function formatCoordinatePair(latitude, longitude) {
  const lat = formatCoordinate(latitude);
  const lng = formatCoordinate(longitude);

  return lat && lng ? `${lat},${lng}` : "";
}

function comparableValue(value) {
  return normalizeValue(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return `${value}${suffix}`;
}

function formatRouteMetricDistance(distanceKm) {
  const distance = Number(distanceKm);

  if (!Number.isFinite(distance) || distance <= 0) {
    return "";
  }

  const rounded = distance >= 100 ? Math.round(distance) : Math.round(distance * 10) / 10;
  return `${String(rounded).replace(".", ",")} km`;
}

function formatRouteMetricDuration(durationSeconds) {
  const duration = Number(durationSeconds);

  if (!Number.isFinite(duration) || duration <= 0) {
    return "";
  }

  const totalMinutes = Math.max(1, Math.round(duration / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} h ${minutes} min`;
  }

  if (hours > 0) {
    return `${hours} h`;
  }

  return `${minutes} min`;
}

function escapeSvgText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stopCountLabel(count) {
  return `${count} arret${count > 1 ? "s" : ""}`;
}

function getCourierName(tournee) {
  const name = normalizeValue(tournee?.livreur_name);
  return name && name !== "-" ? name : "Livreur non assigne";
}

function getStopStatusKind(stop) {
  const stage = comparableValue(stop?.tracking_stage);
  const status = comparableValue(stop?.statut);
  const stageKey = stage.replace(/[\s-]+/g, "_");
  const statusKey = status.replace(/[\s-]+/g, "_");
  const issueCount = Number(stop?.delivery_issue_count || 0);

  if (
    stop?.delivered_at ||
    stageKey === "delivered" ||
    statusKey === "livre" ||
    statusKey === "livree" ||
    statusKey === "delivered"
  ) {
    return "delivered";
  }

  if (
    stop?.returned_at ||
    stageKey === "return_pending" ||
    stageKey === "returned" ||
    statusKey === "retour" ||
    status.includes("refus")
  ) {
    return "returned";
  }

  if (
    stop?.last_delivery_issue_at ||
    stageKey === "delivery_failed" ||
    stageKey === "not_delivered" ||
    statusKey === "a_relivrer" ||
    statusKey === "non_livre" ||
    statusKey === "not_delivered" ||
    status.includes("echec") ||
    status.includes("failed") ||
    status.includes("relivr") ||
    status.includes("report") ||
    (stageKey === "at_warehouse" && issueCount > 0)
  ) {
    return "rescheduled";
  }

  return "pending";
}

function getStopStatusMeta(stop) {
  return STOP_STATUS_META[getStopStatusKind(stop)] || null;
}

function getStopStatusColor(stop) {
  return getStopStatusMeta(stop)?.color || "";
}

function getRoutePointColor(point, fallbackColor) {
  if (point?.kind !== "stop") {
    return fallbackColor;
  }

  return getStopStatusColor(point.stop) || fallbackColor;
}

function getRouteLegColor(_pathPoints, _destinationIndex, fallbackColor) {
  return fallbackColor;
}

function getStopStatusLabel(stop) {
  return getStopStatusMeta(stop)?.label || "";
}

function getTourneeDepotPoint(tournee) {
  const depotKey = comparableValue(tournee?.depot_depart);
  const fallback = DEPOT_COORDS[depotKey];
  const lat = toCoordinate(tournee?.depot_latitude) ?? fallback?.lat;
  const lng = toCoordinate(tournee?.depot_longitude) ?? fallback?.lng;

  if (lat == null || lng == null) {
    return null;
  }

  return {
    lat,
    lng,
    label: "D",
    title: tournee?.depot_label || tournee?.depot_adresse || "Depot",
    kind: "depot",
  };
}

function getTourneeStopPoints(tournee) {
  return (tournee?.stops || [])
    .map((stop, index) => {
      const lat = toCoordinate(stop.latitude);
      const lng = toCoordinate(stop.longitude);

      if (lat == null || lng == null) {
        return null;
      }

      const order = stop.ordre || index + 1;
      return {
        lat,
        lng,
        label: String(order),
        title: stop.adresse || `Arret ${order}`,
        kind: "stop",
        order,
        stop,
      };
    })
    .filter(Boolean);
}

function getTourneeRoute(tournee) {
  const depot = getTourneeDepotPoint(tournee);
  const stops = getTourneeStopPoints(tournee);

  if (!depot && stops.length === 0) {
    return {
      markerPoints: [],
      pathPoints: [],
      stops: [],
    };
  }

  if (!depot) {
    return {
      markerPoints: stops,
      pathPoints: stops,
      stops,
    };
  }

  return {
    markerPoints: [depot, ...stops],
    pathPoints: stops.length > 0 ? [depot, ...stops] : [depot],
    stops,
  };
}

function getRoutePointMarkerKey(tournee, point) {
  if (!tournee || !point) {
    return "";
  }

  const pointId =
    point.kind === "stop"
      ? point.stop?.colis_id || point.order || point.label
      : "depot";

  return `${tournee.id}:${point.kind}:${pointId}`;
}

function countTourneeStops(tournee) {
  return getTourneeStopPoints(tournee).length;
}

function getTourneeDirectionsUrl(tournee) {
  const route = getTourneeRoute(tournee);
  const depot = route.pathPoints[0];
  const stops = route.stops.map((point) =>
    formatCoordinatePair(point.lat, point.lng),
  );

  if (!depot || stops.length === 0) {
    return "";
  }

  const params = new URLSearchParams();
  const destination = route.stops[route.stops.length - 1];
  params.set("api", "1");
  params.set("origin", formatCoordinatePair(depot.lat, depot.lng));
  params.set("destination", formatCoordinatePair(destination.lat, destination.lng));
  if (stops.length > 1) {
    params.set("waypoints", stops.slice(0, -1).join("|"));
  }
  params.set("travelmode", "driving");

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function getTourneeDirectionsUrls(tournees) {
  return tournees.map(getTourneeDirectionsUrl).filter(Boolean);
}

function getTourneeTimelineSteps(tournee) {
  if (!tournee) {
    return [];
  }

  const depot = getTourneeDepotPoint(tournee);
  const stops = getTourneeStopPoints(tournee);
  const depotStep = depot
    ? {
        id: "depot-start",
        markerLabel: "D",
        adresse: depot.title,
        details: formatCoordinatePair(depot.lat, depot.lng),
        markerKey: getRoutePointMarkerKey(tournee, depot),
        kind: "depot",
      }
    : null;

  const stopSteps = stops.map((point, index) => {
    const stop = point.stop || {};
    const coordinates = formatCoordinatePair(point.lat, point.lng);
    const poids = formatNumber(stop.poids, " kg");
    const statusLabel = getStopStatusLabel(stop);
    const meta = [
      coordinates,
      stop.numero_suivi ? `Colis ${stop.numero_suivi}` : "",
      poids !== "-" ? `Poids ${poids}` : "",
      statusLabel,
    ].filter(Boolean);

    return {
      id: stop.colis_id || `stop-${index + 1}`,
      markerLabel: point.label,
      adresse: point.title || coordinates || `Arret ${index + 1}`,
      details: meta.join(" | "),
      markerKey: getRoutePointMarkerKey(tournee, point),
      kind: "stop",
    };
  });

  if (!depotStep) {
    return stopSteps;
  }

  return [depotStep, ...stopSteps];
}

function appendMapInfoText(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function appendMapInfoRow(parent, label, value) {
  if (value === null || value === undefined || value === "") {
    return;
  }

  const row = document.createElement("div");
  row.className = "routePlannerMapInfoRow";

  appendMapInfoText(row, "span", "", label);
  appendMapInfoText(row, "strong", "", String(value));
  parent.appendChild(row);
}

function createMapInfoContent(point, tournee) {
  const root = document.createElement("div");
  root.className = "routePlannerMapInfo";

  if (point.kind === "depot") {
    appendMapInfoText(root, "div", "routePlannerMapInfoTitle", "Depot");
    appendMapInfoText(
      root,
      "div",
      "routePlannerMapInfoSubtitle",
      tournee?.nom || "Tournee",
    );

    const rows = document.createElement("div");
    rows.className = "routePlannerMapInfoRows";
    appendMapInfoRow(rows, "Adresse", point.title);
    appendMapInfoRow(rows, "Coordonnees", formatCoordinatePair(point.lat, point.lng));
    root.appendChild(rows);
    return root;
  }

  const stop = point.stop || {};
  const poids = formatNumber(stop.poids, " kg");

  appendMapInfoText(
    root,
    "div",
    "routePlannerMapInfoTitle",
    `Arret ${point.order || point.label}`,
  );
  appendMapInfoText(
    root,
    "div",
    "routePlannerMapInfoSubtitle",
    tournee?.nom || "Tournee",
  );

  const rows = document.createElement("div");
  rows.className = "routePlannerMapInfoRows";
  appendMapInfoRow(rows, "Adresse", point.title);
  appendMapInfoRow(rows, "Colis", stop.numero_suivi);
  appendMapInfoRow(rows, "Destinataire", stop.nom_destinataire);
  appendMapInfoRow(rows, "Telephone", stop.telephone_destinataire);
  if (poids !== "-") {
    appendMapInfoRow(rows, "Poids", poids);
  }
  appendMapInfoRow(rows, "Etat", getStopStatusLabel(stop));
  appendMapInfoRow(rows, "Motif", stop.last_delivery_issue_reason);
  appendMapInfoRow(rows, "Coordonnees", formatCoordinatePair(point.lat, point.lng));
  root.appendChild(rows);

  return root;
}

function createRoutePointIcon(maps, color, rawLabel, kind) {
  const label = escapeSvgText(rawLabel);
  const labelLength = String(rawLabel || "").length;
  const fontSize = labelLength > 3 ? 9 : labelLength > 2 ? 10.5 : 13;
  const isDepot = kind === "depot";
  const mainFill = isDepot ? "#111827" : color;
  const ringFill = isDepot ? color : "#ffffff";
  const ringOpacity = isDepot ? "0.95" : "0.96";
  const textFill = isDepot ? "#ffffff" : color;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="58" viewBox="0 0 44 58">
      <ellipse cx="22" cy="53" rx="8" ry="3.5" fill="#111827" opacity="0.2"/>
      <path d="M22 52C22 52 7.5 36.8 7.5 22.5C7.5 13 13.9 6 22 6C30.1 6 36.5 13 36.5 22.5C36.5 36.8 22 52 22 52Z" fill="#111827" opacity="0.22"/>
      <path d="M22 49C22 49 9.5 35.2 9.5 22.3C9.5 14.3 14.9 8 22 8C29.1 8 34.5 14.3 34.5 22.3C34.5 35.2 22 49 22 49Z" fill="${mainFill}" stroke="#ffffff" stroke-width="3"/>
      <circle cx="22" cy="22" r="10.8" fill="${ringFill}" opacity="${ringOpacity}"/>
      <circle cx="22" cy="22" r="14.6" fill="none" stroke="#ffffff" stroke-opacity="0.48" stroke-width="1.2"/>
      <text x="22" y="26" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="900" fill="${textFill}">${label}</text>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(44, 58),
    anchor: new maps.Point(22, 49),
  };
}

function focusRouteMarker({ map, marker, position, infoWindow, point, tournee }) {
  map.panTo(position);
  map.setZoom(Math.max(map.getZoom() || 0, 16));
  infoWindow.setContent(createMapInfoContent(point, tournee));
  infoWindow.open({
    anchor: marker,
    map,
    shouldFocus: false,
  });
}

function createRouteMarker({ maps, map, point, tournee, color, infoWindow }) {
  const position = { lat: point.lat, lng: point.lng };
  const markerColor = getRoutePointColor(point, color);
  const marker = new maps.Marker({
    map,
    position,
    title: `${tournee.nom} - ${point.title}`,
    icon: createRoutePointIcon(maps, markerColor, point.label, point.kind),
  });

  marker.routePlannerFocus = () =>
    focusRouteMarker({ map, marker, position, infoWindow, point, tournee });

  marker.addListener("click", marker.routePlannerFocus);

  return marker;
}

function buildRouteSegments(pathPoints, maxWaypointCount = 23) {
  if (pathPoints.length < 2) {
    return [];
  }

  const maxPointsPerSegment = maxWaypointCount + 2;
  const segments = [];
  let startIndex = 0;

  while (startIndex < pathPoints.length - 1) {
    const endIndex = Math.min(
      pathPoints.length - 1,
      startIndex + maxPointsPerSegment - 1,
    );

    segments.push(pathPoints.slice(startIndex, endIndex + 1));
    startIndex = endIndex;
  }

  return segments;
}

function toOsrmCoordinate(point) {
  return `${point.lng},${point.lat}`;
}

async function getOsrmRouteData(pathPoints) {
  if (pathPoints.length <= 1) {
    return {
      paths: [],
      legPaths: [],
      distanceKm: 0,
      durationSeconds: 0,
    };
  }

  const routeSegments = buildRouteSegments(pathPoints);
  const paths = [];
  const legPaths = [];
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  let pointOffset = 0;

  for (const segment of routeSegments) {
    const coordinates = segment.map(toOsrmCoordinate).join(";");
    const params = new URLSearchParams({
      overview: "full",
      geometries: "geojson",
      steps: "true",
    });
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordinates}?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(`OSRM route request failed: ${response.status}`);
    }

    const data = await response.json();
    const route = data?.routes?.[0];
    const geometry = route?.geometry?.coordinates;

    if (!Array.isArray(geometry) || geometry.length === 0) {
      throw new Error("OSRM route response did not include geometry");
    }

    const distanceMeters = Number(route?.distance);
    const durationSeconds = Number(route?.duration);

    if (Number.isFinite(distanceMeters)) {
      totalDistanceMeters += distanceMeters;
    }

    if (Number.isFinite(durationSeconds)) {
      totalDurationSeconds += durationSeconds;
    }

    paths.push(
      geometry.map(([lng, lat]) => ({
        lat,
        lng,
      })),
    );

    if (Array.isArray(route?.legs)) {
      route.legs.forEach((leg, legIndex) => {
        const legPath = [];

        if (Array.isArray(leg?.steps)) {
          leg.steps.forEach((step) => {
            const coordinates = step?.geometry?.coordinates;

            if (!Array.isArray(coordinates)) {
              return;
            }

            coordinates.forEach(([lng, lat]) => {
              const previous = legPath[legPath.length - 1];
              if (previous?.lat === lat && previous?.lng === lng) {
                return;
              }

              legPath.push({ lat, lng });
            });
          });
        }

        if (legPath.length < 2 && segment[legIndex] && segment[legIndex + 1]) {
          legPath.push(
            { lat: segment[legIndex].lat, lng: segment[legIndex].lng },
            { lat: segment[legIndex + 1].lat, lng: segment[legIndex + 1].lng },
          );
        }

        if (legPath.length > 1) {
          legPaths.push({
            from: pointOffset + legIndex,
            to: pointOffset + legIndex + 1,
            path: legPath,
          });
        }
      });
    }

    pointOffset += segment.length - 1;
  }

  return {
    paths,
    legPaths,
    distanceKm: totalDistanceMeters / 1000,
    durationSeconds: totalDurationSeconds,
  };
}

function getRouteMetricAnchor(paths, fallbackPoints) {
  const flattenedPath = [];

  paths.forEach((path) => {
    path.forEach((point) => {
      flattenedPath.push(point);
    });
  });

  const anchorSource = flattenedPath.length > 0 ? flattenedPath : fallbackPoints;

  if (!anchorSource.length) {
    return null;
  }

  return anchorSource[Math.floor(anchorSource.length / 2)];
}

function flattenRoutePaths(paths) {
  const flattenedPath = [];

  paths.forEach((path) => {
    path.forEach((point) => {
      const previous = flattenedPath[flattenedPath.length - 1];
      if (previous?.lat === point.lat && previous?.lng === point.lng) {
        return;
      }

      flattenedPath.push(point);
    });
  });

  return flattenedPath;
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function distanceMeters(a, b) {
  const earthRadiusMeters = 6371000;
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const value =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return (
    2 *
    earthRadiusMeters *
    Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)))
  );
}

function getNearestRouteProgress(routePath, position) {
  if (!position || routePath.length < 2) {
    return null;
  }

  let best = null;

  for (let index = 0; index < routePath.length - 1; index += 1) {
    const start = routePath[index];
    const end = routePath[index + 1];
    const referenceLat = toRadians((start.lat + end.lat + position.lat) / 3);
    const lngScale = Math.cos(referenceLat) || 1;
    const startX = start.lng * lngScale;
    const startY = start.lat;
    const endX = end.lng * lngScale;
    const endY = end.lat;
    const positionX = position.lng * lngScale;
    const positionY = position.lat;
    const dx = endX - startX;
    const dy = endY - startY;
    const lengthSquared = dx * dx + dy * dy;
    const t =
      lengthSquared > 0
        ? Math.max(
            0,
            Math.min(
              1,
              ((positionX - startX) * dx + (positionY - startY) * dy) /
                lengthSquared,
            ),
          )
        : 0;
    const nearestPoint = {
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
    };
    const offRouteDistance = distanceMeters(position, nearestPoint);

    if (!best || offRouteDistance < best.distanceMeters) {
      best = {
        distanceMeters: offRouteDistance,
        nearestPoint,
        segmentIndex: index,
      };
    }
  }

  if (!best) {
    return null;
  }

  const progressPath = routePath.slice(0, best.segmentIndex + 1);
  const last = progressPath[progressPath.length - 1];
  if (
    !last ||
    last.lat !== best.nearestPoint.lat ||
    last.lng !== best.nearestPoint.lng
  ) {
    progressPath.push(best.nearestPoint);
  }

  return {
    ...best,
    progressPath,
  };
}

function createRouteMetricOverlay({
  maps,
  map,
  position,
  distanceKm,
  durationSeconds,
  zIndex = 1,
}) {
  const durationText = formatRouteMetricDuration(durationSeconds);
  const distanceText = formatRouteMetricDistance(distanceKm);

  if (!position || (!durationText && !distanceText)) {
    return null;
  }

  const metricOverlay = new maps.OverlayView();
  const latLng = new maps.LatLng(position.lat, position.lng);

  metricOverlay.onAdd = function onAdd() {
    const root = document.createElement("div");
    root.className = "routePlannerRouteMetricBubble";
    root.style.zIndex = String(zIndex);
    root.setAttribute("aria-hidden", "true");

    const icon = document.createElement("span");
    icon.className = "routePlannerRouteMetricIcon";
    icon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.8 7.2C6.2 6 7.3 5.1 8.6 5.1h6.8c1.3 0 2.4.8 2.8 2.1l.7 2h.6c.6 0 1 .4 1 1v4.6c0 .5-.4 1-1 1h-1.1c-.2 1.1-1.1 1.9-2.2 1.9s-2-.8-2.2-1.9H9.9c-.2 1.1-1.1 1.9-2.2 1.9s-2-.8-2.2-1.9H4.4c-.5 0-1-.4-1-1v-4.6c0-.6.4-1 1-1H5l.8-2Zm2.8-.4c-.6 0-1.1.4-1.3.9l-.6 1.7h10.6l-.6-1.7c-.2-.6-.7-.9-1.3-.9H8.6Zm-.9 9.3c.5 0 .9-.4.9-.9s-.4-.9-.9-.9-.9.4-.9.9.4.9.9.9Zm8.6 0c.5 0 .9-.4.9-.9s-.4-.9-.9-.9-.9.4-.9.9.4.9.9.9Z"/>
      </svg>
    `;

    const text = document.createElement("span");
    text.className = "routePlannerRouteMetricText";

    if (durationText) {
      const duration = document.createElement("strong");
      duration.className = "routePlannerRouteMetricDuration";
      duration.textContent = durationText;
      text.appendChild(duration);
    }

    if (distanceText) {
      const distance = document.createElement("span");
      distance.className = "routePlannerRouteMetricDistance";
      distance.textContent = distanceText;
      text.appendChild(distance);
    }

    root.appendChild(icon);
    root.appendChild(text);
    this.routePlannerMetricDiv = root;
    this.getPanes().floatPane.appendChild(root);
  };

  metricOverlay.draw = function draw() {
    const projection = this.getProjection();

    if (!projection || !this.routePlannerMetricDiv) {
      return;
    }

    const point = projection.fromLatLngToDivPixel(latLng);

    if (!point) {
      return;
    }

    this.routePlannerMetricDiv.style.left = `${point.x}px`;
    this.routePlannerMetricDiv.style.top = `${point.y}px`;
  };

  metricOverlay.onRemove = function onRemove() {
    if (this.routePlannerMetricDiv?.parentNode) {
      this.routePlannerMetricDiv.parentNode.removeChild(
        this.routePlannerMetricDiv,
      );
    }

    this.routePlannerMetricDiv = null;
  };

  metricOverlay.setMap(map);
  return metricOverlay;
}


const TRACKING_LIVE_REFRESH_MS = 5000;
const TRACKING_POINTS_REFRESH_MS = 10000;
const TRACKING_OFFLINE_TIMEOUT_MS = 45 * 1000;

function getTrackingPosition(item) {
  const lat = toCoordinate(item?.latitude);
  const lng = toCoordinate(item?.longitude);
  return lat == null || lng == null ? null : { lat, lng };
}

function formatTrackingDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function isTrackingFresh(item) {
  const raw = item?.updated_at || item?.recorded_at;
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= TRACKING_OFFLINE_TIMEOUT_MS;
}

function getTrackingStatusKind(item) {
  const rawStatus = comparableValue(item?.tracking_status);
  if (!item?.is_online || rawStatus === "offline" || !isTrackingFresh(item)) {
    return "offline";
  }
  return rawStatus === "idle" ? "idle" : "online";
}

function isTrackingLive(item) {
  const status = getTrackingStatusKind(item);
  return status === "online" || status === "idle";
}

function getTrackingStatusLabel(item) {
  const status = getTrackingStatusKind(item);
  if (status === "online") return "En ligne";
  if (status === "idle") return "Idle";
  return "Hors ligne";
}

function getTrackingStatusColor(item) {
  const status = getTrackingStatusKind(item);
  if (status === "online") return "#16a34a";
  if (status === "idle") return "#f59e0b";
  return "#dc2626";
}

function getTrackingInitials(name) {
  const parts = normalizeValue(name || "Livreur").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "L";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function trackingCourierMatchesTournee(courier, tournee) {
  if (!courier || !tournee) return false;
  const courierId = Number(courier.courier_id);
  const tourneeCourierId = Number(tournee.livreur_id);
  if (Number.isFinite(courierId) && Number.isFinite(tourneeCourierId) && courierId === tourneeCourierId) {
    return true;
  }
  return comparableValue(courier.courier_name) === comparableValue(getCourierName(tournee));
}

function createLiveCourierIcon(maps, courier) {
  const color = getTrackingStatusColor(courier);
  const label = escapeSvgText(getTrackingInitials(courier?.courier_name));
  const statusColor = getTrackingStatusColor(courier);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="46" height="58" viewBox="0 0 46 58">',
    '<ellipse cx="23" cy="53" rx="9" ry="3.5" fill="#111827" opacity="0.18"/>',
    '<path d="M23 51C23 51 8 35.7 8 22.5C8 13.3 14.2 6 23 6C31.8 6 38 13.3 38 22.5C38 35.7 23 51 23 51Z" fill="' + color + '" stroke="#ffffff" stroke-width="3"/>',
    '<circle cx="23" cy="22" r="12" fill="#ffffff" opacity="0.96"/>',
    '<text x="23" y="26" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="900" fill="' + color + '">' + label + '</text>',
    '<circle cx="35" cy="11" r="5" fill="' + statusColor + '" stroke="#ffffff" stroke-width="2"/>',
    '</svg>',
  ].join("");
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new maps.Size(46, 58),
    anchor: new maps.Point(23, 51),
  };
}

function createLiveCourierInfoContent(courier) {
  const root = document.createElement("div");
  root.className = "routePlannerMapInfo";
  appendMapInfoText(root, "div", "routePlannerMapInfoTitle", courier?.courier_name || "Livreur");
  appendMapInfoText(root, "div", "routePlannerMapInfoSubtitle", courier?.courier_email || "");
  const rows = document.createElement("div");
  rows.className = "routePlannerMapInfoRows";
  appendMapInfoRow(rows, "Statut", getTrackingStatusLabel(courier));
  appendMapInfoRow(rows, "Tournee", courier?.tournee_id || "-");
  appendMapInfoRow(rows, "Derniere position", formatTrackingDate(courier?.recorded_at));
  if (courier?.accuracy) {
    appendMapInfoRow(rows, "Precision", Number(courier.accuracy).toFixed(0) + " m");
  }
  appendMapInfoRow(rows, "Coordonnees", formatCoordinatePair(courier?.latitude, courier?.longitude));
  root.appendChild(rows);
  return root;
}

function getVisibleTitle({ selectedTournee, selectedCourierName, mapView }) {
  if (selectedTournee) {
    return selectedTournee.nom;
  }

  if (mapView === "courier" && selectedCourierName) {
    return `Trajet de ${selectedCourierName}`;
  }

  if (mapView === "all") {
    return "Tous les trajets acceptes";
  }

  return "Apercu des trajets";
}

export default function Planification() {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const mapsRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapMarkersRef = useRef([]);
  const mapMarkerLookupRef = useRef(new Map());
  const mapPolylinesRef = useRef([]);
  const mapProgressPolylinesRef = useRef([]);
  const mapMetricOverlaysRef = useRef([]);
  const mapInfoWindowRef = useRef(null);
  const routePathLookupRef = useRef(new Map());
  const trackingMarkersRef = useRef([]);
  const trackingPolylinesRef = useRef([]);
  const trackingInfoWindowRef = useRef(null);
  const [backendApiKey, setBackendApiKey] = useState("");
  const [acceptedTournees, setAcceptedTournees] = useState([]);
  const [acceptedLoading, setAcceptedLoading] = useState(true);
  const [acceptedError, setAcceptedError] = useState("");
  const [selectedTournee, setSelectedTournee] = useState(null);
  const [selectedCourierName, setSelectedCourierName] = useState("");
  const [mapView, setMapView] = useState("empty");
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [googleMapReady, setGoogleMapReady] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [liveCouriers, setLiveCouriers] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [selectedTrackingCourier, setSelectedTrackingCourier] = useState(null);
  const [selectedTrackingPoints, setSelectedTrackingPoints] = useState([]);
  const [trackingPointsLoading, setTrackingPointsLoading] = useState(false);
  const [mapRefreshing, setMapRefreshing] = useState(false);
  const [routePathVersion, setRoutePathVersion] = useState(0);

  const courierNames = useMemo(() => {
    return Array.from(new Set(acceptedTournees.map(getCourierName))).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [acceptedTournees]);

  const visibleTournees = useMemo(() => {
    if (mapView === "single" && selectedTournee) {
      return [selectedTournee];
    }

    if (mapView === "courier" && selectedCourierName) {
      return acceptedTournees.filter(
        (tournee) => getCourierName(tournee) === selectedCourierName,
      );
    }

    if (mapView === "all") {
      return acceptedTournees;
    }

    return [];
  }, [acceptedTournees, mapView, selectedCourierName, selectedTournee]);

  const visibleStopCount = useMemo(() => {
    return visibleTournees.reduce(
      (total, tournee) => total + countTourneeStops(tournee),
      0,
    );
  }, [visibleTournees]);

  const selectedSteps = useMemo(
    () => getTourneeTimelineSteps(selectedTournee),
    [selectedTournee],
  );
  const activeDirectionsTournee = useMemo(
    () => (visibleTournees.length === 1 ? visibleTournees[0] : null),
    [visibleTournees],
  );
  const visibleOpenMapsUrls = useMemo(
    () => getTourneeDirectionsUrls(visibleTournees),
    [visibleTournees],
  );
  const selectedOpenMapsUrl =
    visibleOpenMapsUrls.length === 1 ? visibleOpenMapsUrls[0] : "";
  const mapMode =
    visibleTournees.length > 1
      ? "multi"
      : activeDirectionsTournee
        ? "directions"
        : "empty";
  const previewTitle = getVisibleTitle({
    selectedTournee,
    selectedCourierName,
    mapView,
  });

  const visibleTrackingCouriers = useMemo(() => {
    if (!trackingEnabled) return [];

    if (selectedTournee) {
      return liveCouriers.filter((courier) =>
        trackingCourierMatchesTournee(courier, selectedTournee),
      );
    }

    if (mapView === "courier" && selectedCourierName) {
      return liveCouriers.filter(
        (courier) =>
          comparableValue(courier.courier_name) ===
          comparableValue(selectedCourierName),
      );
    }

    return liveCouriers;
  }, [
    liveCouriers,
    mapView,
    selectedCourierName,
    selectedTournee,
    trackingEnabled,
  ]);

  const routeProgressCouriers = useMemo(() => {
    if (!trackingEnabled) return [];

    if (selectedTournee) {
      return liveCouriers.filter((courier) =>
        trackingCourierMatchesTournee(courier, selectedTournee),
      );
    }

    if (mapView === "courier" && selectedCourierName) {
      return liveCouriers.filter(
        (courier) =>
          comparableValue(courier.courier_name) ===
          comparableValue(selectedCourierName),
      );
    }

    if (mapView === "all") {
      return liveCouriers;
    }

    return [];
  }, [
    liveCouriers,
    mapView,
    selectedCourierName,
    selectedTournee,
    trackingEnabled,
  ]);

  const trackingLiveCount = useMemo(
    () => liveCouriers.filter(isTrackingLive).length,
    [liveCouriers],
  );



  const loadLiveCouriers = useCallback(
    async ({ silent = false, shouldApply = () => true } = {}) => {
      try {
        if (!silent) {
          setLiveLoading(true);
        }
        const data = await trackingService.getLive();
        if (!shouldApply()) {
          return false;
        }
        setLiveCouriers(Array.isArray(data) ? data : []);
        setLiveError("");
        return true;
      } catch (err) {
        if (!shouldApply()) {
          return false;
        }
        setLiveError(
          err?.response?.data?.detail ||
            err?.message ||
            "Erreur chargement tracking livreurs.",
        );
        return false;
      } finally {
        if (shouldApply() && !silent) {
          setLiveLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!trackingEnabled) return undefined;

    let cancelled = false;

    loadLiveCouriers({
      shouldApply: () => !cancelled,
    });
    const id = window.setInterval(
      () =>
        loadLiveCouriers({
          silent: true,
          shouldApply: () => !cancelled,
        }),
      TRACKING_LIVE_REFRESH_MS,
    );
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [loadLiveCouriers, trackingEnabled]);

  useEffect(() => {
    if (trackingEnabled) return;
    setSelectedTrackingCourier(null);
    setSelectedTrackingPoints([]);
    clearTrackingOverlays();
  }, [trackingEnabled]);

  useEffect(() => {
    if (!selectedTrackingCourier?.courier_id) return;
    const fresh = liveCouriers.find(
      (courier) => courier.courier_id === selectedTrackingCourier.courier_id,
    );
    if (fresh && fresh.updated_at !== selectedTrackingCourier.updated_at) {
      setSelectedTrackingCourier(fresh);
    }
  }, [
    liveCouriers,
    selectedTrackingCourier?.courier_id,
    selectedTrackingCourier?.updated_at,
  ]);

  useEffect(() => {
    if (!trackingEnabled || !selectedTrackingCourier?.courier_id) {
      setSelectedTrackingPoints([]);
      return undefined;
    }
    let cancelled = false;
    async function loadPoints() {
      try {
        setTrackingPointsLoading(true);
        const data = await trackingService.getCourierPoints(
          selectedTrackingCourier.courier_id,
          { tourneeId: selectedTrackingCourier.tournee_id, limit: 800 },
        );
        if (!cancelled) setSelectedTrackingPoints(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setSelectedTrackingPoints([]);
      } finally {
        if (!cancelled) setTrackingPointsLoading(false);
      }
    }
    loadPoints();
    const id = window.setInterval(loadPoints, TRACKING_POINTS_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    selectedTrackingCourier?.courier_id,
    selectedTrackingCourier?.tournee_id,
    trackingEnabled,
  ]);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!googleMapReady || !maps || !map) return;
    clearTrackingOverlays();
    if (!trackingEnabled) return;
    if (!trackingInfoWindowRef.current) trackingInfoWindowRef.current = new maps.InfoWindow();
    const infoWindow = trackingInfoWindowRef.current;
    visibleTrackingCouriers.forEach((courier) => {
      const position = getTrackingPosition(courier);
      if (!position) return;
      const selected = selectedTrackingCourier?.courier_id === courier.courier_id;
      const marker = new maps.Marker({
        map,
        position,
        title: courier.courier_name || "Livreur",
        icon: createLiveCourierIcon(maps, courier),
        zIndex: selected ? 3000 : 2500,
      });
      marker.addListener("click", () => {
        setSelectedTrackingCourier(courier);
        infoWindow.setContent(createLiveCourierInfoContent(courier));
        infoWindow.open({ map, anchor: marker, shouldFocus: false });
        map.panTo(position);
        map.setZoom(Math.max(map.getZoom() || 0, 15));
      });
      trackingMarkersRef.current.push(marker);
    });
    const path = selectedTrackingPoints.map(getTrackingPosition).filter(Boolean);
    if (path.length >= 2) {
      trackingPolylinesRef.current.push(
        new maps.Polyline({
          map,
          path,
          clickable: false,
          strokeColor: "#2563eb",
          strokeOpacity: 0.95,
          strokeWeight: 5,
          geodesic: true,
          zIndex: 2200,
        }),
      );
    }
  }, [
    googleMapReady,
    selectedTrackingCourier?.courier_id,
    selectedTrackingPoints,
    trackingEnabled,
    visibleTrackingCouriers,
  ]);

  useEffect(() => {
    let cancelled = false;
    const maps = mapsRef.current;
    const map = mapRef.current;
    clearRouteProgressOverlays();

    if (!googleMapReady || !maps || !map || routeProgressCouriers.length === 0) {
      return undefined;
    }

    const addProgressPolyline = (path, options) => {
      if (cancelled || path.length <= 1) {
        return;
      }

      mapProgressPolylinesRef.current.push(
        new maps.Polyline({
          map,
          path,
          clickable: false,
          ...options,
        }),
      );
    };
    const progressStrokeWeight =
      mapView === "all" ? 6 : visibleTournees.length === 1 ? 8 : 7;

    const getRoadDeviationPath = async (start, end) => {
      try {
        const routeData = await getOsrmRouteData([start, end]);
        const roadPath = flattenRoutePaths(routeData.paths);
        return roadPath.length > 1 ? roadPath : [start, end];
      } catch (err) {
        console.warn(err);
        return [start, end];
      }
    };

    async function drawRouteProgressOverlays() {
      for (const [tourneeIndex, tournee] of visibleTournees.entries()) {
        const routePath = routePathLookupRef.current.get(tournee.id);
        if (!routePath || routePath.length < 2) {
          continue;
        }

        const matchingCouriers = routeProgressCouriers.filter((courier) =>
          trackingCourierMatchesTournee(courier, tournee),
        );

        for (const [courierIndex, courier] of matchingCouriers.entries()) {
          const position = getTrackingPosition(courier);
          const progress = getNearestRouteProgress(routePath, position);

          if (!position || !progress) {
            continue;
          }

          if (progress.progressPath.length > 1) {
            addProgressPolyline(progress.progressPath, {
              geodesic: false,
              strokeColor: ROUTE_PROGRESS_COLOR,
              strokeOpacity: 0.94,
              strokeWeight: progressStrokeWeight,
              zIndex: 1700 + tourneeIndex * 20 + courierIndex,
            });
          }

          if (progress.distanceMeters >= ROUTE_DEVIATION_MIN_METERS) {
            const deviationPath = await getRoadDeviationPath(
              position,
              progress.nearestPoint,
            );

            addProgressPolyline(deviationPath, {
              geodesic: false,
              strokeColor: ROUTE_DEVIATION_COLOR,
              strokeOpacity: 0.96,
              strokeWeight: 4,
              zIndex: 2100 + tourneeIndex * 20 + courierIndex,
            });
          }
        }
      }
    }

    drawRouteProgressOverlays();

    return () => {
      cancelled = true;
      clearRouteProgressOverlays();
    };
  }, [
    googleMapReady,
    mapView,
    routeProgressCouriers,
    routePathVersion,
    visibleTournees,
  ]);

  useEffect(() => {
    let cancelled = false;

    api
      .get("/admin/settings/google-maps")
      .then((response) => {
        if (cancelled) {
          return;
        }

        setBackendApiKey(normalizeValue(response.data?.api_key));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setBackendApiKey("");
      });

    loadAcceptedTournees({
      shouldApply: () => !cancelled,
    });

    const intervalId = window.setInterval(() => {
      loadAcceptedTournees({
        silent: true,
        shouldApply: () => !cancelled,
      });
    }, ACCEPTED_TOURNEES_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!selectedCourierName || courierNames.includes(selectedCourierName)) {
      return;
    }

    setSelectedCourierName("");
    setMapView("empty");
    setStatus(EMPTY_STATUS);
  }, [courierNames, selectedCourierName]);

  useEffect(() => {
    if (!backendApiKey || !mapDivRef.current) {
      return undefined;
    }

    let cancelled = false;

    async function drawMap() {
      configureGoogleMapsOnce(backendApiKey);
      const maps = await loadMapsLibrary();
      mapsRef.current = maps;

      if (cancelled || !maps || !mapDivRef.current) {
        return;
      }

      if (!mapRef.current || mapContainerRef.current !== mapDivRef.current) {
        mapContainerRef.current = mapDivRef.current;
        mapRef.current = new maps.Map(mapDivRef.current, {
          center: DEFAULT_CENTER,
          zoom: 7,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
      }

      setGoogleMapReady(true);

      clearMapOverlays();

      if (!mapInfoWindowRef.current) {
        mapInfoWindowRef.current = new maps.InfoWindow();
      }

      const map = mapRef.current;
      const infoWindow = mapInfoWindowRef.current;
      let routePathLookupChanged = false;

      if (visibleTournees.length === 0) {
        map.setCenter(DEFAULT_CENTER);
        map.setZoom(7);
        return;
      }

      const bounds = new maps.LatLngBounds();
      let hasBounds = false;

      const extendBounds = (point) => {
        bounds.extend({ lat: point.lat, lng: point.lng });
        hasBounds = true;
      };

      const addRouteMarkers = (route, tournee, color) => {
        route.markerPoints.forEach((point) => {
          extendBounds(point);
          const marker = createRouteMarker({
            maps,
            map,
            point,
            tournee,
            color,
            infoWindow,
          });

          mapMarkersRef.current.push(marker);
          mapMarkerLookupRef.current.set(
            getRoutePointMarkerKey(tournee, point),
            marker,
          );
        });
      };

      const addPolyline = (path, options) => {
        mapPolylinesRef.current.push(
          new maps.Polyline({
            map,
            path,
            clickable: false,
            ...options,
          }),
        );
      };
      const storeTourneeRoutePath = (tournee, routePath) => {
        if (!tournee?.id || routePath.length <= 1) {
          return;
        }

        routePathLookupRef.current.set(tournee.id, routePath);
        routePathLookupChanged = true;
      };

      const drawStyledRoutePath = (
        path,
        color,
        strokeWeight,
        { geodesic = false, showDirection = false, zIndex = 1 } = {},
      ) => {
        if (path.length <= 1) {
          return;
        }

        addPolyline(path, {
          geodesic,
          strokeColor: color,
          strokeOpacity: 0.16,
          strokeWeight: strokeWeight + 10,
          zIndex,
        });
        addPolyline(path, {
          geodesic,
          strokeColor: color,
          strokeOpacity: 0.22,
          strokeWeight: strokeWeight + 4,
          zIndex: zIndex + 1,
        });
        addPolyline(path, {
          geodesic,
          icons: showDirection
            ? [
                {
                  icon: {
                    path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    fillColor: color,
                    fillOpacity: 1,
                    scale: 2.2,
                    strokeColor: "#ffffff",
                    strokeOpacity: 0.92,
                    strokeWeight: 1.4,
                  },
                  offset: "90px",
                  repeat: "210px",
                },
              ]
            : undefined,
          strokeColor: color,
          strokeOpacity: 0.96,
          strokeWeight,
          zIndex: zIndex + 2,
        });
      };

      const drawRoadRoute = async (
        pathPoints,
        color,
        strokeWeight,
        routeIndex,
        tournee,
      ) => {
        if (pathPoints.length <= 1) {
          return false;
        }

        const routeData = await getOsrmRouteData(pathPoints);
        const routePaths = routeData.paths;

        if (cancelled) {
          return true;
        }

        const legPaths = routeData.legPaths?.length
          ? routeData.legPaths
          : routePaths.map((path, segmentIndex) => ({
              path,
              to: segmentIndex + 1,
            }));

        legPaths.forEach((leg, segmentIndex) => {
          drawStyledRoutePath(leg.path, getRouteLegColor(pathPoints, leg.to, color), strokeWeight, {
            geodesic: false,
            showDirection: mapView !== "all",
            zIndex: 20 + routeIndex * 4 + segmentIndex,
          });
        });
        storeTourneeRoutePath(tournee, flattenRoutePaths(routePaths));

        if (mapView !== "all") {
          const metricAnchor = getRouteMetricAnchor(routePaths, pathPoints);
          const metricOverlay = createRouteMetricOverlay({
            maps,
            map,
            position: metricAnchor,
            distanceKm: routeData.distanceKm,
            durationSeconds: routeData.durationSeconds,
            zIndex: 80 + routeIndex,
          });

          if (metricOverlay) {
            mapMetricOverlaysRef.current.push(metricOverlay);
          }
        }

        return routePaths.length > 0;
      };

      const drawStraightRoute = (
        pathPoints,
        color,
        strokeWeight,
        routeIndex,
        tournee,
      ) => {
        const path = pathPoints.map((point) => ({
          lat: point.lat,
          lng: point.lng,
        }));

        for (let index = 0; index < path.length - 1; index += 1) {
          drawStyledRoutePath(
            [path[index], path[index + 1]],
            getRouteLegColor(pathPoints, index + 1, color),
            strokeWeight,
            {
              geodesic: true,
              showDirection: mapView !== "all",
              zIndex: 20 + routeIndex * 4 + index,
            },
          );
        }
        storeTourneeRoutePath(tournee, path);
      };

      const drawRouteWithRoadFallback = async (
        pathPoints,
        color,
        strokeWeight,
        routeIndex,
        tournee,
      ) => {
        if (pathPoints.length <= 1) {
          return true;
        }

        try {
          return await drawRoadRoute(
            pathPoints,
            color,
            strokeWeight,
            routeIndex,
            tournee,
          );
        } catch (err) {
          console.warn(err);
          drawStraightRoute(pathPoints, color, strokeWeight, routeIndex, tournee);
          return false;
        }
      };

      if (mapMode === "directions" && activeDirectionsTournee) {
        const color = getTourneeRouteColor(activeDirectionsTournee, 0);
        const route = getTourneeRoute(activeDirectionsTournee);

        addRouteMarkers(route, activeDirectionsTournee, color);
        route.pathPoints.forEach(extendBounds);

        const roadRouteDrawn = await drawRouteWithRoadFallback(
          route.pathPoints,
          color,
          6,
          0,
          activeDirectionsTournee,
        );

        if (!roadRouteDrawn && !cancelled) {
          setStatus({
            tone: "warning",
            message:
              "Le calcul routier est indisponible pour ce trajet. Un trace direct est affiche avec les arrets numerotes et cliquables.",
          });
        }

        if (hasBounds) {
          map.fitBounds(bounds, 52);
        }

        if (routePathLookupChanged && !cancelled) {
          setRoutePathVersion((version) => version + 1);
        }

        return;
      }

      let usedRoadRouteFailure = false;

      for (const [tourneeIndex, tournee] of visibleTournees.entries()) {
        const color = getTourneeRouteColor(tournee, tourneeIndex);
        const route = getTourneeRoute(tournee);

        route.pathPoints.forEach(extendBounds);

        const roadRouteDrawn = await drawRouteWithRoadFallback(
          route.pathPoints,
          color,
          mapView === "all" ? 4 : visibleTournees.length === 1 ? 6 : 5,
          tourneeIndex,
          tournee,
        );

        usedRoadRouteFailure = usedRoadRouteFailure || !roadRouteDrawn;

        if (mapView !== "all") {
          addRouteMarkers(route, tournee, color);
        }

        if (cancelled) {
          return;
        }
      }

      if (usedRoadRouteFailure && !cancelled) {
        setStatus({
          tone: "warning",
            message:
              mapView === "all"
              ? "Certains calculs routiers sont indisponibles. Un trace direct est affiche pour ces trajets."
              : "Certains calculs routiers sont indisponibles. Un trace direct est affiche pour ces trajets avec les arrets numerotes et cliquables.",
        });
      }

      if (hasBounds) {
        map.fitBounds(bounds, 52);
      }

      if (routePathLookupChanged && !cancelled) {
        setRoutePathVersion((version) => version + 1);
      }
    }

    drawMap().catch((err) => {
      console.error(err);
      setStatus({
        tone: "warning",
        message:
          "Carte Google indisponible. Verifiez la cle Google Maps du backend.",
      });
    });

    return () => {
      cancelled = true;
      clearMapOverlays();
    };
    // clearMapOverlays only touches map refs; redraw should track route inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDirectionsTournee, backendApiKey, mapMode, mapView, visibleTournees]);

  function clearMapOverlays() {
    if (mapInfoWindowRef.current) {
      mapInfoWindowRef.current.close();
    }

    clearRouteProgressOverlays();
    routePathLookupRef.current.clear();

    mapMarkersRef.current.forEach((marker) => marker.setMap(null));
    mapMarkersRef.current = [];
    mapMarkerLookupRef.current.clear();

    mapPolylinesRef.current.forEach((polyline) => polyline.setMap(null));
    mapPolylinesRef.current = [];

    mapMetricOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
    mapMetricOverlaysRef.current = [];
  }


  function clearRouteProgressOverlays() {
    mapProgressPolylinesRef.current.forEach((polyline) => polyline.setMap(null));
    mapProgressPolylinesRef.current = [];
  }


  function clearTrackingOverlays() {
    if (trackingInfoWindowRef.current) {
      trackingInfoWindowRef.current.close();
    }

    trackingMarkersRef.current.forEach((marker) => marker.setMap(null));
    trackingMarkersRef.current = [];

    trackingPolylinesRef.current.forEach((polyline) => polyline.setMap(null));
    trackingPolylinesRef.current = [];
  }

  function fitTrackingLayer() {
    const maps = mapsRef.current;
    const map = mapRef.current;

    if (!maps || !map) return;

    const bounds = new maps.LatLngBounds();
    let hasBounds = false;

    const add = (position) => {
      if (!position) return;
      bounds.extend(position);
      hasBounds = true;
    };

    visibleTrackingCouriers.map(getTrackingPosition).forEach(add);
    selectedTrackingPoints.map(getTrackingPosition).forEach(add);

    if (!hasBounds) {
      setStatus({
        tone: "warning",
        message: "Aucune position GPS livreur a centrer.",
      });
      return;
    }

    map.fitBounds(bounds, 70);
  }

  function focusTrackingCourier(courier) {
    setSelectedTrackingCourier(courier);

    const position = getTrackingPosition(courier);
    const map = mapRef.current;

    if (!position || !map) {
      return;
    }

    map.panTo(position);
    map.setZoom(Math.max(map.getZoom() || 0, 15));
  }

  function closeTrackingHistory() {
    setSelectedTrackingCourier(null);
    setSelectedTrackingPoints([]);
    if (trackingInfoWindowRef.current) {
      trackingInfoWindowRef.current.close();
    }
  }

  async function loadAcceptedTournees({
    silent = false,
    shouldApply = () => true,
  } = {}) {
    try {
      if (!silent) {
        setAcceptedLoading(true);
      }
      setAcceptedError("");

      const data = await tourneeService.getAccepted();

      if (!shouldApply()) {
        return false;
      }

      const nextTournees = Array.isArray(data) ? data : [];
      setAcceptedTournees(nextTournees);
      setSelectedTournee((current) => {
        if (!current) {
          return null;
        }

        return nextTournees.find((tournee) => tournee.id === current.id) || null;
      });
      return true;
    } catch (err) {
      console.error(err);

      if (!shouldApply()) {
        return false;
      }

      setAcceptedError("Erreur chargement des tournees acceptees.");
      setAcceptedTournees([]);
      return false;
    } finally {
      if (shouldApply() && !silent) {
        setAcceptedLoading(false);
      }
    }
  }

  function selectAcceptedTournee(tournee) {
    const stopCount = countTourneeStops(tournee);

    setSelectedTournee(tournee);
    setSelectedCourierName("");
    setMapView("single");
    setStatus({
      tone: "success",
      message: `Tournee ${tournee.nom} affichee sur la carte avec ${stopCountLabel(
        stopCount,
      )}.`,
    });
  }

  function showAllRoutes() {
    setSelectedTournee(null);
    setSelectedCourierName("");
    setMapView("all");
    setStatus({
      tone: "success",
      message: `${acceptedTournees.length} trajet(s) accepte(s) affiches avec lignes routieres.`,
    });
  }

  async function refreshMapOnly() {
    if (mapRefreshing) {
      return;
    }

    setMapRefreshing(true);
    const tourneeOk = await loadAcceptedTournees({ silent: true });
    const trackingOk = trackingEnabled
      ? await loadLiveCouriers({ silent: true })
      : true;
    setMapRefreshing(false);

    setStatus({
      tone: tourneeOk && trackingOk ? "success" : "warning",
      message:
        tourneeOk && trackingOk
          ? "Carte rafraichie."
          : "Carte partiellement rafraichie. Verifiez la connexion ou reessayez.",
    });
  }

  function handleOpenVisibleInGoogleMaps() {
    if (visibleOpenMapsUrls.length === 0) {
      setStatus({
        tone: "warning",
        message: "Aucun trajet avec coordonnees completes a ouvrir.",
      });
      return;
    }

    const urlsToOpen = visibleOpenMapsUrls.slice(0, MAX_GOOGLE_MAPS_TABS);
    urlsToOpen.forEach((url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    });

    if (visibleOpenMapsUrls.length > MAX_GOOGLE_MAPS_TABS) {
      setStatus({
        tone: "warning",
        message: `Google Maps a ouvert les ${MAX_GOOGLE_MAPS_TABS} premiers trajets. Filtrez par livreur pour ouvrir les autres plus proprement.`,
      });
      return;
    }

    setStatus({
      tone: "success",
      message:
        visibleOpenMapsUrls.length === 1
          ? "Trajet ouvert dans Google Maps."
          : `${visibleOpenMapsUrls.length} trajets ouverts dans Google Maps.`,
    });
  }

  function selectCourier(event) {
    const nextCourierName = event.target.value;
    setSelectedTournee(null);
    setSelectedCourierName(nextCourierName);

    if (!nextCourierName) {
      setMapView("empty");
      setStatus(EMPTY_STATUS);
      return;
    }

    const courierTournees = acceptedTournees.filter(
      (tournee) => getCourierName(tournee) === nextCourierName,
    );
    const stopCount = courierTournees.reduce(
      (total, tournee) => total + countTourneeStops(tournee),
      0,
    );

    setMapView("courier");
    setStatus({
      tone: "success",
      message: `${nextCourierName}: ${courierTournees.length} trajet(s), ${stopCountLabel(
        stopCount,
      )} affiches sur la carte.`,
    });
  }

  function focusStepOnMap(step) {
    if (!step?.markerKey || step.kind !== "stop") {
      return;
    }

    const marker = mapMarkerLookupRef.current.get(step.markerKey);

    if (!marker?.routePlannerFocus) {
      setStatus({
        tone: "warning",
        message: "La carte charge encore ce point. Reessayez dans un instant.",
      });
      return;
    }

    mapDivRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    window.setTimeout(() => {
      marker.routePlannerFocus();
    }, 220);

    setStatus({
      tone: "success",
      message: `Arret ${step.markerLabel} affiche sur la carte.`,
    });
  }

  function handleTimelineKeyDown(event, step) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    focusStepOnMap(step);
  }

  return (
    <div className="routePlannerShell">
      <section className="routePlannerHero">
        <div>
          <div className="routePlannerEyebrow">Admin only</div>
          <h1 className="routePlannerTitle">Planification des tournees</h1>
          <p className="routePlannerLead">
            Les tournees acceptees sont affichees directement avec leurs
            coordonnees GPS. La vue globale garde des lignes routieres nettes,
            et les marqueurs numerotes restent disponibles par tournee ou livreur.
          </p>
        </div>

        <div className="routePlannerHeroActions">
          <button
            className="admDashBtn"
            type="button"
            onClick={() => loadAcceptedTournees()}
            disabled={acceptedLoading}
          >
            {acceptedLoading ? "Chargement..." : "Rafraichir tournees"}
          </button>
        </div>
      </section>

      <div className="routePlannerGrid">
        <div className="routePlannerSideColumn">
          <section className="routePlannerPanel routePlannerAcceptedPanel">
            <div className="routePlannerAcceptedHead">
              <div>
                <div className="routePlannerPreviewTitle">
                  Tournees acceptees
                </div>
                <div className="routePlannerHint">
                  Selectionnez une note, affichez tout, ou filtrez par livreur.
                </div>
              </div>
              <span className="routePlannerCountPill">
                {acceptedTournees.length}
              </span>
            </div>

            <div className="routePlannerAcceptedActions">
              <button
                className="admDashBtn"
                type="button"
                onClick={showAllRoutes}
                disabled={acceptedLoading || acceptedTournees.length === 0}
              >
                Afficher tous les trajets
              </button>

              <button
                className={`admDashBtn routePlannerTrackingToggle${trackingEnabled ? " isActive" : ""}`}
                type="button"
                onClick={() => setTrackingEnabled((value) => !value)}
              >
                {trackingEnabled
                  ? "Masquer tracking GPS"
                  : "Afficher tracking GPS"}
              </button>

              {trackingEnabled ? (
                <button
                  className="admDashBtn"
                  type="button"
                  onClick={fitTrackingLayer}
                  disabled={visibleTrackingCouriers.length === 0}
                >
                  Centrer GPS livreurs
                </button>
              ) : null}

              <label className="routePlannerCourierSelectWrap">
                <span>Liste deroulante des livreurs</span>
                <select
                  className="routePlannerCourierSelect"
                  value={selectedCourierName}
                  onChange={selectCourier}
                  disabled={acceptedLoading || courierNames.length === 0}
                >
                  <option value="">Choisir un livreur</option>
                  {courierNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {acceptedError ? (
              <div className="routePlannerStatus warning">{acceptedError}</div>
            ) : null}

            {acceptedLoading ? (
              <div className="routePlannerEmpty">
                Chargement des tournees acceptees...
              </div>
            ) : acceptedTournees.length === 0 ? (
              <div className="routePlannerEmpty">
                Aucune tournee acceptee pour le moment.
              </div>
            ) : (
              <div className="stickyTourneeGrid">
                {acceptedTournees.map((tournee) => {
                  const routeStops = countTourneeStops(tournee);
                  const courierName = getCourierName(tournee);
                  const isActive =
                    selectedTournee?.id === tournee.id ||
                    (mapView === "courier" &&
                      selectedCourierName &&
                      courierName === selectedCourierName);
                  const databaseDistance = formatNumber(tournee.distance_km, " km");

                  return (
                    <button
                      key={tournee.id}
                      className={`stickyTourneeNote${
                        isActive ? " isActive" : ""
                      }`}
                      type="button"
                      onClick={() => selectAcceptedTournee(tournee)}
                    >
                      <div className="stickyTourneeTop">
                        <span className="stickyTourneeCode">
                          TOUR-{String(tournee.id).padStart(3, "0")}
                        </span>
                        <span className="stickyTourneeTime">
                          {stopCountLabel(routeStops)}
                        </span>
                      </div>

                      <div className="stickyTourneeName">{tournee.nom}</div>

                      <div className="stickyTourneeBody">
                        Livreur {courierName}. Cette tournee contient{" "}
                        {formatNumber(tournee.nombre_colis)} colis pour{" "}
                        {formatNumber(tournee.poids_total, " kg")} avec un
                        trajet estime a {databaseDistance}.
                      </div>

                      <div className="stickyTourneeFoot">
                        <span className="stickyTourneeStatus">Acceptee</span>
                        <strong>{databaseDistance}</strong>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {trackingEnabled ? (
            <section className="routePlannerPanel routePlannerTrackingPanel">
              <div className="routePlannerPreviewHead">
                <div>
                  <div className="routePlannerPreviewTitle">Tracking GPS</div>
                  <div className="routePlannerHint">
                    Positions live des livreurs sur la carte.
                  </div>
                </div>
                <span className="routePlannerCountPill">
                  {trackingLiveCount}/{visibleTrackingCouriers.length}
                </span>
              </div>

              {liveLoading ? (
                <div className="routePlannerHint">
                  Chargement des positions GPS...
                </div>
              ) : null}

              {liveError ? (
                <div className="routePlannerStatus warning">{liveError}</div>
              ) : null}

              {selectedTrackingCourier ? (
                <div className="routePlannerSelectedBox">
                  <div className="routePlannerSelectedBoxHead">
                    <span>Livreur GPS selectionne</span>
                    <button
                      className="routePlannerTrackingClose"
                      type="button"
                      onClick={closeTrackingHistory}
                      aria-label="Fermer l'historique GPS"
                      title="Fermer l'historique GPS"
                    >
                      <X size={16} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  </div>
                  <strong>
                    {selectedTrackingCourier.courier_name || "Livreur"}
                  </strong>
                  <span>
                    {getTrackingStatusLabel(selectedTrackingCourier)} |{" "}
                    {formatTrackingDate(selectedTrackingCourier.recorded_at)}
                  </span>
                  <span>
                    Points trajet:{" "}
                    {trackingPointsLoading
                      ? "chargement..."
                      : selectedTrackingPoints.length}
                  </span>
                </div>
              ) : null}
              {visibleTrackingCouriers.length > 0 ? (
                <div className="routePlannerTrackingList" >
                  {visibleTrackingCouriers.map((courier) => {
                    const isActive =
                      selectedTrackingCourier?.courier_id === courier.courier_id;
                    const statusKind = getTrackingStatusKind(courier);

                    return (
                      <button
                        key={courier.courier_id}
                        className={`routePlannerTrackingCard${
                          isActive ? " isActive" : ""
                        }`}
                        type="button"
                        onClick={() => focusTrackingCourier(courier)}
                      >
                        <div className="routePlannerTrackingCardTop">
                          <strong>{courier.courier_name || "Livreur"}</strong>
                          <span
                            className={`routePlannerTrackingBadge ${statusKind}`}
                          >
                            {getTrackingStatusLabel(courier)}
                          </span>
                        </div>
                        <span>
                          Derniere position:{" "}
                          {formatTrackingDate(courier.recorded_at)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="routePlannerEmpty">
                  Aucun livreur GPS disponible pour cette vue.
                </div>
              )}
            </section>
          ) : null}
        </div>

        <section className="routePlannerMapColumn">
          <div className="routePlannerPanel routePlannerPreviewPanel">
            <div className="routePlannerPreviewHead">
              <div>
                <div className="routePlannerPreviewTitle">{previewTitle}</div>
                <div className="routePlannerHint">
                  {visibleTournees.length > 0
                    ? `${visibleTournees.length} trajet(s), ${stopCountLabel(
                        visibleStopCount,
                      )} sur la carte.`
                    : "Aucun trajet affiche pour le moment."}
                </div>
              </div>

              {selectedOpenMapsUrl ? (
                <a
                  className="routePlannerLink"
                  href={selectedOpenMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ouvrir dans Google Maps
                </a>
              ) : visibleOpenMapsUrls.length > 1 ? (
                <button
                  className="routePlannerLink routePlannerLinkButton"
                  type="button"
                  onClick={handleOpenVisibleInGoogleMaps}
                >
                  Ouvrir dans Google Maps
                </button>
              ) : null}
            </div>

            <div className="routePlannerSummary">
              <div className="routePlannerSummaryCard">
                <span>Trajets</span>
                <strong>{visibleTournees.length}</strong>
              </div>
              <div className="routePlannerSummaryCard">
                <span>Arrets</span>
                <strong>{visibleStopCount}</strong>
              </div>
              <div className="routePlannerSummaryCard routePlannerGpsSummaryCard">
                <span>GPS live</span>
                <strong>
                  {trackingEnabled
                    ? `${trackingLiveCount}/${visibleTrackingCouriers.length}`
                    : "Off"}
                </strong>
              </div>
              <button
                className="routePlannerSummaryCard routePlannerSummaryRefreshCard"
                type="button"
                onClick={refreshMapOnly}
                disabled={mapRefreshing}
              >
                <span>Carte</span>
                <strong>{mapRefreshing ? "En cours..." : "Rafraichir"}</strong>
              </button>
            </div>

            {backendApiKey ? (
              <div
                ref={mapDivRef}
                className="routePlannerFrame routePlannerGoogleMap"
                role="application"
                aria-label="Carte des trajets acceptes"
              />
            ) : (
              <div className="routePlannerPlaceholder">
                <div className="routePlannerPlaceholderTitle">
                  Carte Google indisponible
                </div>
                <div className="routePlannerPlaceholderText">
                  La cle Google Maps n est pas disponible depuis le backend.
                </div>
              </div>
            )}

            {visibleTournees.length > 0 ? (
              <div className="routePlannerLegend">
                {visibleTournees.map((tournee, index) => (
                  <span key={tournee.id} className="routePlannerLegendPill">
                    <span
                      aria-hidden="true"
                      style={{
                        background: getTourneeRouteColor(tournee, index),
                      }}
                    />
                    {tournee.nom}
                  </span>
                ))}
              </div>
            ) : null}



            {trackingEnabled && visibleTrackingCouriers.length > 0 ? (
              <div className="routePlannerLegend">
                {visibleTrackingCouriers.map((courier) => (
                  <span
                    key={courier.courier_id}
                    className="routePlannerLegendPill routePlannerTrackingLegend"
                  >
                    <span
                      aria-hidden="true"
                      style={{ background: getTrackingStatusColor(courier) }}
                    />
                    GPS {courier.courier_name || "Livreur"}
                  </span>
                ))}
              </div>
            ) : null}

            {trackingEnabled && selectedTrackingCourier ? (
              <div className="routePlannerTrackingTrailInfo">
                <strong>
                  {selectedTrackingCourier.courier_name || "Livreur"} -{" "}
                  {getTrackingStatusLabel(selectedTrackingCourier)}
                </strong>
                <div className="routePlannerTrackingTrailActions">
                  <span>
                    {trackingPointsLoading
                      ? "Chargement du trajet GPS..."
                      : `${selectedTrackingPoints.length} point(s) GPS`}
                  </span>
                  <button
                    className="routePlannerTrackingClose"
                    type="button"
                    onClick={closeTrackingHistory}
                    aria-label="Fermer l'historique GPS"
                    title="Fermer l'historique GPS"
                  >
                    <X size={16} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}

            <div className={`routePlannerStatus ${status.tone}`}>
              {status.message}
            </div>
          </div>
        </section>

        {selectedTournee ? (
          <section className="routePlannerPanel routePlannerDetailsPanel routePlannerDetailsPanelFull">
            <div className="routePlannerPreviewHead">
              <div>
                <div className="routePlannerPreviewTitle">
                  Details de la tournee
                </div>
                <div className="routePlannerHint">
                  Parcours accepte par l administrateur.
                </div>
              </div>
              <span className="routePlannerCountPill">
                {stopCountLabel(countTourneeStops(selectedTournee))}
              </span>
            </div>

            <div className="routePlannerDetailsGrid">
              <Info label="Livreur" value={getCourierName(selectedTournee)} />
              <Info
                label="Vehicule"
                value={`${selectedTournee.vehicle_name || "-"} | Capacite: ${
                  selectedTournee.vehicle_capacity || "-"
                } kg`}
              />
              <Info
                label="Colis"
                value={formatNumber(selectedTournee.nombre_colis)}
              />
              <Info
                label="Tracking"
                value={
                  selectedTrackingCourier &&
                  trackingCourierMatchesTournee(
                    selectedTrackingCourier,
                    selectedTournee,
                  )
                    ? `${getTrackingStatusLabel(
                        selectedTrackingCourier,
                      )} | ${formatTrackingDate(
                        selectedTrackingCourier.recorded_at,
                      )}`
                    : "Selectionnez le GPS du livreur"
                }
              />
            </div>

            <div className="routePlannerTimeline routePlannerTimelineFull">
              {selectedSteps.length > 0 ? (
                selectedSteps.map((step) => {
                  const isClickable = step.kind === "stop" && step.markerKey;

                  return (
                    <div
                      key={step.id}
                      className={`routePlannerTimelineRow${
                        isClickable ? " isClickable" : ""
                      }`}
                      role={isClickable ? "button" : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                      onClick={
                        isClickable ? () => focusStepOnMap(step) : undefined
                      }
                      onKeyDown={
                        isClickable
                          ? (event) => handleTimelineKeyDown(event, step)
                          : undefined
                      }
                    >
                      <span className="routePlannerTimelineNumber">
                        {step.markerLabel}
                      </span>
                      <div className="routePlannerTimelineCard">
                        <strong>{step.adresse}</strong>
                        {step.details ? <span>{step.details}</span> : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="routePlannerEmpty">
                  Aucun parcours disponible.
                </div>
              )}
            </div>

          </section>
        ) : null}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="routePlannerInfoBox">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}
