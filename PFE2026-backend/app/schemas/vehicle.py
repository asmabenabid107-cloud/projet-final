from datetime import datetime
import re

from pydantic import BaseModel, field_validator, model_validator

from app.models.vehicle import VehicleStatus

DEFAULT_MIN_WEIGHT = 20
DEFAULT_MAX_WEIGHT = 40

MATRICULE_PATTERN = re.compile(
    r"^\d{1,3}\s+[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,2}\s+\d{3,4}$",
    re.IGNORECASE,
)


def normalize_text(value: str) -> str:
    return " ".join(value.split()).strip()


def normalize_matricule(value: str) -> str:
    value = normalize_text(value)
    if not value:
        raise ValueError("Le matricule est obligatoire")

    parts = []
    for part in value.split(" "):
        if part.isdigit():
            parts.append(part)
        else:
            parts.append(part.capitalize())

    normalized = " ".join(parts)
    if not MATRICULE_PATTERN.fullmatch(normalized):
        raise ValueError("Le matricule doit etre au format 123 Tunis 4567")

    return normalized


class VehicleCreate(BaseModel):
    name: str | None = None
    matricule: str
    status: VehicleStatus = VehicleStatus.actif
    min_length: int = DEFAULT_MIN_WEIGHT
    max_length: int = DEFAULT_MAX_WEIGHT

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None):
        if value is None:
            return None
        value = normalize_text(value)
        return value or None

    @field_validator("matricule")
    @classmethod
    def clean_matricule(cls, value: str):
        return normalize_matricule(value)

    @model_validator(mode="after")
    def validate_weight_range(self):
        if self.min_length < 1:
            raise ValueError("Le poids minimum doit etre superieur a 0")
        if self.max_length < self.min_length:
            raise ValueError(
                "Le poids maximum doit etre superieur ou egal au poids minimum"
            )
        return self


class VehicleUpdate(BaseModel):
    name: str | None = None
    matricule: str | None = None
    status: VehicleStatus | None = None
    min_length: int | None = None
    max_length: int | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None):
        if value is None:
            return None
        value = normalize_text(value)
        return value or None

    @field_validator("matricule")
    @classmethod
    def clean_matricule(cls, value: str | None):
        if value is None:
            return None
        return normalize_matricule(value)

    @model_validator(mode="after")
    def validate_weight_range(self):
        if self.min_length is not None and self.min_length < 1:
            raise ValueError("Le poids minimum doit etre superieur a 0")
        if (
            self.min_length is not None
            and self.max_length is not None
            and self.max_length < self.min_length
        ):
            raise ValueError(
                "Le poids maximum doit etre superieur ou egal au poids minimum"
            )
        return self


class VehicleOut(BaseModel):
    id: int
    name: str | None = None
    matricule: str
    status: VehicleStatus
    min_length: int
    max_length: int
    created_at: datetime

    model_config = {"from_attributes": True}
