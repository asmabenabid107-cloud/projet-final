from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta, timezone
from app.db.session import get_db

from app.models.colis import Colis
from app.models.user import User

from app.models.tournee import (
    Tournee,
    TourneeColis
)

from app.services.tournee_ai_service import (
    DEPOTS,
    generate_tournees_ai
)

router = APIRouter(
    prefix="/admin/tournees",
    tags=["Admin Tournees"]
)


def serialize_tournee(t: Tournee):
    depot = DEPOTS.get(str(t.depot_depart or "").lower().strip()) or {}
    ordered_links = sorted(
        t.colis_items or [],
        key=lambda link: (link.ordre or 0, link.id or 0),
    )

    stops = []
    for link in ordered_links:
        colis = link.colis
        if not colis:
            continue

        stops.append({
            "ordre": link.ordre,
            "colis_id": colis.id,
            "numero_suivi": colis.numero_suivi,
            "adresse": colis.adresse_livraison,
            "latitude": colis.latitude,
            "longitude": colis.longitude,
            "poids": colis.poids,
            "nom_destinataire": colis.nom_destinataire,
            "telephone_destinataire": colis.telephone_destinataire,
            "statut": colis.statut,
            "tracking_stage": colis.tracking_stage,
            "delivery_issue_count": colis.delivery_issue_count,
            "last_delivery_issue_at": colis.last_delivery_issue_at,
            "last_delivery_issue_reason": colis.last_delivery_issue_reason,
            "delivered_at": colis.delivered_at,
            "returned_at": colis.returned_at,
            "distance_depuis_precedent": link.distance_depuis_precedent,
        })

    return {
        "id": t.id,
        "nom": t.nom,
        "region": t.region,
        "status": t.status,
        "cluster_ia": t.cluster_ia,
        "distance_km": t.distance_km,
        "poids_total": t.poids_total,
        "nombre_colis": t.nombre_colis,
        "parcours_text": t.parcours_text,
        "livreur_id": t.livreur_id,
        "livreur_name": t.livreur.name if t.livreur else "-",
        "vehicle_name": t.vehicle.name if t.vehicle else "-",
        "vehicle_min_capacity": t.vehicle_min_capacity,
        "vehicle_capacity": t.vehicle_capacity,
        "depot_depart": t.depot_depart,
        "depot_label": t.depot_label,
        "depot_adresse": t.depot_adresse,
        "execution_date": str(t.execution_date) if t.execution_date else None,
        "depot_latitude": depot.get("latitude"),
        "depot_longitude": depot.get("longitude"),
        "stops": stops,
    }


# ── Helpers ──────────────────────────────────────────────────────────────────

DAY_NAMES_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]

def _resolve_execution_date(execution_date_str: str | None) -> date:
    """
    Résout la date d'exécution depuis le query param.
    - None / vide  → demain (Tunisie UTC+1)
    - "today"      → aujourd'hui (Tunisie)
    - "YYYY-MM-DD" → date exacte
    """
    TZ_TUNISIA = timezone(timedelta(hours=1))
    today_tunisia = datetime.now(tz=TZ_TUNISIA).date()

    if not execution_date_str or execution_date_str.strip() == "":
        return today_tunisia

    val = execution_date_str.strip().lower()
    if val in ("today", "aujourd'hui"):
        return today_tunisia

    try:
        return date.fromisoformat(val)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"Format de date invalide: '{execution_date_str}'. Utilisez YYYY-MM-DD.",
        )


# ── Generate ──────────────────────────────────────────────────────────────────

@router.post("/generate-ai")
@router.post("/generate-ai/")
def generate_ai_tournees(
    db: Session = Depends(get_db),
    execution_date: str = Query(
        default=None,
        description="Date d'exécution YYYY-MM-DD. Par défaut = aujourd'hui (Tunisie).",
    ),
):
    try:
        target_date = _resolve_execution_date(execution_date)
        day_label   = DAY_NAMES_FR[target_date.weekday()]

        print(f"GENERATE-AI — exécution prévue: {day_label} {target_date}")

        # Supprimer les anciennes tournées non acceptées
        old_tournees = db.query(Tournee).filter(
            Tournee.status == "proposed",
            Tournee.execution_date == target_date,
        ).all()
        for old in old_tournees:
            db.delete(old)
        db.flush()

        # Générer en passant la date d'exécution
        ai_response = generate_tournees_ai(db, execution_date=target_date)

        if isinstance(ai_response, dict):
            results = ai_response.get("results", [])
            warnings = ai_response.get("warnings", [])
        else:
            results = ai_response
            warnings = []

        print("RESULTATS IA:", len(results))

        if not results:
            db.commit()
            return {
                "message": "Aucune tournée générée",
                "count": 0,
                "warnings": warnings,
                "execution_date": str(target_date),
                "execution_day": day_label,
            }

        for t in results:
            tournee = Tournee(
                nom=t["nom"],
                region=t["region"],
                status="proposed",
                generated_by="ia",
                execution_date=target_date,
                distance_km=t["distance_km"],
                poids_total=t["poids_total"],
                livreur_id=t["livreur_id"],
                vehicle_id=t["vehicle_id"],
                cluster_ia=t.get("cluster_ia", 0),
                nombre_colis=t.get("nombre_colis", len(t["colis"])),
                parcours_text=t.get("parcours_text", ""),
                vehicle_min_capacity=t.get("vehicle_min_capacity", 0),
                vehicle_capacity=t.get("vehicle_capacity", 300),
                depot_depart=t.get("depot_depart"),
                depot_label=t.get("depot_label"),
                depot_adresse=t.get("depot_adresse"),
            )

            db.add(tournee)
            db.flush()

            for c in t["colis"]:
                db.add(TourneeColis(
                    tournee_id=tournee.id,
                    colis_id=c["colis_id"],
                    ordre=c["ordre"],
                    distance_depuis_precedent=c.get("distance_depuis_precedent", 0),
                ))

        db.commit()

        return {
            "message": f"Tournées IA générées pour {day_label} {target_date}",
            "count": len(results),
            "warnings": warnings,
            "execution_date": str(target_date),
            "execution_day": day_label,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("ERREUR GENERATION IA:", e)
        raise HTTPException(
            status_code=500,
            detail=f"Erreur génération IA: {str(e)}"
        )


# ── GET all ───────────────────────────────────────────────────────────────────

@router.get("")
@router.get("/")
def get_tournees(
    db: Session = Depends(get_db),
    execution_date: str = Query(default=None),
):
    target_date = _resolve_execution_date(execution_date)

    tournees = (
        db.query(Tournee)
        .filter(Tournee.execution_date == target_date)
        .order_by(Tournee.id.desc())
        .all()
    )

    return [serialize_tournee(t) for t in tournees]


# ── GET restants ──────────────────────────────────────────────────────────────
@router.get("/restants")
@router.get("/restants/")
def get_restants_colis(
    db: Session = Depends(get_db),
    execution_date: str = Query(default=None),
):
    target_date = _resolve_execution_date(execution_date)

    try:
        colis_lies_ids = (
            db.query(TourneeColis.colis_id)
            .join(Tournee, Tournee.id == TourneeColis.tournee_id)
            .filter(
                Tournee.status != "refused",
                Tournee.execution_date == target_date,
            )
            .subquery()
        )

        restants = (
            db.query(Colis)
            .join(User, Colis.shipper_id == User.id)
            .filter(
                Colis.statut == "en_attente",
                User.role == "shipper",
                User.email != "admin@mz.com",
                ~Colis.id.in_(colis_lies_ids),
            )
            .order_by(Colis.gouvernorat, Colis.delegation, Colis.id)
            .all()
        )

        grouped = {}

        for c in restants:
            region = c.gouvernorat or "Sans Région"

            if region not in grouped:
                grouped[region] = {
                    "region": region,
                    "count": 0,
                    "poids_total": 0,
                    "colis": [],
                }

            grouped[region]["count"] += 1
            grouped[region]["poids_total"] += float(c.poids or 0)
            grouped[region]["colis"].append({
                "id": c.id,
                "numero_suivi": c.numero_suivi,
                "nom_destinataire": c.nom_destinataire,
                "telephone_destinataire": c.telephone_destinataire,
                "adresse_livraison": c.adresse_livraison,
                "gouvernorat": c.gouvernorat,
                "delegation": c.delegation,
                "rue": c.rue,
                "poids": c.poids,
            })

        result = []

        for item in grouped.values():
            item["poids_total"] = round(item["poids_total"], 1)
            result.append(item)

        return result

    except Exception as e:
        print("ERREUR GET RESTANTS:", repr(e))
        raise HTTPException(
            status_code=500,
            detail=f"Erreur restants: {str(e)}"
        )













# ── Accept ────────────────────────────────────────────────────────────────────

@router.post("/{tournee_id}/accept")
def accept_tournee(tournee_id: int, db: Session = Depends(get_db)):
    tournee = db.query(Tournee).filter(Tournee.id == tournee_id).first()
    if not tournee:
        raise HTTPException(status_code=404, detail="Tournée introuvable")

    now = datetime.utcnow()
    tournee.status = "accepted"

    for link in tournee.colis_items:
        if link.colis:
            link.colis.admin_note    = "accepte"
            link.colis.admin_note_at = now
            link.colis.statut        = "en_transit"

    db.commit()
    return {"message": "Tournée acceptée"}


# ── Refuse ────────────────────────────────────────────────────────────────────

@router.post("/{tournee_id}/refuse")
@router.post("/{tournee_id}/refuse/")
def refuse_tournee(
    tournee_id: int,
    payload: dict = None,
    db: Session = Depends(get_db)
):
    tournee = db.query(Tournee).filter(Tournee.id == tournee_id).first()

    if not tournee:
        raise HTTPException(status_code=404, detail="Tournée introuvable")

    reason = (payload or {}).get("reason") or "Proposition non adaptée"

    tournee.status = "refused"
    tournee.refuse_reason = reason

    db.commit()

    return {
        "message": "Tournée refusée",
        "reason": reason,
    }


# ── GET accepted ──────────────────────────────────────────────────────────────

@router.get("/accepted")
@router.get("/accepted/")
def get_accepted_tournees(db: Session = Depends(get_db)):
    tournees = db.query(Tournee).filter(Tournee.status == "accepted").all()
    return [serialize_tournee(t) for t in tournees]
