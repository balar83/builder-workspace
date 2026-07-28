import json
from pathlib import Path

from app.schemas.answer import AnswerSubmission, Evaluation
from app.schemas.question import Question

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

_answer_keys: dict[str, str] = json.loads(
    (DATA_DIR / "answer_keys.json").read_text(encoding="utf-8")
)


def get_expected_answer(question_id: str) -> str:
    """
    Returns the canonical expected answer for a question, used by both
    rule-based evaluation and Shadow Mode AI evaluation.

    Raises KeyError if the question does not exist.
    """
    return _answer_keys[question_id]


def evaluate(question: Question, submission: AnswerSubmission) -> Evaluation:
    expected_answer = get_expected_answer(question.id)
    is_correct = submission.answer.strip() == expected_answer.strip()

    return Evaluation(isCorrect=is_correct, score=1.0 if is_correct else 0.0)
