from fastapi import APIRouter, HTTPException

from app.schemas.chapter import Chapter
from app.services import question_service

router = APIRouter()


@router.get("/chapters", response_model=list[Chapter])
def list_chapters() -> list[Chapter]:
    return question_service.get_chapters()


@router.get("/chapters/{chapter_id}", response_model=Chapter)
def get_chapter(chapter_id: str) -> Chapter:
    chapter = question_service.get_chapter(chapter_id)
    if chapter is None:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return chapter
