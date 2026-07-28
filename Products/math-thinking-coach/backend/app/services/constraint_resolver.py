from collections import Counter

from app.schemas.session import QuestionCandidate, SelectionConstraints, SessionPlan

_TIERS = ("Easy", "Medium", "Hard")
# Backfill priority when a tier is under-supplied: Medium first (the
# broadest, most available tier in authored content), then Easy, then Hard.
_BACKFILL_ORDER = ("Medium", "Easy", "Hard")


def resolve_constraints(
    plan: SessionPlan,
    candidates: list[QuestionCandidate],
    exclude_question_ids: list[str] | None = None,
) -> SelectionConstraints:
    """
    Deterministic feasibility check and degradation only - never selects an
    actual question. resolvedCount is always <= requestedCount and always
    honestly reflects what the pool can actually supply, even after
    exclusions are applied.

    Implementation decision made here, not pinned down by the accepted
    architecture, flagged for Milestone C2: backfill applies uniformly
    whether the plan requested "Mixed" or one explicit tier (e.g.
    difficulty="Hard" on a chapter with zero Hard questions still backfills
    from Medium/Easy rather than returning a real shortfall). Chosen for
    simplicity - one rule, no special-casing by request shape - but this is
    exactly the kind of thing Test mode might want to override (a student
    who explicitly asked for Hard-only practice may not want an Easy
    question silently substituted). If that turns out to matter, the fix is
    isolated to _degrade() below; nothing else in the pipeline would change.
    """
    exclude_question_ids = exclude_question_ids or []
    available = [candidate for candidate in candidates if candidate.id not in exclude_question_ids]
    counts_by_difficulty = Counter(candidate.difficulty for candidate in available)

    resolved_distribution, resolved_count = _degrade(
        plan.difficultyDistribution, counts_by_difficulty, plan.targetCount
    )

    return SelectionConstraints(
        chapterId=plan.chapterId,
        topicIds=plan.weakConceptTopicIds or None,
        difficultyDistribution=resolved_distribution,
        questionTypes=plan.questionTypes,
        excludeQuestionIds=exclude_question_ids,
        seed=plan.seed,
        requestedCount=plan.targetCount,
        resolvedCount=resolved_count,
    )


def _degrade(
    requested: dict[str, int], available: Counter, target_count: int
) -> tuple[dict[str, int], int]:
    allocated = {tier: min(requested.get(tier, 0), available.get(tier, 0)) for tier in _TIERS}
    shortfall = target_count - sum(allocated.values())

    for tier in _BACKFILL_ORDER:
        if shortfall <= 0:
            break
        surplus = available.get(tier, 0) - allocated[tier]
        take = min(surplus, shortfall)
        if take > 0:
            allocated[tier] += take
            shortfall -= take

    return allocated, sum(allocated.values())
