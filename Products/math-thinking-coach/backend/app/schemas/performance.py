from pydantic import BaseModel


class TopicPerformance(BaseModel):
    topicId: str
    questionsAttempted: int
    questionsCorrect: int
    accuracy: float
    currentStreak: int
    mastered: bool
