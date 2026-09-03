import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.schemas.answer import AnswerEvaluationResponse, AnswerSubmission, Coach, EvaluationResult, NextAction, UiState
from app.schemas.question import Question
from app.services import attempt_service


@pytest.fixture(autouse=True)
def _isolate_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(attempt_service, "DB_PATH", tmp_path / "attempts.db")


def test_get_performance_is_empty_for_a_student_with_no_attempts() -> None:
    assert attempt_service.get_performance("student-1") == []


def test_record_attempt_and_read_back_performance() -> None:
    attempt_service.record_attempt(
        student_id="student-1",
        question_id="q1",
        chapter_id="linear-equations",
        topic_id="topic-linear-equations-one-variable",
        difficulty="Easy",
        is_correct=True,
        attempt_number=1,
    )

    performance = attempt_service.get_performance("student-1")

    assert len(performance) == 1
    assert performance[0]["topicId"] == "topic-linear-equations-one-variable"
    assert performance[0]["questionsAttempted"] == 1
    assert performance[0]["questionsCorrect"] == 1
    assert performance[0]["accuracy"] == 1.0


def test_attempts_without_a_topic_are_excluded_from_performance() -> None:
    attempt_service.record_attempt(
        student_id="student-1",
        question_id="q1",
        chapter_id="data-handling",
        topic_id=None,
        difficulty="Easy",
        is_correct=True,
        attempt_number=1,
    )

    assert attempt_service.get_performance("student-1") == []


def test_performance_aggregates_separately_per_topic() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1,
    )
    attempt_service.record_attempt(
        student_id="student-1", question_id="q2", chapter_id="c1", topic_id="topic-b",
        difficulty="Easy", is_correct=False, attempt_number=1,
    )

    performance = {row["topicId"]: row for row in attempt_service.get_performance("student-1")}

    assert performance["topic-a"]["questionsCorrect"] == 1
    assert performance["topic-b"]["questionsCorrect"] == 0


def test_performance_is_scoped_to_the_requesting_student() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1,
    )

    assert attempt_service.get_performance("student-2") == []


def test_mastery_requires_three_consecutive_correct_attempts_with_no_hints() -> None:
    for _ in range(2):
        attempt_service.record_attempt(
            student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
            difficulty="Easy", is_correct=True, attempt_number=1, hints_used=0,
        )
    assert attempt_service.get_performance("student-1")[0]["mastered"] is False

    attempt_service.record_attempt(
        student_id="student-1", question_id="q2", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1, hints_used=0,
    )
    assert attempt_service.get_performance("student-1")[0]["mastered"] is True


def test_mastery_streak_resets_on_a_wrong_attempt() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1, hints_used=0,
    )
    attempt_service.record_attempt(
        student_id="student-1", question_id="q2", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=False, attempt_number=1, hints_used=0,
    )
    attempt_service.record_attempt(
        student_id="student-1", question_id="q3", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1, hints_used=0,
    )

    assert attempt_service.get_performance("student-1")[0]["currentStreak"] == 1


def test_mastery_streak_resets_when_hints_were_used() -> None:
    for _ in range(3):
        attempt_service.record_attempt(
            student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
            difficulty="Easy", is_correct=True, attempt_number=1, hints_used=1,
        )

    performance = attempt_service.get_performance("student-1")[0]
    assert performance["currentStreak"] == 0
    assert performance["mastered"] is False


def test_get_recent_question_ids_returns_most_recent_first() -> None:
    for question_id in ["q1", "q2", "q3"]:
        attempt_service.record_attempt(
            student_id="student-1", question_id=question_id, chapter_id="c1", topic_id="topic-a",
            difficulty="Easy", is_correct=True, attempt_number=1,
        )

    assert attempt_service.get_recent_question_ids("student-1", "c1") == ["q3", "q2", "q1"]


def test_get_recent_question_ids_respects_limit() -> None:
    for question_id in ["q1", "q2", "q3"]:
        attempt_service.record_attempt(
            student_id="student-1", question_id=question_id, chapter_id="c1", topic_id="topic-a",
            difficulty="Easy", is_correct=True, attempt_number=1,
        )

    assert attempt_service.get_recent_question_ids("student-1", "c1", limit=2) == ["q3", "q2"]


def test_get_recent_question_ids_is_scoped_to_chapter() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1,
    )
    attempt_service.record_attempt(
        student_id="student-1", question_id="q2", chapter_id="c2", topic_id="topic-b",
        difficulty="Easy", is_correct=True, attempt_number=1,
    )

    assert attempt_service.get_recent_question_ids("student-1", "c1") == ["q1"]


def test_get_recent_question_ids_is_empty_for_a_student_with_no_attempts() -> None:
    assert attempt_service.get_recent_question_ids("student-1", "c1") == []


def test_record_attempt_for_answer_never_raises_even_if_recording_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def explode(**kwargs) -> None:
        raise RuntimeError("db is down")

    monkeypatch.setattr(attempt_service, "record_attempt", explode)

    question = Question(
        id="q1", chapterId="c1", question="2+2", text="2+2", difficulty="Easy",
        hints=[], solution="4", topicId="topic-a",
    )
    submission = AnswerSubmission(answer="4", attemptNumber=1)
    response = AnswerEvaluationResponse(
        evaluation=EvaluationResult(isCorrect=True, score=1.0, maxScore=1.0, evaluatorId="short_text_v1"),
        coach=Coach(message="Great job!", nextAction=NextAction.NEXT_QUESTION),
        ui=UiState(canTryAgain=False, canRevealSolution=False, hintLevel=0),
    )

    attempt_service.record_attempt_for_answer("student-1", question, submission, response)


# --- get_recent_attempts / get_chapter_activity_raw (Progress Hub V1) ------
#
# record_attempt always stamps created_at as "now" server-side, so these
# tests insert rows with a controlled created_at directly (same raw-sqlite3
# technique as _read_submitted_option_id above) to exercise the 8-day window
# boundary precisely.


def _insert_attempt_with_created_at(
    *, student_id: str, question_id: str, chapter_id: str, is_correct: bool, created_at: str
) -> None:
    conn = sqlite3.connect(attempt_service.DB_PATH)
    try:
        conn.executescript(attempt_service._SCHEMA)
        conn.execute(
            """
            INSERT INTO attempts (
                student_id, question_id, chapter_id, topic_id, difficulty, question_type,
                session_id, session_mode, is_correct, attempt_number, hints_used,
                submitted_option_id, time_taken_seconds, misconception_tag, created_at
            ) VALUES (?, ?, ?, NULL, 'Easy', NULL, NULL, NULL, ?, 1, 0, NULL, NULL, NULL, ?)
            """,
            (student_id, question_id, chapter_id, int(is_correct), created_at),
        )
        conn.commit()
    finally:
        conn.close()


def test_get_recent_attempts_is_empty_for_a_student_with_no_attempts() -> None:
    assert attempt_service.get_recent_attempts("student-1") == []


def test_get_recent_attempts_returns_raw_unbucketed_rows() -> None:
    now = datetime.now(UTC)
    _insert_attempt_with_created_at(
        student_id="student-1", question_id="q1", chapter_id="c1",
        is_correct=True, created_at=now.isoformat(),
    )

    rows = attempt_service.get_recent_attempts("student-1")

    assert len(rows) == 1
    assert rows[0]["question_id"] == "q1"
    assert rows[0]["chapter_id"] == "c1"
    assert rows[0]["is_correct"] == 1
    assert rows[0]["created_at"] == now.isoformat()


def test_get_recent_attempts_includes_retries_unfiltered() -> None:
    """
    Deliberately NOT deduplicated by question_id here - that dedup is the
    frontend's job once it knows the learner's local calendar day. The raw
    window must carry every attempt, retries included.
    """
    now = datetime.now(UTC)
    for i in range(3):
        _insert_attempt_with_created_at(
            student_id="student-1", question_id="q1", chapter_id="c1",
            is_correct=(i == 2), created_at=now.isoformat(),
        )

    assert len(attempt_service.get_recent_attempts("student-1")) == 3


def test_get_recent_attempts_excludes_rows_older_than_the_window() -> None:
    now = datetime.now(UTC)
    _insert_attempt_with_created_at(
        student_id="student-1", question_id="within", chapter_id="c1",
        is_correct=True, created_at=(now - timedelta(days=7)).isoformat(),
    )
    _insert_attempt_with_created_at(
        student_id="student-1", question_id="outside", chapter_id="c1",
        is_correct=True, created_at=(now - timedelta(days=9)).isoformat(),
    )

    question_ids = {row["question_id"] for row in attempt_service.get_recent_attempts("student-1", since_days=8)}

    assert question_ids == {"within"}


def test_get_recent_attempts_includes_a_row_right_at_the_8_day_boundary() -> None:
    now = datetime.now(UTC)
    cutoff_edge = now - timedelta(days=8) + timedelta(minutes=1)
    _insert_attempt_with_created_at(
        student_id="student-1", question_id="q1", chapter_id="c1",
        is_correct=True, created_at=cutoff_edge.isoformat(),
    )

    question_ids = {row["question_id"] for row in attempt_service.get_recent_attempts("student-1", since_days=8)}

    assert question_ids == {"q1"}


def test_get_recent_attempts_is_scoped_to_the_requesting_student() -> None:
    _insert_attempt_with_created_at(
        student_id="student-1", question_id="q1", chapter_id="c1",
        is_correct=True, created_at=datetime.now(UTC).isoformat(),
    )

    assert attempt_service.get_recent_attempts("student-2") == []


def test_get_chapter_activity_raw_is_empty_for_a_student_with_no_attempts() -> None:
    assert attempt_service.get_chapter_activity_raw("student-1") == []


def test_get_chapter_activity_raw_counts_distinct_questions_not_rows() -> None:
    """A retried question must count once, not once per attempt row."""
    for i in range(3):
        attempt_service.record_attempt(
            student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
            difficulty="Easy", is_correct=(i == 2), attempt_number=i + 1,
        )

    activity = attempt_service.get_chapter_activity_raw("student-1")

    assert len(activity) == 1
    assert activity[0]["chapter_id"] == "c1"
    assert activity[0]["questions_attempted"] == 1


def test_get_chapter_activity_raw_counts_a_question_correct_if_any_attempt_was_correct() -> None:
    """'Eventually solved correctly' (approved V1 definition) - wrong then right still counts as correct."""
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=False, attempt_number=1,
    )
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=2,
    )

    activity = attempt_service.get_chapter_activity_raw("student-1")

    assert activity[0]["questions_attempted"] == 1
    assert activity[0]["questions_correct"] == 1


def test_get_chapter_activity_raw_never_marks_a_never_correct_question_as_correct() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=False, attempt_number=1,
    )

    activity = attempt_service.get_chapter_activity_raw("student-1")

    assert activity[0]["questions_attempted"] == 1
    assert activity[0]["questions_correct"] == 0


def test_get_chapter_activity_raw_includes_a_topic_less_chapter() -> None:
    """Deliberately NOT topic_id IS NOT NULL filtered, unlike get_performance - Practical Geometry's real shape."""
    attempt_service.record_attempt(
        student_id="student-1", question_id="pg-q1", chapter_id="practical-geometry", topic_id=None,
        difficulty="Easy", is_correct=True, attempt_number=1,
    )

    activity = attempt_service.get_chapter_activity_raw("student-1")

    assert len(activity) == 1
    assert activity[0]["chapter_id"] == "practical-geometry"
    assert activity[0]["questions_attempted"] == 1


def test_get_chapter_activity_raw_reports_last_activity_as_the_most_recent_attempt() -> None:
    now = datetime.now(UTC)
    _insert_attempt_with_created_at(
        student_id="student-1", question_id="q1", chapter_id="c1",
        is_correct=True, created_at=(now - timedelta(days=2)).isoformat(),
    )
    _insert_attempt_with_created_at(
        student_id="student-1", question_id="q2", chapter_id="c1",
        is_correct=True, created_at=now.isoformat(),
    )

    activity = attempt_service.get_chapter_activity_raw("student-1")

    assert activity[0]["last_activity_at"] == now.isoformat()


def test_get_chapter_activity_raw_groups_separately_per_chapter() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1,
    )
    attempt_service.record_attempt(
        student_id="student-1", question_id="q2", chapter_id="c2", topic_id="topic-b",
        difficulty="Easy", is_correct=False, attempt_number=1,
    )

    activity = {row["chapter_id"]: row for row in attempt_service.get_chapter_activity_raw("student-1")}

    assert activity["c1"]["questions_correct"] == 1
    assert activity["c2"]["questions_correct"] == 0


def test_get_chapter_activity_raw_is_scoped_to_the_requesting_student() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1,
    )

    assert attempt_service.get_chapter_activity_raw("student-2") == []
