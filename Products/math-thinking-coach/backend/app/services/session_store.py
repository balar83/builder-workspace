import json
import os
import sqlite3
import threading
from pathlib import Path

from app.schemas.session import LearningSession, SelectedQuestion, SessionPlan, SessionState

# DATA_DIR is overridable so deployments with a mounted persistent disk
# (e.g. Render) can point storage off the ephemeral app filesystem.
DATA_DIR = Path(os.getenv("DATA_DIR", str(Path(__file__).resolve().parent.parent / "data")))
DB_PATH = DATA_DIR / "runtime.db"

_lock = threading.Lock()

# Two JSON columns (plan_extra_json, selected_questions_json) rather than a
# normalized session_questions table - both are always read/written as one
# whole, immutable unit, never queried by their internal fields. Revisit
# only if a real cross-session query need shows up (design review, C2).
_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    target_count INTEGER NOT NULL,
    time_limit_minutes INTEGER,
    seed TEXT NOT NULL,
    plan_extra_json TEXT NOT NULL,
    selected_questions_json TEXT NOT NULL,
    status TEXT NOT NULL,
    current_position INTEGER NOT NULL,
    attempts_on_current_question INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    hints_used_total INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    started_at TEXT,
    last_activity_at TEXT NOT NULL,
    completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);
"""


def _get_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(_SCHEMA)
    conn.row_factory = sqlite3.Row
    return conn


def _row_to_session(row: sqlite3.Row) -> LearningSession:
    plan_extra = json.loads(row["plan_extra_json"])
    selected_questions = [SelectedQuestion(**item) for item in json.loads(row["selected_questions_json"])]

    plan = SessionPlan(
        planId=row["session_id"],
        studentId=row["student_id"],
        chapterId=row["chapter_id"],
        mode=row["mode"],
        difficultyDistribution=plan_extra["difficultyDistribution"],
        questionTypes=plan_extra["questionTypes"],
        targetCount=row["target_count"],
        timeLimitMinutes=row["time_limit_minutes"],
        weakConceptTopicIds=plan_extra["weakConceptTopicIds"],
        seed=row["seed"],
    )
    state = SessionState(
        status=row["status"],
        currentPosition=row["current_position"],
        attemptsOnCurrentQuestion=row["attempts_on_current_question"],
        correctCount=row["correct_count"],
        hintsUsedTotal=row["hints_used_total"],
        startedAt=row["started_at"],
        lastActivityAt=row["last_activity_at"],
        completedAt=row["completed_at"],
    )
    return LearningSession(
        sessionId=row["session_id"],
        studentId=row["student_id"],
        chapterId=row["chapter_id"],
        plan=plan,
        selectedQuestions=selected_questions,
        state=state,
        createdAt=row["created_at"],
    )


def insert_session(session: LearningSession) -> None:
    """
    Session Builder's one-time write. No caller other than Session Builder
    should ever call this - it is the only INSERT this table receives.
    """
    plan_extra = json.dumps(
        {
            "difficultyDistribution": session.plan.difficultyDistribution,
            "questionTypes": session.plan.questionTypes,
            "weakConceptTopicIds": session.plan.weakConceptTopicIds,
        }
    )
    selected_questions = json.dumps([q.model_dump() for q in session.selectedQuestions])

    with _lock:
        conn = _get_connection()
        try:
            conn.execute(
                """
                INSERT INTO sessions (
                    session_id, student_id, chapter_id, mode, target_count, time_limit_minutes,
                    seed, plan_extra_json, selected_questions_json, status, current_position,
                    attempts_on_current_question, correct_count, hints_used_total,
                    created_at, started_at, last_activity_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session.sessionId,
                    session.studentId,
                    session.chapterId,
                    session.plan.mode,
                    session.plan.targetCount,
                    session.plan.timeLimitMinutes,
                    session.plan.seed,
                    plan_extra,
                    selected_questions,
                    session.state.status,
                    session.state.currentPosition,
                    session.state.attemptsOnCurrentQuestion,
                    session.state.correctCount,
                    session.state.hintsUsedTotal,
                    session.createdAt,
                    session.state.startedAt,
                    session.state.lastActivityAt,
                    session.state.completedAt,
                ),
            )
            conn.commit()
        finally:
            conn.close()


def get_session(session_id: str) -> LearningSession | None:
    with _lock:
        conn = _get_connection()
        try:
            row = conn.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
        finally:
            conn.close()
    return _row_to_session(row) if row else None


def update_session_state(session_id: str, state: SessionState) -> None:
    """
    Runtime Session Manager's only write. This statement's SET clause names
    only SessionState-mapped columns - plan_extra_json and
    selected_questions_json can never appear here, structurally, not just by
    caller discipline.
    """
    with _lock:
        conn = _get_connection()
        try:
            conn.execute(
                """
                UPDATE sessions SET
                    status = ?, current_position = ?, attempts_on_current_question = ?,
                    correct_count = ?, hints_used_total = ?, started_at = ?,
                    last_activity_at = ?, completed_at = ?
                WHERE session_id = ?
                """,
                (
                    state.status,
                    state.currentPosition,
                    state.attemptsOnCurrentQuestion,
                    state.correctCount,
                    state.hintsUsedTotal,
                    state.startedAt,
                    state.lastActivityAt,
                    state.completedAt,
                    session_id,
                ),
            )
            conn.commit()
        finally:
            conn.close()
