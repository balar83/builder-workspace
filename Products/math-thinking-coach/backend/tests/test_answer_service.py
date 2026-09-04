"""
Self-Serve Learning Loop V1, Slice 5: unit-level tests for
answer_service._build_remediation / evaluate_answer's remediation
eligibility and content-matching rules. Uses synthetic questions injected
into question_service._questions (same monkeypatch technique test_answers.py
already uses for its single_choice tests) - no real content or answer_keys.json
is touched.
"""

import pytest

from app.schemas.answer import AnswerSubmission
from app.schemas.question import Option, Question, QuestionRemediation, ResponseSpecification
from app.services import answer_service, evaluation_service, question_service

SHORT_TEXT_ID = "test-remediation-short-text"
SINGLE_CHOICE_WITH_MATCH_ID = "test-remediation-single-choice-match"
SINGLE_CHOICE_NO_MATCH_METADATA_ID = "test-remediation-single-choice-no-metadata"
NO_REMEDIATION_ID = "test-remediation-none"


@pytest.fixture(autouse=True)
def _synthetic_questions(monkeypatch: pytest.MonkeyPatch) -> None:
    remediation = QuestionRemediation(
        why="Students often mix up the sign.",
        remediationHint="Check the sign before combining terms.",
    )
    single_choice_remediation = QuestionRemediation(
        why="Students often mix up the sign.",
        remediationHint="Check the sign before combining terms.",
        commonWrongOptionId="opt-wrong",
    )

    questions = [
        Question(
            id=SHORT_TEXT_ID,
            chapterId="rational-numbers",
            question="What is -2 + 5?",
            text="What is -2 + 5?",
            difficulty="Easy",
            hints=["Think of a number line."],
            solution="3",
            remediation=remediation,
        ),
        Question(
            id=SINGLE_CHOICE_WITH_MATCH_ID,
            chapterId="rational-numbers",
            question="Which of these is a perfect square?",
            text="Which of these is a perfect square?",
            difficulty="Easy",
            hints=["Try squaring small whole numbers."],
            solution="16",
            questionType="single_choice",
            responseSpecification=ResponseSpecification(
                options=[
                    Option(id="opt-right", text="16"),
                    Option(id="opt-wrong", text="12"),
                ]
            ),
            remediation=single_choice_remediation,
        ),
        Question(
            id=SINGLE_CHOICE_NO_MATCH_METADATA_ID,
            chapterId="rational-numbers",
            question="Which of these is a perfect square?",
            text="Which of these is a perfect square?",
            difficulty="Easy",
            hints=["Try squaring small whole numbers."],
            solution="16",
            questionType="single_choice",
            responseSpecification=ResponseSpecification(
                options=[
                    Option(id="opt-right", text="16"),
                    Option(id="opt-other", text="12"),
                ]
            ),
            remediation=remediation,  # no commonWrongOptionId
        ),
        Question(
            id=NO_REMEDIATION_ID,
            chapterId="rational-numbers",
            question="What is 2 + 2?",
            text="What is 2 + 2?",
            difficulty="Easy",
            hints=["Count on your fingers."],
            solution="4",
        ),
    ]
    monkeypatch.setattr(question_service, "_questions", question_service._questions + questions)
    monkeypatch.setitem(evaluation_service._answer_keys, SHORT_TEXT_ID, "3")
    monkeypatch.setitem(evaluation_service._answer_keys, SINGLE_CHOICE_WITH_MATCH_ID, "opt-right")
    monkeypatch.setitem(evaluation_service._answer_keys, SINGLE_CHOICE_NO_MATCH_METADATA_ID, "opt-right")
    monkeypatch.setitem(evaluation_service._answer_keys, NO_REMEDIATION_ID, "4")


def _submit(question_id: str, answer: str, attempt_number: int):
    return answer_service.evaluate_answer(
        question_id, AnswerSubmission(answer=answer, attemptNumber=attempt_number)
    )


def test_wrong_answer_at_try_again_does_not_expose_remediation() -> None:
    result = _submit(SHORT_TEXT_ID, "wrong", 1)

    assert result.coach.nextAction == "TRY_AGAIN"
    assert result.remediation is None


def test_wrong_answer_at_show_hint_exposes_eligible_authored_remediation() -> None:
    result = _submit(SHORT_TEXT_ID, "wrong", 2)

    assert result.coach.nextAction == "SHOW_HINT"
    assert result.remediation is not None
    assert result.remediation.why == "Students often mix up the sign."
    assert result.remediation.remediationHint == "Check the sign before combining terms."


def test_wrong_answer_at_show_solution_exposes_eligible_authored_remediation() -> None:
    result = _submit(SHORT_TEXT_ID, "wrong", 3)

    assert result.coach.nextAction == "SHOW_SOLUTION"
    assert result.remediation is not None


def test_correct_answer_does_not_expose_remediation() -> None:
    result = _submit(SHORT_TEXT_ID, "3", 1)

    assert result.coach.nextAction == "NEXT_QUESTION"
    assert result.remediation is None


def test_question_without_authored_remediation_never_exposes_remediation() -> None:
    result = _submit(NO_REMEDIATION_ID, "wrong", 3)

    assert result.coach.nextAction == "SHOW_SOLUTION"
    assert result.remediation is None


def test_single_choice_exact_common_wrong_option_id_match_exposes_remediation() -> None:
    result = _submit(SINGLE_CHOICE_WITH_MATCH_ID, "opt-wrong", 2)

    assert result.coach.nextAction == "SHOW_HINT"
    assert result.remediation is not None


def test_single_choice_non_matching_option_id_does_not_expose_remediation() -> None:
    """
    The submission is wrong (opt-right is expected), but it doesn't match
    the one specific authored commonWrongOptionId ("opt-wrong") - this is
    the "non-match" case: a specific-option match was attempted and failed,
    so remediation stays hidden rather than showing generically.
    """
    other_wrong_option = SINGLE_CHOICE_WITH_MATCH_ID
    result = answer_service.evaluate_answer(
        other_wrong_option, AnswerSubmission(answer="not-a-real-option", attemptNumber=2)
    )

    assert result.coach.nextAction == "SHOW_HINT"
    assert result.remediation is None


def test_single_choice_without_common_wrong_option_id_shows_remediation_generically() -> None:
    """
    This question's remediation carries no commonWrongOptionId at all, so
    there is no specific-option match to attempt - the one piece of
    authored content is surfaced generically for any eligible wrong answer.
    """
    result = _submit(SINGLE_CHOICE_NO_MATCH_METADATA_ID, "opt-other", 2)

    assert result.coach.nextAction == "SHOW_HINT"
    assert result.remediation is not None
