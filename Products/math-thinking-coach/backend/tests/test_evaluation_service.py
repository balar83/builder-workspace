from app.schemas.answer import AnswerSubmission
from app.schemas.question import Question
from app.services import evaluation_service

QUESTION = Question(
    id="q1-rational-numbers",
    chapterId="rational-numbers",
    question="What is the result of adding 1/3 and 1/6?",
    text="What is the result of adding 1/3 and 1/6?",
    difficulty="Easy",
    hints=["Find a common denominator for 1/3 and 1/6."],
    solution="1/3 + 1/6 = 2/6 + 1/6 = 3/6 = 1/2.",
)


def test_correct_answer_is_marked_correct() -> None:
    result = evaluation_service.evaluate(QUESTION, AnswerSubmission(answer="1/2", attemptNumber=1))

    assert result.isCorrect is True
    assert result.score == 1.0


def test_incorrect_answer_is_marked_incorrect() -> None:
    result = evaluation_service.evaluate(QUESTION, AnswerSubmission(answer="wrong", attemptNumber=1))

    assert result.isCorrect is False
    assert result.score == 0.0


def test_leading_and_trailing_whitespace_is_trimmed() -> None:
    result = evaluation_service.evaluate(QUESTION, AnswerSubmission(answer="  1/2  ", attemptNumber=1))

    assert result.isCorrect is True


def test_empty_answer_is_marked_incorrect() -> None:
    result = evaluation_service.evaluate(QUESTION, AnswerSubmission(answer="", attemptNumber=1))

    assert result.isCorrect is False
    assert result.score == 0.0
