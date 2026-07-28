from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_list_topics_returns_topics_for_chapter() -> None:
    response = client.get("/api/v1/chapters/rational-numbers/topics")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == "topic-rational-numbers-basics"


def test_list_topics_returns_empty_list_for_chapter_without_topics() -> None:
    response = client.get("/api/v1/chapters/practical-geometry/topics")

    assert response.status_code == 200
    assert response.json() == []


def test_list_topics_returns_404_for_unknown_chapter() -> None:
    response = client.get("/api/v1/chapters/unknown-chapter/topics")

    assert response.status_code == 404


def test_get_topic_returns_single_topic() -> None:
    response = client.get("/api/v1/topics/topic-rational-numbers-basics")

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "What Are Rational Numbers?"
    assert body["chapterId"] == "rational-numbers"


def test_get_topic_returns_404_for_unknown_topic() -> None:
    response = client.get("/api/v1/topics/unknown-topic")

    assert response.status_code == 404
