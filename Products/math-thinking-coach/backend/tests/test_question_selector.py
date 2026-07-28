from app.schemas.session import QuestionCandidate, SelectionConstraints
from app.services import question_selector


def _candidate(id: str, difficulty: str) -> QuestionCandidate:
    return QuestionCandidate(
        id=id, chapterId="linear-equations", topicId="topic-a", difficulty=difficulty,
        type=None, sourceType="canonical", reviewStatus="approved",
    )


def _constraints(
    distribution: dict[str, int],
    requested_count: int,
    resolved_count: int | None = None,
    exclude: list[str] | None = None,
    seed: str = "seed-1",
) -> SelectionConstraints:
    return SelectionConstraints(
        chapterId="linear-equations", topicIds=None, difficultyDistribution=distribution,
        questionTypes=None, excludeQuestionIds=exclude or [], seed=seed,
        requestedCount=requested_count, resolvedCount=resolved_count or requested_count,
    )


def test_selects_exactly_the_requested_count_per_tier() -> None:
    constraints = _constraints({"Easy": 1, "Medium": 1, "Hard": 1}, requested_count=3)
    candidates = [_candidate("e1", "Easy"), _candidate("m1", "Medium"), _candidate("h1", "Hard")]

    outcome = question_selector.select(constraints, candidates)

    assert outcome.actualCount == 3
    assert outcome.shortfall is False
    assert {q.questionId for q in outcome.selectedQuestions} == {"e1", "m1", "h1"}


def test_ordering_is_easy_then_medium_then_hard() -> None:
    constraints = _constraints({"Easy": 1, "Medium": 1, "Hard": 1}, requested_count=3)
    candidates = [_candidate("h1", "Hard"), _candidate("e1", "Easy"), _candidate("m1", "Medium")]

    outcome = question_selector.select(constraints, candidates)

    difficulties_in_order = [q.difficulty for q in outcome.selectedQuestions]
    assert difficulties_in_order == ["Easy", "Medium", "Hard"]
    assert [q.position for q in outcome.selectedQuestions] == [1, 2, 3]


def test_selection_is_deterministic_for_the_same_seed() -> None:
    constraints = _constraints({"Easy": 2, "Medium": 0, "Hard": 0}, requested_count=2)
    candidates = [_candidate(f"e{i}", "Easy") for i in range(10)]

    first = question_selector.select(constraints, candidates)
    second = question_selector.select(constraints, candidates)

    assert [q.questionId for q in first.selectedQuestions] == [q.questionId for q in second.selectedQuestions]


def test_different_seeds_can_produce_different_orderings() -> None:
    candidates = [_candidate(f"e{i}", "Easy") for i in range(10)]
    constraints_a = _constraints({"Easy": 5, "Medium": 0, "Hard": 0}, requested_count=5, seed="seed-a")
    constraints_b = _constraints({"Easy": 5, "Medium": 0, "Hard": 0}, requested_count=5, seed="seed-b")

    outcome_a = question_selector.select(constraints_a, candidates)
    outcome_b = question_selector.select(constraints_b, candidates)

    ids_a = [q.questionId for q in outcome_a.selectedQuestions]
    ids_b = [q.questionId for q in outcome_b.selectedQuestions]
    assert ids_a != ids_b


def test_excluded_questions_are_never_selected() -> None:
    constraints = _constraints({"Easy": 1, "Medium": 0, "Hard": 0}, requested_count=1, exclude=["e1"])
    candidates = [_candidate("e1", "Easy"), _candidate("e2", "Easy")]

    outcome = question_selector.select(constraints, candidates)

    assert outcome.selectedQuestions[0].questionId == "e2"


def test_exclusion_collision_where_all_candidates_in_a_tier_are_excluded() -> None:
    constraints = _constraints(
        {"Easy": 2, "Medium": 0, "Hard": 0}, requested_count=2, resolved_count=0, exclude=["e1", "e2"],
    )
    candidates = [_candidate("e1", "Easy"), _candidate("e2", "Easy")]

    outcome = question_selector.select(constraints, candidates)

    assert outcome.selectedQuestions == []
    assert outcome.actualCount == 0
    assert outcome.shortfall is True


def test_no_question_is_ever_selected_twice() -> None:
    constraints = _constraints({"Easy": 5, "Medium": 0, "Hard": 0}, requested_count=5)
    candidates = [_candidate(f"e{i}", "Easy") for i in range(5)]

    outcome = question_selector.select(constraints, candidates)

    ids = [q.questionId for q in outcome.selectedQuestions]
    assert len(ids) == len(set(ids))


def test_shortfall_is_false_when_actual_count_matches_requested() -> None:
    constraints = _constraints({"Easy": 2, "Medium": 0, "Hard": 0}, requested_count=2)
    candidates = [_candidate("e1", "Easy"), _candidate("e2", "Easy")]

    outcome = question_selector.select(constraints, candidates)

    assert outcome.shortfall is False


def test_shortfall_is_true_when_the_pool_cannot_fill_even_a_resolver_confirmed_count() -> None:
    # Simulates a stale/inconsistent pool: constraints claim 3 are resolvable,
    # but the actual candidates handed to the Selector only contain 1. The
    # Selector must report this honestly rather than silently under-deliver.
    constraints = _constraints({"Easy": 3, "Medium": 0, "Hard": 0}, requested_count=3, resolved_count=3)
    candidates = [_candidate("e1", "Easy")]

    outcome = question_selector.select(constraints, candidates)

    assert outcome.actualCount == 1
    assert outcome.shortfall is True


def test_empty_candidates_produces_an_empty_outcome_with_shortfall() -> None:
    constraints = _constraints({"Easy": 1, "Medium": 1, "Hard": 1}, requested_count=3)

    outcome = question_selector.select(constraints, [])

    assert outcome.selectedQuestions == []
    assert outcome.actualCount == 0
    assert outcome.shortfall is True


def test_zero_difficulty_distribution_produces_zero_count_without_error() -> None:
    constraints = _constraints({"Easy": 0, "Medium": 0, "Hard": 0}, requested_count=0)

    outcome = question_selector.select(constraints, [])

    assert outcome.selectedQuestions == []
    assert outcome.shortfall is False
