from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.colis_events import add_admin_decision_event
from app.db.session import get_db
from app.models.colis import Colis
from app.models.user import User
from app.schemas.colis import ColisResponse

router = APIRouter(prefix="/admin/colis", tags=["admin-colis"])


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin requis")
    return current_user


@router.get("", response_model=list[ColisResponse])
def get_all_colis(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    colis_list = (
        db.query(Colis)
        .options(selectinload(Colis.history))
        .order_by(Colis.id.desc())
        .all()
    )

    now = datetime.utcnow()
    result = []

    for c in colis_list:
        item = {
            column.name: getattr(c, column.name)
            for column in Colis.__table__.columns
        }

        # ColisResponse يستنى ouvrir_colis = "oui" ولا "non"
        ouvrir_value = getattr(c, "ouvrir_colis", None)

        if ouvrir_value in [True, "true", "True", "oui", "1", 1]:
            item["ouvrir_colis"] = "oui"
        else:
            item["ouvrir_colis"] = "non"

        # ColisResponse يستنى datetime، ما ينجمش يقبل NULL
        item["created_at"] = c.created_at or now

        if "updated_at" in item:
            item["updated_at"] = c.updated_at or item["created_at"]

        # كان schema فيه history
        item["history"] = c.history or []

        result.append(item)

    return result


@router.post("/{colis_id}/approve")
def approve_colis(colis_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    colis = db.query(Colis).filter(Colis.id == colis_id).first()
    if not colis:
        raise HTTPException(status_code=404, detail="Colis introuvable")
    if colis.admin_note == "accepte":
        return {"message": "Colis deja accepte", "id": colis_id}
    colis.admin_note = "accepte"
    colis.admin_note_at = datetime.utcnow()
    add_admin_decision_event(db, colis, approved=True, event_at=colis.admin_note_at)
    db.commit()
    return {"message": "Colis accepte", "id": colis_id}


@router.post("/{colis_id}/reject")
def reject_colis(colis_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    colis = db.query(Colis).filter(Colis.id == colis_id).first()
    if not colis:
        raise HTTPException(status_code=404, detail="Colis introuvable")
    if colis.admin_note == "refuse":
        return {"message": "Colis deja refuse", "id": colis_id}
    colis.statut = "annule"
    colis.admin_note = "refuse"
    colis.admin_note_at = datetime.utcnow()
    add_admin_decision_event(db, colis, approved=False, event_at=colis.admin_note_at)
    db.commit()
    return {"message": "Colis refuse", "id": colis_id}
