from app.schemas.session import AssessmentRequest, StudentLearningContext
from app.services import session_planner


def _context(weak_topic_ids: list[str] | None = None, has_history: bool = False) -> StudentLearningContext:
    return StudentLearningContext(
        studentId="student-1",
        chapterId="linear-equations",
        topicMastery={},
        topicAccuracy={},
        weakTopicIds=weak_topic_ids or [],
        recentQuestionIds=[],
        hasHistory=has_history,
    )


def test_practice_mode_with_explicit_difficulty_puts_everything_in_one_tier() -> None:
    request = AssessmentRequest(
        studentId="student-1", chapterId="linear-equations", mode="practice",
        difficulty="Easy", questionCount=5,
    )

    plan = session_planner.create_plan(request, _context())

    assert plan.difficultyDistribution == {"Easy": 5, "Medium": 0, "Hard": 0}
    assert plan.targetCount == 5
    assert plan.weakConceptTopicIds == []


def test_practice_mode_with_no_difficulty_uses_the_mixed_default_split() -> None:
    request = AssessmentRequest(
        studentId="student-1", chapterId="linear-equations", mode="practice", questionCount=10,
    )

    plan = session_planner.create_plan(request, _context())

    assert plan.difficultyDistribution == {"Easy": 3, "Medium": 4, "Hard": 3}
    assert sum(plan.difficultyDistribution.values()) == 10


def test_practice_mode_defaults_target_count_when_not_specified() -> None:
    request = AssessmentRequest(studentId="student-1", chapterId="linear-equations", mode="practice")

    plan = session_planner.create_plan(request, _context())

    assert plan.targetCount == session_planner.DEFAULT_TARGET_COUNT


def test_mixed_distribution_always_sums_to_target_count() -> None:
    for count in [1, 2, 3, 7, 11, 17, 44]:
        request = AssessmentRequest(
            studentId="student-1", chapterId="linear-equations", mode="practice", questionCount=count,
        )
        plan = session_planner.create_plan(request, _context())
        assert sum(plan.difficultyDistribution.values()) == count


def test_test_mode_carries_the_time_limit_through() -> None:
    request = AssessmentRequest(
        studentId="student-1", chapterId="linear-equations", mode="test", timeLimitMinutes=20,
    )

    plan = session_planner.create_plan(request, _context())

    assert plan.timeLimitMinutes == 20
    assert plan.mode == "test"


def test_practice_mode_time_limit_is_passed_through_unenforced() -> None:
    request = AssessmentRequest(
        studentId="student-1", chapterId="linear-equations", mode="practice", timeLimitMinutes=20,
    )

    plan = session_planner.create_plan(request, _context())

    assert plan.timeLimitMinutes == 20


def test_revision_mode_ignores_manual_difficulty_and_question_types() -> None:
    request = AssessmentRequest(
        studentId="student-1", chapterId="linear-equations", mode="revision",
        difficulty="Hard", questionTypes=["MCQ"],
    )

    plan = session_planner.create_plan(request, _context(weak_topic_ids=["topic-a"]))

    assert plan.questionTypes is None
    assert plan.weakConceptTopicIds == ["topic-a"]


def test_revision_mode_with_no_weak_topics_degrades_gracefully() -> None:
    request = AssessmentRequest(studentId="student-1", chapterId="linear-equations", mode="revision")

    plan = session_planner.create_plan(request, _context(weak_topic_ids=[]))

    assert plan.weakConceptTopicIds == []
    assert plan.mode == "revision"


def test_plan_id_is_unique_per_call() -> None:
    request = AssessmentRequest(studentId="student-1", chapterId="linear-equations", mode="practice")

    plan_a = session_planner.create_plan(request, _context())
    plan_b = session_planner.create_plan(request, _context())

    assert plan_a.planId != plan_b.planId


def test_seed_is_deterministic_when_explicitly_provided() -> None:
    request = AssessmentRequest(studentId="student-1", chapterId="linear-equations", mode="practice")

    plan_a = session_planner.create_plan(request, _context(), seed="fixed-seed")
    plan_b = session_planner.create_plan(request, _context(), seed="fixed-seed")

    assert plan_a.seed == plan_b.seed == "fixed-seed"


def test_seed_defaults_to_a_generated_value_when_not_provided() -> None:
    request = AssessmentRequest(studentId="student-1", chapterId="linear-equations", mode="practice")

    plan_a = session_planner.create_plan(request, _context())
    plan_b = session_planner.create_plan(request, _context())

    assert plan_a.seed != plan_b.seed


def test_session_planner_never_imports_content_access() -> None:
    import ast
    import inspect

    source = inspect.getsource(session_planner)
    tree = ast.parse(source)
    imported_modules = {
        alias.name
        for node in ast.walk(tree)
        if isinstance(node, ast.Import)
        for alias in node.names
    } | {
        node.module
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom)
    }

    assert "app.services.content_repository" not in imported_modules
    assert "app.services.question_service" not in imported_modules
