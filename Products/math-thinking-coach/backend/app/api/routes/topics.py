from fastapi import APIRouter, HTTPException

from app.schemas.topic import Topic
from app.services import question_service, topic_service

router = APIRouter()


@router.get("/chapters/{chapter_id}/topics", response_model=list[Topic])
def list_topics(chapter_id: str) -> list[Topic]:
    if question_service.get_chapter(chapter_id) is None:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return topic_service.get_topics(chapter_id)


@router.get("/topics/{topic_id}", response_model=Topic)
def get_topic(topic_id: str) -> Topic:
    topic = topic_service.get_topic(topic_id)
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic
