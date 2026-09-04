from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.services import attempt_service, recovery_service

CHAPTER_ID = "rational-numbers"


@pytest.fixture(autouse=True)
def _isolate_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(attempt_service, "DB_PATH", tmp_path / "attempts.db")


def _record(question_id: str, is_correct: bool, attempt_number: int, student_id: str = "student-1") -> None:
    attempt_service.record_attempt(
        student_id=student_id, question_id=question_id, chapter_id=CHAPTER_ID, topic_id="topic-a",
        difficulty="Easy", is_correct=is_correct, attempt_number=attempt_number,
    )


def _insert_with_created_at(question_id: str, is_correct: bool, attempt_number: int, created_at: str) -> None:
    import sqlite3

    conn = sqlite3.connect(attempt_service.DB_PATH)
    try:
        conn.executescript(attempt_service._SCHEMA)
        conn.execute(
            "INSERT INTO attempts (student_id, question_id, chapter_id, topic_id, difficulty, is_correct, attempt_number, created_at) "
            "VALUES ('student-1', ?, ?, 'topic-a', 'Easy', ?, ?, ?)",
            (question_id, CHAPTER_ID, int(is_correct), attempt_number, created_at),
        )
        conn.commit()
    finally:
        conn.close()


# --- first-attempt accuracy -------------------------------------------------


def test_no_attempts_is_insufficient_evidence_everywhere() -> None:
    metrics = recovery_service.get_recovery_metrics("student-1")

    assert metrics.lifetime.firstAttemptAccuracy == recovery_service.AccuracyMetric(
        correct=0, attempted=0, accuracy=None
    )
    assert metrics.lifetime.eventualAccuracy.accuracy is None
    assert metrics.lifetime.recovery.rate is None
    assert metrics.lifetime.recovery.sufficientSample is False
    assert metrics.hasRecentActivity is False


def test_all_first_attempts_correct() -> None:
    _record("q1", True, 1)
    _record("q2", True, 1)

    metrics = recovery_service.get_recovery_metrics("student-1")

    assert metrics.lifetime.firstAttemptAccuracy.correct == 2
    assert metrics.lifetime.firstAttemptAccuracy.attempted == 2
    assert metrics.lifetime.firstAttemptAccuracy.accuracy == 1.0


def test_mixed_first_attempt_outcomes() -> None:
    _record("q1", True, 1)
    _record("q2", False, 1)
    _record("q3", False, 1)

    metrics = recovery_service.get_recovery_metrics("student-1")

    assert metrics.lifetime.firstAttemptAccuracy.correct == 1
    assert metrics.lifetime.firstAttemptAccuracy.attempted == 3
    assert metrics.lifetime.firstAttemptAccuracy.accuracy == round(1 / 3, 4)


def test_a_later_retry_never_counts_toward_first_attempt_accuracy() -> None:
    _record("q1", False, 1)
    _record("q1", True, 2)

    metrics = recovery_service.get_recovery_metrics("student-1")

    assert metrics.lifetime.firstAttemptAccuracy.correct == 0
    assert metrics.lifetime.firstAttemptAccuracy.attempted == 1


# --- eventual accuracy -------------------------------------------------------


def test_eventual_accuracy_ever_correct_semantics_wrong_then_correct() -> None:
    _record("q1", False, 1)
    _record("q1", True, 2)

    metrics = recovery_service.get_recovery_metrics("student-1")

    assert metrics.lifetime.eventualAccuracy.correct == 1
    assert metrics.lifetime.eventualAccuracy.attempted == 1
    assert metrics.lifetime.eventualAccuracy.accuracy == 1.0


def test_eventual_accuracy_ever_correct_semantics_correct_then_later_wrong() -> None:
    """A later wrong attempt after an earlier correct one must not un-count the question as eventually correct."""
    _record("q1", True, 1)
    _record("q1", False, 2)

    metrics = recovery_service.get_recovery_metrics("student-1")

    assert metrics.lifetime.eventualAccuracy.correct == 1
    assert metrics.lifetime.eventualAccuracy.attempted == 1
    assert metrics.lifetime.eventualAccuracy.accuracy == 1.0


def test_eventual_accuracy_counts_distinct_questions_not_rows() -> None:
    _record("q1", False, 1)
    _record("q1", False, 2)
    _record("q1", False, 3)

    metrics = recovery_service.get_recovery_metrics("student-1")

    assert metrics.lifetime.eventualAccuracy.attempted == 1
    assert metrics.lifetime.eventualAccuracy.correct == 0


# --- recovery rate -----------------------------------------------------------


def test_zero_recovery_denominator_when_every_first_attempt_was_correct() -> None:
    _record("q1", True, 1)
    _record("q2", True, 1)

    metrics = recovery_service.get_recovery_metrics("student-1")

    assert metrics.lifetime.recovery.initiallyWrong == 0
    assert metrics.lifetime.recovery.recovered == 0
    assert metrics.lifetime.recovery.rate is None
    assert metrics.lifetime.recovery.sufficientSample is False


def test_initially_wrong_and_never_recovered() -> None:
    _record("q1", False, 1)
    _record("q2", False, 1)
    _record("q3", False, 1)

    metrics = recovery_service.get_recovery_metrics("student-1")

    assert metrics.lifetime.recovery.initiallyWrong == 3
    assert metrics.lifetime.recovery.recovered == 0
    assert metrics.lifetime.recovery.rate == 0.0
    assert metrics.lifetime.recovery.sufficientSample is True


def test_recovery_denominator_below_the_minimum_sample_threshold() -> None:
    assert recovery_service.MIN_RECOVERY_SAMPLE_SIZE == 3
    _record("q1", False, 1)
    _record("q1", True, 2)
    _record("q2", False, 1)

    metrics = recovery_service.get_recovery_metrics("student-1")

    assert metrics.lifetime.recovery.initiallyWrong == 2
    assert metrics.lifetime.recovery.recovered == 1
    assert metrics.lifetime.recovery.rate is None
    assert metrics.lifetime.recovery.sufficientSample is False


def test_recovery_denominator_at_the_minimum_sample_threshold_exposes_a_rate() -> None:
    _record("q1", False, 1)
    _record("q1", True, 2)
    _record("q2", False, 1)
    _record("q2", True, 2)
    _record("q3", False, 1)

    metrics = recovery_service.get_recovery_metrics("student-1")

    assert metrics.lifetime.recovery.initiallyWrong == 3
    assert metrics.lifetime.recovery.recovered == 2
    assert metrics.lifetime.recovery.sufficientSample is True
    assert metrics.lifetime.recovery.rate == round(2 / 3, 4)


# --- recent vs lifetime -------------------------------------------------------


def test_recent_evidence_differs_from_lifetime_evidence() -> None:
    now = datetime.now(UTC)
    _insert_with_created_at("old-q", False, 1, (now - timedelta(days=30)).isoformat())
    _insert_with_created_at("new-q", True, 1, now.isoformat())

    metrics = recovery_service.get_recovery_metrics("student-1")

    assert metrics.lifetime.firstAttemptAccuracy.attempted == 2
    assert metrics.recent.firstAttemptAccuracy.attempted == 1
    assert metrics.recent.firstAttemptAccuracy.correct == 1
    assert metrics.hasRecentActivity is True


def test_no_recent_activity_is_explicit_not_a_copy_of_lifetime() -> None:
    now = datetime.now(UTC)
    _insert_with_created_at("old-q", True, 1, (now - timedelta(days=30)).isoformat())

    metrics = recovery_service.get_recovery_metrics("student-1")

    assert metrics.lifetime.firstAttemptAccuracy.accuracy == 1.0
    assert metrics.hasRecentActivity is False
    assert metrics.recent.firstAttemptAccuracy.attempted == 0
    assert metrics.recent.firstAttemptAccuracy.accuracy is None
    assert metrics.recent.eventualAccuracy.accuracy is None
    assert metrics.recent.recovery.rate is None


# --- chapter scoping -----------------------------------------------------------


def test_chapter_scoping_isolates_evidence_per_chapter() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="rn-q1", chapter_id="rational-numbers", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1,
    )
    attempt_service.record_attempt(
        student_id="student-1", question_id="le-q1", chapter_id="linear-equations", topic_id="topic-b",
        difficulty="Easy", is_correct=False, attempt_number=1,
    )

    metrics = recovery_service.get_recovery_metrics("student-1")

    by_chapter = {c.chapterId: c for c in metrics.chapters}
    assert by_chapter["rational-numbers"].lifetime.firstAttemptAccuracy.accuracy == 1.0
    assert by_chapter["linear-equations"].lifetime.firstAttemptAccuracy.accuracy == 0.0
    # Every curriculum chapter is listed (Progress Hub's chapter-first
    # framing), including ones with zero evidence.
    zero_evidence = by_chapter["practical-geometry"]
    assert zero_evidence.lifetime.firstAttemptAccuracy.attempted == 0
    assert zero_evidence.lifetime.firstAttemptAccuracy.accuracy is None
    assert zero_evidence.hasRecentActivity is False


def test_chapter_scoping_falls_back_to_the_raw_chapter_id_for_an_unknown_chapter() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="no-such-chapter", topic_id=None,
        difficulty="Easy", is_correct=True, attempt_number=1,
    )

    metrics = recovery_service.get_recovery_metrics("student-1")

    unknown = next(c for c in metrics.chapters if c.chapterId == "no-such-chapter")
    assert unknown.chapterTitle == "no-such-chapter"
    assert unknown.lifetime.firstAttemptAccuracy.attempted == 1


# --- learner isolation ---------------------------------------------------------


def test_learner_isolation() -> None:
    _record("q1", True, 1, student_id="student-1")
    _record("q1", False, 1, student_id="student-2")

    metrics_1 = recovery_service.get_recovery_metrics("student-1")
    metrics_2 = recovery_service.get_recovery_metrics("student-2")

    assert metrics_1.lifetime.firstAttemptAccuracy.accuracy == 1.0
    assert metrics_2.lifetime.firstAttemptAccuracy.accuracy == 0.0
