import random

from app.schemas.session import QuestionCandidate, SelectedQuestion, SelectionConstraints, SelectionOutcome

# Easy -> Medium -> Hard: matches the progression convention the content
# pipeline's authoring docs already establish (increasing structural
# complexity). Not a policy decision made here - the *counts* per tier come
# entirely from SelectionConstraints; this only orders what's already been
# decided upstream.
_TIER_ORDER = ("Easy", "Medium", "Hard")


def select(constraints: SelectionConstraints, candidates: list[QuestionCandidate]) -> SelectionOutcome:
    """
    Never invents a constraint it wasn't given: only ever picks up to the
    count SelectionConstraints specifies for each tier, from the candidates
    it was handed. Deterministic given the same seed, constraints, and
    candidate pool - no dependency on wall-clock time or external state.
    """
    pool = [candidate for candidate in candidates if candidate.id not in constraints.excludeQuestionIds]
    rng = random.Random(constraints.seed)

    selected: list[SelectedQuestion] = []
    for tier in _TIER_ORDER:
        needed = constraints.difficultyDistribution.get(tier, 0)
        if needed <= 0:
            continue

        tier_pool = [candidate for candidate in pool if candidate.difficulty == tier]
        rng.shuffle(tier_pool)

        for candidate in tier_pool[:needed]:
            selected.append(
                SelectedQuestion(
                    position=len(selected) + 1,
                    questionId=candidate.id,
                    difficulty=candidate.difficulty,
                    type=candidate.type,
                )
            )

    actual_count = len(selected)
    return SelectionOutcome(
        selectedQuestions=selected,
        actualCount=actual_count,
        shortfall=actual_count < constraints.requestedCount,
    )
