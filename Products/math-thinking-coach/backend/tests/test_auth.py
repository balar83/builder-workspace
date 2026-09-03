from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import auth_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def _isolate_auth_stores(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(auth_service, "TEACHERS_PATH", tmp_path / "teachers.json")
    monkeypatch.setattr(auth_service, "CLASSES_PATH", tmp_path / "classes.json")
    monkeypatch.setattr(auth_service, "STUDENTS_PATH", tmp_path / "students.json")
    monkeypatch.setattr(auth_service, "LEARNERS_PATH", tmp_path / "learners.json")
    # The module-level `client` is reused across every test in this file and
    # keeps its own cookie jar - without clearing it, a session cookie set by
    # an earlier test (login/register/join) would silently carry into a later
    # test asserting "not logged in", making pass/fail depend on test order.
    client.cookies.clear()


def register_teacher(email="teacher@example.com", password="correct-horse", name="Ms. Rao"):
    return client.post(
        "/api/v1/auth/teacher/register",
        json={"email": email, "password": password, "name": name},
    )


def test_register_teacher_returns_public_profile_no_password_hash() -> None:
    response = register_teacher()

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "teacher@example.com"
    assert body["name"] == "Ms. Rao"
    assert "password" not in body
    assert "passwordHash" not in body


def test_register_teacher_rejects_duplicate_email() -> None:
    register_teacher()
    response = register_teacher()

    assert response.status_code == 400


def test_register_teacher_rejects_short_password() -> None:
    response = client.post(
        "/api/v1/auth/teacher/register",
        json={"email": "a@b.com", "password": "short", "name": "A"},
    )

    assert response.status_code == 400


def test_login_teacher_with_correct_password_succeeds() -> None:
    register_teacher()

    response = client.post(
        "/api/v1/auth/teacher/login",
        json={"email": "teacher@example.com", "password": "correct-horse"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == "teacher@example.com"


def test_login_teacher_with_wrong_password_fails() -> None:
    register_teacher()

    response = client.post(
        "/api/v1/auth/teacher/login",
        json={"email": "teacher@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 401


def test_teacher_session_persists_across_requests_via_cookie() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "persist@example.com", "password": "correct-horse", "name": "P"},
        )

        me = session_client.get("/api/v1/auth/me")

        assert me.status_code == 200
        assert me.json()["role"] == "teacher"


def test_create_class_requires_teacher_session() -> None:
    response = client.post("/api/v1/auth/teacher/classes", json={"name": "Section A"})

    assert response.status_code == 401


def test_create_class_returns_a_join_code() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "owner@example.com", "password": "correct-horse", "name": "Owner"},
        )

        response = session_client.post("/api/v1/auth/teacher/classes", json={"name": "Section A"})

        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "Section A"
        assert len(body["code"]) == 6


def _create_class() -> str:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": f"t-{id(session_client)}@example.com", "password": "correct-horse", "name": "T"},
        )
        response = session_client.post("/api/v1/auth/teacher/classes", json={"name": "Section A"})
        return response.json()["code"]


def test_student_join_with_unknown_class_code_fails() -> None:
    response = client.post(
        "/api/v1/auth/student/join",
        json={"classCode": "ZZZZZZ", "displayName": "Asha", "pin": "1234"},
    )

    assert response.status_code == 400


def test_student_join_and_login_round_trip() -> None:
    code = _create_class()

    join_response = client.post(
        "/api/v1/auth/student/join",
        json={"classCode": code, "displayName": "Asha", "pin": "1234"},
    )
    assert join_response.status_code == 200
    assert join_response.json()["displayName"] == "Asha"

    login_response = client.post(
        "/api/v1/auth/student/login",
        json={"classCode": code, "displayName": "Asha", "pin": "1234"},
    )
    assert login_response.status_code == 200

    wrong_pin_response = client.post(
        "/api/v1/auth/student/login",
        json={"classCode": code, "displayName": "Asha", "pin": "9999"},
    )
    assert wrong_pin_response.status_code == 401


def test_student_join_rejects_duplicate_display_name_in_same_class() -> None:
    code = _create_class()

    client.post(
        "/api/v1/auth/student/join",
        json={"classCode": code, "displayName": "Asha", "pin": "1234"},
    )
    response = client.post(
        "/api/v1/auth/student/join",
        json={"classCode": code, "displayName": "Asha", "pin": "5678"},
    )

    assert response.status_code == 400


def test_logout_clears_session() -> None:
    with TestClient(app) as session_client:
        session_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "logout@example.com", "password": "correct-horse", "name": "L"},
        )

        session_client.post("/api/v1/auth/logout")
        response = session_client.get("/api/v1/auth/me")

        assert response.status_code == 401


def test_me_returns_401_when_not_logged_in() -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_existing_content_routes_remain_unauthenticated() -> None:
    response = client.get("/api/v1/chapters")

    assert response.status_code == 200


# --- Self-serve learner identity (approved identity-foundation slice) -------


def test_start_learner_creates_a_session_with_student_role() -> None:
    with TestClient(app) as session_client:
        response = session_client.post("/api/v1/auth/learner/start")

        assert response.status_code == 200
        body = response.json()
        assert body["role"] == "student"
        assert body["id"].startswith("learner_")
        assert body["name"] is None


def test_start_learner_me_resolves_the_self_serve_identity() -> None:
    with TestClient(app) as session_client:
        start_response = session_client.post("/api/v1/auth/learner/start")
        learner_id = start_response.json()["id"]

        me = session_client.get("/api/v1/auth/me")

        assert me.status_code == 200
        assert me.json() == {"role": "student", "id": learner_id, "name": None}


def test_start_learner_is_idempotent_across_repeated_calls() -> None:
    """Safeguard 2: repeated initialization must preserve, not multiply, identity."""
    with TestClient(app) as session_client:
        first = session_client.post("/api/v1/auth/learner/start")
        second = session_client.post("/api/v1/auth/learner/start")
        third = session_client.post("/api/v1/auth/learner/start")

        first_id = first.json()["id"]
        assert second.json()["id"] == first_id
        assert third.json()["id"] == first_id

        learners = auth_service._read_store(auth_service.LEARNERS_PATH)
        assert len(learners) == 1


def test_start_learner_preserves_an_existing_class_connected_session() -> None:
    """A logged-in class-connected student calling this must not be replaced."""
    code = _create_class()
    with TestClient(app) as session_client:
        join_response = session_client.post(
            "/api/v1/auth/student/join",
            json={"classCode": code, "displayName": "Priya", "pin": "1234"},
        )
        student_id = join_response.json()["id"]

        start_response = session_client.post("/api/v1/auth/learner/start")

        assert start_response.status_code == 200
        body = start_response.json()
        assert body["id"] == student_id
        assert body["name"] == "Priya"
        assert not body["id"].startswith("learner_")

        learners = auth_service._read_store(auth_service.LEARNERS_PATH)
        assert learners == []


def test_learner_id_cannot_collide_with_a_student_id() -> None:
    """Safeguard 1: ids are structurally, not just probabilistically, disjoint."""
    learner = auth_service.create_self_serve_learner()
    student = auth_service.join_class(_create_class(), "Rohan", "4321")

    assert learner.id.startswith("learner_")
    assert not student.id.startswith("learner_")
    assert learner.id != student.id


def test_me_returns_401_for_a_stale_session_id_in_neither_store() -> None:
    with TestClient(app) as session_client:
        session_client.post("/api/v1/auth/learner/start")
        # Simulate the identity having been deleted server-side (e.g. a data
        # reset) while the signed cookie itself is still valid.
        auth_service.LEARNERS_PATH.unlink()

        response = session_client.get("/api/v1/auth/me")

        assert response.status_code == 401


def test_existing_student_teacher_and_content_flows_are_unaffected() -> None:
    """Regression: the self-serve addition changes nothing about class-connected auth."""
    code = _create_class()

    join_response = client.post(
        "/api/v1/auth/student/join",
        json={"classCode": code, "displayName": "Meera", "pin": "1234"},
    )
    assert join_response.status_code == 200
    assert join_response.json()["classId"]

    chapters_response = client.get("/api/v1/chapters")
    assert chapters_response.status_code == 200
