from datetime import datetime
import enum

from sqlalchemy import (
    Column,
    DateTime,
    Enum as SAEnum,
    Float,
    Integer,
    String,
    text,
    func,
)

from app.db.base import Base


class VehicleStatus(str, enum.Enum):
    actif = "actif"
    inactif = "inactif"
    maintenance = "maintenance"


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(120), nullable=True)
    matricule = Column(String(40), nullable=False, unique=True)

    status = Column(
        SAEnum(VehicleStatus),
        nullable=False,
        default=VehicleStatus.actif
    )

    # Capacité poids en kg
    min_length = Column(Integer, nullable=False, default=20, server_default=text("20"))
    max_length = Column(Integer, nullable=False, default=40, server_default=text("40"))

    # Dimensions internes camion en cm
    longueur = Column(Float, nullable=True)
    largeur = Column(Float, nullable=True)
    hauteur = Column(Float, nullable=True)

    # Volume max calculé = longueur × largeur × hauteur
    max_volume = Column(Float, nullable=True)

    created_at = Column(DateTime, server_default=func.now())