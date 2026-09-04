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
from app.schemas.session import AssessmentRequest
from app.services import attempt_service, auth_service, content_repository, learning_context_service, session_builder, session_store

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


# --- Self-Serve Learning Loop V1, Slice 1: Revision mode -----------------------
#
# The prior feasibility review found no class-membership gate anywhere in the
# Revision path (session_builder -> session_planning_pipeline ->
# learning_context_service/session_planner/constraint_resolver). These tests
# prove that directly, the same way the tests above already prove it for
# Practice mode - by exercising the real, unmodified engine with a genuine
# SelfServeLearner identity instead of a class-connected Student.
#
# Content-model note: every current chapter has exactly one Topic (verified
# against backend/app/data/topics.json), so "weak-topic-targeted" and
# "chapter-scoped" selection are the same set of questions today. The
# assertions below still verify the real data flow precisely
# (weakTopicIds -> SessionPlan.weakConceptTopicIds -> selected questions'
# topicId) rather than relying on a served-question difference the content
# doesn't currently make visible.

RN_CHAPTER_ID = "rational-numbers"
RN_TOPIC_ID = "topic-rational-numbers-properties-and-operations"


def _give_learner_weak_topic_evidence(learner_id: str) -> None:
    # Same pattern as test_learning_context_service.py's own weak-topic test:
    # one correct followed by three wrong, most-recent-first for the streak
    # check - accuracy 0.25 (< WEAK_ACCURACY_THRESHOLD) and not mastered.
    # Distinct question ids per row, deliberately - real attempts are never
    # forced onto one synthetic question id.
    outcomes = [True, False, False, False]
    for index, is_correct in enumerate(outcomes):
        attempt_service.record_attempt(
            student_id=learner_id, question_id=f"seed-weak-q{index}",
            chapter_id=RN_CHAPTER_ID, topic_id=RN_TOPIC_ID, difficulty="Easy",
            is_correct=is_correct, attempt_number=1,
        )


def test_self_serve_learner_weak_topic_evidence_is_computed_from_their_own_history() -> None:
    """
    Direct proof of the brief's own requirement: weak-topic computation must
    use the self-serve learner's own attempt history, not a class-joined
    Student's. learning_context_service is identity-agnostic by construction
    (it only ever sees an opaque student_id) - this exercises it with a real
    "learner_"-prefixed id to confirm that in practice, not just by reading
    the code.
    """
    learner = _learner_client()
    learner_id = learner.get("/api/v1/auth/me").json()["id"]
    _give_learner_weak_topic_evidence(learner_id)

    context = learning_context_service.build_learning_context(learner_id, RN_CHAPTER_ID)

    assert context.hasHistory is True
    assert context.topicAccuracy[RN_TOPIC_ID] == 0.25
    assert context.weakTopicIds == [RN_TOPIC_ID]


def test_self_serve_learner_revision_session_plan_targets_their_own_weak_topic() -> None:
    """
    One level up from the previous test: proves the weak topic actually
    reaches SessionPlan.weakConceptTopicIds and constrains real question
    selection, for a self-serve identity, via the exact same
    session_builder.create_session the API route calls.
    """
    learner = _learner_client()
    learner_id = learner.get("/api/v1/auth/me").json()["id"]
    _give_learner_weak_topic_evidence(learner_id)

    request = AssessmentRequest(
        studentId=learner_id, chapterId=RN_CHAPTER_ID, mode="revision", questionCount=5,
    )
    session = session_builder.create_session(request, seed="fixed")

    assert session.plan.mode == "revision"
    assert session.plan.weakConceptTopicIds == [RN_TOPIC_ID]
    assert len(session.selectedQuestions) > 0
    for selected in session.selectedQuestions:
        content = content_repository.get_question_content(selected.questionId)
        assert content is not None
        assert content.topicId == RN_TOPIC_ID


def test_self_serve_learner_can_complete_a_revision_session_end_to_end_via_the_api() -> None:
    """
    Full HTTP walkthrough, mirroring test_sessions_api.py's class-joined
    Revision-adjacent coverage but for a SelfServeLearner: create weak-topic
    evidence, start a Revision session, serve/answer a question, confirm the
    session summary reports mode="revision" throughout.
    """
    learner = _learner_client()
    learner_id = learner.get("/api/v1/auth/me").json()["id"]
    _give_learner_weak_topic_evidence(learner_id)

    create = learner.post(
        "/api/v1/sessions",
        json={"chapterId": RN_CHAPTER_ID, "mode": "revision", "questionCount": 3},
    )
    assert create.status_code == 200
    session_id = create.json()["sessionId"]
    assert create.json()["actualCount"] > 0

    current = learner.get(f"/api/v1/sessions/{session_id}/current-question")
    assert current.status_code == 200

    submit = learner.post(
        f"/api/v1/sessions/{session_id}/answer",
        json={"position": 0, "answer": "anything"},
    )
    assert submit.status_code == 200

    summary = learner.get(f"/api/v1/sessions/{session_id}")
    assert summary.status_code == 200
    assert summary.json()["mode"] == "revision"

    # And the resulting attempt is attributed to this learner, same as
    # every other identity - the point of "one learner model."
    performance = attempt_service.get_performance(learner_id)
    assert any(row["topicId"] == RN_TOPIC_ID for row in performance)


# --- Self-Serve Learning Loop V1, Slice 1: Self-serve Test eligibility check ---
#
# SHOULD-HAVE only (frozen scope). Included here to decide eligibility per
# the confirmed decision: eligible if this passes with no unexpected bugs, no
# new UX work, and no new product-policy question. It reuses this exact
# harness with no changes.


def test_self_serve_learner_can_complete_a_test_mode_session_end_to_end_via_the_api() -> None:
    learner = _learner_client()

    create = learner.post(
        "/api/v1/sessions",
        json={"chapterId": RN_CHAPTER_ID, "mode": "test", "timeLimitMinutes": 15, "questionCount": 3},
    )
    assert create.status_code == 200
    session_id = create.json()["sessionId"]

    current = learner.get(f"/api/v1/sessions/{session_id}/current-question")
    assert current.status_code == 200

    submit = learner.post(
        f"/api/v1/sessions/{session_id}/answer",
        json={"position": 0, "answer": "anything"},
    )
    assert submit.status_code == 200

    summary = learner.get(f"/api/v1/sessions/{session_id}")
    assert summary.status_code == 200
    assert summary.json()["mode"] == "test"
    assert summary.json()["timeLimitMinutes"] == 15
