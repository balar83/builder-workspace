from fastapi import APIRouter, HTTPException, Request

from app.schemas.performance import ActivityResponse, TopicPerformance, UnresolvedMistake
from app.services import activity_service, attempt_service, mistake_service

router = APIRouter()


@router.get("/performance/me", response_model=list[TopicPerformance])
def get_my_performance(request: Request) -> list[dict]:
    if request.session.get("role") != "student":
        raise HTTPException(status_code=401, detail="Student login required")

    return attempt_service.get_performance(request.session["id"])


@router.get("/performance/me/activity", response_model=ActivityResponse)
def get_my_activity(request: Request) -> ActivityResponse:
    if request.session.get("role") != "student":
        raise HTTPException(status_code=401, detail="Student login required")

    return activity_service.get_activity(request.session["id"])


@router.get("/performance/me/mistakes", response_model=list[UnresolvedMistake])
def get_my_unresolved_mistakes(request: Request) -> list[UnresolvedMistake]:
    if request.session.get("role") != "student":
        raise HTTPException(status_code=401, detail="Student login required")

    return mistake_service.get_unresolved_mistakes(request.session["id"])
