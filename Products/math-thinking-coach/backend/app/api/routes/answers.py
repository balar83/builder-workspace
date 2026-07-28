from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.core.config import settings
from app.schemas.answer import AnswerEvaluationResponse, SubmitAnswerRequest
from app.services import answer_service, question_service, shadow_evaluation_service

router = APIRouter()


@router.post("/questions/{question_id}/answer", response_model=AnswerEvaluationResponse)
def submit_answer(
    question_id: str, body: SubmitAnswerRequest, background_tasks: BackgroundTasks
) -> AnswerEvaluationResponse:
    if question_service.get_question_by_id(question_id) is None:
        raise HTTPException(status_code=404, detail="Question not found")

    response = answer_service.evaluate_answer(question_id, body.submission)

    if settings.shadow_mode_enabled:
        background_tasks.add_task(
            shadow_evaluation_service.run_shadow_evaluation,
            question_id,
            body.submission,
            response.evaluation,
        )

    return response
