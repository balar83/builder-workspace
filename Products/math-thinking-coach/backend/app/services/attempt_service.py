import logging
import sqlite3
import threading
from datetime import UTC, datetime
from pathlib import Path

from app.schemas.answer import AnswerEvaluationResponse, AnswerSubmission
from app.schemas.question import Question

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DATA_DIR / "attempts.db"

_lock = threading.Lock()

_SCHEMA = """
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
) -> None:
    with _lock:
        conn = _get_connection()
        try:
            conn.execute(
                """
                INSERT INTO attempts (
                    student_id, question_id, chapter_id, topic_id, difficulty, question_type,
                    session_id, session_mode, is_correct, attempt_number, hints_used,
                    time_taken_seconds, misconception_tag, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
