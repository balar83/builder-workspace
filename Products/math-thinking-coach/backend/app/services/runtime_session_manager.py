import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.schemas.answer import AnswerEvaluationResponse, AnswerSubmission, EvaluationResult, NextAction
from app.schemas.question import Question
from app.schemas.session import LearningSession
from app.services import answer_service, attempt_service, coaching_service, content_repository, session_store

logger = logging.getLogger(__name__)

# Lazy-checked on access, not swept by a background job - this system has no
# scheduler, and building one for this alone would be new infrastructure the
# design review deliberately declined to introduce.
SESSION_INACTIVITY_HOURS = 4

_LIVE_STATUSES = ("not_started", "in_progress")
_ADVANCING_ACTIONS = (NextAction.NEXT_QUESTION, NextAction.SHOW_SOLUTION)


class SessionNotFoundError(Exception):
    """Session does not exist, or does not belong to the requesting student."""


class SessionNotSubmittableError(Exception):
    """Session is in a terminal state, or the submitted position is stale."""


@dataclass
class CurrentQuestionResult:
    session: LearningSession
    question: Question | None  # None exactly when the session is terminal


@dataclass
class SubmitAnswerResult:
    session: LearningSession
    evaluation: AnswerEvaluationResponse


def get_current_question(session_id: str, student_id: str) -> CurrentQuestionResult:
    """
    A read with one lazy write, same class as the lifecycle transition
    below: the first time a live question is actually served, startedAt is
    recorded (RC1 polish - a timed session begins when the student
    receives the first question, not after their first submitted answer).
    Guarded by startedAt still being None, so this fires exactly once per
    session, however many times the question is re-fetched (a reload, a
    resume). Question 1 and question 10 are served by this exact same
    call; there is no separate "first question" path anywhere in this
    module.
    """
    session = _load_live_session(session_id, student_id)

    if session.state.status not in _LIVE_STATUSES:
        return CurrentQuestionResult(session=session, question=None)

    if session.state.startedAt is None:
        session = _mark_started(session)

    selected = session.selectedQuestions[session.state.currentPosition]
    question = content_repository.get_question_content(selected.questionId)
    return CurrentQuestionResult(session=session, question=question)


def _mark_started(session: LearningSession) -> LearningSession:
    # Only startedAt - lastActivityAt is deliberately untouched here, since
    # it remains an attempt-only signal for the separate abandoned-session
    # check; merely viewing a question is not "activity" for that purpose.
    new_state = session.state.model_copy(update={"startedAt": datetime.now(UTC).isoformat()})
    session_store.update_session_state(session.sessionId, new_state)
    return session.model_copy(update={"state": new_state})


def submit_answer(
    session_id: str, student_id: str, position: int, answer: str, hints_used: int = 0
) -> SubmitAnswerResult:
    """
    The only write path. Evaluate -> record -> advance, in that order,
    under session_store's lock. attemptNumber is never accepted from the
    caller - it is always SessionState.attemptsOnCurrentQuestion + 1,
    closing the race a client-supplied value would leave open (two tabs,
    same position, second one holding a stale attempt count). hints_used
    is different: it's a client-observed fact (how many hints this
    student revealed on this question) with no server-side equivalent to
    derive it from instead, so - unlike attemptNumber - it's accepted from
    the caller, the same trust tier `answer` itself already has.
    """
    session = _load_submittable_session(session_id, student_id, position)

    selected = session.selectedQuestions[position]
    submission = AnswerSubmission(
        answer=answer, attemptNumber=session.state.attemptsOnCurrentQuestion + 1, hintsUsed=hints_used
    )

    # Unchanged, ADR-001: evaluate_answer resolves the question internally
    # via question_service. This module never fetches content for
    # evaluation purposes - only get_question_content, for display.
    evaluation = answer_service.evaluate_answer(selected.questionId, submission)

    _record_attempt(session, selected, submission, evaluation)

    updated_session = _advance_state(session, selected, evaluation)
    return SubmitAnswerResult(session=updated_session, evaluation=evaluation)


def reveal_solution(session_id: str, student_id: str, position: int, hints_used: int = 0) -> SubmitAnswerResult:
    """
    M1: the explicit "I revealed the solution" action - distinct from
    submit_answer above. No answer text is evaluated and no coaching-ladder
    attempt-count gating applies (coaching_service.reveal_solution() is
    unconditional, unlike decide()'s own attempt-gated SHOW_SOLUTION
    branch) - see that function's docstring for why: a learner can
    legitimately exhaust every hint (free, unlimited) well before
    submitting 3 real wrong answers, and forcing them to keep submitting
    just to reach the ladder's SHOW_SOLUTION step would mean recording
    attempts that don't reflect what they actually typed.

    Reuses the identical liveness/position validation submit_answer uses
    (_load_submittable_session), so a stale or duplicate reveal request at
    an already-advanced position is rejected exactly like a stale/duplicate
    answer submission is - the session's currentPosition is never advanced
    twice from the same client-visible position, with no separate
    idempotency mechanism needed.

    isCorrect is always False (EvaluationResult contract - see M1 design
    decision below): correctCount is never incremented (_advance_state
    only increments it when evaluation.evaluation.isCorrect is True) and
    the mastery streak (attempt_service.get_performance's 3-consecutive-
    correct-no-hints rule) is broken by this row exactly like any other
    wrong attempt would break it - no separate mastery-suppression logic
    was needed.

    SHOW_SOLUTION is already one of _ADVANCING_ACTIONS, so _advance_state
    (unchanged) advances currentPosition exactly once, the same "no
    separate acknowledge step" behavior already documented on that
    function for the ladder-driven SHOW_SOLUTION case.
    """
    session = _load_submittable_session(session_id, student_id, position)
    selected = session.selectedQuestions[position]

    coach, ui = coaching_service.reveal_solution()
    content = content_repository.get_question_content(selected.questionId)
    evaluation = AnswerEvaluationResponse(
        evaluation=EvaluationResult(
            isCorrect=False,
            score=0.0,
            maxScore=content.maxScore if content else 1.0,
            # M1 design decision: a new evaluatorId, not one of the real
            # evaluators' ids - this outcome was never produced by
            # evaluating a submission at all, and must read as such to
            # anyone inspecting evidence/analytics later.
            evaluatorId="revealed_solution_v1",
            evidence="learner explicitly revealed the solution",
        ),
        coach=coach,
        ui=ui,
    )

    _record_reveal(session, selected, hints_used)

    updated_session = _advance_state(session, selected, evaluation)
    return SubmitAnswerResult(session=updated_session, evaluation=evaluation)


def _load_submittable_session(session_id: str, student_id: str, position: int) -> LearningSession:
    """
    The liveness/position validation shared by submit_answer and (M1)
    reveal_solution - factored out unchanged from submit_answer's own body
    so both write paths reject a terminal session or a stale/already-
    advanced position identically, with no duplicated logic to drift.
    """
    session = _load_live_session(session_id, student_id)

    if session.state.status not in _LIVE_STATUSES:
        raise SessionNotSubmittableError(f"Session {session_id} is {session.state.status}, not submittable")

    if position != session.state.currentPosition:
        raise SessionNotSubmittableError(
            f"Position {position} does not match the session's current position "
            f"{session.state.currentPosition}"
        )

    return session


def _record_reveal(session: LearningSession, selected, hints_used: int) -> None:
    """
    M1's own attempt-recording, parallel to _record_attempt but never
    reading a submission's `answer`/`attemptNumber` (there isn't one) -
    submitted_option_id is always None here (unlike _record_attempt's
    single_choice case), since no option was actually selected.
    """
    try:
        content = content_repository.get_question_content(selected.questionId)
        attempt_service.record_attempt(
            student_id=session.studentId,
            question_id=selected.questionId,
            chapter_id=session.chapterId,
            topic_id=content.topicId if content else None,
            difficulty=selected.difficulty,
            is_correct=False,
            attempt_number=session.state.attemptsOnCurrentQuestion + 1,
            question_type=selected.type,
            session_id=session.sessionId,
            session_mode=session.plan.mode,
            hints_used=hints_used,
            submitted_option_id=None,
            provenance="session",
            revealed_solution=True,
        )
    except Exception:
        logger.warning(
            "Reveal-solution attempt recording failed unexpectedly for session_id=%s question_id=%s",
            session.sessionId, selected.questionId, exc_info=True,
        )


def _record_attempt(session, selected, submission, evaluation) -> None:
    # Best-effort, same tier of importance as the standalone /answer route's
    # own attempt recording: session progression is the core deliverable of
    # submit_answer and must not depend on this succeeding. SessionState's
    # own fields (correctCount, attemptsOnCurrentQuestion) are updated
    # independently below, not derived from this write.
    try:
        content = content_repository.get_question_content(selected.questionId)
        # selected.type (QuestionCandidate/SelectedQuestion.type) is always
        # None today - content_repository never populates it (see its own
        # docstring). content.questionType is the real, live field; reused
        # here since content is already fetched for topic_id, same pattern
        # as attempt_service.record_attempt_for_answer's own gate.
        is_single_choice = content is not None and content.questionType == "single_choice"
        attempt_service.record_attempt(
            student_id=session.studentId,
            question_id=selected.questionId,
            chapter_id=session.chapterId,
            topic_id=content.topicId if content else None,
            difficulty=selected.difficulty,
            is_correct=evaluation.evaluation.isCorrect,
            attempt_number=submission.attemptNumber,
            question_type=selected.type,
            session_id=session.sessionId,
            session_mode=session.plan.mode,
            hints_used=submission.hintsUsed,
            submitted_option_id=submission.answer if is_single_choice else None,
            provenance="session",
        )
    except Exception:
        logger.warning(
            "Attempt recording failed unexpectedly for session_id=%s question_id=%s",
            session.sessionId, selected.questionId, exc_info=True,
        )


def _advance_state(session: LearningSession, selected, evaluation: AnswerEvaluationResponse) -> LearningSession:
    """
    Advances only when the question's cycle has ended - either solved
    (NEXT_QUESTION) or given up on and shown the solution (SHOW_SOLUTION).
    TRY_AGAIN/SHOW_HINT both mean stay put, mirroring QuestionPage.tsx's
    existing, unchanged client-side logic. Advancing on SHOW_SOLUTION (not
    just NEXT_QUESTION) is a deliberate, named difference from today's
    frontend, which requires one extra manual "mark complete" click after
    the solution is revealed - there is no equivalent "acknowledge" call in
    the approved C2 API surface, so the session advances immediately
    instead. Flagged for product review if that reading pause matters once
    this is user-facing.
    """
    now = datetime.now(UTC).isoformat()
    state = session.state
    should_advance = evaluation.coach.nextAction in _ADVANCING_ACTIONS

    if should_advance:
        new_position = state.currentPosition + 1
        is_complete = new_position >= len(session.selectedQuestions)
        updates = {
            "status": "completed" if is_complete else "in_progress",
            "currentPosition": new_position,
            "attemptsOnCurrentQuestion": 0,
            "correctCount": state.correctCount + (1 if evaluation.evaluation.isCorrect else 0),
            "startedAt": state.startedAt or now,
            "lastActivityAt": now,
            "completedAt": now if is_complete else None,
        }
    else:
        updates = {
            "status": "in_progress",
            "attemptsOnCurrentQuestion": state.attemptsOnCurrentQuestion + 1,
            "startedAt": state.startedAt or now,
            "lastActivityAt": now,
        }

    new_state = state.model_copy(update=updates)
    session_store.update_session_state(session.sessionId, new_state)
    return session.model_copy(update={"state": new_state})


def get_session_summary(session_id: str, student_id: str) -> LearningSession:
    """
    Applies the same lazy lifecycle check as the read/write paths, so a
    summary view never shows a stale status for a session that's actually
    expired or abandoned but hasn't been touched since.
    """
    return _load_live_session(session_id, student_id)


def _load_owned_session(session_id: str, student_id: str) -> LearningSession:
    session = session_store.get_session(session_id)
    if session is None or session.studentId != student_id:
        # Same response for "doesn't exist" and "exists but isn't yours" -
        # deliberately not distinguishing, so a session ID can't be probed
        # to confirm another student's session exists.
        raise SessionNotFoundError(f"Session {session_id} not found")
    return session


def _load_live_session(session_id: str, student_id: str) -> LearningSession:
    session = _load_owned_session(session_id, student_id)
    return _apply_lazy_lifecycle(session)


def _apply_lazy_lifecycle(session: LearningSession) -> LearningSession:
    if session.state.status in ("completed", "expired", "abandoned"):
        return session

    now = datetime.now(UTC)

    # Test mode's time limit is the more specific, intent-driven signal and
    # takes precedence over generic inactivity when both could apply.
    if (
        session.plan.mode == "test"
        and session.plan.timeLimitMinutes
        and session.state.startedAt
        and now - datetime.fromisoformat(session.state.startedAt) > timedelta(minutes=session.plan.timeLimitMinutes)
    ):
        return _transition_to(session, "expired", now)

    if now - datetime.fromisoformat(session.state.lastActivityAt) > timedelta(hours=SESSION_INACTIVITY_HOURS):
        return _transition_to(session, "abandoned", now)

    return session


def _transition_to(session: LearningSession, status: str, now: datetime) -> LearningSession:
    new_state = session.state.model_copy(update={"status": status, "completedAt": now.isoformat()})
    session_store.update_session_state(session.sessionId, new_state)
    return session.model_copy(update={"state": new_state})
