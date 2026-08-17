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


class ScoreComponent(BaseModel):
    """
    Future partial-credit shape (design doc §11) - not populated by any
    evaluator in Slice 1. Typed now, with no producer yet, so a later
    decomposable (e.g. multi-part) evaluator populating
    EvaluationResult.scoreBreakdown is not a breaking schema change.
    """

    component: str
    maxScore: float
    earnedScore: float


class EvaluationResult(Evaluation):
    """
    Slice 1 (M2, Question & Response Semantics): extends Evaluation
    additively - isCorrect/score keep their exact current meaning, so
    coaching_service's (is_correct, attempt_number) contract needs no
    change. See docs/Question-Response-Semantics-Design-Proposal.md §7/§8.
    """

    maxScore: float = 1.0
    # Which evaluator produced this result (e.g. "short_text_v1",
    # "numeric_tolerance_v1") - a stable, versioned identifier, always set,
    # never a human description. Required deliberately: every result should
    # honestly declare provenance.
    evaluatorId: str
    scoreBreakdown: list[ScoreComponent] | None = None
    # Deterministic evaluators (Slice 1: short_text, numeric) must leave this
    # None - never fabricated as 1.0. Only a genuinely probabilistic (future
    # AI) evaluator would ever populate it. Design doc §8, Question K.
    confidence: float | None = None


class Coach(BaseModel):
    message: str
    nextAction: NextAction


class UiState(BaseModel):
    canTryAgain: bool
    canRevealSolution: bool
    hintLevel: int


class AnswerEvaluationResponse(BaseModel):
    evaluation: EvaluationResult
    coach: Coach
    ui: UiState
