from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.courier_state import sync_courier_state
from app.core.security import JWT_ALGORITHM, JWT_SECRET
from app.db.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Token invalide")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide")

    user = db.query(User).filter(User.id == int(sub)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur invalide")

    if user.role == "courier" and sync_courier_state(db, user):
        db.commit()
        db.refresh(user)

    if not user.is_active:
        if user.role == "courier" and user.courier_status == "contract_ended":
            raise HTTPException(status_code=403, detail="Contrat livreur termine")
        raise HTTPException(status_code=401, detail="Utilisateur invalide")

    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Acces admin requis")
    return user


def require_courier(user: User = Depends(get_current_user)) -> User:
    if user.role != "courier":
        raise HTTPException(status_code=403, detail="Acces livreur requis")
    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Compte livreur non approuve")
    if user.courier_status == "temporary_leave":
        raise HTTPException(status_code=403, detail="Livreur en conge temporaire")
    if user.courier_status == "contract_ended":
        raise HTTPException(status_code=403, detail="Contrat livreur termine")
    return user
