from fastapi import APIRouter

from app.api.routes import chapters, health, questions

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(chapters.router, tags=["chapters"])
api_router.include_router(questions.router, tags=["questions"])
