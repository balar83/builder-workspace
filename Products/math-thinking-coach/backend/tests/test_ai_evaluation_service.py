import httpx
import pytest

from app.schemas.answer import AnswerSubmission
from app.schemas.question import Question
from app.services import ai_evaluation_client, ai_evaluation_service

QUESTION = Question(
    id="q1-rational-numbers",
    chapterId="rational-numbers",
    question="What is the result of adding 1/3 and 1/6?",
    text="What is the result of adding 1/3 and 1/6?",
    difficulty="Easy",
    hints=["Find a common denominator for 1/3 and 1/6."],
    solution="1/3 + 1/6 = 2/6 + 1/6 = 3/6 = 1/2.",
)

EXPECTED_ANSWER = "1/2"
SUBMISSION = AnswerSubmission(answer="1/2", attemptNumber=1)


def test_successful_evaluation_returns_succeeded_outcome(monkeypatch: pytest.MonkeyPatch) -> None:
    raw_response = (
        '{"correctness": true, "confidence": 0.95, "reasoning_quality": "SOUND", '
        '"misconception_tags": [], "explanation": "Correct."}'
    )
    monkeypatch.setattr(
        ai_evaluation_client, "generate", lambda model, prompt: {"response": raw_response}
    )

    outcome = ai_evaluation_service.generate_ai_evaluation(QUESTION, EXPECTED_ANSWER, SUBMISSION)

    assert outcome.succeeded is True
    assert outcome.error is None
    assert outcome.evaluation.correctness is True
    assert outcome.evaluation.confidence == 0.95
    assert outcome.latencySeconds >= 0


def test_timeout_is_classified_as_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    def raise_timeout(model: str, prompt: str) -> dict:
        raise httpx.ReadTimeout("timed out")

    monkeypatch.setattr(ai_evaluation_client, "generate", raise_timeout)

    outcome = ai_evaluation_service.generate_ai_evaluation(QUESTION, EXPECTED_ANSWER, SUBMISSION)

    assert outcome.succeeded is False
    assert outcome.error == "timeout"
    assert outcome.evaluation is None


def test_connection_error_is_classified_as_connection_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def raise_connect_error(model: str, prompt: str) -> dict:
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(ai_evaluation_client, "generate", raise_connect_error)

    outcome = ai_evaluation_service.generate_ai_evaluation(QUESTION, EXPECTED_ANSWER, SUBMISSION)

    assert outcome.succeeded is False
    assert outcome.error == "connection_error"
    assert outcome.evaluation is None


def test_malformed_json_is_classified_as_json_parse_failed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        ai_evaluation_client, "generate", lambda model, prompt: {"response": "not valid json"}
    )

    outcome = ai_evaluation_service.generate_ai_evaluation(QUESTION, EXPECTED_ANSWER, SUBMISSION)

    assert outcome.succeeded is False
    assert outcome.error == "json_parse_failed"
    assert outcome.evaluation is None


def test_schema_invalid_response_is_classified_as_schema_invalid(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        ai_evaluation_client,
        "generate",
        lambda model, prompt: {"response": '{"correctness": true}'},
    )

    outcome = ai_evaluation_service.generate_ai_evaluation(QUESTION, EXPECTED_ANSWER, SUBMISSION)

    assert outcome.succeeded is False
    assert outcome.error == "schema_invalid"
    assert outcome.evaluation is None
