from pydantic import BaseModel
from typing import List, Optional


class TourneeColisOut(BaseModel):
    colis_id: int
    ordre: int
    distance_depuis_precedent: float

    class Config:
        from_attributes = True


class TourneeOut(BaseModel):
    id: int

    nom: str

    region: Optional[str]

    status: str

    distance_km: float

    poids_total: float

    livreur_id: Optional[int]

    vehicle_id: Optional[int]

    colis: List[TourneeColisOut] = []

    class Config:
        from_attributes = True
