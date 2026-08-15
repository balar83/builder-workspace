from pathlib import Path

import pytest

from app.services import attempt_service, learning_context_service

CHAPTER_ID = "rational-numbers"
TOPIC_ID = "topic-rational-numbers-properties-and-operations"


@pytest.fixture(autouse=True)
def _isolate_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(attempt_service, "DB_PATH", tmp_path / "attempts.db")


def test_first_time_student_has_no_history_but_safe_empty_fields() -> None:
    context = learning_context_service.build_learning_context("student-1", CHAPTER_ID)

    assert context.hasHistory is False
    assert context.topicMastery == {}
    assert context.topicAccuracy == {}
    assert context.weakTopicIds == []
    assert context.recentQuestionIds == []


def test_context_reflects_recorded_attempts_for_the_requested_chapter() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id=CHAPTER_ID, topic_id=TOPIC_ID,
        difficulty="Easy", is_correct=True, attempt_number=1,
    )

    context = learning_context_service.build_learning_context("student-1", CHAPTER_ID)

    assert context.hasHistory is True
    assert context.topicAccuracy[TOPIC_ID] == 1.0


def test_weak_topic_requires_attempts_and_low_accuracy_and_not_mastered() -> None:
    for is_correct in [True, False, False, False]:
        attempt_service.record_attempt(
            student_id="student-1", question_id="q1", chapter_id=CHAPTER_ID, topic_id=TOPIC_ID,
            difficulty="Easy", is_correct=is_correct, attempt_number=1,
        )

    context = learning_context_service.build_learning_context("student-1", CHAPTER_ID)

    assert context.topicAccuracy[TOPIC_ID] == 0.25
    assert TOPIC_ID in context.weakTopicIds


def test_mastered_topic_is_never_weak_even_if_accuracy_history_was_mixed() -> None:
    for is_correct in [False, True, True, True]:
        attempt_service.record_attempt(
            student_id="student-1", question_id="q1", chapter_id=CHAPTER_ID, topic_id=TOPIC_ID,
            difficulty="Easy", is_correct=is_correct, attempt_number=1, hints_used=0,
        )

    context = learning_context_service.build_learning_context("student-1", CHAPTER_ID)

    assert context.topicMastery[TOPIC_ID] is True
    assert TOPIC_ID not in context.weakTopicIds


def test_high_accuracy_topic_is_not_weak() -> None:
    for is_correct in [True, True, True, False]:
        attempt_service.record_attempt(
            student_id="student-1", question_id="q1", chapter_id=CHAPTER_ID, topic_id=TOPIC_ID,
            difficulty="Easy", is_correct=is_correct, attempt_number=1,
        )

    context = learning_context_service.build_learning_context("student-1", CHAPTER_ID)

    assert context.topicAccuracy[TOPIC_ID] == 0.75
    assert TOPIC_ID not in context.weakTopicIds


def test_context_is_scoped_to_the_requested_chapter_only() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="linear-equations",
        topic_id="topic-linear-equations-one-variable", difficulty="Easy",
        is_correct=False, attempt_number=1,
    )

    context = learning_context_service.build_learning_context("student-1", CHAPTER_ID)

    assert context.hasHistory is False
    assert context.topicAccuracy == {}


def test_recent_question_ids_are_most_recent_first_and_scoped_to_chapter() -> None:
    for question_id in ["q1", "q2", "q3"]:
        attempt_service.record_attempt(
            student_id="student-1", question_id=question_id, chapter_id=CHAPTER_ID,
            topic_id=TOPIC_ID, difficulty="Easy", is_correct=True, attempt_number=1,
        )

    context = learning_context_service.build_learning_context("student-1", CHAPTER_ID)

    assert context.recentQuestionIds == ["q3", "q2", "q1"]


def test_context_is_scoped_to_the_requesting_student() -> None:
    attempt_service.record_attempt(
        student_id="student-2", question_id="q1", chapter_id=CHAPTER_ID, topic_id=TOPIC_ID,
        difficulty="Easy", is_correct=True, attempt_number=1,
    )

    context = learning_context_service.build_learning_context("student-1", CHAPTER_ID)

    assert context.hasHistory is False
