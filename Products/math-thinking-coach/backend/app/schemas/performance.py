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


class AccuracyMetric(BaseModel):
    """
    Self-Serve Learning Loop V1, Slice 4. correct/attempted are always
    present - 0 when there's no evidence, never omitted, so a UI can show
    an honest "0/0" - but `accuracy` is None whenever attempted == 0. Never
    a fabricated 0%, matching this release's "insufficient evidence must
    remain an explicit state" principle. Shared shape for both
    first-attempt accuracy ("attempted" = first attempts only) and eventual
    accuracy ("attempted"/"correct" = distinct questions, "correct" meaning
    ever solved correctly) - which one it represents is named by its
    containing field on EvidenceWindowMetrics, not by this shape itself.
    """

    correct: int
    attempted: int
    accuracy: float | None


class RecoveryMetric(BaseModel):
    """
    initiallyWrong = distinct questions whose first attempt (attempt_number
    == 1) was wrong, within this evidence window. recovered = the subset of
    those with any later correct attempt in the same window. `rate` is None
    below MIN_RECOVERY_SAMPLE_SIZE (recovery_service.py) initially-wrong
    questions - including the genuinely-zero case - so a learner's first
    couple of mistakes never produce a misleadingly confident 0% or 100%.
    `sufficientSample` makes that threshold explicit and checkable by a UI
    without hardcoding the number itself; recovered/initiallyWrong are
    always present regardless, so "zero evidence" vs "some evidence, not
    enough" vs "enough evidence, poor recovery" are all distinguishable
    from the raw counts alone.
    """

    recovered: int
    initiallyWrong: int
    rate: float | None
    sufficientSample: bool


class EvidenceWindowMetrics(BaseModel):
    """One evidence window's (lifetime or recent) full Slice 4 metric set - see RecoveryMetricsResponse."""

    firstAttemptAccuracy: AccuracyMetric
    eventualAccuracy: AccuracyMetric
    recovery: RecoveryMetric


class ChapterRecoveryMetrics(BaseModel):
    """
    Exhaustive per-chapter breakdown, mirroring ChapterActivity/
    activity_service._build_chapter_activity's established convention:
    every curriculum chapter is always listed (Progress Hub's chapter-first
    framing), zero/None-filled when a chapter has no evidence in a given
    window, never omitted or fabricated.
    """

    chapterId: str
    chapterTitle: str
    lifetime: EvidenceWindowMetrics
    recent: EvidenceWindowMetrics
    # Explicit "no recent activity" signal for this chapter, independent of
    # having to infer it from three separate zero-attempted sub-metrics.
    hasRecentActivity: bool


class RecoveryMetricsResponse(BaseModel):
    """
    GET /performance/me/recovery's response (Self-Serve Learning Loop V1,
    Slice 4). Computed entirely from attempt evidence at read time - never
    persisted, never backfilled. `recent` covers a straightforward UTC
    RECENT_WINDOW_DAYS-day cutoff (recovery_service.py) - unlike Progress
    Hub V1's daily activity chart, this is a single aggregate per window,
    not a day-by-day breakdown, so it needs none of that feature's
    8-day-buffer-plus-client-trim timezone handling (see
    attempt_service.get_recent_attempts's own docstring for why that one
    does). `recent` is never silently presented as `lifetime` when the
    window is empty - hasRecentActivity says so explicitly, and every
    recent sub-metric already honestly shows attempted=0/accuracy=None in
    that case, per AccuracyMetric/RecoveryMetric's own guarantees.
    """

    lifetime: EvidenceWindowMetrics
    recent: EvidenceWindowMetrics
    hasRecentActivity: bool
    chapters: list[ChapterRecoveryMetrics]
