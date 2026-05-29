import random
import string
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


def generate_tracking_number():
    return "MZ-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=10))


OpenColisType = Literal["oui", "non"]


class ColisBase(BaseModel):
    adresse_livraison: str
    nom_destinataire: str
    telephone_destinataire: str
    email_destinataire: Optional[str] = None
    poids: float
    statut: Optional[str] = "en_attente"
    prix: float
    prix_free: Optional[float] = None
    produits: Optional[list[Any]] = None
    ouvrir_colis: OpenColisType = "non"
    zone: Optional[str] = None
    gouvernorat: Optional[str] = None
    delegation: Optional[str] = None
    rue: Optional[str] = None
    destination_label: Optional[str] = None


class ColisCreate(ColisBase):
    numero_suivi: Optional[str] = None
    depot_depart: str | None = None


class ColisUpdate(BaseModel):
    adresse_livraison: Optional[str] = None
    nom_destinataire: Optional[str] = None
    telephone_destinataire: Optional[str] = None
    email_destinataire: Optional[str] = None
    poids: Optional[float] = None
    statut: Optional[str] = None
    prix: Optional[float] = None
    prix_free: Optional[float] = None
    produits: Optional[list[Any]] = None
    ouvrir_colis: Optional[OpenColisType] = None
    zone: Optional[str] = None
    gouvernorat: Optional[str] = None
    delegation: Optional[str] = None
    rue: Optional[str] = None
    destination_label: Optional[str] = None
    depot_depart: str | None = None


class ColisHistoryEventResponse(BaseModel):
    id: int
    kind: str
    title: str
    note: Optional[str] = None
    date: datetime
    is_notification: bool = False
    is_read: bool = False
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ColisNotificationResponse(BaseModel):
    id: int
    colis_id: int
    numero_suivi: str
    nom_destinataire: str
    kind: str
    title: str
    note: Optional[str] = None
    date: datetime
    expires_at: Optional[datetime] = None
    is_read: bool = False


class ColisResponse(ColisBase):
    id: int
    numero_suivi: str
    barcode_value: Optional[str] = None
    shipper_id: int
    tracking_stage: str = "pending_pickup"
    picked_up_at: Optional[datetime] = None
    picked_up_by_courier_id: Optional[int] = None
    warehouse_received_at: Optional[datetime] = None
    warehouse_received_by_courier_id: Optional[int] = None
    out_for_delivery_at: Optional[datetime] = None
    out_for_delivery_by_courier_id: Optional[int] = None
    delivery_issue_count: int = 0
    last_delivery_issue_at: Optional[datetime] = None
    last_delivery_issue_reason: Optional[str] = None
    returned_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    delivered_by_courier_id: Optional[int] = None
    admin_note: Optional[str] = None
    admin_note_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    history: list[ColisHistoryEventResponse] = Field(default_factory=list)
    depot_depart: str | None = None

    class Config:
        from_attributes = True


class ColisCourierScanRequest(BaseModel):
    barcode_value: str = Field(min_length=4, max_length=255)


class ColisCourierScanActionRequest(ColisCourierScanRequest):
    action: Literal["in_transit", "delivered", "not_delivered", "return_pending"]
    reason: Optional[str] = Field(default=None, max_length=500)


class ColisCourierUndeliveredRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class ColisCourierUndeliveredItemResponse(BaseModel):
    id: int
    numero_suivi: str
    barcode_value: Optional[str] = None
    nom_destinataire: str
    adresse_livraison: str
    statut: str
    tracking_stage: str
    out_for_delivery_at: Optional[datetime] = None
    delivery_issue_count: int = 0
    last_delivery_issue_at: Optional[datetime] = None
    last_delivery_issue_reason: Optional[str] = None
    remaining_issue_days: int = 0
    returned_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ColisCourierActionResponse(BaseModel):
    id: int
    numero_suivi: str
    barcode_value: Optional[str] = None
    nom_destinataire: Optional[str] = None
    telephone_destinataire: Optional[str] = None
    adresse_livraison: Optional[str] = None
    poids: Optional[float] = None
    depot_depart: Optional[str] = None
    statut: str
    tracking_stage: str
    detail: str
    picked_up_at: Optional[datetime] = None
    warehouse_received_at: Optional[datetime] = None
    out_for_delivery_at: Optional[datetime] = None
    delivery_issue_count: int = 0
    last_delivery_issue_at: Optional[datetime] = None
    last_delivery_issue_reason: Optional[str] = None
    returned_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ColisCourierAssignedItemResponse(ColisCourierActionResponse):
    tournee_id: int
    tournee_nom: str
    tournee_region: Optional[str] = None
    ordre: int = 0
    remaining_issue_days: int = 0
    latitude: float | None = None
    longitude: float | None = None

    class Config:
        from_attributes = True
