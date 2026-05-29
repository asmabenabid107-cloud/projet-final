from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

GenderType = Literal["masculin", "feminin"]
OpenColisType = Literal["oui", "non"]


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    phone: str
    phone2: Optional[str] = None
    email: EmailStr
    password: str = Field(..., min_length=3, max_length=120)
    address: Optional[str] = Field(default=None, max_length=255)
    gender: Optional[GenderType] = None
    ouvrir_colis_par_defaut: OpenColisType = "non"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(min_length=6, max_length=6)


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(..., min_length=3, max_length=120)


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    phone2: Optional[str] = None
    address: Optional[str] = Field(default=None, max_length=255)
    gender: Optional[GenderType] = None
    ouvrir_colis_par_defaut: Optional[OpenColisType] = None
