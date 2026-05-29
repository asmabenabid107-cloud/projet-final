from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class Colis(Base):
    __tablename__ = "colis"

    id = Column(Integer, primary_key=True, index=True)
    numero_suivi = Column(String, unique=True, nullable=False)
    adresse_livraison = Column(String, nullable=False)
    nom_destinataire = Column(String, nullable=False)
    telephone_destinataire = Column(String, nullable=False)
    email_destinataire = Column(String, nullable=True)
    poids = Column(Float, nullable=False)
    statut = Column(String, default="en_attente")
    depot_depart = Column(String(50), nullable=True)

    prix = Column(Float, nullable=False)
    prix_free = Column(Float, nullable=True)
    produits = Column(JSON, nullable=True)
    ouvrir_colis = Column(String(10), nullable=False, default="non")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    zone = Column(String(100), nullable=True)
    gouvernorat = Column(String(100), nullable=True)
    delegation = Column(String(100), nullable=True)
    rue = Column(String, nullable=True)
    destination_label = Column(String(120), nullable=True)
    barcode_value = Column(String(40), nullable=True)
    tracking_stage = Column(String(40), nullable=False, default="pending_pickup")
    picked_up_at = Column(DateTime, nullable=True)
    picked_up_by_courier_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    warehouse_received_at = Column(DateTime, nullable=True)
    warehouse_received_by_courier_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    out_for_delivery_at = Column(DateTime, nullable=True)
    out_for_delivery_by_courier_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    delivery_issue_count = Column(Integer, nullable=False, default=0)
    last_delivery_issue_at = Column(DateTime, nullable=True)
    last_delivery_issue_reason = Column(String(500), nullable=True)
    returned_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    delivered_by_courier_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    admin_note = Column(String, nullable=True)
    admin_note_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    shipper_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shipper = relationship("User", back_populates="colis", foreign_keys=[shipper_id])
    tournee_links = relationship(
        "TourneeColis",
        back_populates="colis"
    )
    history = relationship(
        "ColisEvent",
        back_populates="colis",
        cascade="all, delete-orphan",
        order_by="ColisEvent.event_at",
    )
