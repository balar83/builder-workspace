import pytest
from pydantic import ValidationError

from app.schemas.question import Question
from app.schemas.topic import Concept, LearningObjective, Topic, WorkedExample


def _minimal_topic_kwargs() -> dict:
    return {
        "id": "topic-x",
        "chapterId": "chapter-x",
        "title": "Title",
        "explanation": "Explanation text.",
        "workedExampleContent": "Worked example text.",
        "learningObjectives": ["Objective text."],
    }


def test_topic_validates_with_only_legacy_fields_and_defaults_new_fields_to_empty() -> None:
    """An un-migrated chapter's Topic (no concepts/workedExamples key at all
    in the raw runtime JSON) must still validate - this is what keeps the
    4 not-yet-migrated Topic-bearing chapters loading unchanged in A1."""
    topic = Topic(**_minimal_topic_kwargs())

    assert topic.concepts == []
    assert topic.workedExamples == []
    assert topic.explanation == "Explanation text."


def test_topic_validates_with_structured_fields_populated() -> None:
    topic = Topic(
        **_minimal_topic_kwargs(),
        concepts=[
            Concept(
                id="concept-a",
                title="Concept A",
                body="Body A",
                learningObjectives=[LearningObjective(id="obj-a1", text="Do A")],
            )
        ],
        workedExamples=[
            WorkedExample(id="we-1", conceptId="concept-a", problem="P", steps=["S1"], finalAnswer="A")
        ],
    )

    assert len(topic.concepts) == 1
    assert topic.concepts[0].learningObjectives[0].id == "obj-a1"
    assert topic.workedExamples[0].conceptId == "concept-a"


@pytest.mark.parametrize(
    ("model", "kwargs"),
    [
        (LearningObjective, {"id": "obj-1"}),  # missing text
        (LearningObjective, {"text": "Do A"}),  # missing id
        (Concept, {"title": "T", "body": "B", "learningObjectives": []}),  # missing id
        (WorkedExample, {"conceptId": "c1", "problem": "P", "steps": [], "finalAnswer": "A"}),  # missing id
        (WorkedExample, {"id": "we-1", "problem": "P", "steps": [], "finalAnswer": "A"}),  # missing conceptId
    ],
)
def test_structured_models_reject_missing_required_fields(model, kwargs) -> None:
    with pytest.raises(ValidationError):
        model(**kwargs)


def test_topic_rejects_a_malformed_concept() -> None:
    with pytest.raises(ValidationError):
        Topic(**_minimal_topic_kwargs(), concepts=[{"id": "concept-a", "title": "T"}])  # missing body/learningObjectives


def test_question_objective_ids_defaults_to_none() -> None:
    question = Question(
        id="q1",
        chapterId="chapter-x",
        question="Q?",
        text="Q?",
        difficulty="Easy",
        hints=[],
        solution="A",
    )
    assert question.objectiveIds is None


def test_question_objective_ids_accepts_a_list_of_ids() -> None:
    question = Question(
        id="q1",
        chapterId="chapter-x",
        question="Q?",
        text="Q?",
        difficulty="Easy",
        hints=[],
        solution="A",
        objectiveIds=["obj-a1", "obj-a2"],
    )
    assert question.objectiveIds == ["obj-a1", "obj-a2"]
