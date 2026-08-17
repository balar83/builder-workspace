import pytest

from app.schemas.answer import AnswerSubmission
from app.schemas.question import Question, ResponseSpecification
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

UNSUPPORTED_TYPE_QUESTION = Question(
    id="test-unsupported-type",
    chapterId="fixture-chapter",
    question="Which of these is correct?",
    text="Which of these is correct?",
    difficulty="Easy",
    hints=[],
    solution="(b)",
    questionType="single_choice",
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
    monkeypatch.setitem(evaluation_service._answer_keys, UNSUPPORTED_TYPE_QUESTION.id, "(b)")


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


# --- Evaluator dispatch ------------------------------------------------------


def test_dispatch_selects_the_short_text_evaluator_for_short_text_questiontype() -> None:
    result = evaluation_service.evaluate(QUESTION, AnswerSubmission(answer="Yes", attemptNumber=1))
    assert result.evaluatorId == "short_text_v1"


def test_dispatch_selects_the_numeric_evaluator_for_numeric_questiontype() -> None:
    result = evaluation_service.evaluate(NUMERIC_QUESTION, AnswerSubmission(answer="0.5", attemptNumber=1))
    assert result.evaluatorId == "numeric_tolerance_v1"


def test_dispatch_raises_a_clear_error_for_an_unsupported_reserved_questiontype() -> None:
    with pytest.raises(ValueError, match="single_choice"):
        evaluation_service.evaluate(UNSUPPORTED_TYPE_QUESTION, AnswerSubmission(answer="(b)", attemptNumber=1))


# --- EvaluationResult compatibility with coaching -----------------------


def test_evaluationresult_isCorrect_feeds_coaching_service_unchanged() -> None:
    """
    coaching_service.decide() takes only (is_correct, attempt_number) - a
    richer EvaluationResult (from either evaluator) must compose with it
    exactly as the old bare Evaluation did, with zero coaching_service
    changes.
    """
    numeric_result = evaluation_service.evaluate(NUMERIC_QUESTION, AnswerSubmission(answer="0.5", attemptNumber=1))
    coach, ui = coaching_service.decide(numeric_result.isCorrect, attempt_number=1)

    assert coach.nextAction.value == "NEXT_QUESTION"
    assert ui.canTryAgain is False
