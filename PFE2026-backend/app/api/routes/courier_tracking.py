from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_admin, require_courier
from app.db.session import get_db
from app.models.courier_location import CourierLiveLocation, CourierLocationPoint
from app.models.tournee import Tournee
from app.models.user import User
from app.schemas.courier_tracking import (
    AdminCourierLiveLocationOut,
    CourierLocationCreate,
    CourierLocationPointOut,
)

router = APIRouter(tags=["courier-tracking"])


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_datetime(value: datetime | None) -> datetime:
    if value is None:
        return _utc_now()
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _check_tournee_owner(db: Session, tournee_id: int | None, courier: User) -> None:
    if tournee_id is None:
        return

    tournee = (
        db.query(Tournee)
        .filter(Tournee.id == tournee_id, Tournee.livreur_id == courier.id)
        .first()
    )

    if not tournee:
        raise HTTPException(
            status_code=403,
            detail="Cette tournee n'est pas affectee a ce livreur",
        )


@router.post("/courier/tracking/location")
def save_courier_location(
    payload: CourierLocationCreate,
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    _check_tournee_owner(db, payload.tournee_id, courier)

    recorded_at = _normalize_datetime(payload.recorded_at)

    live = (
        db.query(CourierLiveLocation)
        .filter(CourierLiveLocation.courier_id == courier.id)
        .first()
    )

    if live is None:
        live = CourierLiveLocation(courier_id=courier.id)
        db.add(live)

    live.tournee_id = payload.tournee_id
    live.latitude = payload.latitude
    live.longitude = payload.longitude
    live.accuracy = payload.accuracy
    live.speed = payload.speed
    live.heading = payload.heading
    live.recorded_at = recorded_at
    live.updated_at = _utc_now()
    live.is_online = True

    point = CourierLocationPoint(
        courier_id=courier.id,
        tournee_id=payload.tournee_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy=payload.accuracy,
        speed=payload.speed,
        heading=payload.heading,
        recorded_at=recorded_at,
    )
    db.add(point)

    db.commit()
    db.refresh(live)

    return {
        "ok": True,
        "courier_id": courier.id,
        "latitude": live.latitude,
        "longitude": live.longitude,
        "is_online": live.is_online,
        "recorded_at": live.recorded_at,
    }


@router.post("/courier/tracking/offline")
def mark_courier_offline(
    db: Session = Depends(get_db),
    courier: User = Depends(require_courier),
):
    live = (
        db.query(CourierLiveLocation)
        .filter(CourierLiveLocation.courier_id == courier.id)
        .first()
    )

    if live:
        live.is_online = False
        live.updated_at = _utc_now()
        db.commit()

    return {"ok": True}


@router.get("/admin/tracking/live", response_model=list[AdminCourierLiveLocationOut])
def list_live_couriers(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    rows = (
        db.query(CourierLiveLocation, User)
        .join(User, User.id == CourierLiveLocation.courier_id)
        .order_by(CourierLiveLocation.updated_at.desc())
        .all()
    )

    return [
        {
            "courier_id": user.id,
            "courier_name": user.name,
            "courier_email": user.email,
            "tournee_id": live.tournee_id,
            "latitude": live.latitude,
            "longitude": live.longitude,
            "accuracy": live.accuracy,
            "speed": live.speed,
            "heading": live.heading,
            "is_online": live.is_online,
            "recorded_at": live.recorded_at,
            "updated_at": live.updated_at,
        }
        for live, user in rows
    ]


@router.get(
    "/admin/tracking/couriers/{courier_id}/points",
    response_model=list[CourierLocationPointOut],
)
def list_courier_points(
    courier_id: int,
    tournee_id: int | None = None,
    limit: int = Query(default=300, ge=1, le=2000),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    query = db.query(CourierLocationPoint).filter(
        CourierLocationPoint.courier_id == courier_id
    )

    if tournee_id is not None:
        query = query.filter(CourierLocationPoint.tournee_id == tournee_id)

    points = (
        query.order_by(CourierLocationPoint.recorded_at.desc())
        .limit(limit)
        .all()
    )

    return list(reversed(points))
