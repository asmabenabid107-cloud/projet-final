from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.models.user import User
from app.schemas.user import UserOut
from app.core.email_service import send_shipper_approved_email

router = APIRouter()

@router.get("/pending", response_model=list[UserOut])
def list_pending_shippers(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    shippers = (
        db.query(User)
        .filter(
            User.role == "shipper",
            User.is_approved == False,
            User.is_active == True,
        )
        .order_by(User.id.desc())
        .all()
    )
    return shippers

#  NOUVEAU: liste des expéditeurs approuvés
@router.get("/approved", response_model=list[UserOut])
def list_approved_shippers(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    shippers = (
        db.query(User)
        .filter(
            User.role == "shipper",
            User.is_approved == True,
            User.is_active == True,
        )
        .order_by(User.id.desc())
        .all()
    )
    return shippers

@router.post("/{shipper_id}/approve")
def approve_shipper(
    shipper_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    shipper = db.query(User).filter(User.id == shipper_id, User.role == "shipper").first()
    if not shipper:
        raise HTTPException(status_code=404, detail="Shipper not found")

    if shipper.is_approved:
        return {"message": "Already approved"}

    shipper.is_approved = True
    db.commit()
    db.refresh(shipper)

    # email en arrière-plan
    background_tasks.add_task(send_shipper_approved_email, shipper.email, shipper.name)

    return {"message": "Approved"}

@router.delete("/{shipper_id}")
def delete_shipper(
    shipper_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    shipper = db.query(User).filter(User.id == shipper_id, User.role == "shipper").first()
    if not shipper:
        raise HTTPException(status_code=404, detail="Shipper not found")

    db.delete(shipper)
    db.commit()
    return {"message": "Deleted"}
