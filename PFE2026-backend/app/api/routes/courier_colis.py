from datetime import date, datetime
from urllib.parse import parse_qs, unquote, urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_courier
from app.core.colis_events import (
    add_courier_call_event,
    add_delivery_event,
    add_delivery_issue_event,
    add_out_for_delivery_event,
    add_pickup_event,
    add_return_pending_event,
    add_return_to_shipper_event,
    add_status_event,
    add_warehouse_received_event,
)
from app.db.session import get_db
from app.models.colis import Colis
from app.models.colis_event import ColisEvent
from app.models.tournee import Tournee, TourneeColis
from app.models.user import User
from app.schemas.colis import (
    ColisCourierAssignedItemResponse,
    ColisCourierActionResponse,
    ColisCourierHistoryItemResponse,
    ColisCourierScanActionRequest,
    ColisCourierScanRequest,
    ColisCourierUndeliveredItemResponse,
    ColisCourierUndeliveredRequest,
    ColisHistoryEventResponse,
)

router = APIRouter(prefix="/courier/colis", tags=["courier-colis"])

MAX_UNDELIVERED_DAYS = 3
RESCHEDULED_STATUS = "a_relivrer"
SCAN_LINK_SEGMENTS = {
    "scan",
    "scan-pickup",
    "scan-warehouse",
    "scan-route-progress",
}
DETAIL_LINK_SEGMENTS = {
    "colis",
    "colis-action",
    "colis-detail",
    "colis-details",
    "parcel",
    "parcels",
}
NOT_ASSIGNED_DETAIL = (
    "Ce colis n'est pas ton colis. Il n'a pas ete affecte a ton compte."
)
HISTORY_STATUS_LABELS = {
    "delivered": "Livre",
    "returned": "Retour expediteur",
    "rescheduled": "A relivrer",
}


def _extract_barcode_value(raw_value: str) -> str:
    value = (raw_value or "").strip()
    if not value:
        return ""

    parsed = urlparse(value)
    if parsed.query:
        query = parse_qs(parsed.query)
        for key in ("code", "barcode", "barcode_value", "numero_suivi"):
            values = query.get(key)
            if values and values[0].strip():
                return values[0].strip()

    segments = [
        unquote(segment).strip()
        for segment in parsed.path.split("/")
        if unquote(segment).strip()
    ]
    if segments:
        host = (parsed.netloc or "").lower()
        first_segment = segments[0].lower()
        known_hosts = SCAN_LINK_SEGMENTS | DETAIL_LINK_SEGMENTS
        if host in known_hosts:
            return segments[-1]
        if first_segment in known_hosts and len(segments) > 1:
            return segments[-1]

    return value


def _get_colis_by_barcode(db: Session, barcode_value: str) -> Colis:
    barcode = _extract_barcode_value(barcode_value)
    if not barcode:
        raise HTTPException(status_code=422, detail="QR ou code colis requis")

    colis = (
        db.query(Colis)
        .filter(or_(Colis.barcode_value == barcode, Colis.numero_suivi == barcode))
        .first()
    )
    if not colis:
        raise HTTPException(status_code=404, detail="Colis introuvable pour ce QR")
    return colis


def _is_colis_assigned_to_courier(
    db: Session,
    *,
    colis_id: int,
    courier_id: int,
) -> bool:
    return (
        db.query(TourneeColis.id)
        .join(Tournee, Tournee.id == TourneeColis.tournee_id)
        .filter(
            TourneeColis.colis_id == colis_id,
            Tournee.livreur_id == courier_id,
            Tournee.status == "accepted",
        )
        .first()
        is not None
    )


def _ensure_colis_assigned_to_courier(
    db: Session,
    colis: Colis,
    courier: User,
):
    if not _is_colis_assigned_to_courier(
        db,
        colis_id=colis.id,
        courier_id=courier.id,
    ):
        raise HTTPException(status_code=400, detail=NOT_ASSIGNED_DETAIL)


def _serialize_response(colis: Colis, detail: str) -> ColisCourierActionResponse:
    return ColisCourierActionResponse(
        id=colis.id,
        numero_suivi=colis.numero_suivi,
        barcode_value=colis.barcode_value,
        nom_destinataire=colis.nom_destinataire,
        telephone_destinataire=colis.telephone_destinataire,
        adresse_livraison=colis.adresse_livraison,
        poids=colis.poids,
        depot_depart=colis.depot_depart,
        statut=colis.statut,
        tracking_stage=colis.tracking_stage,
        detail=detail,
        picked_up_at=colis.picked_up_at,
        warehouse_received_at=colis.warehouse_received_at,
        out_for_delivery_at=colis.out_for_delivery_at,
        delivery_issue_count=colis.delivery_issue_count or 0,
        last_delivery_issue_at=colis.last_delivery_issue_at,
        last_delivery_issue_reason=colis.last_delivery_issue_reason,
        returned_at=colis.returned_at,
        delivered_at=colis.delivered_at,
    )


def _serialize_undelivered_item(colis: Colis) -> ColisCourierUndeliveredItemResponse:
    count = colis.delivery_issue_count or 0
    return ColisCourierUndeliveredItemResponse(
        id=colis.id,
        numero_suivi=colis.numero_suivi,
        barcode_value=colis.barcode_value,
        nom_destinataire=colis.nom_destinataire,
        adresse_livraison=colis.adresse_livraison,
        statut=colis.statut,
        tracking_stage=colis.tracking_stage,
        out_for_delivery_at=colis.out_for_delivery_at,
        delivery_issue_count=count,
        last_delivery_issue_at=colis.last_delivery_issue_at,
        last_delivery_issue_reason=colis.last_delivery_issue_reason,
        remaining_issue_days=max(MAX_UNDELIVERED_DAYS - count, 0),
        returned_at=colis.returned_at,
    )


def _serialize_assigned_item(link: TourneeColis) -> ColisCourierAssignedItemResponse | None:
    colis = link.colis
    tournee = link.tournee
    if not colis or not tournee:
        return None

    count = colis.delivery_issue_count or 0
    return ColisCourierAssignedItemResponse(
        id=colis.id,
        numero_suivi=colis.numero_suivi,
        barcode_value=colis.barcode_value,
        nom_destinataire=colis.nom_destinataire,
        telephone_destinataire=colis.telephone_destinataire,
        adresse_livraison=colis.adresse_livraison,
        poids=colis.poids,
        depot_depart=colis.depot_depart,
        latitude=colis.latitude,
        longitude=colis.longitude,
        statut=colis.statut,
        tracking_stage=colis.tracking_stage,
        detail="Colis affecte au livreur.",
        picked_up_at=colis.picked_up_at,
        warehouse_received_at=colis.warehouse_received_at,
        out_for_delivery_at=colis.out_for_delivery_at,
        delivery_issue_count=count,
        last_delivery_issue_at=colis.last_delivery_issue_at,
        last_delivery_issue_reason=colis.last_delivery_issue_reason,
        returned_at=colis.returned_at,
        delivered_at=colis.delivered_at,
        tournee_id=tournee.id,
        tournee_nom=tournee.nom,
        tournee_region=tournee.region,
        ordre=link.ordre or 0,
        remaining_issue_days=max(MAX_UNDELIVERED_DAYS - count, 0),
    )


def _normalized_text(value: str | None) -> str:
    return str(value or "").strip().lower()


def _history_status_for_colis(colis: Colis) -> str | None:
    statut = _normalized_text(colis.statut)
    stage = _normalized_text(colis.tracking_stage)
    issue_count = colis.delivery_issue_count or 0

    if (
        colis.returned_at is not None
        or stage in {"return_pending", "returned"}
        or "retour" in statut
    ):
        return "returned"

    if (
        colis.delivered_at is not None
        or stage == "delivered"
        or "livr" in statut
    ):
        return "delivered"

    if (
        colis.last_delivery_issue_at is not None
        or "relivr" in statut
        or "report" in statut
        or stage == "delivery_failed"
        or stage == "not_delivered"
        or (stage == "at_warehouse" and issue_count > 0)
    ):
        return "rescheduled"

    return None


def _history_date_for_colis(colis: Colis, history_status: str | None) -> datetime | None:
    if history_status == "returned":
        return (
            colis.returned_at
            or colis.last_delivery_issue_at
            or colis.out_for_delivery_at
            or colis.warehouse_received_at
            or colis.picked_up_at
        )

    if history_status == "delivered":
        return (
            colis.delivered_at
            or colis.out_for_delivery_at
            or colis.warehouse_received_at
            or colis.picked_up_at
        )

    if history_status == "rescheduled":
        return (
            colis.last_delivery_issue_at
            or colis.out_for_delivery_at
            or colis.warehouse_received_at
            or colis.picked_up_at
        )

    return None


def _serialize_history_item(
    link: TourneeColis,
) -> ColisCourierHistoryItemResponse | None:
    assigned_item = _serialize_assigned_item(link)
    colis = link.colis
    if assigned_item is None or colis is None:
        return None

    history_status = _history_status_for_colis(colis)
    if history_status is None:
        return None

    history_date = _history_date_for_colis(colis, history_status)

    return ColisCourierHistoryItemResponse(
        **assigned_item.model_dump(),
        history_status=history_status,
        history_label=HISTORY_STATUS_LABELS.get(history_status, "Historique"),
        history_date=history_date,
    )


def _parse_history_date_query(value: str | None, field_name: str) -> date | None:
    raw = str(value or "").strip()
    if not raw:
        return None

    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=(
                f"{field_name} invalide: '{raw}'. "
                "Utilise le format YYYY-MM-DD."
            ),
        )


def _history_matches_query(
    item: ColisCourierHistoryItemResponse,
    query: str,
) -> bool:
    haystack = " ".join(
        filter(
            None,
            [
                item.numero_suivi,
                item.barcode_value or "",
                item.nom_destinataire or "",
                item.adresse_livraison or "",
                item.tournee_nom or "",
                item.tournee_region or "",
                item.history_label,
            ],
        )
    ).lower()
    return query in haystack


def _is_returned(colis: Colis) -> bool:
    return colis.returned_at is not None or colis.tracking_stage == "returned" or colis.statut == "retour"


def _is_return_confirmed(colis: Colis) -> bool:
    return colis.returned_at is not None or colis.tracking_stage == "returned"


def _ensure_scannable_colis(colis: Colis):
    if colis.admin_note != "accepte":
        raise HTTPException(status_code=400, detail="Le colis doit etre accepte par l admin avant le scan livreur")
    if colis.delivered_at is not None or colis.statut == "livre":
        raise HTTPException(status_code=400, detail="Cette livraison est deja confirmee")
    if _is_returned(colis):
        raise HTTPException(status_code=400, detail="Ce colis a deja ete retourne a l expediteur")


def _ensure_route_ready(db: Session, colis: Colis, courier: User) -> bool:
    _ensure_scannable_colis(colis)

    happened_at = datetime.utcnow()
    changed = False

    if colis.picked_up_at is None:
        colis.picked_up_at = happened_at
        colis.picked_up_by_courier_id = courier.id
        colis.tracking_stage = "picked_up"
        add_pickup_event(db, colis, courier_name=courier.name, event_at=happened_at)
        changed = True

    if colis.warehouse_received_at is None:
        colis.warehouse_received_at = happened_at
        colis.warehouse_received_by_courier_id = courier.id
        colis.tracking_stage = "at_warehouse"
        add_warehouse_received_event(db, colis, courier_name=courier.name, event_at=happened_at)
        changed = True

    return changed


def _mark_out_for_delivery(db: Session, colis: Colis, courier: User) -> ColisCourierActionResponse:
    if colis.picked_up_at is None:
        raise HTTPException(status_code=400, detail="Le colis doit d abord etre recupere chez l expediteur")
    if colis.warehouse_received_at is None:
        raise HTTPException(status_code=400, detail="Le colis doit etre scanne a l entree du depot avant la sortie")
    if colis.delivered_at is not None or colis.statut == "livre":
        raise HTTPException(status_code=400, detail="Cette livraison est deja confirmee")
    if _is_returned(colis):
        raise HTTPException(status_code=400, detail="Ce colis a deja ete retourne a l expediteur")
    if colis.tracking_stage == "out_for_delivery":
        raise HTTPException(status_code=400, detail="La sortie du depot a deja ete enregistree")

    happened_at = datetime.utcnow()
    colis.out_for_delivery_at = happened_at
    colis.out_for_delivery_by_courier_id = courier.id
    colis.tracking_stage = "out_for_delivery"
    if colis.statut != "en_transit":
        colis.statut = "en_transit"
        add_status_event(
            db,
            colis,
            "en_transit",
            event_at=happened_at,
            note="Le colis a quitte le depot et est reparti en livraison.",
        )
    add_out_for_delivery_event(db, colis, courier_name=courier.name, event_at=happened_at)
    db.commit()
    db.refresh(colis)
    return _serialize_response(colis, "Colis sorti du depot pour la livraison.")


def _mark_delivered(db: Session, colis: Colis, courier: User) -> ColisCourierActionResponse:
    if colis.picked_up_at is None:
        raise HTTPException(status_code=400, detail="Le colis doit d abord etre recupere chez l expediteur")
    if colis.warehouse_received_at is None:
        raise HTTPException(status_code=400, detail="Le colis doit etre scanne au depot avant la livraison")
    if colis.delivered_at is not None or colis.statut == "livre":
        raise HTTPException(status_code=400, detail="Cette livraison est deja confirmee")
    if _is_returned(colis):
        raise HTTPException(status_code=400, detail="Ce colis a deja ete retourne a l expediteur")
    if colis.tracking_stage != "out_for_delivery":
        raise HTTPException(status_code=400, detail="Le colis doit d abord etre marque en sortie depot")

    happened_at = datetime.utcnow()
    colis.delivered_at = happened_at
    colis.delivered_by_courier_id = courier.id
    colis.tracking_stage = "delivered"
    if colis.statut != "livre":
        colis.statut = "livre"
        add_status_event(
            db,
            colis,
            "livre",
            event_at=happened_at,
            note="Le colis a atteint sa destination finale.",
        )
    add_delivery_event(db, colis, courier_name=courier.name, event_at=happened_at)
    db.commit()
    db.refresh(colis)
    return _serialize_response(colis, "Livraison confirmee chez le destinataire.")


def _report_undelivered(
    db: Session,
    colis: Colis,
    courier: User,
    *,
    reason: str,
) -> ColisCourierActionResponse:
    clean_reason = (reason or "").strip()
    if len(clean_reason) < 3:
        raise HTTPException(status_code=422, detail="Le motif doit contenir au moins 3 caracteres")
    if colis.picked_up_at is None:
        raise HTTPException(status_code=400, detail="Le colis doit d abord etre recupere chez l expediteur")
    if colis.warehouse_received_at is None:
        raise HTTPException(status_code=400, detail="Le colis doit etre scanne au depot avant la livraison")
    if colis.delivered_at is not None or colis.statut == "livre":
        raise HTTPException(status_code=400, detail="Cette livraison est deja confirmee")
    if _is_returned(colis):
        raise HTTPException(status_code=400, detail="Ce colis a deja ete retourne a l expediteur")
    if colis.tracking_stage != "out_for_delivery":
        raise HTTPException(
            status_code=400,
            detail="Seuls les colis sortis du depot peuvent etre reportes au depot.",
        )

    happened_at = datetime.utcnow()
    day_number = (colis.delivery_issue_count or 0) + 1
    colis.delivery_issue_count = day_number
    colis.last_delivery_issue_at = happened_at
    colis.last_delivery_issue_reason = clean_reason

    add_delivery_issue_event(
        db,
        colis,
        reason=clean_reason,
        courier_name=courier.name,
        day_number=day_number,
        max_days=MAX_UNDELIVERED_DAYS,
        event_at=happened_at,
    )

    if day_number >= MAX_UNDELIVERED_DAYS:
        colis.tracking_stage = "return_pending"
        if colis.statut != "retour":
            colis.statut = "retour"
            add_status_event(
                db,
                colis,
                "retour",
                event_at=happened_at,
                note="Le colis a atteint 3 tentatives reportees et doit maintenant etre retourne a l expediteur.",
            )
        add_return_pending_event(db, colis, automatic=True, event_at=happened_at)
        detail = (
            "Motif enregistre. Le colis atteint 3 tentatives reportees et passe maintenant dans la liste retour expediteur."
        )
    else:
        colis.tracking_stage = "at_warehouse"
        if colis.statut != RESCHEDULED_STATUS:
            colis.statut = RESCHEDULED_STATUS
            add_status_event(
                db,
                colis,
                RESCHEDULED_STATUS,
                event_at=happened_at,
                note="Le colis est revenu au depot et sera a relivrer demain.",
            )
        detail = (
            f"Motif enregistre. Le colis revient au depot pour une nouvelle tentative demain ({day_number}/{MAX_UNDELIVERED_DAYS})."
        )

    db.commit()
    db.refresh(colis)
    return _serialize_response(colis, detail)


def _mark_return_pending(
    db: Session,
    colis: Colis,
    courier: User,
    *,
    reason: str,
) -> ColisCourierActionResponse:
    clean_reason = (reason or "").strip()
    if len(clean_reason) < 3:
        raise HTTPException(status_code=422, detail="Le motif doit contenir au moins 3 caracteres")
    if colis.picked_up_at is None:
        raise HTTPException(status_code=400, detail="Le colis doit d abord etre recupere chez l expediteur")
    if colis.warehouse_received_at is None:
        raise HTTPException(status_code=400, detail="Le colis doit etre scanne au depot avant le retour")
    if colis.delivered_at is not None or colis.statut == "livre":
        raise HTTPException(status_code=400, detail="Cette livraison est deja confirmee")
    if _is_return_confirmed(colis):
        raise HTTPException(status_code=400, detail="Le retour expediteur est deja confirme pour ce colis")
    if colis.tracking_stage == "return_pending":
        return _serialize_response(colis, "Ce colis est deja au depot pour retour expediteur.")

    happened_at = datetime.utcnow()
    colis.tracking_stage = "return_pending"
    if colis.statut != "retour":
        colis.statut = "retour"
        add_status_event(
            db,
            colis,
            "retour",
            event_at=happened_at,
            note="Le colis est au depot pour retour expediteur.",
        )
    add_return_pending_event(
        db,
        colis,
        courier_name=courier.name,
        reason=clean_reason,
        event_at=happened_at,
    )
    db.commit()
    db.refresh(colis)
    return _serialize_response(colis, "Retour expediteur enregistre. Le colis est au depot pour retour.")


def _confirm_return_to_shipper(
    db: Session,
    colis: Colis,
    courier: User,
) -> ColisCourierActionResponse:
    if colis.picked_up_at is None:
        raise HTTPException(status_code=400, detail="Le colis doit d abord etre recupere chez l expediteur")
    if colis.warehouse_received_at is None:
        raise HTTPException(status_code=400, detail="Le colis doit etre scanne au depot avant le retour")
    if colis.delivered_at is not None or colis.statut == "livre":
        raise HTTPException(status_code=400, detail="Cette livraison est deja confirmee")
    if _is_return_confirmed(colis):
        raise HTTPException(status_code=400, detail="Le retour expediteur est deja confirme pour ce colis")
    if colis.tracking_stage != "return_pending":
        raise HTTPException(
            status_code=400,
            detail="Ce colis n est pas encore pret pour un retour expediteur.",
        )

    happened_at = datetime.utcnow()
    colis.returned_at = happened_at
    colis.tracking_stage = "returned"
    if colis.statut != "retour":
        colis.statut = "retour"
        add_status_event(
            db,
            colis,
            "retour",
            event_at=happened_at,
            note="Le colis a ete remis a l expediteur.",
        )
    add_return_to_shipper_event(
        db,
        colis,
        courier_name=courier.name,
        event_at=happened_at,
    )
    db.commit()
    db.refresh(colis)
    return _serialize_response(colis, "Retour expediteur confirme.")


def _mark_scan_action(
    db: Session,
    colis: Colis,
    courier: User,
    *,
    action: str,
    reason: str | None = None,
) -> ColisCourierActionResponse:
    _ensure_colis_assigned_to_courier(db, colis, courier)

    if action == "return_pending" and colis.tracking_stage == "return_pending":
        return _serialize_response(colis, "Ce colis est deja au depot pour retour expediteur.")

    _ensure_route_ready(db, colis, courier)

    if action == "in_transit":
        if colis.tracking_stage == "out_for_delivery":
            return _serialize_response(colis, "Colis deja en transit vers le destinataire.")
        return _mark_out_for_delivery(db, colis, courier)

    if action == "delivered":
        if colis.tracking_stage != "out_for_delivery":
            _mark_out_for_delivery(db, colis, courier)
            db.refresh(colis)
        return _mark_delivered(db, colis, courier)

    if action == "not_delivered":
        if colis.tracking_stage != "out_for_delivery":
            _mark_out_for_delivery(db, colis, courier)
            db.refresh(colis)
        return _report_undelivered(db, colis, courier, reason=reason or "")

    if action == "return_pending":
        return _mark_return_pending(db, colis, courier, reason=reason or "")

    raise HTTPException(status_code=422, detail="Action de scan inconnue")


@router.get("/undelivered", response_model=list[ColisCourierUndeliveredItemResponse])
def list_undelivered_colis(
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    _ = courier
    rows = (
        db.query(Colis)
        .filter(
            Colis.picked_up_at.isnot(None),
            Colis.warehouse_received_at.isnot(None),
            Colis.delivered_at.is_(None),
            Colis.returned_at.is_(None),
            Colis.tracking_stage == "out_for_delivery",
        )
        .order_by(Colis.out_for_delivery_at.asc(), Colis.id.asc())
        .all()
    )
    return [_serialize_undelivered_item(colis) for colis in rows]


@router.get("/assigned", response_model=list[ColisCourierAssignedItemResponse])
def list_assigned_colis(
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    rows = (
        db.query(TourneeColis)
        .join(Tournee, Tournee.id == TourneeColis.tournee_id)
        .join(Colis, Colis.id == TourneeColis.colis_id)
        .filter(
            Tournee.status == "accepted",
            Tournee.livreur_id == courier.id,
        )
        .order_by(
            Tournee.created_at.desc(),
            Tournee.id.desc(),
            TourneeColis.ordre.asc(),
            TourneeColis.id.asc(),
        )
        .all()
    )

    seen_colis_ids = set()
    result = []
    for link in rows:
        if link.colis_id in seen_colis_ids:
            continue
        item = _serialize_assigned_item(link)
        if item is None:
            continue
        seen_colis_ids.add(link.colis_id)
        result.append(item)
    return result


@router.get("/history", response_model=list[ColisCourierHistoryItemResponse])
def list_history_colis(
    q: str = Query(default=""),
    status: str = Query(default="all"),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    start_date = _parse_history_date_query(date_from, "date_from")
    end_date = _parse_history_date_query(date_to, "date_to")
    if start_date and end_date and end_date < start_date:
        raise HTTPException(
            status_code=422,
            detail="date_to doit etre superieure ou egale a date_from.",
        )

    status_filter = _normalized_text(status)
    if status_filter in {"", "all", "tous", "toutes"}:
        status_filter = "all"
    allowed_statuses = {"all", "delivered", "returned", "rescheduled"}
    if status_filter not in allowed_statuses:
        raise HTTPException(
            status_code=422,
            detail=(
                "Filtre status invalide. "
                "Valeurs acceptees: all, delivered, returned, rescheduled."
            ),
        )

    query = _normalized_text(q)
    rows = (
        db.query(TourneeColis)
        .join(Tournee, Tournee.id == TourneeColis.tournee_id)
        .join(Colis, Colis.id == TourneeColis.colis_id)
        .filter(
            Tournee.status == "accepted",
            Tournee.livreur_id == courier.id,
        )
        .order_by(
            Tournee.created_at.desc(),
            Tournee.id.desc(),
            TourneeColis.ordre.asc(),
            TourneeColis.id.asc(),
        )
        .all()
    )

    seen_colis_ids = set()
    result: list[ColisCourierHistoryItemResponse] = []
    for link in rows:
        if link.colis_id in seen_colis_ids:
            continue

        item = _serialize_history_item(link)
        seen_colis_ids.add(link.colis_id)
        if item is None:
            continue

        if status_filter != "all" and item.history_status != status_filter:
            continue

        if query and not _history_matches_query(item, query):
            continue

        history_dt = item.history_date
        history_day = history_dt.date() if history_dt is not None else None
        if start_date and (history_day is None or history_day < start_date):
            continue
        if end_date and (history_day is None or history_day > end_date):
            continue

        result.append(item)

    result.sort(
        key=lambda item: item.history_date or datetime.min,
        reverse=True,
    )
    return result[:limit]


@router.get("/{colis_id}/history", response_model=list[ColisHistoryEventResponse])
def get_colis_history(
    colis_id: int,
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    colis = (
        db.query(Colis)
        .options(selectinload(Colis.history))
        .filter(Colis.id == colis_id)
        .first()
    )
    if not colis:
        raise HTTPException(status_code=404, detail="Colis introuvable")

    _ensure_colis_assigned_to_courier(db, colis, courier)
    history = sorted(colis.history or [], key=lambda event: event.event_at or datetime.min)
    return history


@router.get("/not-delivered", response_model=list[ColisCourierUndeliveredItemResponse])
def list_not_delivered_colis(
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    _ = courier
    rows = (
        db.query(Colis)
        .filter(
            Colis.picked_up_at.isnot(None),
            Colis.warehouse_received_at.isnot(None),
            Colis.out_for_delivery_at.isnot(None),
            Colis.delivered_at.is_(None),
            Colis.returned_at.is_(None),
            Colis.tracking_stage != "return_pending",
        )
        .order_by(Colis.out_for_delivery_at.desc(), Colis.id.desc())
        .all()
    )
    return [_serialize_undelivered_item(colis) for colis in rows]


@router.get("/returned", response_model=list[ColisCourierUndeliveredItemResponse])
def list_returned_colis(
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    _ = courier
    rows = (
        db.query(Colis)
        .filter(
            or_(
                Colis.tracking_stage == "return_pending",
                Colis.returned_at.isnot(None),
                Colis.tracking_stage == "returned",
                Colis.statut == "retour",
            )
        )
        .order_by(Colis.returned_at.desc(), Colis.id.desc())
        .all()
    )
    return [_serialize_undelivered_item(colis) for colis in rows]


@router.post("/scan/pickup", response_model=ColisCourierActionResponse)
def pickup_colis(
    payload: ColisCourierScanRequest,
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    colis = _get_colis_by_barcode(db, payload.barcode_value)
    _ensure_colis_assigned_to_courier(db, colis, courier)
    if colis.admin_note != "accepte":
        raise HTTPException(status_code=400, detail="Le colis doit etre accepte par l admin avant la prise en charge")
    if colis.delivered_at is not None or colis.statut == "livre":
        raise HTTPException(status_code=400, detail="Ce colis est deja livre")
    if _is_returned(colis):
        raise HTTPException(status_code=400, detail="Ce colis a deja ete retourne a l expediteur")
    if colis.picked_up_at is not None:
        raise HTTPException(status_code=400, detail="Ce colis a deja ete pris en charge chez l expediteur")

    happened_at = datetime.utcnow()
    colis.picked_up_at = happened_at
    colis.picked_up_by_courier_id = courier.id
    colis.tracking_stage = "picked_up"
    add_pickup_event(db, colis, courier_name=courier.name, event_at=happened_at)
    db.commit()
    db.refresh(colis)
    return _serialize_response(colis, "Prise en charge enregistree.")


@router.post("/scan/warehouse", response_model=ColisCourierActionResponse)
def store_colis_in_warehouse(
    payload: ColisCourierScanRequest,
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    colis = _get_colis_by_barcode(db, payload.barcode_value)
    _ensure_colis_assigned_to_courier(db, colis, courier)
    if colis.picked_up_at is None:
        raise HTTPException(status_code=400, detail="Le colis doit d abord etre recupere chez l expediteur")
    if colis.delivered_at is not None or colis.statut == "livre":
        raise HTTPException(status_code=400, detail="Ce colis est deja livre")
    if _is_returned(colis):
        raise HTTPException(status_code=400, detail="Ce colis a deja ete retourne a l expediteur")
    if colis.warehouse_received_at is not None:
        raise HTTPException(status_code=400, detail="Ce colis est deja enregistre au depot")

    happened_at = datetime.utcnow()
    colis.warehouse_received_at = happened_at
    colis.warehouse_received_by_courier_id = courier.id
    colis.tracking_stage = "at_warehouse"
    add_warehouse_received_event(db, colis, courier_name=courier.name, event_at=happened_at)
    db.commit()
    db.refresh(colis)
    return _serialize_response(colis, "Colis enregistre au depot.")


@router.post("/scan/out-for-delivery", response_model=ColisCourierActionResponse)
def mark_out_for_delivery(
    payload: ColisCourierScanRequest,
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    colis = _get_colis_by_barcode(db, payload.barcode_value)
    _ensure_colis_assigned_to_courier(db, colis, courier)
    return _mark_out_for_delivery(db, colis, courier)


@router.post("/scan/deliver", response_model=ColisCourierActionResponse)
def mark_delivered(
    payload: ColisCourierScanRequest,
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    colis = _get_colis_by_barcode(db, payload.barcode_value)
    _ensure_colis_assigned_to_courier(db, colis, courier)
    return _mark_delivered(db, colis, courier)


@router.post("/{colis_id}/undelivered", response_model=ColisCourierActionResponse)
def report_undelivered_colis(
    colis_id: int,
    payload: ColisCourierUndeliveredRequest,
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    colis = db.query(Colis).filter(Colis.id == colis_id).first()
    if not colis:
        raise HTTPException(status_code=404, detail="Colis introuvable")
    _ensure_colis_assigned_to_courier(db, colis, courier)
    return _report_undelivered(db, colis, courier, reason=payload.reason)


@router.post("/{colis_id}/confirm-return", response_model=ColisCourierActionResponse)
def confirm_return_colis(
    colis_id: int,
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    colis = db.query(Colis).filter(Colis.id == colis_id).first()
    if not colis:
        raise HTTPException(status_code=404, detail="Colis introuvable")
    _ensure_colis_assigned_to_courier(db, colis, courier)
    return _confirm_return_to_shipper(db, colis, courier)


@router.post("/{colis_id}/call")
def record_recipient_call(
    colis_id: int,
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    colis = db.query(Colis).filter(Colis.id == colis_id).first()
    if not colis:
        raise HTTPException(status_code=404, detail="Colis introuvable")
    _ensure_colis_assigned_to_courier(db, colis, courier)

    if not (colis.telephone_destinataire or "").strip():
        raise HTTPException(
            status_code=422,
            detail="Aucun telephone destinataire n est disponible pour ce colis",
        )

    call_count = (
        db.query(ColisEvent)
        .filter(ColisEvent.colis_id == colis.id, ColisEvent.kind == "courier_call")
        .count()
        + 1
    )
    happened_at = datetime.utcnow()
    event = add_courier_call_event(
        db,
        colis,
        courier_name=courier.name,
        call_count=call_count,
        event_at=happened_at,
    )
    db.commit()
    db.refresh(event)
    return {
        "detail": f"Appel destinataire enregistre dans l historique ({call_count}).",
        "call_count": call_count,
        "event_id": event.id,
        "event_date": event.event_at,
    }


@router.post("/scan/return-shipper", response_model=ColisCourierActionResponse)
def confirm_return_colis_by_scan(
    payload: ColisCourierScanRequest,
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    colis = _get_colis_by_barcode(db, payload.barcode_value)
    _ensure_colis_assigned_to_courier(db, colis, courier)
    return _confirm_return_to_shipper(db, colis, courier)


@router.post("/scan/inspect", response_model=ColisCourierActionResponse)
def inspect_colis_by_scan(
    payload: ColisCourierScanRequest,
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    colis = _get_colis_by_barcode(db, payload.barcode_value)
    _ensure_colis_assigned_to_courier(db, colis, courier)
    return _serialize_response(colis, "Etat actuel du colis.")


@router.post("/scan/action", response_model=ColisCourierActionResponse)
def mark_colis_by_scan_action(
    payload: ColisCourierScanActionRequest,
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    colis = _get_colis_by_barcode(db, payload.barcode_value)
    return _mark_scan_action(
        db,
        colis,
        courier,
        action=payload.action,
        reason=payload.reason,
    )


@router.post("/scan/route-progress", response_model=ColisCourierActionResponse)
def advance_route_progress(
    payload: ColisCourierScanRequest,
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    colis = _get_colis_by_barcode(db, payload.barcode_value)
    _ensure_colis_assigned_to_courier(db, colis, courier)
    if colis.picked_up_at is None:
        raise HTTPException(status_code=400, detail="Le colis doit d abord etre recupere chez l expediteur")
    if colis.delivered_at is not None or colis.statut == "livre":
        raise HTTPException(status_code=400, detail="Cette livraison est deja confirmee")
    if _is_returned(colis):
        raise HTTPException(status_code=400, detail="Ce colis a deja ete retourne a l expediteur")

    if colis.tracking_stage == "at_warehouse":
        return _mark_out_for_delivery(db, colis, courier)

    if colis.tracking_stage == "out_for_delivery":
        return _mark_delivered(db, colis, courier)

    if colis.tracking_stage == "return_pending":
        raise HTTPException(
            status_code=400,
            detail="Ce colis a atteint la limite des tentatives. Utilise maintenant le retour expediteur.",
        )

    if colis.tracking_stage == "picked_up":
        raise HTTPException(status_code=400, detail="Le colis doit etre scanne au depot avant de poursuivre la livraison")

    raise HTTPException(status_code=400, detail="Le colis n est pas dans une etape compatible avec cette interface")
