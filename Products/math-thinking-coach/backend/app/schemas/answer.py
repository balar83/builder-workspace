from enum import Enum

from pydantic import BaseModel


class NextAction(str, Enum):
    TRY_AGAIN = "TRY_AGAIN"
    SHOW_HINT = "SHOW_HINT"
    SHOW_SOLUTION = "SHOW_SOLUTION"
    NEXT_QUESTION = "NEXT_QUESTION"


class AnswerSubmission(BaseModel):
    answer: str
    attemptNumber: int


class SubmitAnswerRequest(BaseModel):
    submission: AnswerSubmission


class Evaluation(BaseModel):
    isCorrect: bool
    score: float


class Coach(BaseModel):
    message: str
    nextAction: NextAction


class UiState(BaseModel):
    canTryAgain: bool
    canRevealSolution: bool
    hintLevel: int


class AnswerEvaluationResponse(BaseModel):
    evaluation: Evaluation
    coach: Coach
    ui: UiState
