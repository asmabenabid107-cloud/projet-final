# app/models/courier_location.py

from sqlalchemy import Column, Integer, Float, ForeignKey, DateTime, Boolean, func
from sqlalchemy.orm import relationship

from app.db.base import Base


class CourierLiveLocation(Base):
    __tablename__ = "courier_live_locations"

    id = Column(Integer, primary_key=True, index=True)

    courier_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    tournee_id = Column(Integer, ForeignKey("tournees.id"), nullable=True)

    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float, nullable=True)
    speed = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)

    is_online = Column(Boolean, nullable=False, default=True)

    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    courier = relationship("User")
    tournee = relationship("Tournee")


class CourierLocationPoint(Base):
    __tablename__ = "courier_location_points"

    id = Column(Integer, primary_key=True, index=True)

    courier_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tournee_id = Column(Integer, ForeignKey("tournees.id"), nullable=True)

    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float, nullable=True)
    speed = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)

    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    courier = relationship("User")
    tournee = relationship("Tournee")
