import pytest

from app.schemas.answer import AnswerSubmission
from app.schemas.question import Option, Question, ResponseSpecification
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

UNSUPPORTED_TYPE_QUESTION = Question(
    id="test-unsupported-type",
    chapterId="fixture-chapter",
    question="Match each term to its definition.",
    text="Match each term to its definition.",
    difficulty="Easy",
    hints=[],
    solution="a-2, b-1",
    # multi_choice, not single_choice: single_choice gained a real evaluator
    # in Slice 2 - this fixture specifically needs a still-reserved type.
    questionType="multi_choice",
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


def test_dispatch_raises_a_clear_error_for_an_unsupported_reserved_questiontype() -> None:
    with pytest.raises(ValueError, match="multi_choice"):
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
