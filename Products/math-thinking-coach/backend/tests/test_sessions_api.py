from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.question import Question, QuestionRemediation
from app.services import attempt_service, auth_service, evaluation_service, question_service, session_store

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
    "rn-q41": "Yes",
    "rn-q42": "-3/5",
    "rn-q43": "3/4",
    "rn-q44": "Yes",
    "rn-q45": "Subtraction",
    "rn-q46": "Yes",
    "rn-q47": "Commutativity of multiplication",
    "rn-q48": "1",
    "rn-q49": "No",
    "rn-q50": "0",
    "rn-q51": "1",
    "rn-q52": "2/9",
    "rn-q53": "-5/7",
    "rn-q54": "9/10",
    "rn-q55": "3/4",
    "rn-q56": "-13/8",
    "rn-q57": "-11/6",
    "rn-q58": "-1/2",
    "rn-q59": "3/5",
    "rn-q60": "3/8 and 7/16",
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


# --- Self-Serve Learning Loop V1, Slice 5: remediation threaded through the
# session answer response --------------------------------------------------
#
# session_builder's real selection is randomized over the whole chapter
# pool, so a session is built directly here (session_store.insert_session)
# with a single synthetic, remediation-carrying question at position 0 -
# the same "inject synthetic state, drive the real route" technique
# test_answers.py already uses for its single_choice tests - proving the
# real GET current-question / POST answer route pair, not session_builder's
# selection logic (already covered elsewhere).


def _seed_single_question_session(student_id: str, question: Question) -> str:
    from datetime import datetime, timezone

    from app.schemas.session import LearningSession, SelectedQuestion, SessionPlan, SessionState
    from app.services import session_store

    now = datetime.now(timezone.utc).isoformat()
    session_id = f"test-session-{question.id}"
    session_store.insert_session(
        LearningSession(
            sessionId=session_id,
            studentId=student_id,
            chapterId=question.chapterId,
            plan=SessionPlan(
                planId=session_id,
                studentId=student_id,
                chapterId=question.chapterId,
                mode="practice",
                difficultyDistribution={"Easy": 1, "Medium": 0, "Hard": 0},
                questionTypes=None,
                targetCount=1,
                timeLimitMinutes=None,
                weakConceptTopicIds=[],
                seed="test-seed",
            ),
            selectedQuestions=[
                SelectedQuestion(position=0, questionId=question.id, difficulty=question.difficulty, type=None)
            ],
            state=SessionState(
                status="not_started",
                currentPosition=0,
                attemptsOnCurrentQuestion=0,
                correctCount=0,
                hintsUsedTotal=0,
                startedAt=None,
                lastActivityAt=now,
                completedAt=None,
            ),
            createdAt=now,
        )
    )
    return session_id


@pytest.fixture
def _synthetic_session_question_with_remediation(monkeypatch: pytest.MonkeyPatch) -> Question:
    question = Question(
        id="test-remediation-session-api",
        chapterId="rational-numbers",
        question="What is -2 + 5?",
        text="What is -2 + 5?",
        difficulty="Easy",
        hints=["Think of a number line."],
        solution="3",
        remediation=QuestionRemediation(
            why="Students often mix up the sign.",
            remediationHint="Check the sign before combining terms.",
        ),
    )
    monkeypatch.setattr(question_service, "_questions", question_service._questions + [question])
    monkeypatch.setitem(evaluation_service._answer_keys, question.id, "3")
    return question


def test_session_answer_response_exposes_remediation_when_eligible(
    _synthetic_session_question_with_remediation: Question,
) -> None:
    question = _synthetic_session_question_with_remediation
    student = _student_client()
    student_id = student.get("/api/v1/auth/me").json()["id"]
    session_id = _seed_single_question_session(student_id, question)

    student.get(f"/api/v1/sessions/{session_id}/current-question")
    first = student.post(f"/api/v1/sessions/{session_id}/answer", json={"position": 0, "answer": "wrong"})
    assert first.status_code == 200
    assert first.json()["remediation"] is None  # first wrong attempt: TRY_AGAIN, not yet eligible

    second = student.post(f"/api/v1/sessions/{session_id}/answer", json={"position": 0, "answer": "wrong"})

    assert second.status_code == 200
    body = second.json()
    assert body["coach"]["nextAction"] == "SHOW_HINT"
    assert body["remediation"] == {
        "why": "Students often mix up the sign.",
        "remediationHint": "Check the sign before combining terms.",
    }
