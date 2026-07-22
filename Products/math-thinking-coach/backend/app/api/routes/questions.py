from fastapi import APIRouter, HTTPException

from app.schemas.question import Question
from app.services import question_service

router = APIRouter()


@router.get("/chapters/{chapter_id}/questions", response_model=list[Question])
def list_questions(chapter_id: str) -> list[Question]:
    if question_service.get_chapter(chapter_id) is None:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return question_service.get_questions(chapter_id)


@router.get("/chapters/{chapter_id}/questions/{question_id}", response_model=Question)
def get_question(chapter_id: str, question_id: str) -> Question:
    question = question_service.get_question(chapter_id, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    return question
