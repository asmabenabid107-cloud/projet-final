from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CourierLocationCreate(BaseModel):
    tournee_id: Optional[int] = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: Optional[float] = Field(default=None, ge=0)
    speed: Optional[float] = None
    heading: Optional[float] = None
    recorded_at: Optional[datetime] = None


class CourierLocationPointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    courier_id: int
    tournee_id: Optional[int] = None
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None
    recorded_at: datetime


class AdminCourierLiveLocationOut(BaseModel):
    courier_id: int
    courier_name: str
    courier_email: str
    tournee_id: Optional[int] = None
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None
    is_online: bool
    recorded_at: datetime
    updated_at: datetime
