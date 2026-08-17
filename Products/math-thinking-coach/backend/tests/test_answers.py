import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services import ai_evaluation_client, attempt_service, auth_service

client = TestClient(app)

QUESTION_ID = "rn-q01"
QUESTION_URL = f"/api/v1/questions/{QUESTION_ID}/answer"


@pytest.fixture(autouse=True)
def _isolate_shadow_evaluation_from_the_network(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """
    Shadow Mode dispatches a real evaluator call on every /answer request
    (see app/api/routes/answers.py). Every test in this file must stay fast
    and deterministic regardless of whether a local Ollama server happens to
    be running on the machine running the tests — so the network call is
    stubbed out by default. Tests that specifically exercise shadow-mode
    integration override this within the test itself.
    """
    monkeypatch.setattr(settings, "shadow_log_path", str(tmp_path / "shadow_eval_log.jsonl"))
    monkeypatch.setattr(
        ai_evaluation_client,
        "generate",
        lambda model, prompt: {
            "response": (
                '{"correctness": true, "confidence": 0.9, "reasoning_quality": "SOUND", '
                '"misconception_tags": [], "explanation": "stubbed for test isolation"}'
            )
        },
    )
    monkeypatch.setattr(attempt_service, "DB_PATH", tmp_path / "attempts.db")
    monkeypatch.setattr(auth_service, "TEACHERS_PATH", tmp_path / "teachers.json")
    monkeypatch.setattr(auth_service, "CLASSES_PATH", tmp_path / "classes.json")
    monkeypatch.setattr(auth_service, "STUDENTS_PATH", tmp_path / "students.json")
    client.cookies.clear()


def submit(answer: str, attempt_number: int):
    return client.post(
        QUESTION_URL,
        json={"submission": {"answer": answer, "attemptNumber": attempt_number}},
    )


def test_correct_answer_returns_next_question() -> None:
    response = submit("Yes", 1)

    assert response.status_code == 200
    assert response.json() == {
        "evaluation": {
            "isCorrect": True,
            "score": 1.0,
            "maxScore": 1.0,
            "evaluatorId": "short_text_v1",
            "scoreBreakdown": None,
            "confidence": None,
        },
        "coach": {
            "message": "Excellent! You solved it correctly.",
            "nextAction": "NEXT_QUESTION",
        },
        "ui": {"canTryAgain": False, "canRevealSolution": False, "hintLevel": 0},
    }


def test_correct_answer_ignores_leading_and_trailing_spaces() -> None:
    response = submit("  Yes  ", 1)

    assert response.status_code == 200
    assert response.json()["evaluation"]["isCorrect"] is True


def test_incorrect_first_attempt_returns_try_again() -> None:
    response = submit("wrong", 1)

    assert response.status_code == 200
    assert response.json() == {
        "evaluation": {
            "isCorrect": False,
            "score": 0.0,
            "maxScore": 1.0,
            "evaluatorId": "short_text_v1",
            "scoreBreakdown": None,
            "confidence": None,
        },
        "coach": {
            "message": "Not quite. Try solving it once more before using a hint.",
            "nextAction": "TRY_AGAIN",
        },
        "ui": {"canTryAgain": True, "canRevealSolution": False, "hintLevel": 0},
    }


def test_incorrect_second_attempt_returns_show_hint() -> None:
    response = submit("wrong", 2)

    assert response.status_code == 200
    assert response.json() == {
        "evaluation": {
            "isCorrect": False,
            "score": 0.0,
            "maxScore": 1.0,
            "evaluatorId": "short_text_v1",
            "scoreBreakdown": None,
            "confidence": None,
        },
        "coach": {
            "message": "Good effort. Here's a hint to help you.",
            "nextAction": "SHOW_HINT",
        },
        "ui": {"canTryAgain": True, "canRevealSolution": False, "hintLevel": 1},
    }


def test_incorrect_third_attempt_returns_show_solution() -> None:
    response = submit("wrong", 3)

    assert response.status_code == 200
    assert response.json() == {
        "evaluation": {
            "isCorrect": False,
            "score": 0.0,
            "maxScore": 1.0,
            "evaluatorId": "short_text_v1",
            "scoreBreakdown": None,
            "confidence": None,
        },
        "coach": {
            "message": "If you're still stuck, you can view the solution.",
            "nextAction": "SHOW_SOLUTION",
        },
        "ui": {"canTryAgain": False, "canRevealSolution": True, "hintLevel": 2},
    }


def test_incorrect_fourth_attempt_still_returns_show_solution() -> None:
    response = submit("wrong", 4)

    assert response.status_code == 200
    assert response.json()["coach"]["nextAction"] == "SHOW_SOLUTION"


def test_submit_answer_returns_404_for_unknown_question() -> None:
    response = client.post(
        "/api/v1/questions/unknown-question/answer",
        json={"submission": {"answer": "1/2", "attemptNumber": 1}},
    )

    assert response.status_code == 404


def test_empty_answer_is_treated_as_incorrect() -> None:
    response = submit("", 1)

    assert response.status_code == 200
    assert response.json()["evaluation"] == {
        "isCorrect": False,
        "score": 0.0,
        "maxScore": 1.0,
        "evaluatorId": "short_text_v1",
        "scoreBreakdown": None,
        "confidence": None,
    }
    assert response.json()["coach"]["nextAction"] == "TRY_AGAIN"


def test_missing_submission_field_returns_422() -> None:
    response = client.post(QUESTION_URL, json={})

    assert response.status_code == 422


def test_non_integer_attempt_number_returns_422() -> None:
    response = client.post(
        QUESTION_URL,
        json={"submission": {"answer": "1/2", "attemptNumber": "not-a-number"}},
    )

    assert response.status_code == 422


def test_missing_answer_field_returns_422() -> None:
    response = client.post(QUESTION_URL, json={"submission": {"attemptNumber": 1}})

    assert response.status_code == 422


def test_response_is_unaffected_when_shadow_evaluation_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def explode(model: str, prompt: str) -> dict:
        raise RuntimeError("shadow evaluator is down")

    monkeypatch.setattr(ai_evaluation_client, "generate", explode)

    response = submit("Yes", 1)

    assert response.status_code == 200
    assert response.json() == {
        "evaluation": {
            "isCorrect": True,
            "score": 1.0,
            "maxScore": 1.0,
            "evaluatorId": "short_text_v1",
            "scoreBreakdown": None,
            "confidence": None,
        },
        "coach": {
            "message": "Excellent! You solved it correctly.",
            "nextAction": "NEXT_QUESTION",
        },
        "ui": {"canTryAgain": False, "canRevealSolution": False, "hintLevel": 0},
    }


def test_shadow_evaluation_writes_a_log_entry_alongside_the_response(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    log_path = tmp_path / "shadow_eval_log.jsonl"
    monkeypatch.setattr(settings, "shadow_log_path", str(log_path))

    response = submit("Yes", 1)

    assert response.status_code == 200
    records = [json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines()]
    assert len(records) == 1
    assert records[0]["questionId"] == QUESTION_ID
    assert records[0]["agreement"] is True


def test_shadow_mode_enabled_defaults_to_true() -> None:
    assert settings.shadow_mode_enabled is True


def test_disabling_shadow_mode_skips_the_background_task_entirely(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    log_path = tmp_path / "shadow_eval_log.jsonl"
    monkeypatch.setattr(settings, "shadow_log_path", str(log_path))
    monkeypatch.setattr(settings, "shadow_mode_enabled", False)

    def fail_if_called(model: str, prompt: str) -> dict:
        raise AssertionError("shadow evaluator should not be invoked when shadow mode is disabled")

    monkeypatch.setattr(ai_evaluation_client, "generate", fail_if_called)

    response = submit("Yes", 1)

    assert response.status_code == 200
    assert response.json()["coach"]["nextAction"] == "NEXT_QUESTION"
    assert not log_path.exists()


def _join_as_student() -> TestClient:
    session_client = TestClient(app)
    session_client.post(
        "/api/v1/auth/teacher/register",
        json={"email": f"t-{id(session_client)}@example.com", "password": "correct-horse", "name": "T"},
    )
    class_code = session_client.post("/api/v1/auth/teacher/classes", json={"name": "Section A"}).json()["code"]

    student_client = TestClient(app)
    student_client.post(
        "/api/v1/auth/student/join",
        json={"classCode": class_code, "displayName": "Asha", "pin": "1234"},
    )
    return student_client


def test_answer_is_not_recorded_without_a_student_session() -> None:
    response = submit("Yes", 1)

    assert response.status_code == 200
    assert attempt_service.get_performance("anyone") == []


def test_answer_is_recorded_when_a_student_is_logged_in() -> None:
    student_client = _join_as_student()
    student_id = student_client.get("/api/v1/auth/me").json()["id"]

    response = student_client.post(
        QUESTION_URL,
        json={"submission": {"answer": "Yes", "attemptNumber": 1}},
    )

    assert response.status_code == 200
    performance = attempt_service.get_performance(student_id)
    assert len(performance) == 1
    assert performance[0]["topicId"] == "topic-rational-numbers-properties-and-operations"
    assert performance[0]["questionsAttempted"] == 1
    assert performance[0]["questionsCorrect"] == 1


def test_response_is_unaffected_when_attempt_recording_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    def explode(*args, **kwargs) -> None:
        raise RuntimeError("attempt recording is down")

    monkeypatch.setattr(attempt_service, "record_attempt", explode)
    student_client = _join_as_student()

    response = student_client.post(
        QUESTION_URL,
        json={"submission": {"answer": "Yes", "attemptNumber": 1}},
    )

    assert response.status_code == 200
    assert response.json()["evaluation"]["isCorrect"] is True
