from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.models.vehicle import Vehicle
from app.models.user import User
from app.schemas.vehicle import VehicleCreate, VehicleOut, VehicleUpdate

router = APIRouter(prefix="/admin/vehicles", tags=["admin-vehicles"])


@router.get("/", response_model=List[VehicleOut])
def list_vehicles(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return db.query(Vehicle).order_by(Vehicle.id).all()


@router.post("/", response_model=VehicleOut)
def create_vehicle(data: VehicleCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    existing = db.query(Vehicle).filter(Vehicle.matricule == data.matricule).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ce matricule existe deja")

    vehicle = Vehicle(
        name=data.name,
        matricule=data.matricule,
        status=data.status,
        min_length=data.min_length,
        max_length=data.max_length,
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.put("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(vehicle_id: int, data: VehicleUpdate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicule introuvable")

    next_name = data.name if data.name is not None else vehicle.name
    next_matricule = data.matricule if data.matricule is not None else vehicle.matricule
    next_min_length = data.min_length if data.min_length is not None else vehicle.min_length
    next_max_length = data.max_length if data.max_length is not None else vehicle.max_length

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

    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/{vehicle_id}")
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicule introuvable")
    db.delete(vehicle)
    db.commit()
    return {"detail": "Vehicule supprime"}
