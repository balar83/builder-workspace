from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/health")
def get_health() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
    }
