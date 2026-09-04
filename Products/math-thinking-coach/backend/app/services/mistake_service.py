from app.schemas.performance import UnresolvedMistake
from app.services import attempt_service, question_service


def get_unresolved_mistakes(student_id: str) -> list[UnresolvedMistake]:
    """
    Self-Serve Learning Loop V1, Slice 3. "Unresolved mistake" means: this
    student's latest attempt on the question (by attempt id, the table's own
    monotonic sequence - never timestamp) was incorrect. A question with any
    later correct attempt is resolved and excluded entirely, no matter how
    many times it was wrong before that; a question with several wrong
    attempts and no correct one yet still produces exactly one entry, not
    one per attempt. Session and provenance are irrelevant by construction -
    attempt_service.get_latest_attempt_per_question groups purely by
    question_id, so a question attempted once standalone and once inside a
    session groups as one question either way.
    """
    latest_rows = attempt_service.get_latest_attempt_per_question(student_id)
    unresolved_rows = [row for row in latest_rows if not row["is_correct"]]

    return [_to_unresolved_mistake(row) for row in unresolved_rows]


def _to_unresolved_mistake(row: dict) -> UnresolvedMistake:
    """
    Chapter/topic default to the question's CURRENT content lookup, not the
    attempt row's own denormalized values - a question retagged or moved to
    a different chapter/topic since this attempt shows where it lives today.
    Falls back to the attempt row's own chapter_id/topic_id only when the
    question no longer resolves at all (content removed since) - never
    fabricated, always the real value that was actually recorded at attempt
    time. chapterTitle resolution (with its own id-as-title fallback for an
    unknown chapter) is identical to activity_service._build_chapter_activity's
    established pattern, reused here rather than re-invented.
    """
    question = question_service.get_question_by_id(row["question_id"])
    if question is not None:
        chapter_id = question.chapterId
        topic_id = question.topicId
    else:
        chapter_id = row["chapter_id"]
        topic_id = row["topic_id"]

    chapter = question_service.get_chapter(chapter_id)
    chapter_title = chapter.title if chapter is not None else chapter_id

    return UnresolvedMistake(
        questionId=row["question_id"],
        chapterId=chapter_id,
        chapterTitle=chapter_title,
        topicId=topic_id,
        lastAttemptAt=row["created_at"],
    )
