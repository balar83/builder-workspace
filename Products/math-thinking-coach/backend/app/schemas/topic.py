from pydantic import BaseModel, Field


class LearningObjective(BaseModel):
    id: str
    text: str


class Concept(BaseModel):
    id: str
    title: str
    body: str
    learningObjectives: list[LearningObjective]


class WorkedExample(BaseModel):
    id: str
    conceptId: str
    problem: str
    steps: list[str]
    finalAnswer: str


class Topic(BaseModel):
    id: str
    chapterId: str
    title: str
    explanation: str
    workedExampleContent: str
    learningObjectives: list[str]
    # Additive, Slice A1 (Structured Learning Content Foundation): structured
    # equivalents of the three legacy fields above. Default to an empty list
    # so existing runtime topics.json entries for not-yet-migrated chapters
    # (only squares-and-cubes is migrated in A1) keep validating unchanged.
    # explanation/workedExampleContent/learningObjectives are removed only in
    # Slice A3, once every Topic-bearing chapter has migrated - see
    # docs/Structured-Learning-Content-Design-Proposal.md §K/§M.
    concepts: list[Concept] = Field(default_factory=list)
    workedExamples: list[WorkedExample] = Field(default_factory=list)
