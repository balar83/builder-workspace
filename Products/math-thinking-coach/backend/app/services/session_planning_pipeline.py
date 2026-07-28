from app.schemas.session import AssessmentRequest, SelectionOutcome, SessionPlan
from app.services import constraint_resolver, content_repository, learning_context_service, question_selector, session_planner


def plan_session(request: AssessmentRequest, seed: str | None = None) -> tuple[SessionPlan, SelectionOutcome]:
    """
    Thin composition of Milestone C1's five stateless components, in the
    order the architecture specifies. This is deliberately not a named
    architectural component itself - it's the glue Milestone C2's Session
    Builder will call when it persists a real LearningSession, not a
    permanent seventh piece of the design.

    The same candidate pool is fetched once and reused for both constraint
    resolution and selection, so the two steps can never disagree about
    what's actually available.
    """
    context = learning_context_service.build_learning_context(request.studentId, request.chapterId)
    plan = session_planner.create_plan(request, context, seed=seed)

    topic_ids = plan.weakConceptTopicIds or None
    candidates = content_repository.get_candidates(plan.chapterId, topic_ids=topic_ids)

    constraints = constraint_resolver.resolve_constraints(
        plan, candidates, exclude_question_ids=context.recentQuestionIds
    )
    outcome = question_selector.select(constraints, candidates)

    return plan, outcome
