from pathlib import Path

import pytest

from app.services import attempt_service, concept_performance_service

# Real production content ids (backend/app/data/questions.json), not
# fabricated - D1's authorization requires exercising the actual content
# relationships, not synthetic stand-ins.
#
# le-q01:  1 objectiveId  -> concept-le-transposition (single concept)
# le-q21:  2 objectiveIds -> both concept-le-basics (same concept - counts once)
# le-q30:  2 objectiveIds -> concept-le-basics AND concept-le-reducing (genuine cross-concept)
# sc-q41:  no objectiveIds (untagged Squares & Cubes content gap)
# pg-q01:  Practical Geometry - no Topic/concepts exist for this chapter at all


@pytest.fixture(autouse=True)
def _isolate_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(attempt_service, "DB_PATH", tmp_path / "runtime.db")


def _record(question_id: str, is_correct: bool, chapter_id: str = "linear-equations") -> None:
    attempt_service.record_attempt(
        student_id="student-1",
        question_id=question_id,
        chapter_id=chapter_id,
        difficulty="Easy",
        is_correct=is_correct,
        attempt_number=1,
    )


def test_returns_empty_list_for_a_student_with_no_attempts() -> None:
    assert concept_performance_service.get_concept_performance("student-1") == []


def test_single_objective_question_attributes_to_its_one_concept() -> None:
    _record("le-q01", is_correct=True)

    performance = concept_performance_service.get_concept_performance("student-1")

    assert len(performance) == 1
    assert performance[0].conceptId == "concept-le-transposition"
    assert performance[0].questionsAttempted == 1
    assert performance[0].questionsCorrect == 1
    assert performance[0].accuracy == 1.0
    assert performance[0].topicId == "topic-linear-equations-one-variable"
    assert performance[0].chapterId == "linear-equations"


def test_multiple_objectives_in_the_same_concept_count_once_not_twice() -> None:
    # le-q21's two objectiveIds (obj-le-expression-vs-equation,
    # obj-le-identify-linear) both belong to concept-le-basics.
    _record("le-q21", is_correct=True)

    performance = concept_performance_service.get_concept_performance("student-1")
    by_concept = {row.conceptId: row for row in performance}

    assert len(performance) == 1
    assert by_concept["concept-le-basics"].questionsAttempted == 1


def test_cross_concept_question_posts_its_full_outcome_to_each_distinct_concept() -> None:
    # le-q30 spans concept-le-basics and concept-le-reducing - per D1's
    # attribution rule, the single wrong answer counts as a full incorrect
    # attempt against BOTH concepts, never split.
    _record("le-q30", is_correct=False)

    performance = concept_performance_service.get_concept_performance("student-1")
    by_concept = {row.conceptId: row for row in performance}

    assert len(performance) == 2
    assert by_concept["concept-le-basics"].questionsAttempted == 1
    assert by_concept["concept-le-basics"].questionsCorrect == 0
    assert by_concept["concept-le-reducing"].questionsAttempted == 1
    assert by_concept["concept-le-reducing"].questionsCorrect == 0


def test_a_question_with_no_objective_ids_is_excluded_not_an_error() -> None:
    _record("sc-q41", is_correct=True, chapter_id="squares-and-cubes")

    assert concept_performance_service.get_concept_performance("student-1") == []


def test_a_topic_less_chapter_produces_no_concept_breakdown() -> None:
    _record("pg-q01", is_correct=True, chapter_id="practical-geometry")

    assert concept_performance_service.get_concept_performance("student-1") == []


def test_accuracy_reflects_a_mix_of_correct_and_incorrect_attempts_on_one_concept() -> None:
    _record("le-q01", is_correct=True)
    _record("le-q01", is_correct=False)
    _record("le-q01", is_correct=True)

    performance = concept_performance_service.get_concept_performance("student-1")

    assert performance[0].questionsAttempted == 3
    assert performance[0].questionsCorrect == 2
    assert performance[0].accuracy == pytest.approx(2 / 3, rel=1e-4)


def test_concepts_aggregate_independently_across_different_questions() -> None:
    _record("le-q01", is_correct=True)  # concept-le-transposition
    _record("le-q30", is_correct=False)  # concept-le-basics + concept-le-reducing

    performance = concept_performance_service.get_concept_performance("student-1")
    by_concept = {row.conceptId: row for row in performance}

    assert by_concept["concept-le-transposition"].questionsCorrect == 1
    assert by_concept["concept-le-basics"].questionsCorrect == 0
    assert by_concept["concept-le-reducing"].questionsCorrect == 0


def test_performance_is_scoped_to_the_requesting_student() -> None:
    _record("le-q01", is_correct=True)

    assert concept_performance_service.get_concept_performance("student-2") == []


def test_an_unknown_question_id_is_excluded_not_an_error() -> None:
    _record("does-not-exist", is_correct=True)

    assert concept_performance_service.get_concept_performance("student-1") == []
