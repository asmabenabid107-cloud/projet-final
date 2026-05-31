from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.models.vehicle import Vehicle
from app.models.user import User
from app.schemas.vehicle import VehicleCreate, VehicleOut, VehicleUpdate

router = APIRouter(prefix="/admin/vehicles", tags=["admin-vehicles"])


def calculate_max_volume(longueur, largeur, hauteur):
    if longueur and largeur and hauteur:
        return float(longueur) * float(largeur) * float(hauteur)
    return None


@router.get("/", response_model=List[VehicleOut])
def list_vehicles(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin)
):
    return db.query(Vehicle).order_by(Vehicle.id).all()


@router.post("/", response_model=VehicleOut)
def create_vehicle(
    data: VehicleCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin)
):
    existing = db.query(Vehicle).filter(Vehicle.matricule == data.matricule).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ce matricule existe deja")

    if data.max_length < data.min_length:
        raise HTTPException(
            status_code=400,
            detail="Le poids maximum doit etre superieur ou egal au poids minimum",
        )

    max_volume = data.max_volume
    if max_volume is None:
        max_volume = calculate_max_volume(data.longueur, data.largeur, data.hauteur)

    vehicle = Vehicle(
        name=data.name,
        matricule=data.matricule,
        status=data.status,
        min_length=data.min_length,
        max_length=data.max_length,

        longueur=data.longueur,
        largeur=data.largeur,
        hauteur=data.hauteur,
        max_volume=max_volume,
    )

    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.put("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: int,
    data: VehicleUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin)
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicule introuvable")

    next_name = data.name if data.name is not None else vehicle.name
    next_matricule = data.matricule if data.matricule is not None else vehicle.matricule
    next_min_length = data.min_length if data.min_length is not None else vehicle.min_length
    next_max_length = data.max_length if data.max_length is not None else vehicle.max_length

    next_longueur = data.longueur if data.longueur is not None else vehicle.longueur
    next_largeur = data.largeur if data.largeur is not None else vehicle.largeur
    next_hauteur = data.hauteur if data.hauteur is not None else vehicle.hauteur

    if next_max_length < next_min_length:
        raise HTTPException(
            status_code=400,
            detail="Le poids maximum doit etre superieur ou egal au poids minimum",
        )

    if data.matricule is not None:
        existing = (
            db.query(Vehicle)
            .filter(Vehicle.matricule == next_matricule, Vehicle.id != vehicle_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Ce matricule existe deja")

    vehicle.name = next_name
    vehicle.matricule = next_matricule

    if data.status is not None:
        vehicle.status = data.status

    vehicle.min_length = next_min_length
    vehicle.max_length = next_max_length

    vehicle.longueur = next_longueur
    vehicle.largeur = next_largeur
    vehicle.hauteur = next_hauteur

    if data.max_volume is not None:
        vehicle.max_volume = data.max_volume
    else:
        vehicle.max_volume = calculate_max_volume(
            next_longueur,
            next_largeur,
            next_hauteur
        )

    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/{vehicle_id}")
def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin)
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicule introuvable")

    db.delete(vehicle)
    db.commit()
    return {"detail": "Vehicule supprime"}