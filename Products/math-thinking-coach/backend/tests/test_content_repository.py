from app.services import content_repository


def test_get_candidates_returns_normalized_candidates_for_a_chapter() -> None:
    candidates = content_repository.get_candidates("rational-numbers")

    assert len(candidates) == 5
    assert all(candidate.chapterId == "rational-numbers" for candidate in candidates)
    assert all(candidate.sourceType == "canonical" for candidate in candidates)
    assert all(candidate.reviewStatus == "approved" for candidate in candidates)
    assert all(candidate.type is None for candidate in candidates)


def test_get_candidates_never_exposes_an_answer() -> None:
    candidates = content_repository.get_candidates("rational-numbers")

    for candidate in candidates:
        assert not hasattr(candidate, "solution")
        assert not hasattr(candidate, "hints")


def test_get_candidates_filters_by_topic_when_given() -> None:
    candidates = content_repository.get_candidates(
        "rational-numbers", topic_ids=["topic-rational-numbers-basics"]
    )

    assert len(candidates) == 5

    empty = content_repository.get_candidates("rational-numbers", topic_ids=["some-other-topic"])
    assert empty == []


def test_get_candidates_returns_empty_list_for_unknown_chapter() -> None:
    assert content_repository.get_candidates("unknown-chapter") == []


def test_get_candidates_reflects_real_content_scale_for_linear_equations() -> None:
    candidates = content_repository.get_candidates("linear-equations")

    assert len(candidates) == 44
    assert all(candidate.topicId == "topic-linear-equations-one-variable" for candidate in candidates)


def test_get_candidates_includes_topicless_questions_with_topic_id_none() -> None:
    candidates = content_repository.get_candidates("data-handling")

    assert len(candidates) == 5
    assert all(candidate.topicId is None for candidate in candidates)
