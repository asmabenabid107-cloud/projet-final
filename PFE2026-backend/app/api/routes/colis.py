# app/api/routes/colis.py
from datetime import datetime
from typing import List
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.colis_codes import generate_barcode_value, generate_tracking_number
from app.core.colis_events import add_created_event, add_status_event
from app.db.session import get_db
from app.models.colis import Colis
from app.models.colis_event import ColisEvent
from app.models.user import User
from app.schemas.colis import (
    ColisCreate,
    ColisNotificationResponse,
    ColisResponse,
    ColisUpdate,
)

router = APIRouter(prefix="/colis", tags=["colis"])


def _normalize_admin_note(note: str | None) -> str:
    raw = str(note or "").strip().lower()
    raw = unicodedata.normalize("NFD", raw)
    return "".join(char for char in raw if unicodedata.category(char) != "Mn")


def _is_admin_approved(note: str | None) -> bool:
    normalized = _normalize_admin_note(note)
    return normalized == "accepte" or "accept" in normalized


@router.get("/notifications", response_model=List[ColisNotificationResponse])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    rows = (
        db.query(ColisEvent, Colis)
        .join(Colis, Colis.id == ColisEvent.colis_id)
        .filter(
            Colis.shipper_id == current_user.id,
            ColisEvent.is_notification == True,
            ColisEvent.read_at.is_(None),
            or_(ColisEvent.expires_at.is_(None), ColisEvent.expires_at > now),
        )
        .order_by(ColisEvent.event_at.desc())
        .all()
    )

    return [
        {
            "id": event.id,
            "colis_id": colis.id,
            "numero_suivi": colis.numero_suivi,
            "nom_destinataire": colis.nom_destinataire,
            "kind": event.kind,
            "title": event.title,
            "note": event.note,
            "date": event.event_at,
            "expires_at": event.expires_at,
            "is_read": event.read_at is not None,
        }
        for event, colis in rows
    ]


@router.post("/notifications/read-all")
def read_all_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    events = (
        db.query(ColisEvent)
        .join(Colis, Colis.id == ColisEvent.colis_id)
        .filter(
            Colis.shipper_id == current_user.id,
            ColisEvent.is_notification == True,
            ColisEvent.read_at.is_(None),
            or_(ColisEvent.expires_at.is_(None), ColisEvent.expires_at > now),
        )
        .all()
    )

    for event in events:
        event.read_at = now

    db.commit()
    return {"updated": len(events)}


@router.post("/notifications/{event_id}/read")
def read_notification(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = (
        db.query(ColisEvent)
        .join(Colis, Colis.id == ColisEvent.colis_id)
        .filter(
            ColisEvent.id == event_id,
            Colis.shipper_id == current_user.id,
            ColisEvent.is_notification == True,
        )
        .first()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Notification introuvable")

    if event.read_at is None:
        event.read_at = datetime.utcnow()
        db.commit()

    return {"detail": "Notification marquee comme lue"}


@router.get("", response_model=List[ColisResponse])
def get_all_colis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Colis)
        .options(selectinload(Colis.history))
        .filter(Colis.shipper_id == current_user.id)
        .all()
    )


@router.get("/{colis_id}", response_model=ColisResponse)
def get_colis(
    colis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    colis = (
        db.query(Colis)
        .options(selectinload(Colis.history))
        .filter(Colis.id == colis_id, Colis.shipper_id == current_user.id)
        .first()
    )
    if not colis:
        raise HTTPException(status_code=404, detail="Colis non trouve")
    return colis


@router.post("", response_model=ColisResponse, status_code=status.HTTP_201_CREATED)
def create_colis(
    colis_data: ColisCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy.exc import IntegrityError

    numero = colis_data.numero_suivi or generate_tracking_number()
    barcode = generate_barcode_value()

    for _ in range(5):
        exists = (
            db.query(Colis)
            .filter(
                or_(
                    Colis.numero_suivi == numero,
                    Colis.barcode_value == barcode,
                )
            )
            .first()
        )
        if not exists:
            break
        numero = generate_tracking_number()
        barcode = generate_barcode_value()
    else:
        raise HTTPException(status_code=500, detail="Impossible de generer un code colis unique")

    payload = colis_data.model_dump()
    payload["zone"] = payload.get("zone") or payload.get("gouvernorat")
    payload["numero_suivi"] = numero
    payload["barcode_value"] = barcode
    payload["statut"] = "en_attente"
    payload["tracking_stage"] = "pending_pickup"
    payload["ouvrir_colis"] = current_user.ouvrir_colis_par_defaut or "non"

    colis = Colis(**payload, shipper_id=current_user.id)

    try:
        db.add(colis)
        db.flush()
        add_created_event(db, colis, event_at=colis.created_at)
        db.commit()
        db.refresh(colis)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Numero de suivi ou code barre deja utilise")
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))

    return colis


@router.put("/{colis_id}", response_model=ColisResponse)
def update_colis(
    colis_id: int,
    colis_data: ColisUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    colis = (
        db.query(Colis)
        .filter(Colis.id == colis_id, Colis.shipper_id == current_user.id)
        .first()
    )
    if not colis:
        raise HTTPException(status_code=404, detail="Colis non trouve")
    if _is_admin_approved(colis.admin_note):
        raise HTTPException(status_code=400, detail="Ce colis a deja ete accepte par l admin et ne peut plus etre modifie")

    update_data = colis_data.model_dump(exclude_unset=True)

    update_data.pop("statut", None)

    if "gouvernorat" in update_data:
        update_data["zone"] = update_data.get("zone") or update_data.get("gouvernorat")
    for key, value in update_data.items():
        setattr(colis, key, value)

    db.commit()
    db.refresh(colis)
    return colis


@router.delete("/{colis_id}", status_code=status.HTTP_200_OK)
def delete_colis(
    colis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    colis = (
        db.query(Colis)
        .filter(Colis.id == colis_id, Colis.shipper_id == current_user.id)
        .first()
    )
    if not colis:
        raise HTTPException(status_code=404, detail="Colis non trouve")
    if _is_admin_approved(colis.admin_note):
        raise HTTPException(status_code=400, detail="Ce colis a deja ete accepte par l admin et ne peut plus etre supprime")

    db.delete(colis)
    db.commit()
    return {"message": "Deleted"}
