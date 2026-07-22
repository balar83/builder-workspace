from app.schemas.answer import NextAction
from app.services import coaching_service


def test_correct_answer_returns_next_question() -> None:
    coach, ui = coaching_service.decide(is_correct=True, attempt_number=1)

    assert coach.nextAction == NextAction.NEXT_QUESTION
    assert coach.message == "Excellent! You solved it correctly."
    assert ui.canTryAgain is False
    assert ui.canRevealSolution is False
    assert ui.hintLevel == 0


def test_first_incorrect_attempt_returns_try_again() -> None:
    coach, ui = coaching_service.decide(is_correct=False, attempt_number=1)

    assert coach.nextAction == NextAction.TRY_AGAIN
    assert coach.message == "Not quite. Try solving it once more before using a hint."
    assert ui.canTryAgain is True
    assert ui.canRevealSolution is False
    assert ui.hintLevel == 0


def test_second_incorrect_attempt_returns_show_hint() -> None:
    coach, ui = coaching_service.decide(is_correct=False, attempt_number=2)

    assert coach.nextAction == NextAction.SHOW_HINT
    assert coach.message == "Good effort. Here's a hint to help you."
    assert ui.canTryAgain is True
    assert ui.canRevealSolution is False
    assert ui.hintLevel == 1


def test_third_incorrect_attempt_returns_show_solution() -> None:
    coach, ui = coaching_service.decide(is_correct=False, attempt_number=3)

    assert coach.nextAction == NextAction.SHOW_SOLUTION
    assert coach.message == "If you're still stuck, you can view the solution."
    assert ui.canTryAgain is False
    assert ui.canRevealSolution is True
    assert ui.hintLevel == 2


def test_fourth_incorrect_attempt_still_returns_show_solution() -> None:
    coach, ui = coaching_service.decide(is_correct=False, attempt_number=4)

    assert coach.nextAction == NextAction.SHOW_SOLUTION
