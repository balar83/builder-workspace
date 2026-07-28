import uuid

from app.schemas.session import AssessmentRequest, SessionPlan, StudentLearningContext

DEFAULT_TARGET_COUNT = 10

# Default split when no specific difficulty was requested ("Mixed" or
# unset). Matches the easy/medium/hard balance the content pipeline's own
# coverage report already documents for authored chapters - not a new
# number invented here. Medium absorbs the rounding remainder so the three
# counts always sum to exactly targetCount.
_MIXED_EASY_RATIO = 0.3
_MIXED_HARD_RATIO = 0.3


def create_plan(
    request: AssessmentRequest, context: StudentLearningContext, seed: str | None = None
) -> SessionPlan:
    """
    Never touches question content - only AssessmentRequest and
    StudentLearningContext. Mode is a strategy branch inside this one
    component, not three separate planners (design review round 2).
    """
    target_count = request.questionCount or DEFAULT_TARGET_COUNT

    if request.mode == "revision":
        difficulty_distribution = _default_distribution(target_count)
        question_types = None
        weak_concept_topic_ids = list(context.weakTopicIds)
    else:
        difficulty_distribution = _resolve_distribution(request.difficulty, target_count)
        question_types = request.questionTypes
        weak_concept_topic_ids = []

    return SessionPlan(
        planId=uuid.uuid4().hex,
        studentId=request.studentId,
        chapterId=request.chapterId,
        mode=request.mode,
        difficultyDistribution=difficulty_distribution,
        questionTypes=question_types,
        targetCount=target_count,
        timeLimitMinutes=request.timeLimitMinutes,
        weakConceptTopicIds=weak_concept_topic_ids,
        seed=seed or uuid.uuid4().hex,
    )


def _resolve_distribution(difficulty: str | None, target_count: int) -> dict[str, int]:
    if difficulty in ("Easy", "Medium", "Hard"):
        return {tier: target_count if tier == difficulty else 0 for tier in ("Easy", "Medium", "Hard")}
    return _default_distribution(target_count)


def _default_distribution(target_count: int) -> dict[str, int]:
    easy = round(target_count * _MIXED_EASY_RATIO)
    hard = round(target_count * _MIXED_HARD_RATIO)
    medium = target_count - easy - hard
    return {"Easy": easy, "Medium": medium, "Hard": hard}
