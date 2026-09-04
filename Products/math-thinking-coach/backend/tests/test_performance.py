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


# --- /performance/me/activity (Progress Hub V1) -----------------------------


def test_activity_requires_a_student_session() -> None:
    response = client.get("/api/v1/performance/me/activity")

    assert response.status_code == 401


def test_teacher_session_cannot_read_student_activity() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "teacher6@example.com", "password": "correct-horse", "name": "T"},
        )

        response = session_client.get("/api/v1/performance/me/activity")

        assert response.status_code == 401


def test_activity_returns_the_logged_in_students_own_data_with_the_expected_shape() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "teacher7@example.com", "password": "correct-horse", "name": "T"},
        )
        class_code = session_client.post("/api/v1/auth/teacher/classes", json={"name": "Section D"}).json()["code"]

    with TestClient(app) as student_client:
        student_client.post(
            "/api/v1/auth/student/join",
            json={"classCode": class_code, "displayName": "Dev", "pin": "1234"},
        )
        student_id = student_client.get("/api/v1/auth/me").json()["id"]

        attempt_service.record_attempt(
            student_id=student_id, question_id="rn-q01", chapter_id="rational-numbers",
            topic_id="topic-a", difficulty="Easy", is_correct=True, attempt_number=1,
        )

        response = student_client.get("/api/v1/performance/me/activity")

        assert response.status_code == 200
        body = response.json()
        assert set(body.keys()) == {"recentAttempts", "chapterActivity"}

        assert len(body["recentAttempts"]) == 1
        assert set(body["recentAttempts"][0].keys()) == {"questionId", "chapterId", "isCorrect", "createdAt"}
        assert body["recentAttempts"][0]["questionId"] == "rn-q01"

        # Every curriculum chapter is listed, not just ones with activity
        # (approved V1 UX decision) - 7 real chapters, only one of which
        # (rational-numbers) has a real attempt here.
        assert len(body["chapterActivity"]) == 7
        assert set(body["chapterActivity"][0].keys()) == {
            "chapterId", "chapterTitle", "questionsAttempted",
            "questionsCorrect", "accuracy", "lastActivityAt",
        }
        rational_numbers = next(c for c in body["chapterActivity"] if c["chapterId"] == "rational-numbers")
        assert rational_numbers["questionsAttempted"] == 1

        zero_activity_chapter = next(c for c in body["chapterActivity"] if c["chapterId"] == "practical-geometry")
        assert zero_activity_chapter["questionsAttempted"] == 0
        assert zero_activity_chapter["questionsCorrect"] == 0
        assert zero_activity_chapter["accuracy"] == 0.0
        assert zero_activity_chapter["lastActivityAt"] is None


def test_activity_lists_all_curriculum_chapters_zero_filled_for_a_student_with_no_attempts() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "teacher8@example.com", "password": "correct-horse", "name": "T"},
        )
        class_code = session_client.post("/api/v1/auth/teacher/classes", json={"name": "Section E"}).json()["code"]

    with TestClient(app) as student_client:
        student_client.post(
            "/api/v1/auth/student/join",
            json={"classCode": class_code, "displayName": "Ela", "pin": "1234"},
        )

        response = student_client.get("/api/v1/performance/me/activity")

        assert response.status_code == 200
        body = response.json()
        assert body["recentAttempts"] == []
        assert len(body["chapterActivity"]) == 7
        assert all(c["questionsAttempted"] == 0 for c in body["chapterActivity"])
        assert all(c["lastActivityAt"] is None for c in body["chapterActivity"])
        assert {c["chapterId"] for c in body["chapterActivity"]} == {
            "rational-numbers", "linear-equations", "understanding-quadrilaterals",
            "practical-geometry", "data-handling", "squares-and-cubes", "exponents-and-powers",
        }


def test_existing_performance_and_concept_contracts_are_unchanged_by_the_new_activity_endpoint() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "teacher9@example.com", "password": "correct-horse", "name": "T"},
        )
        class_code = session_client.post("/api/v1/auth/teacher/classes", json={"name": "Section F"}).json()["code"]

    with TestClient(app) as student_client:
        student_client.post(
            "/api/v1/auth/student/join",
            json={"classCode": class_code, "displayName": "Fahim", "pin": "1234"},
        )
        student_id = student_client.get("/api/v1/auth/me").json()["id"]

        attempt_service.record_attempt(
            student_id=student_id, question_id="le-q01", chapter_id="linear-equations",
            topic_id="topic-linear-equations-one-variable", difficulty="Easy",
            is_correct=True, attempt_number=1,
        )

        performance_response = student_client.get("/api/v1/performance/me")
        concepts_response = student_client.get("/api/v1/performance/me/concepts")

        assert performance_response.status_code == 200
        assert set(performance_response.json()[0].keys()) == {
            "topicId", "questionsAttempted", "questionsCorrect",
            "accuracy", "currentStreak", "mastered",
        }
        assert concepts_response.status_code == 200
        assert set(concepts_response.json()[0].keys()) == {
            "conceptId", "conceptTitle", "topicId", "chapterId",
            "questionsAttempted", "questionsCorrect", "accuracy",
        }


# --- /performance/me/mistakes (Self-Serve Learning Loop V1, Slice 3) -------


def test_mistakes_requires_a_student_session() -> None:
    response = client.get("/api/v1/performance/me/mistakes")

    assert response.status_code == 401


def test_teacher_session_cannot_read_student_mistakes() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "teacher10@example.com", "password": "correct-horse", "name": "T"},
        )

        response = session_client.get("/api/v1/performance/me/mistakes")

        assert response.status_code == 401


def test_mistakes_returns_only_the_logged_in_students_own_unresolved_mistakes() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "teacher11@example.com", "password": "correct-horse", "name": "T"},
        )
        class_code = session_client.post("/api/v1/auth/teacher/classes", json={"name": "Section G"}).json()["code"]

    with TestClient(app) as student_a, TestClient(app) as student_b:
        student_a.post(
            "/api/v1/auth/student/join",
            json={"classCode": class_code, "displayName": "Gita", "pin": "1234"},
        )
        student_a_id = student_a.get("/api/v1/auth/me").json()["id"]
        student_b.post(
            "/api/v1/auth/student/join",
            json={"classCode": class_code, "displayName": "Hari", "pin": "1234"},
        )

        attempt_service.record_attempt(
            student_id=student_a_id, question_id="rn-q01", chapter_id="rational-numbers",
            topic_id="topic-a", difficulty="Easy", is_correct=False, attempt_number=1,
        )

        response_a = student_a.get("/api/v1/performance/me/mistakes")
        response_b = student_b.get("/api/v1/performance/me/mistakes")

        assert response_a.status_code == 200
        assert len(response_a.json()) == 1
        assert response_a.json()[0]["questionId"] == "rn-q01"

        assert response_b.status_code == 200
        assert response_b.json() == []


def test_mistakes_response_shape() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "teacher12@example.com", "password": "correct-horse", "name": "T"},
        )
        class_code = session_client.post("/api/v1/auth/teacher/classes", json={"name": "Section H"}).json()["code"]

    with TestClient(app) as student_client:
        student_client.post(
            "/api/v1/auth/student/join",
            json={"classCode": class_code, "displayName": "Iqbal", "pin": "1234"},
        )
        student_id = student_client.get("/api/v1/auth/me").json()["id"]

        attempt_service.record_attempt(
            student_id=student_id, question_id="rn-q01", chapter_id="rational-numbers",
            topic_id="topic-rational-numbers-properties-and-operations", difficulty="Easy",
            is_correct=False, attempt_number=1,
        )

        response = student_client.get("/api/v1/performance/me/mistakes")

        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert set(body[0].keys()) == {"questionId", "chapterId", "chapterTitle", "topicId", "lastAttemptAt"}
        assert body[0]["chapterId"] == "rational-numbers"
        assert body[0]["chapterTitle"] == "Rational Numbers"


def test_a_resolved_question_does_not_appear_in_mistakes() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "teacher13@example.com", "password": "correct-horse", "name": "T"},
        )
        class_code = session_client.post("/api/v1/auth/teacher/classes", json={"name": "Section I"}).json()["code"]

    with TestClient(app) as student_client:
        student_client.post(
            "/api/v1/auth/student/join",
            json={"classCode": class_code, "displayName": "Jaya", "pin": "1234"},
        )
        student_id = student_client.get("/api/v1/auth/me").json()["id"]

        attempt_service.record_attempt(
            student_id=student_id, question_id="rn-q01", chapter_id="rational-numbers",
            topic_id="topic-a", difficulty="Easy", is_correct=False, attempt_number=1,
        )
        attempt_service.record_attempt(
            student_id=student_id, question_id="rn-q01", chapter_id="rational-numbers",
            topic_id="topic-a", difficulty="Easy", is_correct=True, attempt_number=2,
        )

        response = student_client.get("/api/v1/performance/me/mistakes")

        assert response.status_code == 200
        assert response.json() == []


def test_existing_performance_and_activity_contracts_are_unchanged_by_the_new_mistakes_endpoint() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "teacher14@example.com", "password": "correct-horse", "name": "T"},
        )
        class_code = session_client.post("/api/v1/auth/teacher/classes", json={"name": "Section J"}).json()["code"]

    with TestClient(app) as student_client:
        student_client.post(
            "/api/v1/auth/student/join",
            json={"classCode": class_code, "displayName": "Kabir", "pin": "1234"},
        )
        student_id = student_client.get("/api/v1/auth/me").json()["id"]

        attempt_service.record_attempt(
            student_id=student_id, question_id="le-q01", chapter_id="linear-equations",
            topic_id="topic-linear-equations-one-variable", difficulty="Easy",
            is_correct=True, attempt_number=1,
        )

        performance_response = student_client.get("/api/v1/performance/me")
        activity_response = student_client.get("/api/v1/performance/me/activity")

        assert performance_response.status_code == 200
        assert set(performance_response.json()[0].keys()) == {
            "topicId", "questionsAttempted", "questionsCorrect",
            "accuracy", "currentStreak", "mastered",
        }
        assert activity_response.status_code == 200
        assert set(activity_response.json().keys()) == {"recentAttempts", "chapterActivity"}


# --- /performance/me/recovery (Self-Serve Learning Loop V1, Slice 4) -------


def test_recovery_requires_a_student_session() -> None:
    response = client.get("/api/v1/performance/me/recovery")

    assert response.status_code == 401


def test_teacher_session_cannot_read_student_recovery_metrics() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "teacher15@example.com", "password": "correct-horse", "name": "T"},
        )

        response = session_client.get("/api/v1/performance/me/recovery")

        assert response.status_code == 401


def test_recovery_returns_only_the_logged_in_students_own_data() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "teacher16@example.com", "password": "correct-horse", "name": "T"},
        )
        class_code = session_client.post("/api/v1/auth/teacher/classes", json={"name": "Section K"}).json()["code"]

    with TestClient(app) as student_a, TestClient(app) as student_b:
        student_a.post(
            "/api/v1/auth/student/join",
            json={"classCode": class_code, "displayName": "Leela", "pin": "1234"},
        )
        student_a_id = student_a.get("/api/v1/auth/me").json()["id"]
        student_b.post(
            "/api/v1/auth/student/join",
            json={"classCode": class_code, "displayName": "Mohan", "pin": "1234"},
        )

        attempt_service.record_attempt(
            student_id=student_a_id, question_id="rn-q01", chapter_id="rational-numbers",
            topic_id="topic-a", difficulty="Easy", is_correct=True, attempt_number=1,
        )

        response_a = student_a.get("/api/v1/performance/me/recovery")
        response_b = student_b.get("/api/v1/performance/me/recovery")

        assert response_a.status_code == 200
        assert response_a.json()["lifetime"]["firstAttemptAccuracy"]["attempted"] == 1

        assert response_b.status_code == 200
        assert response_b.json()["lifetime"]["firstAttemptAccuracy"]["attempted"] == 0
        assert response_b.json()["lifetime"]["firstAttemptAccuracy"]["accuracy"] is None


def test_recovery_response_contract_and_insufficient_evidence_semantics() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "teacher17@example.com", "password": "correct-horse", "name": "T"},
        )
        class_code = session_client.post("/api/v1/auth/teacher/classes", json={"name": "Section L"}).json()["code"]

    with TestClient(app) as student_client:
        student_client.post(
            "/api/v1/auth/student/join",
            json={"classCode": class_code, "displayName": "Nasrin", "pin": "1234"},
        )

        response = student_client.get("/api/v1/performance/me/recovery")

        assert response.status_code == 200
        body = response.json()
        assert set(body.keys()) == {"lifetime", "recent", "hasRecentActivity", "chapters"}
        assert set(body["lifetime"].keys()) == {"firstAttemptAccuracy", "eventualAccuracy", "recovery"}
        assert set(body["lifetime"]["firstAttemptAccuracy"].keys()) == {"correct", "attempted", "accuracy"}
        assert set(body["lifetime"]["recovery"].keys()) == {"recovered", "initiallyWrong", "rate", "sufficientSample"}
        assert set(body["chapters"][0].keys()) == {"chapterId", "chapterTitle", "lifetime", "recent", "hasRecentActivity"}

        # A fresh learner: explicit insufficient-evidence, never a fake 0%.
        assert body["lifetime"]["firstAttemptAccuracy"]["attempted"] == 0
        assert body["lifetime"]["firstAttemptAccuracy"]["accuracy"] is None
        assert body["lifetime"]["recovery"]["rate"] is None
        assert body["lifetime"]["recovery"]["sufficientSample"] is False
        assert body["hasRecentActivity"] is False
        # Every curriculum chapter is listed, matching the Progress Hub's
        # chapter-first framing, even with zero evidence.
        assert len(body["chapters"]) == 7


def test_existing_performance_and_mistakes_contracts_are_unchanged_by_the_new_recovery_endpoint() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "teacher18@example.com", "password": "correct-horse", "name": "T"},
        )
        class_code = session_client.post("/api/v1/auth/teacher/classes", json={"name": "Section M"}).json()["code"]

    with TestClient(app) as student_client:
        student_client.post(
            "/api/v1/auth/student/join",
            json={"classCode": class_code, "displayName": "Omar", "pin": "1234"},
        )
        student_id = student_client.get("/api/v1/auth/me").json()["id"]

        attempt_service.record_attempt(
            student_id=student_id, question_id="le-q01", chapter_id="linear-equations",
            topic_id="topic-linear-equations-one-variable", difficulty="Easy",
            is_correct=True, attempt_number=1,
        )

        performance_response = student_client.get("/api/v1/performance/me")
        mistakes_response = student_client.get("/api/v1/performance/me/mistakes")

        assert performance_response.status_code == 200
        assert set(performance_response.json()[0].keys()) == {
            "topicId", "questionsAttempted", "questionsCorrect",
            "accuracy", "currentStreak", "mastered",
        }
        assert mistakes_response.status_code == 200
        assert mistakes_response.json() == []
