from fastapi.testclient import TestClient

from app.main import app

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


def test_get_topic_defaults_structured_fields_to_empty_for_a_not_yet_migrated_chapter() -> None:
    """Rational Numbers has a Topic but hasn't been migrated in A1 - it must
    keep working exactly as before, with concepts/workedExamples empty."""
    response = client.get("/api/v1/topics/topic-rational-numbers-properties-and-operations")

    assert response.status_code == 200
    body = response.json()
    assert body["concepts"] == []
    assert body["workedExamples"] == []
    assert len(body["learningObjectives"]) > 0
