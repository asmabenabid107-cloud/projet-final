from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.courier_state import sync_courier_state
from app.models.courier_leave_request import CourierLeaveRequest
from app.models.user import User
from app.schemas.courier_leave import CourierLeaveCreateRequest, CourierLeaveRequestOut

router = APIRouter()


def _serialize_leave_request(item: CourierLeaveRequest) -> CourierLeaveRequestOut:
    return CourierLeaveRequestOut(
        id=item.id,
        courier_id=item.courier_id,
        courier_name=item.courier.name if item.courier else None,
        courier_email=item.courier.email if item.courier else None,
        start_date=item.start_date,
        end_date=item.end_date,
        description_conge=item.description_conge,
        status=item.status,
        denial_reason=item.denial_reason,
        requested_at=item.requested_at,
        reviewed_at=item.reviewed_at,
    )


def _require_courier_account(user: User) -> User:
    if user.role != "courier":
        raise HTTPException(status_code=403, detail="Acces livreur requis")
    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Compte livreur non approuve")
    if user.courier_status == "contract_ended":
        raise HTTPException(status_code=403, detail="Contrat livreur termine")
    return user


@router.get("/courier/leaves", response_model=list[CourierLeaveRequestOut])
def list_my_leave_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    courier = _require_courier_account(current_user)
    requests = (
        db.query(CourierLeaveRequest)
        .filter(CourierLeaveRequest.courier_id == courier.id)
        .order_by(CourierLeaveRequest.requested_at.desc(), CourierLeaveRequest.id.desc())
        .all()
    )
    return [_serialize_leave_request(item) for item in requests]


@router.post("/courier/leaves", response_model=CourierLeaveRequestOut)
def create_leave_request(
    payload: CourierLeaveCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    courier = _require_courier_account(current_user)
    today = date.today()

    if payload.start_date < today:
        raise HTTPException(status_code=422, detail="La date de debut doit etre aujourd'hui ou dans le futur")
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=422, detail="La date de fin doit etre apres ou egale a la date de debut")

    if sync_courier_state(db, courier):
        db.commit()
        db.refresh(courier)

    existing_pending = (
        db.query(CourierLeaveRequest)
        .filter(
            CourierLeaveRequest.courier_id == courier.id,
            CourierLeaveRequest.status == "pending",
        )
        .first()
    )
    if existing_pending:
        raise HTTPException(status_code=400, detail="Une demande de conge est deja en attente")

    existing_approved = (
        db.query(CourierLeaveRequest)
        .filter(
            CourierLeaveRequest.courier_id == courier.id,
            CourierLeaveRequest.status == "approved",
            CourierLeaveRequest.end_date >= today,
        )
        .first()
    )
    if existing_approved:
        raise HTTPException(status_code=400, detail="Une seule demande de conge peut etre active a la fois")

    item = CourierLeaveRequest(
        courier_id=courier.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        description_conge=payload.description_conge,
        status="pending",
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return _serialize_leave_request(item)
