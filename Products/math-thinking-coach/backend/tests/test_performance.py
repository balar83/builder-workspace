from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import attempt_service, auth_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def _isolate_stores(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(attempt_service, "DB_PATH", tmp_path / "attempts.db")
    monkeypatch.setattr(auth_service, "TEACHERS_PATH", tmp_path / "teachers.json")
    monkeypatch.setattr(auth_service, "CLASSES_PATH", tmp_path / "classes.json")
    monkeypatch.setattr(auth_service, "STUDENTS_PATH", tmp_path / "students.json")
    client.cookies.clear()


def test_performance_requires_a_student_session() -> None:
    response = client.get("/api/v1/performance/me")

    assert response.status_code == 401


def test_teacher_session_cannot_read_student_performance() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "teacher@example.com", "password": "correct-horse", "name": "T"},
        )

        response = session_client.get("/api/v1/performance/me")

        assert response.status_code == 401


def test_performance_returns_the_logged_in_students_own_data() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "teacher2@example.com", "password": "correct-horse", "name": "T"},
        )
        class_code = session_client.post("/api/v1/auth/teacher/classes", json={"name": "Section A"}).json()["code"]

    with TestClient(app) as student_client:
        student_client.post(
            "/api/v1/auth/student/join",
            json={"classCode": class_code, "displayName": "Asha", "pin": "1234"},
        )
        student_id = student_client.get("/api/v1/auth/me").json()["id"]

        attempt_service.record_attempt(
            student_id=student_id, question_id="q1", chapter_id="c1", topic_id="topic-a",
            difficulty="Easy", is_correct=True, attempt_number=1,
        )

        response = student_client.get("/api/v1/performance/me")

        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["topicId"] == "topic-a"
        assert body[0]["questionsAttempted"] == 1
