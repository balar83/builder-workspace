from app.schemas.answer import Coach, NextAction, UiState

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


def decide(is_correct: bool, attempt_number: int) -> tuple[Coach, UiState]:
    if is_correct:
        next_action = NextAction.NEXT_QUESTION
    elif attempt_number <= 1:
        next_action = NextAction.TRY_AGAIN
    elif attempt_number == 2:
        next_action = NextAction.SHOW_HINT
    else:
        next_action = NextAction.SHOW_SOLUTION

    return (
        Coach(message=_COACH_MESSAGES[next_action], nextAction=next_action),
        _UI_STATE_BY_ACTION[next_action],
    )
