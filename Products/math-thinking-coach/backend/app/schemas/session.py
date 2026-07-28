from typing import Literal

from pydantic import BaseModel

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
    questionCount: int | None = None
    timeLimitMinutes: int | None = None


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
