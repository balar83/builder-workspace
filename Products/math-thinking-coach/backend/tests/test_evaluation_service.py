import pytest

from app.schemas.answer import AnswerSubmission
from app.schemas.question import Option, Question, QuestionPart, ResponseSpecification
from app.services import coaching_service, evaluation_service

QUESTION = Question(
    id="rn-q01",
    chapterId="rational-numbers",
    question="Is 5 a rational number?",
    text="Is 5 a rational number?",
    difficulty="Easy",
    hints=["A rational number is any number expressible as p/q, with q not zero."],
    solution="Yes",
)

NUMERIC_QUESTION = Question(
    id="test-numeric-half",
    chapterId="fixture-chapter",
    question="What is one divided by two?",
    text="What is one divided by two?",
    difficulty="Easy",
    hints=[],
    solution="0.5",
    questionType="numeric",
)

NUMERIC_WHOLE_QUESTION = Question(
    id="test-numeric-four",
    chapterId="fixture-chapter",
    question="What is 2 squared?",
    text="What is 2 squared?",
    difficulty="Easy",
    hints=[],
    solution="4",
    questionType="numeric",
)

NUMERIC_TOLERANT_QUESTION = Question(
    id="test-numeric-pi",
    chapterId="fixture-chapter",
    question="Estimate pi to one decimal place.",
    text="Estimate pi to one decimal place.",
    difficulty="Easy",
    hints=[],
    solution="3.14",
    questionType="numeric",
    responseSpecification=ResponseSpecification(numericTolerance=0.05),
)

NUMERIC_NON_NUMERIC_CANONICAL_QUESTION = Question(
    id="test-numeric-with-unit",
    chapterId="fixture-chapter",
    question="Find the side length.",
    text="Find the side length.",
    difficulty="Easy",
    hints=[],
    solution="18 m",
    questionType="numeric",
)

SINGLE_CHOICE_QUESTION = Question(
    id="test-single-choice-basic",
    chapterId="fixture-chapter",
    question="Which of these is a perfect square?",
    text="Which of these is a perfect square?",
    difficulty="Easy",
    hints=[],
    solution="16",
    questionType="single_choice",
    responseSpecification=ResponseSpecification(
        options=[
            Option(id="opt-a", text="12"),
            Option(id="opt-b", text="16"),
            Option(id="opt-c", text="20"),
        ]
    ),
)

MULTI_CHOICE_QUESTION = Question(
    id="test-multi-choice-basic",
    chapterId="fixture-chapter",
    question="Which of these are prime numbers?",
    text="Which of these are prime numbers?",
    difficulty="Easy",
    hints=[],
    solution="2, 3, 5",
    questionType="multi_choice",
    responseSpecification=ResponseSpecification(
        options=[
            Option(id="opt-a", text="2"),
            Option(id="opt-b", text="3"),
            Option(id="opt-c", text="4"),
            Option(id="opt-d", text="5"),
        ]
    ),
)

# M3: mirrors the real le-q25 shape (two short_text-typed, labeled parts -
# an algebraic LHS/RHS expression each) - not the real question id/content,
# a fixture, same convention as every other synthetic question above.
MULTI_PART_ALGEBRA_QUESTION = Question(
    id="test-multi-part-algebra",
    chapterId="fixture-chapter",
    question="Identify the LHS and RHS of the equation 9 - 2x = 5x + 2.",
    text="Identify the LHS and RHS of the equation 9 - 2x = 5x + 2.",
    difficulty="Easy",
    hints=[],
    solution="LHS = 9 - 2x. RHS = 5x + 2.",
    questionType="multi_part",
    maxScore=2.0,
    responseSpecification=ResponseSpecification(
        parts=[
            QuestionPart(id="lhs", prompt="LHS (left-hand side)", questionType="short_text"),
            QuestionPart(id="rhs", prompt="RHS (right-hand side)", questionType="short_text"),
        ]
    ),
)

# M3: mirrors the real le-q37 shape (two numeric, order-fixed parts - "the
# smaller number" then "the larger number", not interchangeable).
MULTI_PART_NUMERIC_QUESTION = Question(
    id="test-multi-part-numeric",
    chapterId="fixture-chapter",
    question="A number is 5 more than another number, and their sum is 37. Find the two numbers.",
    text="A number is 5 more than another number, and their sum is 37. Find the two numbers.",
    difficulty="Medium",
    hints=[],
    solution="The numbers are 16 and 21.",
    questionType="multi_part",
    maxScore=2.0,
    responseSpecification=ResponseSpecification(
        parts=[
            QuestionPart(id="smaller", prompt="The smaller number", questionType="numeric"),
            QuestionPart(id="larger", prompt="The larger number", questionType="numeric"),
        ]
    ),
)

MULTI_PART_UNSUPPORTED_PART_TYPE_QUESTION = Question(
    id="test-multi-part-unsupported-part-type",
    chapterId="fixture-chapter",
    question="A synthetic multi-part question with one part of a type this evaluator doesn't implement.",
    text="A synthetic multi-part question with one part of a type this evaluator doesn't implement.",
    difficulty="Easy",
    hints=[],
    solution="n/a",
    questionType="multi_part",
    maxScore=2.0,
    responseSpecification=ResponseSpecification(
        parts=[
            QuestionPart(id="p1", prompt="A numeric part", questionType="numeric"),
            # "matching" has no evaluator at all (still reserved) - a genuine
            # unsupported part type, distinct from Decision 3's narrower
            # "M3 only implements short_text/numeric part comparison" scope.
            QuestionPart(id="p2", prompt="An unsupported part", questionType="matching"),
        ]
    ),
)

UNSUPPORTED_TYPE_QUESTION = Question(
    id="test-unsupported-type",
    chapterId="fixture-chapter",
    question="Match each term to its definition.",
    text="Match each term to its definition.",
    difficulty="Easy",
    hints=[],
    solution="a-2, b-1",
    # matching, not single_choice/multi_choice: both gained real evaluators
    # in Slice 2/3 - this fixture specifically needs a still-reserved type.
    questionType="matching",
)


@pytest.fixture(autouse=True)
def _synthetic_answer_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Isolated, fully-controlled expected answers for the new evaluator tests
    - monkeypatching the module-level _answer_keys dict, same technique
    already used elsewhere in this suite for other module-level state
    (e.g. attempt_service.DB_PATH), rather than depending on real content's
    specific values.
    """
    monkeypatch.setitem(evaluation_service._answer_keys, NUMERIC_QUESTION.id, "0.5")
    monkeypatch.setitem(evaluation_service._answer_keys, NUMERIC_WHOLE_QUESTION.id, "4")
    monkeypatch.setitem(evaluation_service._answer_keys, NUMERIC_TOLERANT_QUESTION.id, "3.14159")
    monkeypatch.setitem(evaluation_service._answer_keys, NUMERIC_NON_NUMERIC_CANONICAL_QUESTION.id, "18 m")
    monkeypatch.setitem(evaluation_service._answer_keys, UNSUPPORTED_TYPE_QUESTION.id, "a-2, b-1")
    # The private answer-key value for single_choice is simply the correct
    # option's id - no second, richer answer-key mechanism.
    monkeypatch.setitem(evaluation_service._answer_keys, SINGLE_CHOICE_QUESTION.id, "opt-b")
    # multi_choice (Slice 3): the correct *set* of option ids, using the same
    # comma-delimited string convention the submission itself uses - still a
    # plain string value, answer_keys.json's dict[str, str] shape unchanged.
    monkeypatch.setitem(evaluation_service._answer_keys, MULTI_CHOICE_QUESTION.id, "opt-a,opt-b,opt-d")
    # M3: the private multi_part answer key is one "|"-delimited string,
    # positional per QuestionPart order - the same "single opaque string,
    # parsed only by its own evaluator" convention multi_choice's
    # comma-delimited value already established.
    monkeypatch.setitem(evaluation_service._answer_keys, MULTI_PART_ALGEBRA_QUESTION.id, "9 - 2x|5x + 2")
    monkeypatch.setitem(evaluation_service._answer_keys, MULTI_PART_NUMERIC_QUESTION.id, "16|21")
    monkeypatch.setitem(evaluation_service._answer_keys, MULTI_PART_UNSUPPORTED_PART_TYPE_QUESTION.id, "4|a-2, b-1")


# --- Backward compatibility: legacy (default) short_text behavior ---------


def test_correct_answer_is_marked_correct() -> None:
    result = evaluation_service.evaluate(QUESTION, AnswerSubmission(answer="Yes", attemptNumber=1))

    assert result.isCorrect is True
    assert result.score == 1.0


def test_incorrect_answer_is_marked_incorrect() -> None:
    result = evaluation_service.evaluate(QUESTION, AnswerSubmission(answer="wrong", attemptNumber=1))

    assert result.isCorrect is False
    assert result.score == 0.0


def test_leading_and_trailing_whitespace_is_trimmed() -> None:
    result = evaluation_service.evaluate(QUESTION, AnswerSubmission(answer="  Yes  ", attemptNumber=1))

    assert result.isCorrect is True


def test_empty_answer_is_marked_incorrect() -> None:
    result = evaluation_service.evaluate(QUESTION, AnswerSubmission(answer="", attemptNumber=1))

    assert result.isCorrect is False
    assert result.score == 0.0


def test_get_expected_answer_returns_the_canonical_answer() -> None:
    assert evaluation_service.get_expected_answer(QUESTION.id) == "Yes"


def test_get_expected_answer_raises_key_error_for_unknown_question() -> None:
    with pytest.raises(KeyError):
        evaluation_service.get_expected_answer("unknown-question")


def test_a_question_with_no_explicit_questiontype_defaults_to_short_text() -> None:
    assert QUESTION.questionType == "short_text"
    result = evaluation_service.evaluate(QUESTION, AnswerSubmission(answer="Yes", attemptNumber=1))
    assert result.evaluatorId == "short_text_v1"


def test_explicit_short_text_questiontype_behaves_identically_to_the_default() -> None:
    explicit_question = QUESTION.model_copy(update={"questionType": "short_text"})

    default_result = evaluation_service.evaluate(QUESTION, AnswerSubmission(answer="Yes", attemptNumber=1))
    explicit_result = evaluation_service.evaluate(explicit_question, AnswerSubmission(answer="Yes", attemptNumber=1))

    assert default_result.isCorrect == explicit_result.isCorrect == True  # noqa: E712
    assert default_result.evaluatorId == explicit_result.evaluatorId == "short_text_v1"


def test_short_text_result_carries_the_new_additive_evaluationresult_fields() -> None:
    result = evaluation_service.evaluate(QUESTION, AnswerSubmission(answer="Yes", attemptNumber=1))

    assert result.maxScore == 1.0
    assert result.evaluatorId == "short_text_v1"
    assert result.scoreBreakdown is None
    assert result.confidence is None


# --- Numeric evaluator ------------------------------------------------------


def test_numeric_correct_answer_is_marked_correct() -> None:
    result = evaluation_service.evaluate(NUMERIC_QUESTION, AnswerSubmission(answer="0.5", attemptNumber=1))

    assert result.isCorrect is True
    assert result.score == 1.0
    assert result.evaluatorId == "numeric_tolerance_v1"


def test_numeric_incorrect_answer_is_marked_incorrect() -> None:
    result = evaluation_service.evaluate(NUMERIC_QUESTION, AnswerSubmission(answer="0.6", attemptNumber=1))

    assert result.isCorrect is False
    assert result.score == 0.0


def test_numeric_fraction_and_decimal_forms_are_equivalent() -> None:
    result = evaluation_service.evaluate(NUMERIC_QUESTION, AnswerSubmission(answer="1/2", attemptNumber=1))

    assert result.isCorrect is True


def test_numeric_trailing_zero_decimal_forms_are_equivalent() -> None:
    result = evaluation_service.evaluate(NUMERIC_WHOLE_QUESTION, AnswerSubmission(answer="4.0", attemptNumber=1))

    assert result.isCorrect is True


def test_numeric_non_numeric_submission_is_incorrect_not_an_error() -> None:
    result = evaluation_service.evaluate(NUMERIC_QUESTION, AnswerSubmission(answer="one half", attemptNumber=1))

    assert result.isCorrect is False


def test_numeric_whitespace_is_tolerated() -> None:
    result = evaluation_service.evaluate(NUMERIC_QUESTION, AnswerSubmission(answer="  0.5  ", attemptNumber=1))

    assert result.isCorrect is True


def test_numeric_question_with_a_non_numeric_canonical_answer_falls_back_to_exact_text() -> None:
    # A content-authoring edge case (numeric-typed but unit-bearing answer) -
    # must degrade safely, never raise into the request.
    correct = evaluation_service.evaluate(
        NUMERIC_NON_NUMERIC_CANONICAL_QUESTION, AnswerSubmission(answer="18 m", attemptNumber=1)
    )
    incorrect = evaluation_service.evaluate(
        NUMERIC_NON_NUMERIC_CANONICAL_QUESTION, AnswerSubmission(answer="18", attemptNumber=1)
    )

    assert correct.isCorrect is True
    assert incorrect.isCorrect is False  # "18" alone does not exact-match "18 m"


def test_numeric_tolerance_within_bound_is_correct() -> None:
    # expected 3.14159, tolerance 0.05 -> 3.10 is within bound (diff 0.04159)
    result = evaluation_service.evaluate(NUMERIC_TOLERANT_QUESTION, AnswerSubmission(answer="3.10", attemptNumber=1))

    assert result.isCorrect is True


def test_numeric_tolerance_outside_bound_is_incorrect() -> None:
    # expected 3.14159, tolerance 0.05 -> 3.00 is outside bound (diff 0.14159)
    result = evaluation_service.evaluate(NUMERIC_TOLERANT_QUESTION, AnswerSubmission(answer="3.00", attemptNumber=1))

    assert result.isCorrect is False


def test_numeric_zero_tolerance_default_requires_exact_numeric_equality() -> None:
    assert NUMERIC_QUESTION.responseSpecification is None
    result = evaluation_service.evaluate(NUMERIC_QUESTION, AnswerSubmission(answer="0.51", attemptNumber=1))

    assert result.isCorrect is False


# --- Single-choice evaluator (Slice 2) --------------------------------------


def test_single_choice_correct_option_is_marked_correct() -> None:
    result = evaluation_service.evaluate(SINGLE_CHOICE_QUESTION, AnswerSubmission(answer="opt-b", attemptNumber=1))

    assert result.isCorrect is True
    assert result.score == 1.0
    assert result.evaluatorId == "single_choice_v1"


def test_single_choice_recognized_wrong_option_is_marked_incorrect() -> None:
    result = evaluation_service.evaluate(SINGLE_CHOICE_QUESTION, AnswerSubmission(answer="opt-a", attemptNumber=1))

    assert result.isCorrect is False
    assert result.score == 0.0
    # A real, recognized (just wrong) option carries no evidence note - only
    # an unrecognized submission does (see the next two tests).
    assert result.evidence is None


def test_single_choice_unrecognized_submission_is_incorrect_with_evidence() -> None:
    result = evaluation_service.evaluate(
        SINGLE_CHOICE_QUESTION, AnswerSubmission(answer="opt-does-not-exist", attemptNumber=1)
    )

    assert result.isCorrect is False
    assert result.score == 0.0
    assert result.evidence is not None
    assert "not among" in result.evidence


def test_single_choice_empty_submission_is_incorrect_with_evidence() -> None:
    result = evaluation_service.evaluate(SINGLE_CHOICE_QUESTION, AnswerSubmission(answer="", attemptNumber=1))

    assert result.isCorrect is False
    assert result.evidence is not None


def test_single_choice_whitespace_around_the_submitted_option_id_is_tolerated() -> None:
    result = evaluation_service.evaluate(SINGLE_CHOICE_QUESTION, AnswerSubmission(answer="  opt-b  ", attemptNumber=1))

    assert result.isCorrect is True


def test_single_choice_result_carries_no_speculative_populated_fields() -> None:
    result = evaluation_service.evaluate(SINGLE_CHOICE_QUESTION, AnswerSubmission(answer="opt-b", attemptNumber=1))

    assert result.maxScore == 1.0
    assert result.confidence is None
    assert result.scoreBreakdown is None
    assert result.partResults is None


def test_single_choice_with_no_options_at_all_is_incorrect_not_a_crash() -> None:
    # Defensive: Stage 10 already refuses to export a single_choice question
    # with no options, but the evaluator must not crash if one somehow
    # reaches it (e.g. a directly-constructed Question in a future caller).
    malformed_question = SINGLE_CHOICE_QUESTION.model_copy(update={"responseSpecification": None})
    result = evaluation_service.evaluate(malformed_question, AnswerSubmission(answer="opt-b", attemptNumber=1))

    assert result.isCorrect is False


# --- Multi-choice evaluator (Slice 3) ---------------------------------------


def test_multi_choice_exact_set_match_is_correct() -> None:
    result = evaluation_service.evaluate(
        MULTI_CHOICE_QUESTION, AnswerSubmission(answer="opt-a,opt-b,opt-d", attemptNumber=1)
    )

    assert result.isCorrect is True
    assert result.score == 1.0
    assert result.evaluatorId == "multi_choice_v1"


def test_multi_choice_order_is_irrelevant() -> None:
    result = evaluation_service.evaluate(
        MULTI_CHOICE_QUESTION, AnswerSubmission(answer="opt-d,opt-a,opt-b", attemptNumber=1)
    )

    assert result.isCorrect is True


def test_multi_choice_duplicate_submitted_ids_are_deduplicated_and_still_correct() -> None:
    result = evaluation_service.evaluate(
        MULTI_CHOICE_QUESTION, AnswerSubmission(answer="opt-a,opt-a,opt-b,opt-d", attemptNumber=1)
    )

    assert result.isCorrect is True


def test_multi_choice_incomplete_subset_is_incorrect() -> None:
    result = evaluation_service.evaluate(MULTI_CHOICE_QUESTION, AnswerSubmission(answer="opt-a,opt-b", attemptNumber=1))

    assert result.isCorrect is False
    assert result.score == 0.0


def test_multi_choice_superset_is_incorrect() -> None:
    result = evaluation_service.evaluate(
        MULTI_CHOICE_QUESTION, AnswerSubmission(answer="opt-a,opt-b,opt-c,opt-d", attemptNumber=1)
    )

    assert result.isCorrect is False


def test_multi_choice_disjoint_set_is_incorrect() -> None:
    result = evaluation_service.evaluate(MULTI_CHOICE_QUESTION, AnswerSubmission(answer="opt-c", attemptNumber=1))

    assert result.isCorrect is False


def test_multi_choice_unknown_option_id_is_incorrect_with_evidence() -> None:
    result = evaluation_service.evaluate(
        MULTI_CHOICE_QUESTION, AnswerSubmission(answer="opt-a,opt-does-not-exist", attemptNumber=1)
    )

    assert result.isCorrect is False
    assert result.score == 0.0
    assert result.evidence is not None
    assert "not all among" in result.evidence


def test_multi_choice_empty_submission_is_incorrect_and_not_a_crash() -> None:
    result = evaluation_service.evaluate(MULTI_CHOICE_QUESTION, AnswerSubmission(answer="", attemptNumber=1))

    assert result.isCorrect is False
    assert result.score == 0.0


def test_multi_choice_whitespace_only_submission_is_treated_as_empty() -> None:
    result = evaluation_service.evaluate(MULTI_CHOICE_QUESTION, AnswerSubmission(answer="   ", attemptNumber=1))

    assert result.isCorrect is False


def test_multi_choice_whitespace_around_tokens_is_tolerated() -> None:
    result = evaluation_service.evaluate(
        MULTI_CHOICE_QUESTION, AnswerSubmission(answer=" opt-a , opt-b ,opt-d", attemptNumber=1)
    )

    assert result.isCorrect is True


def test_multi_choice_malformed_submission_with_a_double_comma_is_incorrect_with_evidence() -> None:
    result = evaluation_service.evaluate(MULTI_CHOICE_QUESTION, AnswerSubmission(answer="opt-a,,opt-b", attemptNumber=1))

    assert result.isCorrect is False
    assert result.score == 0.0
    assert result.evidence is not None
    assert "well-formed" in result.evidence


def test_multi_choice_trailing_comma_is_malformed_and_incorrect() -> None:
    result = evaluation_service.evaluate(MULTI_CHOICE_QUESTION, AnswerSubmission(answer="opt-a,opt-b,", attemptNumber=1))

    assert result.isCorrect is False
    assert result.evidence is not None


def test_multi_choice_correct_result_carries_full_maxscore_and_incorrect_carries_zero() -> None:
    correct = evaluation_service.evaluate(
        MULTI_CHOICE_QUESTION, AnswerSubmission(answer="opt-a,opt-b,opt-d", attemptNumber=1)
    )
    incorrect = evaluation_service.evaluate(MULTI_CHOICE_QUESTION, AnswerSubmission(answer="opt-a", attemptNumber=1))

    assert correct.score == correct.maxScore == 1.0
    assert incorrect.score == 0.0
    assert incorrect.maxScore == 1.0


def test_multi_choice_result_carries_no_speculative_populated_fields() -> None:
    result = evaluation_service.evaluate(
        MULTI_CHOICE_QUESTION, AnswerSubmission(answer="opt-a,opt-b,opt-d", attemptNumber=1)
    )

    assert result.maxScore == 1.0
    assert result.confidence is None
    assert result.scoreBreakdown is None
    assert result.partResults is None


def test_multi_choice_with_no_options_at_all_is_incorrect_not_a_crash() -> None:
    # Defensive, mirrors single_choice's own equivalent test above.
    malformed_question = MULTI_CHOICE_QUESTION.model_copy(update={"responseSpecification": None})
    result = evaluation_service.evaluate(malformed_question, AnswerSubmission(answer="opt-a", attemptNumber=1))

    assert result.isCorrect is False


# --- Multi-part evaluator (M3) -----------------------------------------------


def test_multi_part_all_parts_correct_is_marked_correct() -> None:
    result = evaluation_service.evaluate(
        MULTI_PART_ALGEBRA_QUESTION, AnswerSubmission(answer="9 - 2x|5x + 2", attemptNumber=1)
    )

    assert result.isCorrect is True
    assert result.evaluatorId == "multi_part_v1"


def test_multi_part_all_parts_incorrect_is_marked_incorrect_with_zero_score() -> None:
    result = evaluation_service.evaluate(
        MULTI_PART_ALGEBRA_QUESTION, AnswerSubmission(answer="wrong lhs|wrong rhs", attemptNumber=1)
    )

    assert result.isCorrect is False
    assert result.score == 0.0


def test_multi_part_one_correct_one_incorrect_is_marked_incorrect_with_partial_score() -> None:
    result = evaluation_service.evaluate(
        MULTI_PART_ALGEBRA_QUESTION, AnswerSubmission(answer="9 - 2x|not the rhs", attemptNumber=1)
    )

    assert result.isCorrect is False
    assert result.score == 1.0
    assert result.maxScore == 2.0


def test_multi_part_aggregate_score_and_maxscore_sum_across_parts() -> None:
    correct = evaluation_service.evaluate(
        MULTI_PART_ALGEBRA_QUESTION, AnswerSubmission(answer="9 - 2x|5x + 2", attemptNumber=1)
    )

    assert correct.score == 2.0
    assert correct.maxScore == 2.0


def test_multi_part_result_carries_one_partresult_per_part_in_order() -> None:
    result = evaluation_service.evaluate(
        MULTI_PART_ALGEBRA_QUESTION, AnswerSubmission(answer="9 - 2x|not the rhs", attemptNumber=1)
    )

    assert result.partResults is not None
    assert [p.partId for p in result.partResults] == ["lhs", "rhs"]
    assert result.partResults[0].isCorrect is True
    assert result.partResults[0].score == 1.0
    assert result.partResults[0].maxScore == 1.0
    assert result.partResults[0].evaluatorId == "short_text_v1"
    assert result.partResults[1].isCorrect is False
    assert result.partResults[1].score == 0.0


def test_multi_part_does_not_populate_scorebreakdown() -> None:
    """
    scoreBreakdown stays reserved for a future single-response rubric
    evaluator (design doc §C's correction) - multi-part decomposition is a
    different axis and must only ever populate partResults.
    """
    result = evaluation_service.evaluate(
        MULTI_PART_ALGEBRA_QUESTION, AnswerSubmission(answer="9 - 2x|5x + 2", attemptNumber=1)
    )

    assert result.scoreBreakdown is None


def test_multi_part_malformed_submission_with_wrong_part_count_is_incorrect_with_evidence() -> None:
    result = evaluation_service.evaluate(MULTI_PART_ALGEBRA_QUESTION, AnswerSubmission(answer="9 - 2x", attemptNumber=1))

    assert result.isCorrect is False
    assert result.score == 0.0
    assert result.evidence is not None
    assert "exactly 2 part" in result.evidence


def test_multi_part_submission_with_too_many_parts_is_incorrect_with_evidence() -> None:
    result = evaluation_service.evaluate(
        MULTI_PART_ALGEBRA_QUESTION, AnswerSubmission(answer="9 - 2x|5x + 2|extra", attemptNumber=1)
    )

    assert result.isCorrect is False
    assert result.evidence is not None


def test_multi_part_empty_submission_is_incorrect_and_not_a_crash() -> None:
    result = evaluation_service.evaluate(MULTI_PART_ALGEBRA_QUESTION, AnswerSubmission(answer="", attemptNumber=1))

    assert result.isCorrect is False
    assert result.score == 0.0


def test_multi_part_unsupported_part_questiontype_fails_that_part_safely() -> None:
    """
    Decision 3's scope: M3 only implements short_text/numeric part
    comparison. A part naming any other (still-reserved) questionType must
    fail safe to incorrect for that one part, never crash the request.
    """
    result = evaluation_service.evaluate(
        MULTI_PART_UNSUPPORTED_PART_TYPE_QUESTION, AnswerSubmission(answer="4|a-2, b-1", attemptNumber=1)
    )

    assert result.isCorrect is False
    assert result.partResults is not None
    assert result.partResults[0].isCorrect is True  # the numeric part still evaluates correctly
    assert result.partResults[1].isCorrect is False  # the unsupported "matching" part fails safe
    assert result.partResults[1].evaluatorId == "multi_part_v1"


def test_multi_part_with_no_parts_configured_is_incorrect_not_a_crash() -> None:
    # Defensive: Stage 10 already refuses to export a multi_part question
    # with no parts, but the evaluator must not crash if one somehow
    # reaches it (e.g. a directly-constructed Question) - mirrors single_
    # choice/multi_choice's own "no options" defensive tests.
    malformed_question = MULTI_PART_ALGEBRA_QUESTION.model_copy(update={"responseSpecification": None})
    result = evaluation_service.evaluate(malformed_question, AnswerSubmission(answer="anything", attemptNumber=1))

    assert result.isCorrect is False


def test_multi_part_duplicate_part_ids_do_not_crash_the_evaluator() -> None:
    """
    Stage 10 already refuses to export a multi_part question with duplicate
    part ids (loadCanonical.js), but the evaluator itself must not assume
    uniqueness - each part is evaluated independently and positionally, so
    a duplicate id simply produces two PartEvaluationResult entries sharing
    a partId, never a crash or a silently-dropped part.
    """
    duplicate_id_question = MULTI_PART_ALGEBRA_QUESTION.model_copy(
        update={
            "responseSpecification": ResponseSpecification(
                parts=[
                    QuestionPart(id="lhs", prompt="LHS", questionType="short_text"),
                    QuestionPart(id="lhs", prompt="RHS", questionType="short_text"),
                ]
            )
        }
    )
    result = evaluation_service.evaluate(
        duplicate_id_question, AnswerSubmission(answer="9 - 2x|5x + 2", attemptNumber=1)
    )

    assert len(result.partResults) == 2
    assert result.isCorrect is True


# --- Numeric normalization within multi_part (le-q37 style) ----------------


def test_multi_part_numeric_part_accepts_equivalent_numeric_forms() -> None:
    result = evaluation_service.evaluate(
        MULTI_PART_NUMERIC_QUESTION, AnswerSubmission(answer="16.0|21", attemptNumber=1)
    )

    assert result.isCorrect is True


def test_multi_part_numeric_part_rejects_wrong_value() -> None:
    result = evaluation_service.evaluate(MULTI_PART_NUMERIC_QUESTION, AnswerSubmission(answer="17|21", attemptNumber=1))

    assert result.isCorrect is False
    assert result.score == 1.0


def test_multi_part_order_is_fixed_swapped_parts_are_incorrect() -> None:
    """
    Decision 2: multi_part uses positional/identified parts, never
    unordered-set matching. le-q37's two numbers are order-fixed (smaller,
    then larger) - submitting them the other way round must not be
    silently accepted as a permutation match.
    """
    result = evaluation_service.evaluate(MULTI_PART_NUMERIC_QUESTION, AnswerSubmission(answer="21|16", attemptNumber=1))

    assert result.isCorrect is False
    # Both parts individually fail (each compared against the wrong
    # position's expected value) - not "correct but reordered".
    assert result.score == 0.0


# --- Exact string behavior for algebra expression parts (le-q25 style) -----


def test_multi_part_short_text_part_is_exact_match_only_no_algebra_equivalence() -> None:
    """
    Decision 3: no symbolic algebra parser, no mathematical-equivalence
    acceptance beyond what short_text already does. "9-2x" (no spaces) is
    algebraically identical to "9 - 2x" but must still be marked wrong,
    exactly like today's short_text evaluator would for any other question.
    """
    result = evaluation_service.evaluate(
        MULTI_PART_ALGEBRA_QUESTION, AnswerSubmission(answer="9-2x|5x + 2", attemptNumber=1)
    )

    assert result.isCorrect is False
    assert result.partResults[0].isCorrect is False
    assert result.partResults[1].isCorrect is True


def test_multi_part_short_text_part_tolerates_surrounding_whitespace() -> None:
    result = evaluation_service.evaluate(
        MULTI_PART_ALGEBRA_QUESTION, AnswerSubmission(answer="  9 - 2x  |  5x + 2  ", attemptNumber=1)
    )

    assert result.isCorrect is True


# --- Evaluator dispatch ------------------------------------------------------


def test_dispatch_selects_the_short_text_evaluator_for_short_text_questiontype() -> None:
    result = evaluation_service.evaluate(QUESTION, AnswerSubmission(answer="Yes", attemptNumber=1))
    assert result.evaluatorId == "short_text_v1"


def test_dispatch_selects_the_numeric_evaluator_for_numeric_questiontype() -> None:
    result = evaluation_service.evaluate(NUMERIC_QUESTION, AnswerSubmission(answer="0.5", attemptNumber=1))
    assert result.evaluatorId == "numeric_tolerance_v1"


def test_dispatch_selects_the_single_choice_evaluator_for_single_choice_questiontype() -> None:
    result = evaluation_service.evaluate(SINGLE_CHOICE_QUESTION, AnswerSubmission(answer="opt-b", attemptNumber=1))
    assert result.evaluatorId == "single_choice_v1"


def test_dispatch_selects_the_multi_choice_evaluator_for_multi_choice_questiontype() -> None:
    result = evaluation_service.evaluate(
        MULTI_CHOICE_QUESTION, AnswerSubmission(answer="opt-a,opt-b,opt-d", attemptNumber=1)
    )
    assert result.evaluatorId == "multi_choice_v1"


def test_dispatch_selects_the_multi_part_evaluator_for_multi_part_questiontype() -> None:
    result = evaluation_service.evaluate(
        MULTI_PART_ALGEBRA_QUESTION, AnswerSubmission(answer="9 - 2x|5x + 2", attemptNumber=1)
    )
    assert result.evaluatorId == "multi_part_v1"


def test_dispatch_raises_a_clear_error_for_an_unsupported_reserved_questiontype() -> None:
    with pytest.raises(ValueError, match="matching"):
        evaluation_service.evaluate(UNSUPPORTED_TYPE_QUESTION, AnswerSubmission(answer="a-2, b-1", attemptNumber=1))


# --- EvaluationResult compatibility with coaching -----------------------


def test_evaluationresult_isCorrect_feeds_coaching_service_unchanged() -> None:
    """
    coaching_service.decide() takes only (is_correct, attempt_number) - a
    richer EvaluationResult (from any evaluator) must compose with it
    exactly as the old bare Evaluation did, with zero coaching_service
    changes.
    """
    numeric_result = evaluation_service.evaluate(NUMERIC_QUESTION, AnswerSubmission(answer="0.5", attemptNumber=1))
    coach, ui = coaching_service.decide(numeric_result.isCorrect, attempt_number=1)

    assert coach.nextAction.value == "NEXT_QUESTION"
    assert ui.canTryAgain is False


def test_single_choice_evaluationresult_feeds_coaching_service_unchanged() -> None:
    correct_result = evaluation_service.evaluate(SINGLE_CHOICE_QUESTION, AnswerSubmission(answer="opt-b", attemptNumber=1))
    coach, ui = coaching_service.decide(correct_result.isCorrect, attempt_number=1)
    assert coach.nextAction.value == "NEXT_QUESTION"

    wrong_result = evaluation_service.evaluate(SINGLE_CHOICE_QUESTION, AnswerSubmission(answer="opt-a", attemptNumber=1))
    coach, ui = coaching_service.decide(wrong_result.isCorrect, attempt_number=1)
    assert coach.nextAction.value == "TRY_AGAIN"


def test_multi_choice_evaluationresult_feeds_coaching_service_unchanged() -> None:
    correct_result = evaluation_service.evaluate(
        MULTI_CHOICE_QUESTION, AnswerSubmission(answer="opt-a,opt-b,opt-d", attemptNumber=1)
    )
    coach, ui = coaching_service.decide(correct_result.isCorrect, attempt_number=1)
    assert coach.nextAction.value == "NEXT_QUESTION"

    wrong_result = evaluation_service.evaluate(MULTI_CHOICE_QUESTION, AnswerSubmission(answer="opt-a", attemptNumber=1))
    coach, ui = coaching_service.decide(wrong_result.isCorrect, attempt_number=1)
    assert coach.nextAction.value == "TRY_AGAIN"


def test_multi_part_evaluationresult_feeds_coaching_service_unchanged() -> None:
    """
    Even a partially-correct multi_part result (one part right, one wrong)
    must feed coaching_service exactly like any other incorrect answer -
    isCorrect stays the single boolean contract coaching_service reads;
    partial-credit detail (score/partResults) is never consulted here.
    """
    partial_result = evaluation_service.evaluate(
        MULTI_PART_ALGEBRA_QUESTION, AnswerSubmission(answer="9 - 2x|not the rhs", attemptNumber=1)
    )
    coach, ui = coaching_service.decide(partial_result.isCorrect, attempt_number=1)
    assert coach.nextAction.value == "TRY_AGAIN"

    correct_result = evaluation_service.evaluate(
        MULTI_PART_ALGEBRA_QUESTION, AnswerSubmission(answer="9 - 2x|5x + 2", attemptNumber=1)
    )
    coach, ui = coaching_service.decide(correct_result.isCorrect, attempt_number=1)
    assert coach.nextAction.value == "NEXT_QUESTION"
