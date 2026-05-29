from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])


@router.get("/google-maps")
def get_google_maps_settings():
    return {"api_key": settings.GOOGLE_MAPS_API_KEY or ""}
