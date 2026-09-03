from app.schemas.performance import ActivityResponse, AttemptActivityRecord, ChapterActivity
from app.services import attempt_service, question_service

# Deliberate one-day buffer over the 7-day rolling window this feeds -
# see attempt_service.get_recent_attempts's own docstring for why.
RECENT_WINDOW_DAYS = 8


def get_activity(student_id: str) -> ActivityResponse:
    """
    Progress Hub V1 (self-serve + class-connected alike - purely
    student_id-opaque, same as every other read in this module's siblings).
    Two independently-scoped pieces: recentAttempts is a raw, un-bucketed
    window for the frontend's browser-local daily timeline; chapterActivity
    is a lifetime, chapter-keyed aggregate, computed here since it needs no
    day-boundary precision (see attempt_service.get_chapter_activity_raw).
    """
    recent_rows = attempt_service.get_recent_attempts(student_id, since_days=RECENT_WINDOW_DAYS)
    recent_attempts = [
        AttemptActivityRecord(
            questionId=row["question_id"],
            chapterId=row["chapter_id"],
            isCorrect=bool(row["is_correct"]),
            createdAt=row["created_at"],
        )
        for row in recent_rows
    ]

    chapter_activity = _build_chapter_activity(student_id)

    return ActivityResponse(recentAttempts=recent_attempts, chapterActivity=chapter_activity)


def _build_chapter_activity(student_id: str) -> list[ChapterActivity]:
    """
    Every curriculum chapter is included, not just ones with recorded
    attempts (approved V1 UX decision - curriculum coverage should be
    visible, including chapters the learner hasn't touched yet). A chapter
    with no attempts renders with all-zero counts and a null lastActivityAt,
    never omitted. Order follows question_service.get_chapters() - the same
    order Dashboard's own chapter grid already renders in.
    """
    raw_by_chapter = {row["chapter_id"]: row for row in attempt_service.get_chapter_activity_raw(student_id)}
    known_chapters = question_service.get_chapters()
    known_chapter_ids = {chapter.id for chapter in known_chapters}

    activity = [
        _chapter_activity_entry(chapter.id, chapter.title, raw_by_chapter.get(chapter.id))
        for chapter in known_chapters
    ]

    # Defensive, unchanged from before this chapter list became exhaustive:
    # an attempt row whose chapter_id matches no known chapter (attempts are
    # never FK-validated against chapters.json at write time - should not
    # happen in production, but must not silently disappear) still renders,
    # using its own id as the title.
    for chapter_id, row in raw_by_chapter.items():
        if chapter_id not in known_chapter_ids:
            activity.append(_chapter_activity_entry(chapter_id, chapter_id, row))

    return activity


def _chapter_activity_entry(chapter_id: str, chapter_title: str, row: dict | None) -> ChapterActivity:
    if row is None:
        return ChapterActivity(
            chapterId=chapter_id,
            chapterTitle=chapter_title,
            questionsAttempted=0,
            questionsCorrect=0,
            accuracy=0.0,
            lastActivityAt=None,
        )

    attempted = row["questions_attempted"]
    correct = row["questions_correct"]
    return ChapterActivity(
        chapterId=chapter_id,
        chapterTitle=chapter_title,
        questionsAttempted=attempted,
        questionsCorrect=correct,
        accuracy=round(correct / attempted, 4) if attempted else 0.0,
        lastActivityAt=row["last_activity_at"],
    )
