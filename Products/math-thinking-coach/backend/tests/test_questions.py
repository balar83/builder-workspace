import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.question import Question
from app.services import question_service

client = TestClient(app)


def test_list_questions_returns_questions_for_chapter() -> None:
    response = client.get("/api/v1/chapters/rational-numbers/questions")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 40
    assert all(question["chapterId"] == "rational-numbers" for question in body)


def test_list_questions_returns_404_for_unknown_chapter() -> None:
    response = client.get("/api/v1/chapters/unknown-chapter/questions")

    assert response.status_code == 404


def test_get_question_returns_single_question() -> None:
    response = client.get("/api/v1/chapters/rational-numbers/questions/rn-q01")

    assert response.status_code == 200
    assert response.json()["solution"] == "Yes"


def test_get_question_returns_404_for_unknown_question() -> None:
    response = client.get("/api/v1/chapters/rational-numbers/questions/unknown-question")

    assert response.status_code == 404


def test_get_question_returns_404_for_unknown_chapter() -> None:
    response = client.get("/api/v1/chapters/unknown-chapter/questions/q1-rational-numbers")

    assert response.status_code == 404


def test_get_question_returns_objective_ids_for_the_migrated_pilot_chapter() -> None:
    """Slice A1: squares-and-cubes questions carry the new, optional
    objectiveIds relationship after migration; every question has exactly
    one, matching the mechanical objective:N -> objectiveIds mapping."""
    response = client.get("/api/v1/chapters/squares-and-cubes/questions/sc-q07")

    assert response.status_code == 200
    assert response.json()["objectiveIds"] == ["obj-squares-pythagorean-triplet"]


def test_get_question_returns_objective_ids_for_rational_numbers() -> None:
    """Slice A2b-4: rational-numbers is the final chapter migrated to
    structured content; its questions now carry objectiveIds, mirroring the
    squares-and-cubes assertion above."""
    response = client.get("/api/v1/chapters/rational-numbers/questions/rn-q01")

    assert response.status_code == 200
    assert response.json()["objectiveIds"] == ["obj-rn-definition"]


def test_get_question_objective_ids_is_null_for_a_legacy_shaped_question(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Slice A2b-4 migrated the last real legacy Topic-bearing chapter
    (Rational Numbers), so this regression pin now uses a synthetic fixture
    instead of a real chapter, the same shift test_topics.py and the Stage 10
    pipeline suite's legacyExport.test.js made in this same slice."""
    legacy_question = Question(
        id="q-fixture-legacy-for-tests",
        chapterId="rational-numbers",
        question="Fixture prompt?",
        text="Fixture prompt?",
        difficulty="Easy",
        hints=["Fixture hint."],
        solution="Fixture solution.",
    )
    monkeypatch.setattr(question_service, "_questions", question_service._questions + [legacy_question])

    response = client.get("/api/v1/chapters/rational-numbers/questions/q-fixture-legacy-for-tests")

    assert response.status_code == 200
    assert response.json()["objectiveIds"] is None
