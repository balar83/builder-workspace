import json
from pathlib import Path

from app.schemas.answer import (
    AnswerEvaluationResponse,
    AnswerSubmission,
    Coach,
    Evaluation,
    NextAction,
    UiState,
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

_answer_keys: dict[str, str] = json.loads(
    (DATA_DIR / "answer_keys.json").read_text(encoding="utf-8")
)

_UI_STATE_BY_ACTION: dict[NextAction, UiState] = {
    NextAction.TRY_AGAIN: UiState(canTryAgain=True, canRevealSolution=False, hintLevel=0),
    NextAction.SHOW_HINT: UiState(canTryAgain=True, canRevealSolution=False, hintLevel=1),
    NextAction.SHOW_SOLUTION: UiState(canTryAgain=False, canRevealSolution=True, hintLevel=2),
    NextAction.NEXT_QUESTION: UiState(canTryAgain=False, canRevealSolution=False, hintLevel=0),
}

_COACH_MESSAGES: dict[NextAction, str] = {
    NextAction.NEXT_QUESTION: "Excellent! You solved it correctly.",
    NextAction.TRY_AGAIN: "Not quite. Try solving it once more before using a hint.",
    NextAction.SHOW_HINT: "Good effort. Here's a hint to help you.",
    NextAction.SHOW_SOLUTION: "If you're still stuck, you can view the solution.",
}


def evaluate_answer(question_id: str, submission: AnswerSubmission) -> AnswerEvaluationResponse:
    expected_answer = _answer_keys[question_id]
    is_correct = submission.answer.strip() == expected_answer.strip()

    if is_correct:
        next_action = NextAction.NEXT_QUESTION
    elif submission.attemptNumber <= 1:
        next_action = NextAction.TRY_AGAIN
    elif submission.attemptNumber == 2:
        next_action = NextAction.SHOW_HINT
    else:
        next_action = NextAction.SHOW_SOLUTION

    return AnswerEvaluationResponse(
        evaluation=Evaluation(isCorrect=is_correct, score=1.0 if is_correct else 0.0),
        coach=Coach(message=_COACH_MESSAGES[next_action], nextAction=next_action),
        ui=_UI_STATE_BY_ACTION[next_action],
    )
