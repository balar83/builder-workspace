from datetime import UTC, datetime

from app.schemas.session import AssessmentRequest, LearningSession, SessionState
from app.services import session_planning_pipeline, session_store


class SessionCreationError(Exception):
    """Raised when a session cannot be created - e.g. zero selectable questions."""


def create_session(request: AssessmentRequest, seed: str | None = None) -> LearningSession:
    """
    One-time construction only. Runs C1's unchanged planning pipeline, then
    persists a new LearningSession exactly once - this is the only INSERT
    the sessions table ever receives, and never updates an existing row.

    Zero-question outcomes refuse creation entirely, since a session with
    nothing to serve is meaningless. A partial shortfall still creates a
    session - the student gets what's actually available, honestly
    reported via the same actualCount/shortfall the caller already handles.
    A genuine persistence failure is allowed to raise: unlike Shadow Mode
    (ADR-002) or attempt recording (ADR-005), session creation has no
    existing response to protect - failing to create the one thing the
    request asked for must surface, not be swallowed.
    """
    plan, outcome = session_planning_pipeline.plan_session(request, seed=seed)

    if outcome.actualCount == 0:
        raise SessionCreationError(
            f"No questions available for chapter {request.chapterId!r} matching the requested configuration"
        )

    now = datetime.now(UTC).isoformat()
    session = LearningSession(
        sessionId=plan.planId,
        studentId=request.studentId,
        chapterId=request.chapterId,
        plan=plan,
        selectedQuestions=outcome.selectedQuestions,
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
    session_store.insert_session(session)
    return session
