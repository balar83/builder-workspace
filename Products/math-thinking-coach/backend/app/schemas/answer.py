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


class PartEvaluationResult(BaseModel):
    """
    Reserved for future multi_part use (Slice 2 design proposal, Part II
    §C) - no evaluator in any current slice produces one; single_choice
    does not need it. Deliberately mirrors EvaluationResult's own fields so
    a future multi_part evaluator can reuse the same per-part shape rather
    than inventing a second contract. Kept distinct from ScoreComponent:
    this represents one independent sub-question's full result (multi-part
    composition), not a named piece of credit within a single answer
    (within-answer rubric decomposition, still ScoreComponent's job).
    """

    partId: str
    isCorrect: bool
    score: float
    maxScore: float
    evaluatorId: str
    confidence: float | None = None


class EvaluationResult(Evaluation):
    """
    Slice 1 (M2, Question & Response Semantics): extends Evaluation
    additively - isCorrect/score keep their exact current meaning, so
    coaching_service's (is_correct, attempt_number) contract needs no
    change. See docs/Question-Response-Semantics-Design-Proposal.md §7/§8
    and Part II §C for the Slice 2 overall/part/evidence separation.
    """

    maxScore: float = 1.0
    # Which evaluator produced this result (e.g. "short_text_v1",
    # "numeric_tolerance_v1", "single_choice_v1") - a stable, versioned
    # identifier, always set, never a human description. Required
    # deliberately: every result should honestly declare provenance. This
    # already serves as the "evaluator/version information" a future
    # consumer needs - no separate field was added for it.
    evaluatorId: str
    scoreBreakdown: list[ScoreComponent] | None = None
    # Deterministic evaluators (Slice 1/2: short_text, numeric,
    # single_choice) must leave this None - never fabricated as 1.0. Only a
    # genuinely probabilistic (future AI) evaluator would ever populate it.
    # Design doc §8, Question K.
    confidence: float | None = None
    # Plain-language reason/evidence for the result - e.g. the
    # single_choice evaluator sets this when a submission doesn't match any
    # of the question's real options, to distinguish that case from a
    # recognized-but-wrong choice. Absent otherwise. Also the eventual home
    # for a future AI evaluator's explanation, mirroring Shadow Mode's
    # already-built (experimental) AIEvaluation.explanation field.
    evidence: str | None = None
    # Reserved for future multi_part use - no evaluator in this slice
    # populates it. Kept separate from scoreBreakdown on purpose: this is
    # multi-part decomposition (N independent sub-question results),
    # scoreBreakdown is within-one-answer rubric decomposition - conflating
    # them was identified as a design risk before this slice was built.
    partResults: list[PartEvaluationResult] | None = None


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
