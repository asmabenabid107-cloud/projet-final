## Geocode Cache Model c'est un table stocke les adresse un seul fois
from sqlalchemy import Column, DateTime, Float, Integer, String, func
from app.db.base import Base


class GeocodeCache(Base):
    __tablename__ = "geocode_cache"

    id = Column(Integer, primary_key=True, index=True)
    address_key = Column(String, unique=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    source = Column(String(50), default="nominatim")
    created_at = Column(DateTime, server_default=func.now())
