"""
End-to-end verification for the approved self-serve learner identity slice.

Exercises the existing, unmodified learning engine (session creation, the
standalone /answer route, and /performance/me) through a SelfServeLearner
identity instead of a class-connected Student, proving the engine is
genuinely identity-agnostic - none of these routes or services were touched
to make this work.
"""

import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import attempt_service, auth_service, session_store

client = TestClient(app)


@pytest.fixture(autouse=True)
def _isolate_stores(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(attempt_service, "DB_PATH", tmp_path / "runtime.db")
    monkeypatch.setattr(session_store, "DB_PATH", tmp_path / "runtime.db")
    monkeypatch.setattr(auth_service, "TEACHERS_PATH", tmp_path / "teachers.json")
    monkeypatch.setattr(auth_service, "CLASSES_PATH", tmp_path / "classes.json")
    monkeypatch.setattr(auth_service, "STUDENTS_PATH", tmp_path / "students.json")
    monkeypatch.setattr(auth_service, "LEARNERS_PATH", tmp_path / "learners.json")
    client.cookies.clear()


def _learner_client() -> TestClient:
    learner_client = TestClient(app)
    learner_client.post("/api/v1/auth/learner/start")
    return learner_client


def test_self_serve_learner_can_create_a_session_and_answer_via_the_unmodified_engine() -> None:
    learner = _learner_client()
    learner_id = learner.get("/api/v1/auth/me").json()["id"]
    assert learner_id.startswith("learner_")

    session_id = learner.post(
        "/api/v1/sessions", json={"chapterId": "rational-numbers", "mode": "practice", "questionCount": 1}
    ).json()["sessionId"]
    assert session_id

    current = learner.get(f"/api/v1/sessions/{session_id}/current-question")
    assert current.status_code == 200
    question_id = current.json()["question"]["id"]

    submit = learner.post(
        f"/api/v1/sessions/{session_id}/answer",
        json={"position": 0, "answer": "anything"},
    )
    assert submit.status_code == 200

    # attempt_service.record_attempt() (unmodified) wrote the row under the
    # self-serve learner's id, exactly like it would for a Student id.
    performance = attempt_service.get_performance(learner_id)
    assert performance[0]["questionsAttempted"] == 1
    assert performance[0]["topicId"]

    # /performance/me (unmodified route) reflects the same attempt.
    me_performance = learner.get("/api/v1/performance/me")
    assert me_performance.status_code == 200
    assert me_performance.json() == performance

    assert question_id  # sanity: a real question was actually served


def test_self_serve_learner_can_answer_via_the_standalone_answer_route() -> None:
    """Covers the /questions/{id}/answer entry point (not just the session flow)."""
    learner = _learner_client()
    learner_id = learner.get("/api/v1/auth/me").json()["id"]

    question = learner.get("/api/v1/chapters/rational-numbers/questions").json()[0]

    response = learner.post(
        f"/api/v1/questions/{question['id']}/answer",
        json={"submission": {"answer": "anything", "attemptNumber": 1}},
    )
    assert response.status_code == 200

    performance = attempt_service.get_performance(learner_id)
    # rational-numbers' first question may or may not carry a topicId
    # (topic-bearing chapters only) - assert on the raw attempt row instead
    # of the topic-scoped aggregate, so this test doesn't depend on which
    # question happens to be first.
    conn = sqlite3.connect(attempt_service.DB_PATH)
    try:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT student_id, question_id FROM attempts WHERE student_id = ?", (learner_id,)
        ).fetchone()
    finally:
        conn.close()

    assert row["student_id"] == learner_id
    assert row["question_id"] == question["id"]
    assert isinstance(performance, list)  # unmodified aggregation still runs without error


def test_two_self_serve_learners_have_independent_histories() -> None:
    learner_a = _learner_client()
    learner_b = _learner_client()

    id_a = learner_a.get("/api/v1/auth/me").json()["id"]
    id_b = learner_b.get("/api/v1/auth/me").json()["id"]
    assert id_a != id_b

    session_id = learner_a.post(
        "/api/v1/sessions", json={"chapterId": "rational-numbers", "mode": "practice", "questionCount": 1}
    ).json()["sessionId"]
    learner_a.post(f"/api/v1/sessions/{session_id}/answer", json={"position": 0, "answer": "anything"})

    assert len(attempt_service.get_performance(id_a)) == 1
    assert attempt_service.get_performance(id_b) == []


def test_class_connected_and_self_serve_learners_do_not_interfere() -> None:
    """Regression: both identity kinds fully operable side by side."""
    with TestClient(app) as teacher_client:
        teacher_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "t@example.com", "password": "correct-horse", "name": "T"},
        )
        code = teacher_client.post("/api/v1/auth/teacher/classes", json={"name": "Section A"}).json()["code"]

    student = TestClient(app)
    student.post("/api/v1/auth/student/join", json={"classCode": code, "displayName": "Asha", "pin": "1234"})
    student_id = student.get("/api/v1/auth/me").json()["id"]

    learner = _learner_client()
    learner_id = learner.get("/api/v1/auth/me").json()["id"]

    student_session = student.post(
        "/api/v1/sessions", json={"chapterId": "rational-numbers", "mode": "practice", "questionCount": 1}
    ).json()["sessionId"]
    student.post(f"/api/v1/sessions/{student_session}/answer", json={"position": 0, "answer": "anything"})

    learner_session = learner.post(
        "/api/v1/sessions", json={"chapterId": "rational-numbers", "mode": "practice", "questionCount": 1}
    ).json()["sessionId"]
    learner.post(f"/api/v1/sessions/{learner_session}/answer", json={"position": 0, "answer": "anything"})

    assert len(attempt_service.get_performance(student_id)) == 1
    assert len(attempt_service.get_performance(learner_id)) == 1
    assert student_id != learner_id
