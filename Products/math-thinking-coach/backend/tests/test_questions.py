from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_list_questions_returns_questions_for_chapter() -> None:
    response = client.get("/api/v1/chapters/rational-numbers/questions")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 5
    assert all(question["chapterId"] == "rational-numbers" for question in body)


def test_list_questions_returns_404_for_unknown_chapter() -> None:
    response = client.get("/api/v1/chapters/unknown-chapter/questions")

    assert response.status_code == 404


def test_get_question_returns_single_question() -> None:
    response = client.get("/api/v1/chapters/rational-numbers/questions/q1-rational-numbers")

    assert response.status_code == 200
    assert response.json()["solution"] == "1/3 + 1/6 = 2/6 + 1/6 = 3/6 = 1/2."


def test_get_question_returns_404_for_unknown_question() -> None:
    response = client.get("/api/v1/chapters/rational-numbers/questions/unknown-question")

    assert response.status_code == 404


def test_get_question_returns_404_for_unknown_chapter() -> None:
    response = client.get("/api/v1/chapters/unknown-chapter/questions/q1-rational-numbers")

    assert response.status_code == 404
