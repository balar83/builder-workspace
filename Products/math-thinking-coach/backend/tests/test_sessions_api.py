from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import attempt_service, auth_service, session_store

client = TestClient(app)

ANSWERS = {
    "rn-q01": "Yes",
    "rn-q02": "1/2",
    "rn-q03": "the square root of 2",
    "rn-q04": "-2/3",
    "rn-q05": "Yes",
    "rn-q06": "Yes",
    "rn-q07": "Addition",
    "rn-q08": "7/20",
    "rn-q09": "Commutativity of addition",
    "rn-q10": "Associativity of addition",
    "rn-q11": "No",
    "rn-q12": "-1/7",
    "rn-q13": "No",
    "rn-q14": "0",
    "rn-q15": "1",
    "rn-q16": "3/4",
    "rn-q17": "Distributivity of multiplication over addition",
    "rn-q18": "5/9",
    "rn-q19": "-3/8",
    "rn-q20": "9/5",
    "rn-q21": "-1/7",
    "rn-q22": "No",
    "rn-q23": "-4/9",
    "rn-q24": "1",
    "rn-q25": "1",
    "rn-q26": "1/2",
    "rn-q27": "3/8",
    "rn-q28": "5/2",
    "rn-q29": "0",
    "rn-q30": "7/10",
    "rn-q31": "Infinite",
    "rn-q32": "-5/2",
    "rn-q33": "Yes",
    "rn-q34": "15/5",
    "rn-q35": "-3/4",
    "rn-q36": "1",
    "rn-q37": "-7/4",
    "rn-q38": "5/9",
    "rn-q39": "1/10",
    "rn-q40": "No",
}


@pytest.fixture(autouse=True)
def _isolate_stores(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(attempt_service, "DB_PATH", tmp_path / "runtime.db")
    monkeypatch.setattr(session_store, "DB_PATH", tmp_path / "runtime.db")
    monkeypatch.setattr(auth_service, "TEACHERS_PATH", tmp_path / "teachers.json")
    monkeypatch.setattr(auth_service, "CLASSES_PATH", tmp_path / "classes.json")
    monkeypatch.setattr(auth_service, "STUDENTS_PATH", tmp_path / "students.json")
    client.cookies.clear()


def _student_client(name="Asha") -> TestClient:
    with TestClient(app) as teacher_client:
        teacher_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": f"t-{id(teacher_client)}@example.com", "password": "correct-horse", "name": "T"},
        )
        code = teacher_client.post("/api/v1/auth/teacher/classes", json={"name": "Section A"}).json()["code"]

    student_client = TestClient(app)
    student_client.post(
        "/api/v1/auth/student/join",
        json={"classCode": code, "displayName": name, "pin": "1234"},
    )
    return student_client


def test_create_session_requires_a_student_session() -> None:
    response = client.post("/api/v1/sessions", json={"chapterId": "rational-numbers", "mode": "practice"})

    assert response.status_code == 401


def test_teacher_session_cannot_create_a_session() -> None:
    with TestClient(app) as teacher_client:
        teacher_client.post(
            "/api/v1/auth/teacher/register",
            json={"email": "teacher@example.com", "password": "correct-horse", "name": "T"},
        )
        response = teacher_client.post(
            "/api/v1/sessions", json={"chapterId": "rational-numbers", "mode": "practice"}
        )

        assert response.status_code == 401


def test_create_session_returns_only_summary_fields_no_question_content() -> None:
    student = _student_client()

    response = student.post(
        "/api/v1/sessions", json={"chapterId": "rational-numbers", "mode": "practice", "questionCount": 5}
    )

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"sessionId", "targetCount", "actualCount", "shortfall"}
    assert body["actualCount"] == 5
    assert body["shortfall"] is False


def test_create_session_rejects_a_configuration_yielding_zero_questions() -> None:
    student = _student_client()

    response = student.post(
        "/api/v1/sessions", json={"chapterId": "no-such-chapter", "mode": "practice"}
    )

    assert response.status_code == 400


def test_create_session_rejects_non_positive_time_limit() -> None:
    student = _student_client()

    response = student.post(
        "/api/v1/sessions",
        json={"chapterId": "rational-numbers", "mode": "test", "timeLimitMinutes": 0},
    )

    assert response.status_code == 422


def test_question_1_and_question_5_use_the_same_endpoint() -> None:
    student = _student_client()
    session_id = student.post(
        "/api/v1/sessions", json={"chapterId": "rational-numbers", "mode": "practice", "questionCount": 5}
    ).json()["sessionId"]

    # Walk through all 5 questions via the exact same GET, answering correctly each time.
    for expected_position in range(5):
        current = student.get(f"/api/v1/sessions/{session_id}/current-question")
        assert current.status_code == 200
        body = current.json()
        assert body["position"] == expected_position
        assert body["totalCount"] == 5
        assert "solution" in body["question"]

        answer = ANSWERS[body["question"]["id"]]
        submit = student.post(
            f"/api/v1/sessions/{session_id}/answer",
            json={"position": expected_position, "answer": answer},
        )
        assert submit.status_code == 200

    summary = student.get(f"/api/v1/sessions/{session_id}")
    assert summary.status_code == 200
    assert summary.json()["status"] == "completed"
    assert summary.json()["correctCount"] == 5


def test_current_question_carries_questiontype_and_responsespecification() -> None:
    """
    Slice 2 (M2): the session flow's QuestionContent must expose
    questionType/responseSpecification exactly like the standalone Question
    model does - otherwise SessionQuestionPage has no way to know how to
    render a served question. Rational Numbers is unmigrated (short_text),
    so this also doubles as a backward-compatibility check: existing
    session-served questions get the new fields with their default values,
    nothing else about the response changes.
    """
    student = _student_client()
    session_id = student.post(
        "/api/v1/sessions", json={"chapterId": "rational-numbers", "mode": "practice", "questionCount": 1}
    ).json()["sessionId"]

    current = student.get(f"/api/v1/sessions/{session_id}/current-question")
    assert current.status_code == 200
    question = current.json()["question"]
    assert question["questionType"] == "short_text"
    assert question["responseSpecification"] is None


def test_current_question_on_a_completed_session_returns_409() -> None:
    student = _student_client()
    session_id = student.post(
        "/api/v1/sessions", json={"chapterId": "rational-numbers", "mode": "practice", "questionCount": 1}
    ).json()["sessionId"]

    question = student.get(f"/api/v1/sessions/{session_id}/current-question").json()["question"]
    student.post(f"/api/v1/sessions/{session_id}/answer", json={"position": 0, "answer": ANSWERS[question["id"]]})

    response = student.get(f"/api/v1/sessions/{session_id}/current-question")

    assert response.status_code == 409
    assert response.json()["detail"]["status"] == "completed"


def test_stale_position_returns_409() -> None:
    student = _student_client()
    session_id = student.post(
        "/api/v1/sessions", json={"chapterId": "rational-numbers", "mode": "practice", "questionCount": 5}
    ).json()["sessionId"]
    question = student.get(f"/api/v1/sessions/{session_id}/current-question").json()["question"]
    student.post(f"/api/v1/sessions/{session_id}/answer", json={"position": 0, "answer": ANSWERS[question["id"]]})

    response = student.post(f"/api/v1/sessions/{session_id}/answer", json={"position": 0, "answer": "anything"})

    assert response.status_code == 409


def test_unknown_session_returns_404() -> None:
    student = _student_client()

    response = student.get("/api/v1/sessions/no-such-session/current-question")

    assert response.status_code == 404


def test_a_different_students_session_is_not_accessible() -> None:
    student_a = _student_client("Asha")
    session_id = student_a.post(
        "/api/v1/sessions", json={"chapterId": "rational-numbers", "mode": "practice"}
    ).json()["sessionId"]

    student_b = _student_client("Ravi")
    response = student_b.get(f"/api/v1/sessions/{session_id}/current-question")

    assert response.status_code == 404


def test_submit_answer_request_has_no_attempt_number_field() -> None:
    student = _student_client()
    session_id = student.post(
        "/api/v1/sessions", json={"chapterId": "rational-numbers", "mode": "practice"}
    ).json()["sessionId"]
    question = student.get(f"/api/v1/sessions/{session_id}/current-question").json()["question"]

    # Only position and answer are accepted - an attemptNumber, if sent, is
    # simply ignored by the schema (extra fields are dropped by default).
    response = student.post(
        f"/api/v1/sessions/{session_id}/answer",
        json={"position": 0, "answer": ANSWERS[question["id"]], "attemptNumber": 99},
    )

    assert response.status_code == 200
    assert response.json()["ui"]["hintLevel"] == 0  # correct-answer response, unaffected by the extra field


def test_session_summary_reports_time_limit_for_test_mode() -> None:
    student = _student_client()
    session_id = student.post(
        "/api/v1/sessions",
        json={"chapterId": "rational-numbers", "mode": "test", "timeLimitMinutes": 15},
    ).json()["sessionId"]

    summary = student.get(f"/api/v1/sessions/{session_id}")

    assert summary.status_code == 200
    assert summary.json()["timeLimitMinutes"] == 15


def test_session_summary_reports_no_time_limit_for_practice_mode() -> None:
    student = _student_client()
    session_id = student.post(
        "/api/v1/sessions", json={"chapterId": "rational-numbers", "mode": "practice"}
    ).json()["sessionId"]

    summary = student.get(f"/api/v1/sessions/{session_id}")

    assert summary.status_code == 200
    assert summary.json()["timeLimitMinutes"] is None
