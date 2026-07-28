from pathlib import Path

import pytest

from app.schemas.session import LearningSession, SelectedQuestion, SessionPlan, SessionState
from app.services import session_store


@pytest.fixture(autouse=True)
def _isolate_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(session_store, "DB_PATH", tmp_path / "runtime.db")


def _session(session_id: str = "session-1", student_id: str = "student-1") -> LearningSession:
    return LearningSession(
        sessionId=session_id,
        studentId=student_id,
        chapterId="linear-equations",
        plan=SessionPlan(
            planId=session_id, studentId=student_id, chapterId="linear-equations", mode="practice",
            difficultyDistribution={"Easy": 2, "Medium": 1, "Hard": 0}, questionTypes=None,
            targetCount=3, timeLimitMinutes=None, weakConceptTopicIds=[], seed="seed-1",
        ),
        selectedQuestions=[
            SelectedQuestion(position=1, questionId="q1", difficulty="Easy", type=None),
            SelectedQuestion(position=2, questionId="q2", difficulty="Easy", type=None),
            SelectedQuestion(position=3, questionId="q3", difficulty="Medium", type=None),
        ],
        state=SessionState(
            status="not_started", currentPosition=0, attemptsOnCurrentQuestion=0,
            correctCount=0, hintsUsedTotal=0, startedAt=None,
            lastActivityAt="2026-07-28T00:00:00+00:00", completedAt=None,
        ),
        createdAt="2026-07-28T00:00:00+00:00",
    )


def test_get_session_returns_none_for_unknown_id() -> None:
    assert session_store.get_session("unknown") is None


def test_insert_and_get_round_trips_the_full_aggregate() -> None:
    session_store.insert_session(_session())

    loaded = session_store.get_session("session-1")

    assert loaded is not None
    assert loaded.sessionId == "session-1"
    assert loaded.studentId == "student-1"
    assert loaded.plan.difficultyDistribution == {"Easy": 2, "Medium": 1, "Hard": 0}
    assert loaded.plan.targetCount == 3
    assert len(loaded.selectedQuestions) == 3
    assert loaded.selectedQuestions[0].questionId == "q1"
    assert loaded.state.status == "not_started"


def test_update_session_state_only_touches_state_fields() -> None:
    session_store.insert_session(_session())

    new_state = SessionState(
        status="in_progress", currentPosition=1, attemptsOnCurrentQuestion=1,
        correctCount=0, hintsUsedTotal=0, startedAt="2026-07-28T00:05:00+00:00",
        lastActivityAt="2026-07-28T00:05:00+00:00", completedAt=None,
    )
    session_store.update_session_state("session-1", new_state)

    loaded = session_store.get_session("session-1")
    assert loaded.state.status == "in_progress"
    assert loaded.state.currentPosition == 1
    # Immutable parts unaffected by the state update.
    assert loaded.plan.targetCount == 3
    assert len(loaded.selectedQuestions) == 3
    assert loaded.selectedQuestions[0].questionId == "q1"


def test_multiple_sessions_are_independent() -> None:
    session_store.insert_session(_session("session-1", "student-1"))
    session_store.insert_session(_session("session-2", "student-2"))

    assert session_store.get_session("session-1").studentId == "student-1"
    assert session_store.get_session("session-2").studentId == "student-2"
