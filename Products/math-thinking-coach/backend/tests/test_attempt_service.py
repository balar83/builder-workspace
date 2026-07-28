from pathlib import Path

import pytest

from app.schemas.answer import AnswerEvaluationResponse, AnswerSubmission, Coach, Evaluation, NextAction, UiState
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
        evaluation=Evaluation(isCorrect=True, score=1.0),
        coach=Coach(message="Great job!", nextAction=NextAction.NEXT_QUESTION),
        ui=UiState(canTryAgain=False, canRevealSolution=False, hintLevel=0),
    )

    attempt_service.record_attempt_for_answer("student-1", question, submission, response)
