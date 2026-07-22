from fastapi import APIRouter, HTTPException

from app.schemas.answer import AnswerEvaluationResponse, SubmitAnswerRequest
from app.services import answer_service, question_service

router = APIRouter()


@router.post("/questions/{question_id}/answer", response_model=AnswerEvaluationResponse)
def submit_answer(question_id: str, body: SubmitAnswerRequest) -> AnswerEvaluationResponse:
    if question_service.get_question_by_id(question_id) is None:
        raise HTTPException(status_code=404, detail="Question not found")

    return answer_service.evaluate_answer(question_id, body.submission)
