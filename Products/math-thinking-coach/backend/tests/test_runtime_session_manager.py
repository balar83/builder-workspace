from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.schemas.session import AssessmentRequest
from app.services import attempt_service, runtime_session_manager as rsm
from app.services import session_builder, session_store

ANSWERS = {
    "rn-q01": "Yes",
    "rn-q02": "1/2",
    "rn-q03": "the square root of 2",
    "rn-q04": "-2/3",
    "rn-q05": "Yes",
    "rn-q06": "Yes",
    "rn-q07": "Addition",
    "rn-q08": "7/20",
    "rn-q09": "Commutativity of addition",
    "rn-q10": "Associativity of addition",
    "rn-q11": "No",
    "rn-q12": "-1/7",
    "rn-q13": "No",
    "rn-q14": "0",
    "rn-q15": "1",
    "rn-q16": "3/4",
    "rn-q17": "Distributivity of multiplication over addition",
    "rn-q18": "5/9",
    "rn-q19": "-3/8",
    "rn-q20": "9/5",
    "rn-q21": "-1/7",
    "rn-q22": "No",
    "rn-q23": "-4/9",
    "rn-q24": "1",
    "rn-q25": "1",
    "rn-q26": "1/2",
    "rn-q27": "3/8",
    "rn-q28": "5/2",
    "rn-q29": "0",
    "rn-q30": "7/10",
    "rn-q31": "Infinite",
    "rn-q32": "-5/2",
    "rn-q33": "Yes",
    "rn-q34": "15/5",
    "rn-q35": "-3/4",
    "rn-q36": "1",
    "rn-q37": "-7/4",
    "rn-q38": "5/9",
    "rn-q39": "1/10",
    "rn-q40": "No",
    "rn-q41": "Yes",
    "rn-q42": "-3/5",
    "rn-q43": "3/4",
    "rn-q44": "Yes",
    "rn-q45": "Subtraction",
    "rn-q46": "Yes",
    "rn-q47": "Commutativity of multiplication",
    "rn-q48": "1",
    "rn-q49": "No",
    "rn-q50": "0",
    "rn-q51": "1",
    "rn-q52": "2/9",
    "rn-q53": "-5/7",
    "rn-q54": "9/10",
    "rn-q55": "3/4",
    "rn-q56": "-13/8",
    "rn-q57": "-11/6",
    "rn-q58": "-1/2",
    "rn-q59": "3/5",
    "rn-q60": "3/8 and 7/16",
}


@pytest.fixture(autouse=True)
def _isolate_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(attempt_service, "DB_PATH", tmp_path / "runtime.db")
    monkeypatch.setattr(session_store, "DB_PATH", tmp_path / "runtime.db")


def _create(mode="practice", question_count=5, time_limit_minutes=None, seed="fixed"):
    request = AssessmentRequest(
        studentId="student-1", chapterId="rational-numbers", mode=mode,
        questionCount=question_count, timeLimitMinutes=time_limit_minutes,
    )
    return session_builder.create_session(request, seed=seed)


def _backdate(session_id: str, *, last_activity_hours_ago: float = 0, started_hours_ago: float | None = None):
    session = session_store.get_session(session_id)
    now = datetime.now(UTC)
    updates = {"lastActivityAt": (now - timedelta(hours=last_activity_hours_ago)).isoformat()}
    if started_hours_ago is not None:
        updates["startedAt"] = (now - timedelta(hours=started_hours_ago)).isoformat()
    new_state = session.state.model_copy(update=updates)
    session_store.update_session_state(session_id, new_state)


# --- one-question serving / resume -------------------------------------------

def test_get_current_question_serves_only_the_current_question() -> None:
    session = _create()

    result = rsm.get_current_question(session.sessionId, "student-1")

    assert result.question is not None
    assert result.question.id == session.selectedQuestions[0].questionId
    assert result.session.state.currentPosition == 0


def test_get_current_question_never_returns_the_full_bank() -> None:
    session = _create()

    result = rsm.get_current_question(session.sessionId, "student-1")

    # The result carries exactly one question, not the session's full list.
    assert result.question is not None
    assert not hasattr(result, "selectedQuestions")


def test_repeated_reads_are_side_effect_free_resume_and_refresh() -> None:
    session = _create()

    first = rsm.get_current_question(session.sessionId, "student-1")
    second = rsm.get_current_question(session.sessionId, "student-1")

    assert first.question.id == second.question.id
    assert first.session.state.currentPosition == second.session.state.currentPosition == 0


def test_question_content_comes_from_content_repository_not_a_candidate() -> None:
    session = _create()

    result = rsm.get_current_question(session.sessionId, "student-1")

    # QuestionCandidate has no .solution/.hints text; Question (from
    # get_question_content) does - proves the display path, not selection.
    assert result.question.solution
    assert isinstance(result.question.hints, list)


# --- ownership -----------------------------------------------------------------

def test_get_current_question_rejects_a_different_student() -> None:
    session = _create()

    with pytest.raises(rsm.SessionNotFoundError):
        rsm.get_current_question(session.sessionId, "student-2")


def test_submit_answer_rejects_a_different_student() -> None:
    session = _create()

    with pytest.raises(rsm.SessionNotFoundError):
        rsm.submit_answer(session.sessionId, "student-2", 0, "1/2")


def test_unknown_session_id_raises_not_found() -> None:
    with pytest.raises(rsm.SessionNotFoundError):
        rsm.get_current_question("no-such-session", "student-1")


# --- answer submission, advancement -------------------------------------------

def test_wrong_answer_stays_on_the_same_question() -> None:
    session = _create()
    selected = session.selectedQuestions[0]

    result = rsm.submit_answer(session.sessionId, "student-1", 0, "definitely wrong")

    assert result.evaluation.evaluation.isCorrect is False
    assert result.session.state.currentPosition == 0
    assert result.session.state.attemptsOnCurrentQuestion == 1
    assert result.session.state.status == "in_progress"


def test_correct_answer_advances_to_the_next_question() -> None:
    session = _create()
    selected = session.selectedQuestions[0]

    result = rsm.submit_answer(session.sessionId, "student-1", 0, ANSWERS[selected.questionId])

    assert result.evaluation.evaluation.isCorrect is True
    assert result.session.state.currentPosition == 1
    assert result.session.state.attemptsOnCurrentQuestion == 0
    assert result.session.state.correctCount == 1


def test_reaching_show_solution_also_advances_without_counting_as_correct() -> None:
    session = _create()

    rsm.submit_answer(session.sessionId, "student-1", 0, "wrong")
    rsm.submit_answer(session.sessionId, "student-1", 0, "wrong")
    result = rsm.submit_answer(session.sessionId, "student-1", 0, "wrong")

    assert result.evaluation.coach.nextAction == "SHOW_SOLUTION"
    assert result.session.state.currentPosition == 1
    assert result.session.state.correctCount == 0


def test_first_submission_transitions_not_started_to_in_progress() -> None:
    session = _create()
    assert session.state.status == "not_started"

    result = rsm.submit_answer(session.sessionId, "student-1", 0, "wrong")

    assert result.session.state.status == "in_progress"
    assert result.session.state.startedAt is not None


def test_attempt_number_is_server_derived_not_client_supplied() -> None:
    # submit_answer's signature has no attemptNumber parameter at all - this
    # test proves the derived sequence is correct across retries.
    session = _create()

    rsm.submit_answer(session.sessionId, "student-1", 0, "wrong")
    result = rsm.submit_answer(session.sessionId, "student-1", 0, "wrong")

    assert result.session.state.attemptsOnCurrentQuestion == 2


def test_completing_the_final_question_marks_the_session_completed() -> None:
    session = _create(question_count=1)
    selected = session.selectedQuestions[0]

    result = rsm.submit_answer(session.sessionId, "student-1", 0, ANSWERS[selected.questionId])

    assert result.session.state.status == "completed"
    assert result.session.state.completedAt is not None
    assert result.session.state.currentPosition == 1


def test_completed_session_returns_no_current_question() -> None:
    session = _create(question_count=1)
    selected = session.selectedQuestions[0]
    rsm.submit_answer(session.sessionId, "student-1", 0, ANSWERS[selected.questionId])

    result = rsm.get_current_question(session.sessionId, "student-1")

    assert result.question is None
    assert result.session.state.status == "completed"


# --- concurrency / stale submissions -------------------------------------------

def test_stale_position_from_a_second_tab_is_rejected() -> None:
    session = _create()
    selected = session.selectedQuestions[0]
    # "Tab A" advances the session.
    rsm.submit_answer(session.sessionId, "student-1", 0, ANSWERS[selected.questionId])

    # "Tab B", still showing the old position, submits late.
    with pytest.raises(rsm.SessionNotSubmittableError):
        rsm.submit_answer(session.sessionId, "student-1", 0, "anything")


def test_submitting_to_a_completed_session_is_rejected() -> None:
    session = _create(question_count=1)
    selected = session.selectedQuestions[0]
    rsm.submit_answer(session.sessionId, "student-1", 0, ANSWERS[selected.questionId])

    with pytest.raises(rsm.SessionNotSubmittableError):
        rsm.submit_answer(session.sessionId, "student-1", 0, "anything")


# --- lifecycle: expired / abandoned --------------------------------------------

def test_inactive_session_becomes_abandoned_lazily_on_access() -> None:
    session = _create()
    _backdate(session.sessionId, last_activity_hours_ago=rsm.SESSION_INACTIVITY_HOURS + 1)

    result = rsm.get_current_question(session.sessionId, "student-1")

    assert result.session.state.status == "abandoned"
    assert result.question is None


def test_recently_active_session_is_not_abandoned() -> None:
    session = _create()
    _backdate(session.sessionId, last_activity_hours_ago=0.01)

    result = rsm.get_current_question(session.sessionId, "student-1")

    assert result.session.state.status == "not_started"
    assert result.question is not None


def test_test_mode_session_past_its_time_limit_becomes_expired() -> None:
    session = _create(mode="test", time_limit_minutes=10, question_count=5)
    rsm.submit_answer(session.sessionId, "student-1", 0, "wrong")  # sets startedAt
    _backdate(session.sessionId, last_activity_hours_ago=0, started_hours_ago=1)

    result = rsm.get_current_question(session.sessionId, "student-1")

    assert result.session.state.status == "expired"


def test_get_current_question_starts_the_clock_on_first_serve_not_first_submission() -> None:
    session = _create(mode="test", time_limit_minutes=10, question_count=5)
    assert session.state.startedAt is None

    result = rsm.get_current_question(session.sessionId, "student-1")

    assert result.session.state.startedAt is not None


def test_second_get_current_question_call_does_not_reset_started_at() -> None:
    session = _create(mode="test", time_limit_minutes=10, question_count=5)
    first = rsm.get_current_question(session.sessionId, "student-1")

    second = rsm.get_current_question(session.sessionId, "student-1")

    assert second.session.state.startedAt == first.session.state.startedAt


def test_test_mode_session_can_expire_before_any_answer_is_submitted() -> None:
    # The bug RC1 polish fixes: previously startedAt stayed null until the
    # first submission, so a session nobody ever answered could never expire.
    session = _create(mode="test", time_limit_minutes=10, question_count=5)
    rsm.get_current_question(session.sessionId, "student-1")  # starts the clock, no submission yet
    _backdate(session.sessionId, last_activity_hours_ago=0, started_hours_ago=1)

    result = rsm.get_current_question(session.sessionId, "student-1")

    assert result.session.state.status == "expired"
    assert result.question is None


def test_practice_mode_get_current_question_also_sets_started_at_but_it_has_no_lifecycle_effect() -> None:
    # Uniform behavior regardless of mode - harmless for Practice/Revision,
    # since the expiry check requires mode == "test" and timeLimitMinutes
    # besides startedAt.
    session = _create(mode="practice", question_count=5)

    result = rsm.get_current_question(session.sessionId, "student-1")

    assert result.session.state.startedAt is not None
    assert result.session.state.status == "not_started"
    assert result.question is not None


def test_expired_takes_precedence_over_abandoned_for_test_mode() -> None:
    session = _create(mode="test", time_limit_minutes=10, question_count=5)
    rsm.submit_answer(session.sessionId, "student-1", 0, "wrong")
    # Both conditions true at once: long past the time limit AND long inactive.
    _backdate(
        session.sessionId,
        last_activity_hours_ago=rsm.SESSION_INACTIVITY_HOURS + 1,
        started_hours_ago=rsm.SESSION_INACTIVITY_HOURS + 1,
    )

    result = rsm.get_current_question(session.sessionId, "student-1")

    assert result.session.state.status == "expired"


def test_practice_mode_never_expires_only_abandons() -> None:
    session = _create(mode="practice", question_count=5)
    rsm.submit_answer(session.sessionId, "student-1", 0, "wrong")
    _backdate(
        session.sessionId,
        last_activity_hours_ago=rsm.SESSION_INACTIVITY_HOURS + 1,
        started_hours_ago=rsm.SESSION_INACTIVITY_HOURS + 1,
    )

    result = rsm.get_current_question(session.sessionId, "student-1")

    assert result.session.state.status == "abandoned"


def test_submitting_to_an_expired_session_is_rejected() -> None:
    session = _create(mode="test", time_limit_minutes=10, question_count=5)
    rsm.submit_answer(session.sessionId, "student-1", 0, "wrong")
    _backdate(session.sessionId, last_activity_hours_ago=0, started_hours_ago=1)

    with pytest.raises(rsm.SessionNotSubmittableError):
        rsm.submit_answer(session.sessionId, "student-1", 1, "anything")


# --- aggregate immutability ------------------------------------------------------

def test_plan_and_selected_questions_never_change_across_the_session() -> None:
    session = _create()
    original_plan = session.plan.model_dump()
    original_questions = [q.model_dump() for q in session.selectedQuestions]

    selected = session.selectedQuestions[0]
    result = rsm.submit_answer(session.sessionId, "student-1", 0, ANSWERS[selected.questionId])

    assert result.session.plan.model_dump() == original_plan
    assert [q.model_dump() for q in result.session.selectedQuestions] == original_questions


# --- attempt-history integration ------------------------------------------------

def test_submit_answer_records_a_session_linked_attempt() -> None:
    session = _create()
    selected = session.selectedQuestions[0]

    rsm.submit_answer(session.sessionId, "student-1", 0, ANSWERS[selected.questionId])

    performance = attempt_service.get_performance("student-1")
    assert len(performance) == 1
    assert performance[0]["questionsAttempted"] == 1
    assert performance[0]["questionsCorrect"] == 1
