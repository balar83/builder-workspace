import pytest
from pydantic import ValidationError

from app.schemas.ai_evaluation import AIEvaluation, AIEvaluationOutcome


def test_valid_construction() -> None:
    evaluation = AIEvaluation(
        correctness=True,
        confidence=0.95,
        reasoning_quality="SOUND",
        misconception_tags=["incorrect_addition_of_fractions"],
        explanation="The student correctly added the fractions.",
    )

    assert evaluation.correctness is True
    assert evaluation.confidence == 0.95
    assert evaluation.reasoning_quality == "SOUND"
    assert evaluation.misconception_tags == ["incorrect_addition_of_fractions"]
    assert evaluation.explanation == "The student correctly added the fractions."


def test_missing_required_field_raises_validation_error() -> None:
    with pytest.raises(ValidationError):
        AIEvaluation(
            correctness=True,
            confidence=0.95,
            reasoning_quality="SOUND",
            # explanation omitted
        )


def test_misconception_tags_defaults_to_empty_list() -> None:
    evaluation = AIEvaluation(
        correctness=True,
        confidence=1.0,
        reasoning_quality="SOUND",
        explanation="No issues found.",
    )

    assert evaluation.misconception_tags == []


def test_successful_ai_evaluation_outcome() -> None:
    evaluation = AIEvaluation(
        correctness=False,
        confidence=0.85,
        reasoning_quality="WEAK",
        misconception_tags=["confusion_with_symbol"],
        explanation="The student misapplied the formula.",
    )
    outcome = AIEvaluationOutcome(
        succeeded=True,
        evaluation=evaluation,
        error=None,
        latencySeconds=41.2,
    )

    assert outcome.succeeded is True
    assert outcome.evaluation == evaluation
    assert outcome.error is None
    assert outcome.latencySeconds == 41.2


def test_failed_ai_evaluation_outcome() -> None:
    outcome = AIEvaluationOutcome(
        succeeded=False,
        evaluation=None,
        error="timeout",
        latencySeconds=90.0,
    )

    assert outcome.succeeded is False
    assert outcome.evaluation is None
    assert outcome.error == "timeout"
    assert outcome.latencySeconds == 90.0
