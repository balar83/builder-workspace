from app.services import content_repository


def test_get_candidates_returns_normalized_candidates_for_a_chapter() -> None:
    candidates = content_repository.get_candidates("rational-numbers")

    assert len(candidates) == 40
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
        "rational-numbers", topic_ids=["topic-rational-numbers-properties-and-operations"]
    )

    assert len(candidates) == 40

    empty = content_repository.get_candidates("rational-numbers", topic_ids=["some-other-topic"])
    assert empty == []


def test_get_candidates_returns_empty_list_for_unknown_chapter() -> None:
    assert content_repository.get_candidates("unknown-chapter") == []


def test_get_candidates_reflects_real_content_scale_for_linear_equations() -> None:
    candidates = content_repository.get_candidates("linear-equations")

    assert len(candidates) == 44
    assert all(candidate.topicId == "topic-linear-equations-one-variable" for candidate in candidates)


def test_get_candidates_includes_topicless_questions_with_topic_id_none() -> None:
    candidates = content_repository.get_candidates("practical-geometry")

    assert len(candidates) == 35
    assert all(candidate.topicId is None for candidate in candidates)


def test_get_question_content_returns_the_full_question() -> None:
    question = content_repository.get_question_content("rn-q01")

    assert question is not None
    assert question.id == "rn-q01"
    assert question.solution
    assert isinstance(question.hints, list)


def test_get_question_content_returns_none_for_unknown_id() -> None:
    assert content_repository.get_question_content("no-such-question") is None
