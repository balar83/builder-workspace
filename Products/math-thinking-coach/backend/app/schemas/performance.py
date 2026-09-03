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
