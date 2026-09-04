import logging
import os
import sqlite3
import threading
from datetime import UTC, datetime, timedelta
from pathlib import Path

from app.schemas.answer import AnswerEvaluationResponse, AnswerSubmission
from app.schemas.question import Question

logger = logging.getLogger(__name__)

# DATA_DIR is overridable so deployments with a mounted persistent disk
# (e.g. Render) can point storage off the ephemeral app filesystem.
DATA_DIR = Path(os.getenv("DATA_DIR", str(Path(__file__).resolve().parent.parent / "data")))
# Renamed from attempts.db in the same change that introduced the sessions
# table (session_store.py, Milestone C2) - the file now holds both tables.
DB_PATH = DATA_DIR / "runtime.db"

_lock = threading.Lock()

_SCHEMA = """
-- provenance (Self-Serve Learning Loop V1, Slice 2): nullable, distinct
-- from session_mode on purpose - session_mode names WHICH session mode an
-- attempt belongs to (practice/test/revision) and is only ever set for
-- session-originated attempts; provenance instead names WHICH WRITE PATH
-- recorded the attempt at all ("session" vs "standalone"), set on every new
-- attempt regardless of mode. Historical rows predate this column and stay
-- NULL forever - never backfilled, per this slice's explicit scope. See
-- CREATE TABLE IF NOT EXISTS's own limitation note below.
--
-- IMPORTANT, applies to every column in this table, not just this one:
-- CREATE TABLE IF NOT EXISTS is a no-op against a table that already
-- exists - SQLite checks table existence only, never column parity. This
-- statement does NOT retroactively add a new column to a real, persisted
-- runtime.db whose attempts table was created under an older version of
-- this schema (verified empirically while adding provenance). Every prior
-- additive column here carries the same latent gap; no migration mechanism
-- (e.g. PRAGMA table_info + conditional ALTER TABLE) exists in this
-- codebase today. Out of scope to fix here - flagged for a deliberate
-- decision before this is relied upon against a real persisted database.
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
    provenance TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_student_topic ON attempts(student_id, topic_id);
"""


def _get_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(_SCHEMA)
    return conn


def record_attempt(
    *,
    student_id: str,
    question_id: str,
    chapter_id: str,
    difficulty: str,
    is_correct: bool,
    attempt_number: int,
    topic_id: str | None = None,
    question_type: str | None = None,
    session_id: str | None = None,
    session_mode: str | None = None,
    hints_used: int = 0,
    time_taken_seconds: float | None = None,
    misconception_tag: str | None = None,
    provenance: str | None = None,
) -> None:
    with _lock:
        conn = _get_connection()
        try:
            conn.execute(
                """
                INSERT INTO attempts (
                    student_id, question_id, chapter_id, topic_id, difficulty, question_type,
                    session_id, session_mode, is_correct, attempt_number, hints_used,
                    time_taken_seconds, misconception_tag, provenance, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    student_id,
                    question_id,
                    chapter_id,
                    topic_id,
                    difficulty,
                    question_type,
                    session_id,
                    session_mode,
                    int(is_correct),
                    attempt_number,
                    hints_used,
                    time_taken_seconds,
                    misconception_tag,
                    provenance,
                    datetime.now(UTC).isoformat(),
                ),
            )
            conn.commit()
        finally:
            conn.close()


def record_attempt_for_answer(
    student_id: str,
    question: Question,
    submission: AnswerSubmission,
    evaluation: AnswerEvaluationResponse,
) -> None:
    """
    Out-of-band write, dispatched via BackgroundTasks after the answer
    response is already built (same execution model as Shadow Mode, ADR-002)
    - must never raise into the caller and never affect the response.
    """
    try:
        record_attempt(
            student_id=student_id,
            question_id=question.id,
            chapter_id=question.chapterId,
            topic_id=question.topicId,
            difficulty=question.difficulty,
            is_correct=evaluation.evaluation.isCorrect,
            attempt_number=submission.attemptNumber,
            provenance="standalone",
        )
    except Exception:
        logger.warning(
            "Attempt recording failed unexpectedly for question_id=%s", question.id, exc_info=True
        )


def get_performance(student_id: str) -> list[dict]:
    """
    Deterministic per-topic aggregates only - no model, arithmetic over the
    raw attempt log. Mastery follows LearningExperienceArchitecture.md's
    existing rule: 3 consecutive correct, no hints used, most-recent-first.
    """
    with _lock:
        conn = _get_connection()
        try:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
                SELECT * FROM attempts
                WHERE student_id = ? AND topic_id IS NOT NULL
                ORDER BY topic_id, created_at
                """,
                (student_id,),
            ).fetchall()
        finally:
            conn.close()

    by_topic: dict[str, list[sqlite3.Row]] = {}
    for row in rows:
        by_topic.setdefault(row["topic_id"], []).append(row)

    results = []
    for topic_id, topic_rows in by_topic.items():
        attempted = len(topic_rows)
        correct = sum(1 for row in topic_rows if row["is_correct"])
        accuracy = round(correct / attempted, 4) if attempted else 0.0

        streak = 0
        for row in reversed(topic_rows):
            if row["is_correct"] and row["hints_used"] == 0:
                streak += 1
            else:
                break

        results.append(
            {
                "topicId": topic_id,
                "questionsAttempted": attempted,
                "questionsCorrect": correct,
                "accuracy": accuracy,
                "currentStreak": streak,
                "mastered": streak >= 3,
            }
        )

    return results


def get_recent_question_ids(student_id: str, chapter_id: str, limit: int = 10) -> list[str]:
    """
    Read-only, most-recent-first. Used by StudentLearningContext to seed
    exclusion so a student isn't immediately re-served a question they just
    answered - not a general history/reporting feature.
    """
    with _lock:
        conn = _get_connection()
        try:
            rows = conn.execute(
                """
                SELECT question_id FROM attempts
                WHERE student_id = ? AND chapter_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (student_id, chapter_id, limit),
            ).fetchall()
        finally:
            conn.close()

    return [row[0] for row in rows]


def get_recent_attempts(student_id: str, since_days: int = 8) -> list[dict]:
    """
    Raw (question_id, chapter_id, is_correct, created_at) rows, deliberately
    NOT grouped by day here - created_at is server UTC only (no learner-local
    offset is ever stored), so day-bucketing must happen client-side against
    the browser's own local timezone (Progress Hub V1 timezone decision).
    since_days=8 (not 7) is a deliberate one-day buffer: local calendar-day
    boundaries can sit up to ~14h ahead of or ~12h behind UTC depending on
    the learner's timezone, so an 8-day UTC window is guaranteed to be a
    superset of any real local 7-day rolling window - the caller trims to
    the exact 7 local days after bucketing.
    """
    cutoff = (datetime.now(UTC) - timedelta(days=since_days)).isoformat()
    with _lock:
        conn = _get_connection()
        try:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
                SELECT question_id, chapter_id, is_correct, created_at FROM attempts
                WHERE student_id = ? AND created_at >= ?
                ORDER BY created_at
                """,
                (student_id, cutoff),
            ).fetchall()
        finally:
            conn.close()

    return [dict(row) for row in rows]


def get_chapter_activity_raw(student_id: str) -> list[dict]:
    """
    Lifetime, chapter-keyed aggregate for the Progress Hub - deliberately NOT
    topic-scoped (unlike get_performance's `topic_id IS NOT NULL` filter), so
    every chapter is included, including one with no Topic (Practical
    Geometry). Deliberately distinct-question-counted throughout (unlike
    get_performance's row-counting, where a retried question inflates both
    questionsAttempted and, if eventually correct, questionsCorrect):
    questions_correct here means "eventually solved correctly" - a question
    counts once if ANY of its attempts in this chapter was correct, per the
    approved V1 product definition.
    """
    with _lock:
        conn = _get_connection()
        try:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
                SELECT
                    chapter_id,
                    COUNT(DISTINCT question_id) AS questions_attempted,
                    COUNT(DISTINCT CASE WHEN is_correct THEN question_id END) AS questions_correct,
                    MAX(created_at) AS last_activity_at
                FROM attempts
                WHERE student_id = ?
                GROUP BY chapter_id
                """,
                (student_id,),
            ).fetchall()
        finally:
            conn.close()

    return [dict(row) for row in rows]
