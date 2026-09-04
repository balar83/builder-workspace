from pydantic import BaseModel


class TopicPerformance(BaseModel):
    topicId: str
    questionsAttempted: int
    questionsCorrect: int
    accuracy: float
    currentStreak: int
    mastered: bool


class AttemptActivityRecord(BaseModel):
    """
    One raw attempt row, timestamp preserved as-is (server UTC) - the
    Progress Hub's local-day bucketing happens entirely client-side against
    the browser's own timezone (V1 timezone decision), never here.
    """

    questionId: str
    chapterId: str
    isCorrect: bool
    createdAt: str


class ChapterActivity(BaseModel):
    """
    Lifetime, chapter-keyed (not topic-keyed) Progress Hub aggregate - see
    attempt_service.get_chapter_activity_raw. questionsAttempted/Correct are
    distinct-question counts, not row counts, unlike TopicPerformance above:
    "correct" means "eventually solved correctly" (>=1 correct attempt),
    matching the approved V1 product definition, not "most recent attempt
    correct" or "every attempt correct."
    """

    chapterId: str
    chapterTitle: str
    questionsAttempted: int
    questionsCorrect: int
    accuracy: float
    # None for a chapter with no recorded attempts - present, not omitted
    # (approved V1 UX decision: every curriculum chapter is always listed).
    lastActivityAt: str | None


class ActivityResponse(BaseModel):
    """
    GET /performance/me/activity's response. recentAttempts covers an ~8-day
    UTC window (see get_recent_attempts) for the frontend's rolling 7-local-
    day timeline; chapterActivity is lifetime-scoped and independent of that
    window.
    """

    recentAttempts: list[AttemptActivityRecord]
    chapterActivity: list[ChapterActivity]


class UnresolvedMistake(BaseModel):
    """
    Self-Serve Learning Loop V1, Slice 3 - GET /performance/me/mistakes.
    "Still worth fixing," not a lifetime mistake log: a question whose most
    recent attempt (by attempt id, not timestamp) was incorrect. A question
    recovered by any later correct attempt is excluded entirely, however
    many times it was wrong before that - see mistake_service.py for the
    exact grouping rule. Session-agnostic and provenance-agnostic by
    construction; deliberately not a generic diagnosis shape - just enough
    for a learner to see and act on one unresolved question.

    chapterId/chapterTitle/topicId reflect the question's CURRENT content
    (question_service.get_question_by_id), not what was recorded on the
    attempt row at the time - a retagged/re-chaptered question shows where
    it lives today. Falls back to the attempt row's own denormalized
    chapter_id/topic_id only if the question no longer resolves at all
    (removed from content since); chapterTitle then falls back to the raw
    chapter_id, mirroring activity_service's identical unknown-chapter
    fallback.
    """

    questionId: str
    chapterId: str
    chapterTitle: str
    topicId: str | None
    lastAttemptAt: str
