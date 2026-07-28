from app.schemas.session import QuestionCandidate, SessionPlan
from app.services import constraint_resolver


def _candidate(id: str, difficulty: str) -> QuestionCandidate:
    return QuestionCandidate(
        id=id, chapterId="linear-equations", topicId="topic-a", difficulty=difficulty,
        type=None, sourceType="canonical", reviewStatus="approved",
    )


def _plan(distribution: dict[str, int], target_count: int, weak_topic_ids: list[str] | None = None) -> SessionPlan:
    return SessionPlan(
        planId="plan-1", studentId="student-1", chapterId="linear-equations", mode="practice",
        difficultyDistribution=distribution, questionTypes=None, targetCount=target_count,
        timeLimitMinutes=None, weakConceptTopicIds=weak_topic_ids or [], seed="seed-1",
    )


def test_sufficient_supply_resolves_exactly_as_requested() -> None:
    plan = _plan({"Easy": 2, "Medium": 2, "Hard": 2}, target_count=6)
    candidates = [_candidate(f"e{i}", "Easy") for i in range(3)] + \
        [_candidate(f"m{i}", "Medium") for i in range(3)] + \
        [_candidate(f"h{i}", "Hard") for i in range(3)]

    constraints = constraint_resolver.resolve_constraints(plan, candidates)

    assert constraints.difficultyDistribution == {"Easy": 2, "Medium": 2, "Hard": 2}
    assert constraints.resolvedCount == 6
    assert constraints.requestedCount == 6


def test_insufficient_hard_supply_backfills_from_medium() -> None:
    plan = _plan({"Easy": 2, "Medium": 2, "Hard": 4}, target_count=8)
    candidates = [_candidate(f"e{i}", "Easy") for i in range(2)] + \
        [_candidate(f"m{i}", "Medium") for i in range(10)] + \
        [_candidate(f"h{i}", "Hard") for i in range(1)]

    constraints = constraint_resolver.resolve_constraints(plan, candidates)

    assert constraints.difficultyDistribution["Hard"] == 1
    assert constraints.resolvedCount == 8
    assert constraints.difficultyDistribution["Medium"] == 5


def test_insufficient_total_supply_produces_an_honest_shortfall() -> None:
    plan = _plan({"Easy": 5, "Medium": 5, "Hard": 5}, target_count=15)
    candidates = [_candidate("e1", "Easy"), _candidate("m1", "Medium")]

    constraints = constraint_resolver.resolve_constraints(plan, candidates)

    assert constraints.resolvedCount == 2
    assert constraints.resolvedCount < constraints.requestedCount


def test_empty_candidate_pool_resolves_to_zero() -> None:
    plan = _plan({"Easy": 3, "Medium": 3, "Hard": 3}, target_count=9)

    constraints = constraint_resolver.resolve_constraints(plan, [])

    assert constraints.resolvedCount == 0
    assert constraints.difficultyDistribution == {"Easy": 0, "Medium": 0, "Hard": 0}


def test_exclusions_reduce_the_available_pool() -> None:
    plan = _plan({"Easy": 2, "Medium": 0, "Hard": 0}, target_count=2)
    candidates = [_candidate("e1", "Easy"), _candidate("e2", "Easy")]

    constraints = constraint_resolver.resolve_constraints(plan, candidates, exclude_question_ids=["e1"])

    assert constraints.resolvedCount == 1
    assert constraints.excludeQuestionIds == ["e1"]


def test_topic_ids_are_set_from_weak_concept_topics_when_present() -> None:
    plan = _plan({"Easy": 1, "Medium": 1, "Hard": 1}, target_count=3, weak_topic_ids=["topic-a", "topic-b"])

    constraints = constraint_resolver.resolve_constraints(plan, [])

    assert constraints.topicIds == ["topic-a", "topic-b"]


def test_topic_ids_are_none_when_no_weak_concept_topics() -> None:
    plan = _plan({"Easy": 1, "Medium": 1, "Hard": 1}, target_count=3)

    constraints = constraint_resolver.resolve_constraints(plan, [])

    assert constraints.topicIds is None


def test_resolution_is_deterministic_for_identical_inputs() -> None:
    plan = _plan({"Easy": 2, "Medium": 3, "Hard": 1}, target_count=6)
    candidates = [_candidate(f"e{i}", "Easy") for i in range(1)] + \
        [_candidate(f"m{i}", "Medium") for i in range(5)] + \
        [_candidate(f"h{i}", "Hard") for i in range(1)]

    first = constraint_resolver.resolve_constraints(plan, candidates)
    second = constraint_resolver.resolve_constraints(plan, candidates)

    assert first == second
