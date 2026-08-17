from fastapi.testclient import TestClient

from app.main import app

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


def test_get_question_objective_ids_is_null_for_a_not_yet_migrated_chapter() -> None:
    response = client.get("/api/v1/chapters/rational-numbers/questions/rn-q01")

    assert response.status_code == 200
    assert response.json()["objectiveIds"] is None
