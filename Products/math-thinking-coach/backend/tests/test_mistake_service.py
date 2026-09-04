from pathlib import Path

import pytest

from app.services import attempt_service, mistake_service

# Real production content, same convention as test_activity_service.py /
# test_performance.py: proves the current-question-metadata lookup against
# actual data, not a fixture double. rn-q01 is a real rational-numbers
# question with a real topicId.
REAL_CHAPTER_ID = "rational-numbers"
REAL_QUESTION_ID = "rn-q01"
REAL_TOPIC_ID = "topic-rational-numbers-properties-and-operations"


@pytest.fixture(autouse=True)
def _isolate_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(attempt_service, "DB_PATH", tmp_path / "attempts.db")


def test_get_unresolved_mistakes_is_empty_for_a_fresh_learner() -> None:
    assert mistake_service.get_unresolved_mistakes("student-1") == []


def test_one_wrong_attempt_is_included() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id=REAL_QUESTION_ID, chapter_id=REAL_CHAPTER_ID,
        topic_id=REAL_TOPIC_ID, difficulty="Easy", is_correct=False, attempt_number=1,
    )

    mistakes = mistake_service.get_unresolved_mistakes("student-1")

    assert len(mistakes) == 1
    assert mistakes[0].questionId == REAL_QUESTION_ID


def test_wrong_then_correct_is_excluded() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id=REAL_QUESTION_ID, chapter_id=REAL_CHAPTER_ID,
        topic_id=REAL_TOPIC_ID, difficulty="Easy", is_correct=False, attempt_number=1,
    )
    attempt_service.record_attempt(
        student_id="student-1", question_id=REAL_QUESTION_ID, chapter_id=REAL_CHAPTER_ID,
        topic_id=REAL_TOPIC_ID, difficulty="Easy", is_correct=True, attempt_number=2,
    )

    assert mistake_service.get_unresolved_mistakes("student-1") == []


def test_correct_then_wrong_is_included() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id=REAL_QUESTION_ID, chapter_id=REAL_CHAPTER_ID,
        topic_id=REAL_TOPIC_ID, difficulty="Easy", is_correct=True, attempt_number=1,
    )
    attempt_service.record_attempt(
        student_id="student-1", question_id=REAL_QUESTION_ID, chapter_id=REAL_CHAPTER_ID,
        topic_id=REAL_TOPIC_ID, difficulty="Easy", is_correct=False, attempt_number=2,
    )

    mistakes = mistake_service.get_unresolved_mistakes("student-1")

    assert len(mistakes) == 1
    assert mistakes[0].questionId == REAL_QUESTION_ID


def test_multiple_wrong_attempts_produce_exactly_one_entry() -> None:
    for attempt_number in range(1, 4):
        attempt_service.record_attempt(
            student_id="student-1", question_id=REAL_QUESTION_ID, chapter_id=REAL_CHAPTER_ID,
            topic_id=REAL_TOPIC_ID, difficulty="Easy", is_correct=False, attempt_number=attempt_number,
        )

    mistakes = mistake_service.get_unresolved_mistakes("student-1")

    assert len(mistakes) == 1


def test_attempts_across_different_sessions_are_grouped_by_question() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id=REAL_QUESTION_ID, chapter_id=REAL_CHAPTER_ID,
        topic_id=REAL_TOPIC_ID, difficulty="Easy", is_correct=False, attempt_number=1,
        session_id="session-a", session_mode="practice",
    )
    attempt_service.record_attempt(
        student_id="student-1", question_id=REAL_QUESTION_ID, chapter_id=REAL_CHAPTER_ID,
        topic_id=REAL_TOPIC_ID, difficulty="Easy", is_correct=False, attempt_number=1,
        session_id="session-b", session_mode="revision",
    )

    mistakes = mistake_service.get_unresolved_mistakes("student-1")

    assert len(mistakes) == 1


def test_standalone_and_session_attempts_on_the_same_question_are_grouped_together() -> None:
    """Provenance is irrelevant to grouping - a session attempt and a standalone attempt on the same question count as one question."""
    attempt_service.record_attempt(
        student_id="student-1", question_id=REAL_QUESTION_ID, chapter_id=REAL_CHAPTER_ID,
        topic_id=REAL_TOPIC_ID, difficulty="Easy", is_correct=False, attempt_number=1,
        session_id="session-a", session_mode="practice", provenance="session",
    )
    attempt_service.record_attempt(
        student_id="student-1", question_id=REAL_QUESTION_ID, chapter_id=REAL_CHAPTER_ID,
        topic_id=REAL_TOPIC_ID, difficulty="Easy", is_correct=True, attempt_number=1,
        provenance="standalone",
    )

    # The standalone attempt (correct) is the higher-id, i.e. latest, row -
    # resolved, regardless of the earlier session attempt's provenance.
    assert mistake_service.get_unresolved_mistakes("student-1") == []


def test_current_question_metadata_is_used_when_the_question_resolves() -> None:
    """
    Chapter/topic come from question_service.get_question_by_id (current
    content), not the attempt row's own denormalized values - proven here by
    passing DELIBERATELY WRONG chapter/topic on the attempt row and
    confirming the response reflects the real, current question metadata
    instead.
    """
    attempt_service.record_attempt(
        student_id="student-1", question_id=REAL_QUESTION_ID, chapter_id="wrong-chapter-id",
        topic_id="wrong-topic-id", difficulty="Easy", is_correct=False, attempt_number=1,
    )

    mistakes = mistake_service.get_unresolved_mistakes("student-1")

    assert len(mistakes) == 1
    assert mistakes[0].chapterId == REAL_CHAPTER_ID
    assert mistakes[0].chapterTitle == "Rational Numbers"
    assert mistakes[0].topicId == REAL_TOPIC_ID


def test_falls_back_to_attempt_row_metadata_when_the_question_no_longer_resolves() -> None:
    """
    A question_id with no matching current content (removed/renamed since
    the attempt was recorded) falls back to the attempt row's own
    denormalized chapter_id/topic_id - never fabricated, never dropped.
    chapterTitle falls back to the raw chapter_id, same as
    activity_service's identical unknown-chapter convention.
    """
    attempt_service.record_attempt(
        student_id="student-1", question_id="no-such-question-anymore", chapter_id="rational-numbers",
        topic_id="some-historical-topic-id", difficulty="Easy", is_correct=False, attempt_number=1,
    )

    mistakes = mistake_service.get_unresolved_mistakes("student-1")

    assert len(mistakes) == 1
    assert mistakes[0].questionId == "no-such-question-anymore"
    assert mistakes[0].chapterId == "rational-numbers"
    assert mistakes[0].chapterTitle == "Rational Numbers"
    assert mistakes[0].topicId == "some-historical-topic-id"


def test_falls_back_to_the_raw_chapter_id_when_neither_question_nor_chapter_resolve() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="no-such-question", chapter_id="no-such-chapter",
        topic_id=None, difficulty="Easy", is_correct=False, attempt_number=1,
    )

    mistakes = mistake_service.get_unresolved_mistakes("student-1")

    assert len(mistakes) == 1
    assert mistakes[0].chapterId == "no-such-chapter"
    assert mistakes[0].chapterTitle == "no-such-chapter"
    assert mistakes[0].topicId is None


def test_response_shape() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id=REAL_QUESTION_ID, chapter_id=REAL_CHAPTER_ID,
        topic_id=REAL_TOPIC_ID, difficulty="Easy", is_correct=False, attempt_number=1,
    )

    mistake = mistake_service.get_unresolved_mistakes("student-1")[0]

    assert mistake.model_dump().keys() == {
        "questionId", "chapterId", "chapterTitle", "topicId", "lastAttemptAt",
    }
    assert mistake.lastAttemptAt  # non-empty ISO timestamp, exact value not asserted here
