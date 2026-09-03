from pathlib import Path

import pytest

from app.services import activity_service, attempt_service


@pytest.fixture(autouse=True)
def _isolate_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(attempt_service, "DB_PATH", tmp_path / "attempts.db")


def test_get_activity_lists_every_curriculum_chapter_even_with_no_attempts_at_all() -> None:
    """
    Approved V1 UX decision: curriculum coverage must be visible, so every
    chapter is always listed - a student with zero attempts still sees all
    7 real chapters, each all-zero with lastActivityAt=None, not an empty
    list.
    """
    activity = activity_service.get_activity("student-1")

    assert activity.recentAttempts == []
    assert len(activity.chapterActivity) == 7
    assert all(chapter.questionsAttempted == 0 for chapter in activity.chapterActivity)
    assert all(chapter.questionsCorrect == 0 for chapter in activity.chapterActivity)
    assert all(chapter.accuracy == 0.0 for chapter in activity.chapterActivity)
    assert all(chapter.lastActivityAt is None for chapter in activity.chapterActivity)
    chapter_ids = {chapter.chapterId for chapter in activity.chapterActivity}
    assert "practical-geometry" in chapter_ids
    assert "rational-numbers" in chapter_ids


def test_get_activity_recent_attempts_carries_raw_fields() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="rn-q01", chapter_id="rational-numbers", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1,
    )

    activity = activity_service.get_activity("student-1")

    assert len(activity.recentAttempts) == 1
    record = activity.recentAttempts[0]
    assert record.questionId == "rn-q01"
    assert record.chapterId == "rational-numbers"
    assert record.isCorrect is True
    assert record.createdAt  # non-empty ISO timestamp, exact value not asserted here


def test_get_activity_chapter_activity_resolves_the_real_chapter_title() -> None:
    """
    Uses real production content (rational-numbers, a real chapter in
    chapters.json) so the title-join against question_service.get_chapters()
    is proven against actual data, not a fixture double.
    """
    attempt_service.record_attempt(
        student_id="student-1", question_id="rn-q01", chapter_id="rational-numbers", topic_id="topic-a",
        difficulty="Easy", is_correct=True, attempt_number=1,
    )

    activity = activity_service.get_activity("student-1")

    # All 7 curriculum chapters are listed; only rational-numbers has real
    # activity, the other 6 are zero-filled (see the all-zero test above).
    assert len(activity.chapterActivity) == 7
    chapter = next(c for c in activity.chapterActivity if c.chapterId == "rational-numbers")
    assert chapter.chapterTitle == "Rational Numbers"
    assert chapter.questionsAttempted == 1
    assert chapter.questionsCorrect == 1
    assert chapter.accuracy == 1.0
    assert chapter.lastActivityAt

    other_chapter = next(c for c in activity.chapterActivity if c.chapterId == "practical-geometry")
    assert other_chapter.questionsAttempted == 0
    assert other_chapter.lastActivityAt is None


def test_get_activity_chapter_activity_falls_back_to_chapter_id_for_an_unknown_chapter() -> None:
    """
    Defensive: attempts are opaque strings, not FK-validated against
    chapters.json at write time - a chapter_id with no matching Chapter
    (should not happen in production, but must not crash or disappear) still
    renders, using its own id as the title.
    """
    attempt_service.record_attempt(
        student_id="student-1", question_id="q1", chapter_id="no-such-chapter", topic_id=None,
        difficulty="Easy", is_correct=True, attempt_number=1,
    )

    activity = activity_service.get_activity("student-1")

    # 7 real chapters (all zero-filled - none has an attempt in this test)
    # plus the one unknown chapter_id, appended defensively.
    assert len(activity.chapterActivity) == 8
    unknown = next(c for c in activity.chapterActivity if c.chapterId == "no-such-chapter")
    assert unknown.chapterTitle == "no-such-chapter"
    assert unknown.questionsAttempted == 1


def test_get_activity_includes_practical_geometry_despite_having_no_topic() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="pg-q1", chapter_id="practical-geometry", topic_id=None,
        difficulty="Easy", is_correct=True, attempt_number=1,
    )

    activity = activity_service.get_activity("student-1")

    chapter_ids = {c.chapterId for c in activity.chapterActivity}
    assert "practical-geometry" in chapter_ids
