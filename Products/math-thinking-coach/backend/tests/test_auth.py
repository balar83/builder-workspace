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
