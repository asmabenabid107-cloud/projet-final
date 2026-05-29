from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.core.courier_state import (
    WEEKDAY_VALUES,
    is_contract_ended,
    set_manual_courier_state,
    sync_courier_state,
)
from app.core.email_service import send_courier_approved_email
from app.models.user import User
from app.schemas.user import CourierAdminUpdateRequest, CourierApproveRequest, UserOut

router = APIRouter()

DEPOT_OPTIONS = {"kairouan", "sousse"}
DAY_OFF_OPTIONS = set(WEEKDAY_VALUES)


def _clean_region(region: str) -> str:
    return (region or "").strip()


def _clean_depot(depot: str) -> str:
    normalized = (depot or "").strip().lower()

    if normalized not in DEPOT_OPTIONS:
        raise HTTPException(
            status_code=422,
            detail="Depot invalide. Choisis kairouan ou sousse",
        )

    return normalized


def _clean_day_off(day_off: str) -> str:
    normalized = (day_off or "").strip().lower()

    if normalized not in DAY_OFF_OPTIONS:
        raise HTTPException(
            status_code=422,
            detail="Jour de repos invalide",
        )

    return normalized


def _validate_contract_end_date(contract_end_date: date):
    if contract_end_date < date.today():
        raise HTTPException(status_code=422, detail="La date de fin de contrat doit etre future ou egale a aujourd'hui")


@router.get("/pending", response_model=list[UserOut])
def list_pending_couriers(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return (
        db.query(User)
        .filter(User.role == "courier", User.is_approved == False, User.is_active == True)
        .order_by(User.id.desc())
        .all()
    )


@router.get("/approved", response_model=list[UserOut])
def list_approved_couriers(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    couriers = (
        db.query(User)
        .filter(User.role == "courier", User.is_approved == True)
        .order_by(User.id.desc())
        .all()
    )

    changed = False
    for courier in couriers:
        changed = sync_courier_state(db, courier) or changed

    if changed:
        db.commit()

    return couriers


@router.post("/{courier_id}/approve")
def approve_courier(
    courier_id: int,
    payload: CourierApproveRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    courier = db.query(User).filter(User.id == courier_id, User.role == "courier").first()
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")

    region = _clean_region(payload.assigned_region)
    if not region:
        raise HTTPException(status_code=422, detail="Region requise")

    depot = _clean_depot(payload.assigned_depot)
    day_off = _clean_day_off(payload.day_off)

    _validate_contract_end_date(payload.contract_end_date)

    courier.is_approved = True
    courier.assigned_region = region
    courier.assigned_depot = depot
    courier.contract_end_date = payload.contract_end_date
    courier.day_off = day_off
    set_manual_courier_state(courier, "active")
    sync_courier_state(db, courier)
    db.commit()
    db.refresh(courier)

    send_courier_approved_email(courier.email, courier.name)

    return {
        "message": "Approved",
        "assigned_region": courier.assigned_region,
        "assigned_depot": courier.assigned_depot,
        "courier_status": courier.courier_status,
        "contract_end_date": courier.contract_end_date,
        "day_off": courier.day_off,
    }


@router.patch("/{courier_id}", response_model=UserOut)
def update_courier_admin_details(
    courier_id: int,
    payload: CourierAdminUpdateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    courier = db.query(User).filter(User.id == courier_id, User.role == "courier").first()
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")

    if not courier.is_approved:
        raise HTTPException(status_code=400, detail="Le livreur doit etre approuve avant modification")

    if payload.assigned_region is not None:
        region = _clean_region(payload.assigned_region)
        if not region:
            raise HTTPException(status_code=422, detail="Region requise")
        courier.assigned_region = region

    if payload.assigned_depot is not None:
        courier.assigned_depot = _clean_depot(payload.assigned_depot)

    if payload.contract_end_date is not None:
        _validate_contract_end_date(payload.contract_end_date)
        courier.contract_end_date = payload.contract_end_date

    if payload.day_off is not None:
        courier.day_off = _clean_day_off(payload.day_off)

    if payload.courier_status is not None:
        if payload.courier_status == "active" and not courier.assigned_region:
            raise HTTPException(status_code=422, detail="Une region doit etre assignee avant activation")
        if payload.courier_status == "active" and not courier.assigned_depot:
            raise HTTPException(status_code=422, detail="Un depot doit etre assigne avant activation")
        if payload.courier_status != "contract_ended" and is_contract_ended(courier):
            raise HTTPException(
                status_code=422,
                detail="Choisis une nouvelle date de fin de contrat future pour renouveler le contrat",
            )
        set_manual_courier_state(courier, payload.courier_status)

    sync_courier_state(db, courier)
    db.commit()
    db.refresh(courier)
    return courier


@router.post("/{courier_id}/reject")
def reject_courier(
    courier_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    courier = db.query(User).filter(User.id == courier_id, User.role == "courier").first()
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")

    courier.is_approved = False
    courier.is_active = False
    courier.assigned_region = None
    courier.assigned_depot = None
    courier.courier_status = None
    courier.manual_courier_status = None
    courier.contract_end_date = None
    courier.day_off = None
    db.commit()

    return {"message": "Rejected"}


@router.delete("/{courier_id}")
def delete_courier(
    courier_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    courier = db.query(User).filter(User.id == courier_id, User.role == "courier").first()
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")

    db.delete(courier)
    db.commit()
    return {"message": "Deleted"}
