import logging
from datetime import UTC, datetime

from app.schemas.answer import AnswerSubmission, EvaluationResult
from app.services import ai_evaluation_service, evaluation_service, question_service, shadow_log_writer

logger = logging.getLogger(__name__)


def run_shadow_evaluation(
    question_id: str, submission: AnswerSubmission, rule_based_evaluation: EvaluationResult
) -> None:
    """
    Runs the experimental AI evaluator alongside the production rule-based
    evaluator and logs the comparison. Out-of-band only: must never raise
    into the caller and never influence coaching or the API response.
    """
    try:
        question = question_service.get_question_by_id(question_id)
        if question is None:
            return

        expected_answer = evaluation_service.get_expected_answer(question_id)
        outcome = ai_evaluation_service.generate_ai_evaluation(question, expected_answer, submission)

        agreement = (
            outcome.evaluation.correctness == rule_based_evaluation.isCorrect
            if outcome.succeeded and outcome.evaluation is not None
            else None
        )

        shadow_log_writer.append_record(
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "questionId": question_id,
                "attemptNumber": submission.attemptNumber,
                "submittedAnswer": submission.answer,
                "ruleBasedEvaluation": rule_based_evaluation.model_dump(),
                "aiSucceeded": outcome.succeeded,
                "aiEvaluation": outcome.evaluation.model_dump() if outcome.evaluation else None,
                "aiError": outcome.error,
                "latencySeconds": outcome.latencySeconds,
                "agreement": agreement,
            }
        )
    except Exception:
        logger.warning(
            "Shadow evaluation failed unexpectedly for question_id=%s", question_id, exc_info=True
        )
