from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from app.core.config import settings
from app.schemas.answer import AnswerEvaluationResponse, SubmitAnswerRequest
from app.services import answer_service, attempt_service, question_service, shadow_evaluation_service

router = APIRouter()


@router.post("/questions/{question_id}/answer", response_model=AnswerEvaluationResponse)
def submit_answer(
    question_id: str, body: SubmitAnswerRequest, background_tasks: BackgroundTasks, request: Request
) -> AnswerEvaluationResponse:
    question = question_service.get_question_by_id(question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")

    response = answer_service.evaluate_answer(question_id, body.submission)

    # Registered before Shadow Mode deliberately: BackgroundTasks runs tasks
    # sequentially, awaited one at a time (confirmed against Starlette's
    # source), not concurrently. Shadow Mode's AI evaluator call can take
    # 40-90s (see ADR-002); attempt recording must never queue behind it.
    if request.session.get("role") == "student":
        background_tasks.add_task(
            attempt_service.record_attempt_for_answer,
            request.session["id"],
            question,
            body.submission,
            response,
        )

    if settings.shadow_mode_enabled:
        background_tasks.add_task(
            shadow_evaluation_service.run_shadow_evaluation,
            question_id,
            body.submission,
            response.evaluation,
        )

    return response
