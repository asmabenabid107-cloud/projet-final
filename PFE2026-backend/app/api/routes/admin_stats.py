from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_db, require_admin
from app.models.user import User
from app.models.colis import Colis

router = APIRouter()

@router.get("")
def get_admin_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    # --- Shippers ---
    total_shippers = (
        db.query(func.count(User.id))
        .filter(User.role == "shipper", User.is_active == True)
        .scalar() or 0
    )

    approved_shippers = (
        db.query(func.count(User.id))
        .filter(
            User.role == "shipper",
            User.is_active == True,
            User.is_approved == True,
        )
        .scalar() or 0
    )

    pending_shippers = (
        db.query(func.count(User.id))
        .filter(
            User.role == "shipper",
            User.is_active == True,
            User.is_approved == False,
        )
        .scalar() or 0
    )

    # --- Couriers ---
    total_couriers = (
        db.query(func.count(User.id))
        .filter(User.role == "courier", User.is_active == True)
        .scalar() or 0
    )

    approved_couriers = (
        db.query(func.count(User.id))
        .filter(
            User.role == "courier",
            User.is_active == True,
            User.is_approved == True,
        )
        .scalar() or 0
    )

    pending_couriers = (
        db.query(func.count(User.id))
        .filter(
            User.role == "courier",
            User.is_active == True,
            User.is_approved == False,
        )
        .scalar() or 0
    )

    # --- Colis ---
    total_colis = db.query(func.count(Colis.id)).scalar() or 0

    rows = (
        db.query(Colis.statut, func.count(Colis.id))
        .group_by(Colis.statut)
        .all()
    )
    colis_by_status = {(s or "inconnu"): int(c) for s, c in rows}

    return {
        "shippers": {
            "total": int(total_shippers),
            "approved": int(approved_shippers),
            "pending": int(pending_shippers),
        },
        "couriers": {
            "total": int(total_couriers),
            "approved": int(approved_couriers),
            "pending": int(pending_couriers),
        },
        "parcels": {
            "total": int(total_colis),
            "by_status": colis_by_status,
        },
    }
