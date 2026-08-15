from pathlib import Path

import pytest

from app.schemas.session import AssessmentRequest, QuestionCandidate
from app.services import attempt_service, content_repository, session_planning_pipeline

# Real content: rational-numbers has 40 questions (15 Easy, 16 Medium, 9 Hard),
# one topic. practical-geometry has 35 questions (12 Easy, 15 Medium, 8 Hard),
# no topic. linear-equations has 44 questions (14/16/14), one topic. As of this
# milestone every real chapter has at least some Hard content, so the
# "requested tier is empty" scenario below uses a monkeypatched candidate
# pool instead of leaning on a chapter that happens to be difficulty-sparse.


@pytest.fixture(autouse=True)
def _isolate_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(attempt_service, "DB_PATH", tmp_path / "attempts.db")


def test_practice_session_for_a_first_time_student_backfills_across_real_content() -> None:
    request = AssessmentRequest(
        studentId="student-1", chapterId="rational-numbers", mode="practice", questionCount=5,
    )

    plan, outcome = session_planning_pipeline.plan_session(request, seed="fixed")

    assert plan.mode == "practice"
    assert outcome.actualCount == 5
    assert outcome.shortfall is False


def test_shortfall_when_requesting_more_than_the_chapter_contains() -> None:
    request = AssessmentRequest(
        studentId="student-1", chapterId="rational-numbers", mode="practice", questionCount=100,
    )

    plan, outcome = session_planning_pipeline.plan_session(request, seed="fixed")

    assert outcome.actualCount == 40
    assert outcome.shortfall is True


def test_explicit_single_difficulty_still_backfills_from_other_tiers_when_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # No real chapter has a zero-Hard tier any more, so this scenario is
    # exercised against a monkeypatched candidate pool instead. Constraint
    # Resolver degrades uniformly regardless of whether the original request
    # was Mixed or a specific tier (see constraint_resolver.py's module
    # docstring) - the student still gets a full session, just not all-Hard.
    synthetic_candidates = [
        QuestionCandidate(
            id=f"synthetic-q{i}", chapterId="practical-geometry", topicId=None,
            difficulty=difficulty, type=None, sourceType="canonical", reviewStatus="approved",
        )
        for i, difficulty in enumerate(["Easy", "Easy", "Medium", "Medium"])
    ]
    monkeypatch.setattr(content_repository, "get_candidates", lambda *args, **kwargs: synthetic_candidates)

    request = AssessmentRequest(
        studentId="student-1", chapterId="practical-geometry", mode="practice",
        difficulty="Hard", questionCount=3,
    )

    plan, outcome = session_planning_pipeline.plan_session(request, seed="fixed")

    assert outcome.actualCount == 3
    assert outcome.shortfall is False
    assert all(q.difficulty != "Hard" for q in outcome.selectedQuestions)


def test_revision_mode_scopes_to_weak_topics_from_real_attempt_history() -> None:
    for is_correct in [False, False, False]:
        attempt_service.record_attempt(
            student_id="student-1", question_id="q1", chapter_id="rational-numbers",
            topic_id="topic-rational-numbers-properties-and-operations", difficulty="Easy",
            is_correct=is_correct, attempt_number=1,
        )

    request = AssessmentRequest(studentId="student-1", chapterId="rational-numbers", mode="revision")
    plan, outcome = session_planning_pipeline.plan_session(request, seed="fixed")

    assert plan.weakConceptTopicIds == ["topic-rational-numbers-properties-and-operations"]
    assert outcome.actualCount > 0


def test_revision_mode_for_a_first_time_student_degrades_gracefully() -> None:
    request = AssessmentRequest(studentId="student-1", chapterId="rational-numbers", mode="revision")

    plan, outcome = session_planning_pipeline.plan_session(request, seed="fixed")

    assert plan.weakConceptTopicIds == []
    # No topic restriction applied when there's nothing weak yet - falls
    # back to drawing from the whole chapter rather than erroring.
    assert outcome.actualCount > 0


def test_same_request_and_seed_produce_identical_outcomes() -> None:
    request = AssessmentRequest(
        studentId="student-1", chapterId="linear-equations", mode="practice", questionCount=10,
    )

    _, outcome_a = session_planning_pipeline.plan_session(request, seed="reproducible-seed")
    _, outcome_b = session_planning_pipeline.plan_session(request, seed="reproducible-seed")

    ids_a = [q.questionId for q in outcome_a.selectedQuestions]
    ids_b = [q.questionId for q in outcome_b.selectedQuestions]
    assert ids_a == ids_b


def test_recent_questions_are_excluded_from_a_new_practice_session() -> None:
    attempt_service.record_attempt(
        student_id="student-1", question_id="rn-q01", chapter_id="rational-numbers",
        topic_id="topic-rational-numbers-properties-and-operations", difficulty="Easy", is_correct=True, attempt_number=1,
    )

    request = AssessmentRequest(
        studentId="student-1", chapterId="rational-numbers", mode="practice",
        difficulty="Easy", questionCount=3,
    )
    plan, outcome = session_planning_pipeline.plan_session(request, seed="fixed")

    selected_ids = [q.questionId for q in outcome.selectedQuestions]
    assert "rn-q01" not in selected_ids


def test_test_mode_time_limit_flows_through_the_whole_pipeline() -> None:
    request = AssessmentRequest(
        studentId="student-1", chapterId="linear-equations", mode="test",
        timeLimitMinutes=15, questionCount=10,
    )

    plan, outcome = session_planning_pipeline.plan_session(request, seed="fixed")

    assert plan.timeLimitMinutes == 15
    assert outcome.shortfall is False
