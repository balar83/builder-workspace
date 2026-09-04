from app.schemas.answer import AnswerEvaluationResponse, AnswerSubmission, Coach, NextAction, RemediationFeedback
from app.schemas.question import Question
from app.services import coaching_service, evaluation_service, question_service

# Self-Serve Learning Loop V1, Slice 5: reuses the existing coaching
# next-action as the remediation gate - no new attempt state, no separate
# remediation ladder. Approved product decision: never on the first
# TRY_AGAIN (the hint ladder's own "productive struggle first" principle),
# eligible once the ladder reaches SHOW_HINT or SHOW_SOLUTION.
_REMEDIATION_ELIGIBLE_ACTIONS = (NextAction.SHOW_HINT, NextAction.SHOW_SOLUTION)


def evaluate_answer(question_id: str, submission: AnswerSubmission) -> AnswerEvaluationResponse:
    question = question_service.get_question_by_id(question_id)
    evaluation = evaluation_service.evaluate(question, submission)
    coach, ui = coaching_service.decide(evaluation.isCorrect, submission.attemptNumber)
    remediation = _build_remediation(question, submission, evaluation.isCorrect, coach)

    return AnswerEvaluationResponse(evaluation=evaluation, coach=coach, ui=ui, remediation=remediation)


def _build_remediation(
    question: Question, submission: AnswerSubmission, is_correct: bool, coach: Coach
) -> RemediationFeedback | None:
    """
    No new question lookup - `question` is already loaded by the caller.
    Eligibility, in order:
    1. The question must have authored remediation at all (uneven coverage
       - most questions have none, and none is invented for those).
    2. The answer must be wrong (a correct answer advances to
       NEXT_QUESTION, never eligible).
    3. The coaching ladder must have reached SHOW_HINT or SHOW_SOLUTION -
       never on the first TRY_AGAIN, per the approved product decision.
    4. Content matching: for a single_choice question whose remediation
       carries a specific commonWrongOptionId, remediation is shown only
       when the learner's actual submission matches it exactly - a direct
       string comparison against data already in hand (submission.answer,
       already known to be the selected option's id for this
       questionType), no new lookup or evaluator change required. For
       every other case - no commonWrongOptionId at all, or a
       questionType where option-id matching isn't meaningful
       (short_text/numeric/multi_choice) - there is no reliable way to
       confirm the submission matches the authored mistake, so the one
       piece of authored content this question has is surfaced
       generically instead, per the approved semantics. This is
       deliberately not a per-distractor engine and never does free-text
       matching.
    """
    if question.remediation is None:
        return None
    if is_correct:
        return None
    if coach.nextAction not in _REMEDIATION_ELIGIBLE_ACTIONS:
        return None

    common_wrong_option_id = question.remediation.commonWrongOptionId
    if question.questionType == "single_choice" and common_wrong_option_id is not None:
        if submission.answer.strip() != common_wrong_option_id:
            return None

    return RemediationFeedback(
        why=question.remediation.why,
        remediationHint=question.remediation.remediationHint,
    )
