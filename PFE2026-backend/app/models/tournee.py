from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime ,Date

from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Tournee(Base):
    __tablename__ = "tournees"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, nullable=False)
    region = Column(String, nullable=True)
    status = Column(String, default="proposed")
    generated_by = Column(String, default="ia")
    distance_km = Column(Float, default=0)
    poids_total = Column(Float, default=0)

    cluster_ia = Column(Integer, default=0)
    nombre_colis = Column(Integer, default=0)
    parcours_text = Column(String, nullable=True)
    refuse_reason = Column(String(255), nullable=True)
    execution_date = Column(Date, nullable=True)

    vehicle_min_capacity = Column(Float, nullable=True, default=0)
    vehicle_capacity = Column(Float, default=300)

    livreur_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)

    depot_depart = Column(String(50), nullable=True)
    depot_label = Column(String(120), nullable=True)
    depot_adresse = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    livreur = relationship("User")
    vehicle = relationship("Vehicle")

    colis_items = relationship(
        "TourneeColis",
        back_populates="tournee",
        cascade="all, delete-orphan",
    )



class TourneeColis(Base):
    __tablename__ = "tournee_colis"

    id = Column(Integer, primary_key=True, index=True)

    tournee_id = Column(Integer, ForeignKey("tournees.id", ondelete="CASCADE"))
    colis_id = Column(Integer, ForeignKey("colis.id"))

    # ordre de livraison
    ordre = Column(Integer, default=0)

    # ordre de chargement dans le camion selon LIFO
    ordre_chargement = Column(Integer, nullable=True)

    distance_depuis_precedent = Column(Float, default=0)

    tournee = relationship("Tournee", back_populates="colis_items")
    colis = relationship("Colis", back_populates="tournee_links")
