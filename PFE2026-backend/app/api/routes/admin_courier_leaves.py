from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, require_admin
from app.core.courier_state import sync_courier_state
from app.models.courier_leave_request import CourierLeaveRequest
from app.models.user import User
from app.schemas.courier_leave import CourierLeaveDenyRequest, CourierLeaveRequestOut

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


@router.get("/admin/courier-leaves", response_model=list[CourierLeaveRequestOut])
def list_courier_leave_requests(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    items = (
        db.query(CourierLeaveRequest)
        .options(joinedload(CourierLeaveRequest.courier))
        .order_by(CourierLeaveRequest.requested_at.desc(), CourierLeaveRequest.id.desc())
        .all()
    )

    changed = False
    synced_couriers: set[int] = set()
    for item in items:
        if item.courier and item.courier_id not in synced_couriers:
            changed = sync_courier_state(db, item.courier) or changed
            synced_couriers.add(item.courier_id)

    if changed:
        db.commit()
        for item in items:
            if item.courier:
                db.refresh(item.courier)

    return [_serialize_leave_request(item) for item in items]


@router.post("/admin/courier-leaves/{leave_request_id}/approve", response_model=CourierLeaveRequestOut)
def approve_courier_leave_request(
    leave_request_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    item = (
        db.query(CourierLeaveRequest)
        .options(joinedload(CourierLeaveRequest.courier))
        .filter(CourierLeaveRequest.id == leave_request_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Demande de conge introuvable")
    if item.status != "pending":
        raise HTTPException(status_code=400, detail="Cette demande a deja ete traitee")

    other_approved = (
        db.query(CourierLeaveRequest)
        .filter(
            CourierLeaveRequest.courier_id == item.courier_id,
            CourierLeaveRequest.status == "approved",
            CourierLeaveRequest.id != item.id,
            CourierLeaveRequest.end_date >= date.today(),
        )
        .first()
    )
    if other_approved:
        raise HTTPException(status_code=400, detail="Ce livreur a deja un conge actif ou planifie")

    item.status = "approved"
    item.denial_reason = None
    item.reviewed_at = datetime.now(timezone.utc)

    if item.courier:
        sync_courier_state(db, item.courier)

    db.commit()
    db.refresh(item)
    if item.courier:
        db.refresh(item.courier)

    return _serialize_leave_request(item)


@router.post("/admin/courier-leaves/{leave_request_id}/deny", response_model=CourierLeaveRequestOut)
def deny_courier_leave_request(
    leave_request_id: int,
    payload: CourierLeaveDenyRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    item = (
        db.query(CourierLeaveRequest)
        .options(joinedload(CourierLeaveRequest.courier))
        .filter(CourierLeaveRequest.id == leave_request_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Demande de conge introuvable")
    if item.status != "pending":
        raise HTTPException(status_code=400, detail="Cette demande a deja ete traitee")

    item.status = "denied"
    item.denial_reason = payload.denial_reason.strip()
    item.reviewed_at = datetime.now(timezone.utc)

    if item.courier:
        sync_courier_state(db, item.courier)

    db.commit()
    db.refresh(item)
    if item.courier:
        db.refresh(item.courier)

    return _serialize_leave_request(item)
