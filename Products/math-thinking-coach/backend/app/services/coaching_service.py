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


def reveal_solution() -> tuple[Coach, UiState]:
    """
    M1: the explicit "I revealed the solution" outcome - independent of
    attempt_number, unlike decide()'s own SHOW_SOLUTION branch above (which
    only reaches it after 3 attempts). A learner can legitimately exhaust
    every hint well before then (hints are free, submissions aren't), so the
    session-runtime layer calls this directly once the learner explicitly
    asks to reveal, rather than fabricating attempts to walk the ladder
    there. Returns the exact same Coach/UiState shape decide() would for
    SHOW_SOLUTION, since the outcome is identical either way - only how it
    was reached differs.
    """
    return (
        Coach(message=_COACH_MESSAGES[NextAction.SHOW_SOLUTION], nextAction=NextAction.SHOW_SOLUTION),
        _UI_STATE_BY_ACTION[NextAction.SHOW_SOLUTION],
    )


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
