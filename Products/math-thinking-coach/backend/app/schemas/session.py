from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.answer import Coach, Evaluation, UiState
from app.schemas.question import Difficulty

Mode = Literal["practice", "test", "revision"]
RequestedDifficulty = Literal["Easy", "Medium", "Hard", "Mixed"]
SourceType = Literal["canonical", "template", "ai-generated", "teacher-upload"]


class AssessmentRequest(BaseModel):
    """
    The only input this milestone's pipeline accepts. Ephemeral - never
    persisted. questionCount/timeLimitMinutes are optional; Session Planner
    fills sensible defaults per mode.
    """

    studentId: str
    chapterId: str
    mode: Mode
    difficulty: RequestedDifficulty | None = None
    questionTypes: list[str] | None = None
    questionCount: int | None = Field(default=None, gt=0)
    timeLimitMinutes: int | None = Field(default=None, gt=0)


class StudentLearningContext(BaseModel):
    """
    A consolidated, read-only snapshot of what's known about a student in a
    chapter, built fresh from attempt_service (ADR-005) on every call - never
    persisted, never cached. hasHistory=False for a first-time student; every
    other field is safe to read in that case (empty dict/list), not absent.
    """

    studentId: str
    chapterId: str
    topicMastery: dict[str, bool]
    topicAccuracy: dict[str, float]
    weakTopicIds: list[str]
    recentQuestionIds: list[str]
    hasHistory: bool


class SessionPlan(BaseModel):
    """
    The resolved output of planning - policy, not mechanics. Immutable once
    created; Constraint Resolver never mutates it, only derives
    SelectionConstraints from it. difficultyDistribution keys are always
    exactly "Easy", "Medium", "Hard".
    """

    planId: str
    studentId: str
    chapterId: str
    mode: Mode
    difficultyDistribution: dict[str, int]
    questionTypes: list[str] | None
    targetCount: int
    timeLimitMinutes: int | None
    weakConceptTopicIds: list[str]
    seed: str


class SelectionConstraints(BaseModel):
    """
    The sole contract Question Selector receives - mechanics, not policy.
    Never constructed directly by the Selector; always the output of
    Constraint Resolver. resolvedCount may be less than requestedCount when
    the content pool can't fill the plan even after degradation.
    """

    chapterId: str
    topicIds: list[str] | None
    difficultyDistribution: dict[str, int]
    questionTypes: list[str] | None
    excludeQuestionIds: list[str]
    seed: str
    requestedCount: int
    resolvedCount: int


class QuestionCandidate(BaseModel):
    """
    A normalized, source-agnostic pool record. type is always None today -
    no question-type field exists on the runtime Question schema yet (P2,
    not built). reviewStatus is always "approved" for canonical/template
    content, since Stage 10 export (ADR-003) already gates on it before
    anything reaches runtime data.
    """

    id: str
    chapterId: str
    topicId: str | None
    difficulty: Difficulty
    type: str | None
    sourceType: SourceType
    reviewStatus: str


class SelectedQuestion(BaseModel):
    position: int
    questionId: str
    difficulty: Difficulty
    type: str | None


class SelectionOutcome(BaseModel):
    """
    Question Selector's return type - never a bare list. shortfall is True
    whenever actualCount < the constraints' requestedCount, whether the
    shortfall originated in Constraint Resolver's pool-count check or in
    the Selector's own exclusion logic finding fewer fillable slots than
    the resolved count implied.
    """

    selectedQuestions: list[SelectedQuestion]
    actualCount: int
    shortfall: bool


# --- Milestone C2: the stateful runtime aggregate ---------------------------

SessionStatus = Literal["not_started", "in_progress", "completed", "expired", "abandoned"]


class SessionState(BaseModel):
    """
    The only mutable slice of a LearningSession. Runtime Session Manager is
    the sole writer, for the session's entire remaining life after creation.
    completedAt is set whenever the session becomes terminal for any reason
    (completed, expired, or abandoned), not just on a successful finish -
    status is what distinguishes why.
    """

    status: SessionStatus
    currentPosition: int
    attemptsOnCurrentQuestion: int
    correctCount: int
    hintsUsedTotal: int
    startedAt: str | None
    lastActivityAt: str
    completedAt: str | None


class LearningSession(BaseModel):
    """
    The central runtime aggregate. sessionId is plan.planId, adopted
    directly rather than minting a second UUID for the same thing. plan and
    selectedQuestions are immutable from the moment Session Builder inserts
    this row - written exactly once, never updated by anyone, including
    Runtime Session Manager.
    """

    sessionId: str
    studentId: str
    chapterId: str
    plan: SessionPlan
    selectedQuestions: list[SelectedQuestion]
    state: SessionState
    createdAt: str


# --- API-facing request/response shapes -------------------------------------


class CreateSessionRequest(BaseModel):
    """studentId is not accepted here - it comes from the authenticated session."""

    chapterId: str
    mode: Mode
    difficulty: RequestedDifficulty | None = None
    questionTypes: list[str] | None = None
    questionCount: int | None = Field(default=None, gt=0)
    timeLimitMinutes: int | None = Field(default=None, gt=0)


class CreateSessionResponse(BaseModel):
    sessionId: str
    targetCount: int
    actualCount: int
    shortfall: bool


class QuestionContent(BaseModel):
    id: str
    question: str
    text: str
    difficulty: Difficulty
    hints: list[str]
    solution: str


class CurrentQuestionResponse(BaseModel):
    position: int
    totalCount: int
    question: QuestionContent


class SessionTerminalResponse(BaseModel):
    sessionId: str
    status: SessionStatus
    position: int
    totalCount: int
    correctCount: int


class SubmitSessionAnswerRequest(BaseModel):
    position: int
    answer: str


class SubmitSessionAnswerResponse(BaseModel):
    evaluation: Evaluation
    coach: Coach
    ui: UiState
    position: int
    totalCount: int
    sessionStatus: SessionStatus


class SessionSummaryResponse(BaseModel):
    sessionId: str
    mode: Mode
    status: SessionStatus
    position: int
    totalCount: int
    correctCount: int
    startedAt: str | None
    completedAt: str | None
