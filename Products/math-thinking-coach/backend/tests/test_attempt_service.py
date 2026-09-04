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


# --- provenance (Self-Serve Learning Loop V1, Slice 2) ----------------------
#
# Write-only, same technique as _read_submitted_option_id above: no read
# path exposes provenance in this slice (explicitly out of scope - no
# provenance-based analytics/UI yet), so these read the column directly.


def _read_provenance(question_id: str) -> list[str | None]:
    conn = sqlite3.connect(attempt_service.DB_PATH)
    try:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT provenance FROM attempts WHERE question_id = ? ORDER BY id", (question_id,)
        ).fetchall()
    finally:
        conn.close()
    return [row["provenance"] for row in rows]


def test_record_attempt_defaults_provenance_to_none() -> None:
    """
    No caller is required to pass provenance - a row written without it
    (the same shape every historical, pre-Slice-2 row has) stays NULL, never
    a fabricated guess. Directly covers "historical rows can legitimately
    remain NULL."
    """
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1,
    )

    assert _read_provenance("q1") == [None]


def test_record_attempt_persists_provenance_when_given() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1, provenance="standalone",
    )

    assert _read_provenance("q1") == ["standalone"]


def test_record_attempt_for_answer_persists_provenance_as_standalone() -> None:
    """
    The standalone /questions/{id}/answer write path (record_attempt_for_answer)
    always stamps provenance="standalone" - unconditionally, regardless of
    question type or correctness, distinct from session_mode which this path
    never sets at all.
    """
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

    assert _read_provenance("q1") == ["standalone"]


# --- schema compatibility (Self-Serve Learning Loop V1, Slice 2.5) ---------
#
# Two real historical schema shapes, reproduced exactly (verified against
# git history - Milestone B's original commit c615618 for the original
# shape; the pre-provenance shape is this table's state with
# submitted_option_id already present but before Slice 2 added provenance).
# _ensure_schema must safely upgrade either one, in place, preserving every
# existing row exactly.

_ORIGINAL_SCHEMA = """
CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    topic_id TEXT,
    difficulty TEXT NOT NULL,
    question_type TEXT,
    session_id TEXT,
    session_mode TEXT,
    is_correct INTEGER NOT NULL,
    attempt_number INTEGER NOT NULL,
    hints_used INTEGER NOT NULL DEFAULT 0,
    time_taken_seconds REAL,
    misconception_tag TEXT,
    created_at TEXT NOT NULL
);
"""

_PRE_PROVENANCE_SCHEMA = """
CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    topic_id TEXT,
    difficulty TEXT NOT NULL,
    question_type TEXT,
    session_id TEXT,
    session_mode TEXT,
    is_correct INTEGER NOT NULL,
    attempt_number INTEGER NOT NULL,
    hints_used INTEGER NOT NULL DEFAULT 0,
    submitted_option_id TEXT,
    time_taken_seconds REAL,
    misconception_tag TEXT,
    created_at TEXT NOT NULL
);
"""

_ALL_CURRENT_COLUMNS = {
    "id", "student_id", "question_id", "chapter_id", "topic_id", "difficulty",
    "question_type", "session_id", "session_mode", "is_correct", "attempt_number",
    "hints_used", "submitted_option_id", "time_taken_seconds", "misconception_tag",
    "provenance", "created_at",
}


def _table_columns() -> set[str]:
    conn = sqlite3.connect(attempt_service.DB_PATH)
    try:
        return {row[1] for row in conn.execute("PRAGMA table_info(attempts)")}
    finally:
        conn.close()


def _seed_old_row(schema: str, **overrides) -> None:
    """Inserts one row directly, under a given historical schema, bypassing record_attempt entirely."""
    values = {
        "student_id": "student-old", "question_id": "old-q1", "chapter_id": "c1",
        "topic_id": "topic-a", "difficulty": "Easy", "question_type": None,
        "session_id": None, "session_mode": None, "is_correct": 1, "attempt_number": 1,
        "hints_used": 0, "time_taken_seconds": None, "misconception_tag": None,
        "created_at": "2026-01-01T00:00:00+00:00",
    }
    if "submitted_option_id" in schema:
        values["submitted_option_id"] = None
    values.update(overrides)

    columns = list(values.keys())
    conn = sqlite3.connect(attempt_service.DB_PATH)
    try:
        conn.executescript(schema)
        conn.execute(
            f"INSERT INTO attempts ({', '.join(columns)}) VALUES ({', '.join('?' * len(columns))})",
            tuple(values[c] for c in columns),
        )
        conn.commit()
    finally:
        conn.close()


def test_fresh_database_has_every_current_column() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1,
    )

    assert _table_columns() == _ALL_CURRENT_COLUMNS


def test_ensure_schema_adds_provenance_to_a_database_missing_only_provenance() -> None:
    _seed_old_row(_PRE_PROVENANCE_SCHEMA)

    attempt_service.record_attempt(
        student_id="student-1", question_id="new-q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1, provenance="standalone",
    )

    assert _table_columns() == _ALL_CURRENT_COLUMNS
    conn = sqlite3.connect(attempt_service.DB_PATH)
    try:
        conn.row_factory = sqlite3.Row
        rows = {row["question_id"]: row for row in conn.execute("SELECT * FROM attempts")}
    finally:
        conn.close()
    # The pre-existing row is untouched, and never backfilled.
    assert rows["old-q1"]["provenance"] is None
    assert rows["old-q1"]["student_id"] == "student-old"
    assert rows["old-q1"]["is_correct"] == 1
    # The new write, made after the upgrade, is a full current-shape write.
    assert rows["new-q1"]["provenance"] == "standalone"


def test_ensure_schema_adds_multiple_missing_columns_to_the_original_schema() -> None:
    """
    The very first schema this table ever had (Milestone B, commit
    c615618) - missing both submitted_option_id and provenance. Writes
    through record_attempt (provenance only - submitted_option_id isn't one
    of its parameters; that's a separate, unrelated write-path concern, not
    part of what _ensure_schema owns) plus a direct SQL write, to prove the
    column itself exists and is writable independently of any particular
    caller's parameter surface.
    """
    _seed_old_row(_ORIGINAL_SCHEMA)

    attempt_service.record_attempt(
        student_id="student-1", question_id="new-q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1, provenance="session",
    )

    assert _table_columns() == _ALL_CURRENT_COLUMNS
    conn = sqlite3.connect(attempt_service.DB_PATH)
    try:
        conn.execute("UPDATE attempts SET submitted_option_id = ? WHERE question_id = ?", ("opt-a", "new-q1"))
        conn.commit()
        conn.row_factory = sqlite3.Row
        rows = {row["question_id"]: row for row in conn.execute("SELECT * FROM attempts")}
    finally:
        conn.close()
    assert rows["old-q1"]["submitted_option_id"] is None
    assert rows["old-q1"]["provenance"] is None
    assert rows["old-q1"]["chapter_id"] == "c1"
    assert rows["new-q1"]["submitted_option_id"] == "opt-a"
    assert rows["new-q1"]["provenance"] == "session"


def test_ensure_schema_preserves_every_existing_row_exactly_during_upgrade() -> None:
    """
    The explicit preservation guarantee: several rows under the original
    schema, each with distinct values, all survive the upgrade unchanged -
    same count, same values, same order - with only the new columns reading
    NULL on them.
    """
    for i in range(3):
        _seed_old_row(
            _ORIGINAL_SCHEMA if i == 0 else "",  # only the first insert needs to run executescript
            question_id=f"old-q{i}", is_correct=(i % 2), attempt_number=i + 1,
        )

    attempt_service.record_attempt(
        student_id="student-1", question_id="trigger-upgrade", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1,
    )

    conn = sqlite3.connect(attempt_service.DB_PATH)
    try:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM attempts WHERE question_id LIKE 'old-q%' ORDER BY question_id"
        ).fetchall()
    finally:
        conn.close()

    assert len(rows) == 3
    for i, row in enumerate(rows):
        assert row["question_id"] == f"old-q{i}"
        assert row["is_correct"] == (i % 2)
        assert row["attempt_number"] == i + 1
        assert row["submitted_option_id"] is None
        assert row["provenance"] is None


def test_ensure_schema_is_a_no_op_on_a_fully_current_database() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1, provenance="standalone",
    )
    columns_before = _table_columns()

    # A second, independent call against an already-current database.
    attempt_service.record_attempt(
        student_id="student-1", question_id="q2", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1, provenance="session",
    )

    assert _table_columns() == columns_before == _ALL_CURRENT_COLUMNS
    assert _read_provenance("q1") == ["standalone"]


def test_ensure_schema_is_idempotent_across_repeated_calls() -> None:
    _seed_old_row(_ORIGINAL_SCHEMA)

    conn = sqlite3.connect(attempt_service.DB_PATH)
    try:
        for _ in range(5):
            attempt_service._ensure_schema(conn)
    finally:
        conn.close()

    assert _table_columns() == _ALL_CURRENT_COLUMNS
    # Still exactly one row - repeated calls never duplicate or touch data.
    conn = sqlite3.connect(attempt_service.DB_PATH)
    try:
        count = conn.execute("SELECT COUNT(*) FROM attempts").fetchone()[0]
    finally:
        conn.close()
    assert count == 1


class _InjectedFailureConnection:
    """
    Duck-typed proxy around a real sqlite3.Connection - sqlite3.Connection
    is a C-extension type and cannot be monkeypatched directly (it raises
    "cannot set 'execute' attribute of immutable type"), so _ensure_schema's
    two exact dependencies (execute/commit) are proxied instead, forcing one
    specific ALTER TABLE statement to fail with a chosen error - exactly
    what a real concurrent-process race, or a real I/O failure, would
    produce. _ensure_schema only ever calls .execute()/.commit() on its
    conn parameter, so this is a faithful substitute, not a shortcut.
    """

    def __init__(self, real_conn: sqlite3.Connection, trigger_prefix: str, error_message: str) -> None:
        self._real_conn = real_conn
        self._trigger_prefix = trigger_prefix
        self._error_message = error_message

    def execute(self, sql, *args, **kwargs):
        if sql.strip().upper().startswith(self._trigger_prefix):
            raise sqlite3.OperationalError(self._error_message)
        return self._real_conn.execute(sql, *args, **kwargs)

    def commit(self) -> None:
        self._real_conn.commit()


def test_ensure_schema_swallows_a_concurrent_duplicate_column_race() -> None:
    """
    Reproduces the exact race two processes could hit: both see a column
    missing via PRAGMA, both attempt ALTER TABLE ADD COLUMN, and the loser's
    statement fails with "duplicate column name" purely because the winner
    already succeeded a moment earlier. That specific failure must be
    treated as convergence (the column exists either way), not an error.
    """
    _seed_old_row(_PRE_PROVENANCE_SCHEMA)

    real_conn = sqlite3.connect(attempt_service.DB_PATH)
    try:
        racing_conn = _InjectedFailureConnection(
            real_conn, "ALTER TABLE ATTEMPTS ADD COLUMN PROVENANCE", "duplicate column name: provenance"
        )
        attempt_service._ensure_schema(racing_conn)  # must not raise, even though its own ALTER "lost" the race
    finally:
        real_conn.close()

    # This synthetic scenario has no real second process, so the column
    # genuinely isn't present yet after this one call alone - proving the
    # swallow doesn't crash is the point. A subsequent real call (the next
    # request against this file) still converges correctly, exactly as a
    # real race's loser would via its own next connection.
    attempt_service.record_attempt(
        student_id="student-1", question_id="after-race", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1, provenance="standalone",
    )
    assert _table_columns() == _ALL_CURRENT_COLUMNS
    assert _read_provenance("after-race") == ["standalone"]


def test_ensure_schema_reraises_a_genuine_operational_error_unrelated_to_the_race() -> None:
    """
    The duplicate-column swallow must be narrow: _ensure_schema itself still
    propagates any other OperationalError (e.g. a real disk/IO failure) -
    not silently absorbed just because it happened during an ALTER TABLE.
    """
    _seed_old_row(_PRE_PROVENANCE_SCHEMA)

    real_conn = sqlite3.connect(attempt_service.DB_PATH)
    try:
        failing_conn = _InjectedFailureConnection(
            real_conn, "ALTER TABLE ATTEMPTS ADD COLUMN PROVENANCE", "disk I/O error"
        )
        with pytest.raises(sqlite3.OperationalError, match="disk I/O error"):
            attempt_service._ensure_schema(failing_conn)
    finally:
        real_conn.close()


def test_schema_evolution_now_safely_upgrades_an_existing_database_and_writes_succeed() -> None:
    """
    Supersedes this test's own pre-Slice-2.5 version, which asserted the
    write raised OperationalError - that was a true, verified limitation at
    the time (see git history), not a desired behavior. Slice 2.5 fixes it;
    this proves the fix rather than the limitation it replaced.
    """
    _seed_old_row(_PRE_PROVENANCE_SCHEMA)

    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1,
    )

    assert _read_provenance("q1") == [None]  # this student's own new row, no provenance passed


# --- get_latest_attempt_per_question (Self-Serve Learning Loop V1, Slice 3) -


def test_get_latest_attempt_per_question_is_empty_for_a_student_with_no_attempts() -> None:
    assert attempt_service.get_latest_attempt_per_question("student-1") == []


def test_get_latest_attempt_per_question_returns_one_row_per_question() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1,
    )
    attempt_service.record_attempt(
        student_id="student-1", question_id="q2", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=False, attempt_number=1,
    )

    rows = attempt_service.get_latest_attempt_per_question("student-1")

    assert {row["question_id"] for row in rows} == {"q1", "q2"}


def test_get_latest_attempt_per_question_picks_the_row_with_the_highest_id_not_the_latest_timestamp() -> None:
    """
    Ordering must rely on attempt id (the table's own monotonic sequence),
    never created_at - two rows are inserted with an intentionally
    contradictory timestamp (the earlier-id row carries the LATER
    timestamp) to prove id, not created_at, decides which one is "latest."
    """
    conn = sqlite3.connect(attempt_service.DB_PATH)
    try:
        conn.executescript(attempt_service._SCHEMA)
        conn.execute(
            """
            INSERT INTO attempts (student_id, question_id, chapter_id, topic_id, difficulty, is_correct, attempt_number, created_at)
            VALUES ('student-1', 'q1', 'c1', 'topic-a', 'Easy', 0, 1, '2026-06-01T00:00:00+00:00')
            """
        )
        conn.execute(
            """
            INSERT INTO attempts (student_id, question_id, chapter_id, topic_id, difficulty, is_correct, attempt_number, created_at)
            VALUES ('student-1', 'q1', 'c1', 'topic-a', 'Easy', 1, 2, '2026-01-01T00:00:00+00:00')
            """
        )
        conn.commit()
    finally:
        conn.close()

    rows = attempt_service.get_latest_attempt_per_question("student-1")

    assert len(rows) == 1
    assert rows[0]["is_correct"] == 1  # the higher-id row, despite its earlier timestamp
    assert rows[0]["attempt_number"] == 2


def test_get_latest_attempt_per_question_is_scoped_to_the_requesting_student() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1,
    )

    assert attempt_service.get_latest_attempt_per_question("student-2") == []


def test_get_latest_attempt_per_question_groups_across_sessions_and_provenance() -> None:
    """Session/provenance are irrelevant to grouping - same question_id groups together regardless."""
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=False, attempt_number=1,
        session_id="session-a", session_mode="practice", provenance="session",
    )
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="c1", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1,
        provenance="standalone",
    )

    rows = attempt_service.get_latest_attempt_per_question("student-1")

    assert len(rows) == 1
    assert rows[0]["is_correct"] == 1
    assert rows[0]["provenance"] == "standalone"
