from sqlalchemy.orm import declarative_base

Base = declarative_base()

from app.models.tournee import Tournee, TourneeColis
from app.models.geocode_cache import GeocodeCache
