from fastapi import APIRouter

from app.api.routes import answers, auth, chapters, health, performance, questions, sessions, topics

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(chapters.router, tags=["chapters"])
api_router.include_router(questions.router, tags=["questions"])
api_router.include_router(topics.router, tags=["topics"])
api_router.include_router(answers.router, tags=["answers"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(performance.router, tags=["performance"])
api_router.include_router(sessions.router, tags=["sessions"])
