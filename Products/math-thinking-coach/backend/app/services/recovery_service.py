from datetime import UTC, datetime, timedelta

from app.schemas.performance import (
    AccuracyMetric,
    ChapterRecoveryMetrics,
    EvidenceWindowMetrics,
    RecoveryMetric,
    RecoveryMetricsResponse,
)
from app.services import attempt_service, question_service

# Self-Serve Learning Loop V1, Slice 4. A pure aggregate window - one number
# per metric, not a day-by-day breakdown - so unlike Progress Hub V1's daily
# activity chart, this needs none of that feature's 8-day-buffer-plus-
# client-trim timezone handling (see attempt_service.get_recent_attempts's
# own docstring for why that one does). A straightforward UTC cutoff is
# both correct and the smallest solution here. 7 days, matching the
# Progress Hub's own existing "last 7 days" framing (DashboardPage.tsx).
RECENT_WINDOW_DAYS = 7

# Recovery rate is withheld as a percentage below this many distinct
# initially-wrong questions - a rate computed from 1 or 2 samples is too
# easily a misleading 0% or 100% by chance to expose as a trustworthy
# number. Below this, the response still exposes recovered/initiallyWrong
# (evidence-count honesty) - just not `rate`. Named and importable so nothing
# else ever needs to duplicate this number.
MIN_RECOVERY_SAMPLE_SIZE = 3


def get_recovery_metrics(student_id: str) -> RecoveryMetricsResponse:
    """
    Everything computed fresh from attempt_service.get_attempt_rows - never
    persisted, never backfilled. Recent-window computations use only rows
    whose created_at falls in that window: a question first attempted
    (and gotten wrong) outside the window doesn't count toward the recent
    window's initiallyWrong just because a later attempt happens to fall
    inside it - "recent recovery" means recovery observed within the
    window, not evidence inferred from outside it.
    """
    cutoff = (datetime.now(UTC) - timedelta(days=RECENT_WINDOW_DAYS)).isoformat()

    lifetime_rows = attempt_service.get_attempt_rows(student_id)
    recent_rows = attempt_service.get_attempt_rows(student_id, since=cutoff)

    return RecoveryMetricsResponse(
        lifetime=_window_metrics(lifetime_rows),
        recent=_window_metrics(recent_rows),
        hasRecentActivity=len(recent_rows) > 0,
        chapters=_chapter_metrics(lifetime_rows, recent_rows),
    )


def _window_metrics(rows: list[dict]) -> EvidenceWindowMetrics:
    return EvidenceWindowMetrics(
        firstAttemptAccuracy=_first_attempt_accuracy(rows),
        eventualAccuracy=_eventual_accuracy(rows),
        recovery=_recovery(rows),
    )


def _first_attempt_accuracy(rows: list[dict]) -> AccuracyMetric:
    """Correct first attempts (attempt_number == 1) / all first attempts, within scope."""
    first_attempts = [row for row in rows if row["attempt_number"] == 1]
    attempted = len(first_attempts)
    correct = sum(1 for row in first_attempts if row["is_correct"])
    return AccuracyMetric(
        correct=correct,
        attempted=attempted,
        accuracy=round(correct / attempted, 4) if attempted else None,
    )


def _eventual_accuracy(rows: list[dict]) -> AccuracyMetric:
    """Distinct questions ever correct / distinct questions attempted, within scope."""
    ever_correct_by_question: dict[str, bool] = {}
    for row in rows:
        question_id = row["question_id"]
        ever_correct_by_question[question_id] = ever_correct_by_question.get(question_id, False) or bool(
            row["is_correct"]
        )

    attempted = len(ever_correct_by_question)
    correct = sum(1 for is_correct in ever_correct_by_question.values() if is_correct)
    return AccuracyMetric(
        correct=correct,
        attempted=attempted,
        accuracy=round(correct / attempted, 4) if attempted else None,
    )


def _recovery(rows: list[dict]) -> RecoveryMetric:
    """
    Distinct questions whose first attempt (within scope) was wrong AND
    which later became correct (within scope) / distinct questions whose
    first attempt (within scope) was wrong.
    """
    first_attempt_wrong: set[str] = set()
    ever_correct: set[str] = set()
    for row in rows:
        if row["attempt_number"] == 1 and not row["is_correct"]:
            first_attempt_wrong.add(row["question_id"])
        if row["is_correct"]:
            ever_correct.add(row["question_id"])

    initially_wrong = len(first_attempt_wrong)
    recovered = len(first_attempt_wrong & ever_correct)
    sufficient_sample = initially_wrong >= MIN_RECOVERY_SAMPLE_SIZE

    return RecoveryMetric(
        recovered=recovered,
        initiallyWrong=initially_wrong,
        rate=round(recovered / initially_wrong, 4) if sufficient_sample else None,
        sufficientSample=sufficient_sample,
    )


def _chapter_metrics(lifetime_rows: list[dict], recent_rows: list[dict]) -> list[ChapterRecoveryMetrics]:
    """
    Exhaustive per-chapter breakdown, same grouping/defensive-fallback
    pattern as activity_service._build_chapter_activity: every curriculum
    chapter is always listed, and an attempt row's chapter_id with no
    matching known Chapter still renders, using its own id as the title.
    """
    lifetime_by_chapter: dict[str, list[dict]] = {}
    for row in lifetime_rows:
        lifetime_by_chapter.setdefault(row["chapter_id"], []).append(row)

    recent_by_chapter: dict[str, list[dict]] = {}
    for row in recent_rows:
        recent_by_chapter.setdefault(row["chapter_id"], []).append(row)

    known_chapters = question_service.get_chapters()
    known_chapter_ids = {chapter.id for chapter in known_chapters}

    chapters = [
        _chapter_metrics_entry(
            chapter.id,
            chapter.title,
            lifetime_by_chapter.get(chapter.id, []),
            recent_by_chapter.get(chapter.id, []),
        )
        for chapter in known_chapters
    ]

    for chapter_id, rows in lifetime_by_chapter.items():
        if chapter_id not in known_chapter_ids:
            chapters.append(
                _chapter_metrics_entry(chapter_id, chapter_id, rows, recent_by_chapter.get(chapter_id, []))
            )

    return chapters


def _chapter_metrics_entry(
    chapter_id: str, chapter_title: str, lifetime_rows: list[dict], recent_rows: list[dict]
) -> ChapterRecoveryMetrics:
    return ChapterRecoveryMetrics(
        chapterId=chapter_id,
        chapterTitle=chapter_title,
        lifetime=_window_metrics(lifetime_rows),
        recent=_window_metrics(recent_rows),
        hasRecentActivity=len(recent_rows) > 0,
    )
