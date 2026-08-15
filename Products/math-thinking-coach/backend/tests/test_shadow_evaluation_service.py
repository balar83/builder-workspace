import json
from pathlib import Path

import pytest

from app.core.config import settings
from app.schemas.answer import AnswerSubmission, Evaluation
from app.services import ai_evaluation_client, shadow_evaluation_service

QUESTION_ID = "rn-q01"
SUBMISSION = AnswerSubmission(answer="Yes", attemptNumber=1)
RULE_BASED_EVALUATION = Evaluation(isCorrect=True, score=1.0)


def _read_log_lines(log_path: Path) -> list[dict]:
    return [json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines()]


def test_successful_run_logs_agreement(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    log_path = tmp_path / "shadow_eval_log.jsonl"
    monkeypatch.setattr(settings, "shadow_log_path", str(log_path))
    raw_response = (
        '{"correctness": true, "confidence": 0.95, "reasoning_quality": "SOUND", '
        '"misconception_tags": [], "explanation": "Correct."}'
    )
    monkeypatch.setattr(
        ai_evaluation_client, "generate", lambda model, prompt: {"response": raw_response}
    )

    shadow_evaluation_service.run_shadow_evaluation(QUESTION_ID, SUBMISSION, RULE_BASED_EVALUATION)

    records = _read_log_lines(log_path)
    assert len(records) == 1
    assert records[0]["questionId"] == QUESTION_ID
    assert records[0]["aiSucceeded"] is True
    assert records[0]["agreement"] is True


def test_disagreement_is_logged_as_false(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    log_path = tmp_path / "shadow_eval_log.jsonl"
    monkeypatch.setattr(settings, "shadow_log_path", str(log_path))
    raw_response = (
        '{"correctness": false, "confidence": 0.9, "reasoning_quality": "PARTIAL", '
        '"misconception_tags": ["incomplete_simplification"], "explanation": "Not simplified."}'
    )
    monkeypatch.setattr(
        ai_evaluation_client, "generate", lambda model, prompt: {"response": raw_response}
    )

    shadow_evaluation_service.run_shadow_evaluation(QUESTION_ID, SUBMISSION, RULE_BASED_EVALUATION)

    records = _read_log_lines(log_path)
    assert records[0]["agreement"] is False


def test_ai_failure_is_logged_with_null_agreement(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    log_path = tmp_path / "shadow_eval_log.jsonl"
    monkeypatch.setattr(settings, "shadow_log_path", str(log_path))

    def raise_timeout(model: str, prompt: str) -> dict:
        import httpx

        raise httpx.ReadTimeout("timed out")

    monkeypatch.setattr(ai_evaluation_client, "generate", raise_timeout)

    shadow_evaluation_service.run_shadow_evaluation(QUESTION_ID, SUBMISSION, RULE_BASED_EVALUATION)

    records = _read_log_lines(log_path)
    assert records[0]["aiSucceeded"] is False
    assert records[0]["aiError"] == "timeout"
    assert records[0]["agreement"] is None


def test_unknown_question_id_is_a_no_op(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    log_path = tmp_path / "shadow_eval_log.jsonl"
    monkeypatch.setattr(settings, "shadow_log_path", str(log_path))

    shadow_evaluation_service.run_shadow_evaluation(
        "unknown-question", SUBMISSION, RULE_BASED_EVALUATION
    )

    assert not log_path.exists()


def test_unexpected_exception_is_swallowed_not_raised(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    log_path = tmp_path / "shadow_eval_log.jsonl"
    monkeypatch.setattr(settings, "shadow_log_path", str(log_path))

    def explode(model: str, prompt: str) -> dict:
        raise RuntimeError("unexpected failure")

    monkeypatch.setattr(ai_evaluation_client, "generate", explode)

    shadow_evaluation_service.run_shadow_evaluation(QUESTION_ID, SUBMISSION, RULE_BASED_EVALUATION)
