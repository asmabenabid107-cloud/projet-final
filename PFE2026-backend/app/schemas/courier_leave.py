from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

LeaveRequestStatus = Literal["pending", "approved", "denied"]


class CourierLeaveCreateRequest(BaseModel):
    start_date: date
    end_date: date
    description_conge: Optional[str] = Field(default=None, max_length=500)


class CourierLeaveDenyRequest(BaseModel):
    denial_reason: str = Field(min_length=3, max_length=255)


class CourierLeaveRequestOut(BaseModel):
    id: int
    courier_id: int
    courier_name: Optional[str] = None
    courier_email: Optional[EmailStr] = None
    start_date: date
    end_date: date
    description_conge: Optional[str] = None
    status: LeaveRequestStatus
    denial_reason: Optional[str] = None
    requested_at: datetime
    reviewed_at: Optional[datetime] = None
