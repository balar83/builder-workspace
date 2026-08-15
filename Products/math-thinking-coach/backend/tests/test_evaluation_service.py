import pytest

from app.schemas.answer import AnswerSubmission
from app.schemas.question import Question
from app.services import evaluation_service

QUESTION = Question(
    id="rn-q01",
    chapterId="rational-numbers",
    question="Is 5 a rational number?",
    text="Is 5 a rational number?",
    difficulty="Easy",
    hints=["A rational number is any number expressible as p/q, with q not zero."],
    solution="Yes",
)


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
