from pydantic import BaseModel


class Chapter(BaseModel):
    id: str
    title: str
    description: str
