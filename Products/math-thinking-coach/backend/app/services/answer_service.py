from app.schemas.answer import AnswerEvaluationResponse, AnswerSubmission
from app.services import coaching_service, evaluation_service, question_service


def evaluate_answer(question_id: str, submission: AnswerSubmission) -> AnswerEvaluationResponse:
    question = question_service.get_question_by_id(question_id)
    evaluation = evaluation_service.evaluate(question, submission)
    coach, ui = coaching_service.decide(evaluation.isCorrect, submission.attemptNumber)

    return AnswerEvaluationResponse(evaluation=evaluation, coach=coach, ui=ui)
