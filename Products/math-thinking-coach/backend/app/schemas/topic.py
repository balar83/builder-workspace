from pydantic import BaseModel


class Topic(BaseModel):
    id: str
    chapterId: str
    title: str
    explanation: str
    workedExampleContent: str
    learningObjectives: list[str]
