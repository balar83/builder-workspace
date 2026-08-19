import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.topic import Topic
from app.services import topic_service

client = TestClient(app)


def test_list_topics_returns_topics_for_chapter() -> None:
    response = client.get("/api/v1/chapters/rational-numbers/topics")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == "topic-rational-numbers-properties-and-operations"


def test_list_topics_returns_empty_list_for_chapter_without_topics() -> None:
    response = client.get("/api/v1/chapters/practical-geometry/topics")

    assert response.status_code == 200
    assert response.json() == []


def test_list_topics_returns_404_for_unknown_chapter() -> None:
    response = client.get("/api/v1/chapters/unknown-chapter/topics")

    assert response.status_code == 404


def test_get_topic_returns_single_topic() -> None:
    response = client.get("/api/v1/topics/topic-rational-numbers-properties-and-operations")

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Rational Numbers: Properties and Operations"
    assert body["chapterId"] == "rational-numbers"


def test_get_topic_returns_404_for_unknown_topic() -> None:
    response = client.get("/api/v1/topics/unknown-topic")

    assert response.status_code == 404


def test_get_topic_returns_structured_concepts_for_the_migrated_pilot_chapter() -> None:
    """Slice A1: squares-and-cubes is the pilot chapter, migrated to
    structured Concept/WorkedExample/LearningObjective. Both the new
    structured fields and the legacy joined-string fields must be present
    and correct (additive migration, §K)."""
    response = client.get("/api/v1/topics/topic-squares-and-cubes-numbers-and-roots")

    assert response.status_code == 200
    body = response.json()

    assert len(body["concepts"]) == 4
    first_concept = body["concepts"][0]
    assert first_concept["id"] == "concept-squares-properties"
    assert first_concept["title"] == "Square numbers and their properties"
    assert len(first_concept["learningObjectives"]) == 4
    assert first_concept["learningObjectives"][0]["id"] == "obj-squares-unit-digit"

    assert len(body["workedExamples"]) == 4
    assert body["workedExamples"][0]["conceptId"] == "concept-squares-properties"

    # Legacy fields still populated, unchanged in kind - not removed in A1.
    assert isinstance(body["explanation"], str) and len(body["explanation"]) > 0
    assert isinstance(body["workedExampleContent"], str) and len(body["workedExampleContent"]) > 0
    assert len(body["learningObjectives"]) == 11
    assert all(isinstance(o, str) for o in body["learningObjectives"])


def test_get_topic_returns_structured_concepts_for_rational_numbers() -> None:
    """Slice A2b-4: rational-numbers is the final chapter migrated to
    structured Concept/WorkedExample/LearningObjective - both the new
    structured fields and the legacy joined-string fields must be present
    and correct, mirroring the squares-and-cubes assertion above."""
    response = client.get("/api/v1/topics/topic-rational-numbers-properties-and-operations")

    assert response.status_code == 200
    body = response.json()

    assert len(body["concepts"]) == 5
    first_concept = body["concepts"][0]
    assert first_concept["id"] == "concept-rn-definition"
    assert first_concept["title"] == "What is a rational number?"
    assert len(first_concept["learningObjectives"]) == 2
    assert first_concept["learningObjectives"][0]["id"] == "obj-rn-definition"

    assert len(body["workedExamples"]) == 5
    assert body["workedExamples"][0]["conceptId"] == "concept-rn-definition"

    # Legacy fields still populated, unchanged in kind - not removed (Slice A3, not authorized).
    assert isinstance(body["explanation"], str) and len(body["explanation"]) > 0
    assert isinstance(body["workedExampleContent"], str) and len(body["workedExampleContent"]) > 0
    assert len(body["learningObjectives"]) == 11
    assert all(isinstance(o, str) for o in body["learningObjectives"])


def test_get_topic_defaults_structured_fields_to_empty_for_a_legacy_shaped_topic(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Slice A2b-4 migrated the last real legacy Topic-bearing chapter
    (Rational Numbers), so this regression pin - proving the API still
    correctly defaults concepts/workedExamples to [] for a legacy-shaped
    Topic - now uses a synthetic fixture instead of a real chapter, the same
    shift the Stage 10 pipeline suite's legacyExport.test.js made in this
    same slice. The legacy code path itself is unchanged, still real
    production architecture (removed only in Slice A3, not authorized)."""
    legacy_topic = Topic(
        id="topic-fixture-legacy-for-tests",
        chapterId="rational-numbers",
        title="Fixture Legacy Topic",
        explanation="Legacy explanation text.",
        workedExampleContent="Legacy worked example content.",
        learningObjectives=["Legacy objective."],
    )
    monkeypatch.setattr(topic_service, "_topics", topic_service._topics + [legacy_topic])

    response = client.get("/api/v1/topics/topic-fixture-legacy-for-tests")

    assert response.status_code == 200
    body = response.json()
    assert body["concepts"] == []
    assert body["workedExamples"] == []
    assert len(body["learningObjectives"]) > 0
