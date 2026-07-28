import json
import time

import httpx
from pydantic import ValidationError

from app.core.config import settings
from app.schemas.ai_evaluation import AIEvaluation, AIEvaluationOutcome
from app.schemas.answer import AnswerSubmission
from app.schemas.question import Question
from app.services import ai_evaluation_client
from app.services.ai_evaluation_prompt import build_prompt


def generate_ai_evaluation(
    question: Question, expected_answer: str, submission: AnswerSubmission
) -> AIEvaluationOutcome:
    prompt = build_prompt(
        question=question.question,
        expected_answer=expected_answer,
        student_answer=submission.answer,
    )

    start = time.monotonic()

    try:
        envelope = ai_evaluation_client.generate(settings.shadow_model_name, prompt)
    except httpx.TimeoutException:
        return AIEvaluationOutcome(
            succeeded=False,
            evaluation=None,
            error="timeout",
            latencySeconds=time.monotonic() - start,
        )
    except httpx.HTTPError:
        return AIEvaluationOutcome(
            succeeded=False,
            evaluation=None,
            error="connection_error",
            latencySeconds=time.monotonic() - start,
        )

    latency_seconds = time.monotonic() - start
    raw_text = envelope.get("response", "")

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        return AIEvaluationOutcome(
            succeeded=False,
            evaluation=None,
            error="json_parse_failed",
            latencySeconds=latency_seconds,
        )

    try:
        evaluation = AIEvaluation(**parsed)
    except (ValidationError, TypeError):
        return AIEvaluationOutcome(
            succeeded=False,
            evaluation=None,
            error="schema_invalid",
            latencySeconds=latency_seconds,
        )

    return AIEvaluationOutcome(
        succeeded=True,
        evaluation=evaluation,
        error=None,
        latencySeconds=latency_seconds,
    )
