from pathlib import Path

import pytest

from app.schemas.session import AssessmentRequest
from app.services import attempt_service, session_builder, session_store


@pytest.fixture(autouse=True)
def _isolate_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(attempt_service, "DB_PATH", tmp_path / "runtime.db")
    monkeypatch.setattr(session_store, "DB_PATH", tmp_path / "runtime.db")


def test_create_session_persists_and_returns_a_full_learning_session() -> None:
    request = AssessmentRequest(
        studentId="student-1", chapterId="rational-numbers", mode="practice", questionCount=5,
    )

    session = session_builder.create_session(request, seed="fixed")

    assert session.studentId == "student-1"
    assert session.chapterId == "rational-numbers"
    assert session.state.status == "not_started"
    assert len(session.selectedQuestions) == 5

    persisted = session_store.get_session(session.sessionId)
    assert persisted is not None
    assert persisted.sessionId == session.sessionId
    assert len(persisted.selectedQuestions) == 5


def test_session_id_is_the_plans_own_id_not_a_second_uuid() -> None:
    request = AssessmentRequest(studentId="student-1", chapterId="rational-numbers", mode="practice")

    session = session_builder.create_session(request, seed="fixed")

    assert session.sessionId == session.plan.planId


def test_zero_question_outcome_refuses_creation() -> None:
    request = AssessmentRequest(
        studentId="student-1", chapterId="rational-numbers", mode="practice",
        difficulty="Hard", questionCount=100,
    )
    # rational-numbers has zero Hard questions; but backfill still fills the
    # session from other tiers (C1's own established behavior), so use an
    # unknown chapter to force a genuine zero-candidate outcome instead.
    empty_request = AssessmentRequest(studentId="student-1", chapterId="no-such-chapter", mode="practice")

    with pytest.raises(session_builder.SessionCreationError):
        session_builder.create_session(empty_request, seed="fixed")


def test_partial_shortfall_still_creates_a_session() -> None:
    request = AssessmentRequest(
        studentId="student-1", chapterId="rational-numbers", mode="practice", questionCount=100,
    )

    session = session_builder.create_session(request, seed="fixed")

    assert len(session.selectedQuestions) == 40  # all of rational-numbers' 40 questions


def test_created_session_has_no_persisted_state_beyond_not_started() -> None:
    request = AssessmentRequest(studentId="student-1", chapterId="rational-numbers", mode="practice")

    session = session_builder.create_session(request, seed="fixed")

    assert session.state.currentPosition == 0
    assert session.state.attemptsOnCurrentQuestion == 0
    assert session.state.correctCount == 0
    assert session.state.startedAt is None
    assert session.state.completedAt is None


def test_two_sessions_for_the_same_student_get_distinct_ids() -> None:
    request = AssessmentRequest(studentId="student-1", chapterId="rational-numbers", mode="practice")

    session_a = session_builder.create_session(request)
    session_b = session_builder.create_session(request)

    assert session_a.sessionId != session_b.sessionId
