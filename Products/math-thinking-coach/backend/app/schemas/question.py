from typing import Literal

from pydantic import BaseModel

Difficulty = Literal["Easy", "Medium", "Hard"]

# Slice 1 (Question & Response Semantics, M2): the full durable taxonomy is
# named now so canonical content and tooling never have to guess at future
# values - only "short_text" and "numeric" have a registered evaluator
# (evaluation_service.py) in this slice. The other five are reserved,
# structurally valid values, but rejected at export time (loadCanonical.js)
# until their own slice implements them - see
# docs/Question-Response-Semantics-Design-Proposal.md §9/§17.
QuestionType = Literal[
    "short_text",
    "numeric",
    "single_choice",
    "multi_choice",
    "fill_blank",
    "matching",
    "multi_part",
]


class Option(BaseModel):
    """
    A single_choice answer option - public by design. The option's text
    must be shown to render the question at all; which option is correct
    never lives here (see ResponseSpecification's own docstring).
    """

    id: str
    text: str


class ResponseSpecification(BaseModel):
    """
    Deliberately minimal - only the parameters an implemented evaluator
    actually reads (numericTolerance for "numeric"; options for
    "single_choice"). Does NOT carry the expected answer itself: Question
    (and therefore ResponseSpecification) is returned by public GET routes,
    and the expected answer stays private in answer_keys.json (ADR-001) for
    every questionType. For single_choice specifically: `options` (the
    choice text) is legitimately public - a student must see the choices to
    pick one - but *which* option is correct is never represented here or
    anywhere else on Question; it is resolved only through
    evaluation_service.get_expected_answer(), exactly like every other
    type, where the private answer_keys.json value is simply the correct
    option's id (no second answer-key mechanism). See
    docs/Question-Response-Semantics-Design-Proposal.md Part II §B.
    """

    numericTolerance: float = 0.0
    options: list[Option] | None = None


class QuestionRemediation(BaseModel):
    """
    Self-Serve Learning Loop V1, Slice 5. Static authored remediation
    content (canonical `misconception` field, Stage 10 export's
    transformQuestion) - present only for the currently uneven subset of
    questions with authored content, never fabricated for the rest.
    `why`/`remediationHint` are always present together. commonWrongOptionId
    is present only for some single_choice questions with one specific
    authored distractor - answer_service.py uses it for an exact-match
    check against the learner's actual submission; its absence, or a
    submission that doesn't match it, doesn't disqualify remediation from
    being shown generically - see that module's own eligibility rule for
    the exact semantics. Deliberately does NOT carry commonWrongAnswer - an
    authoring/matching aid, not learner-facing content.
    """

    why: str
    remediationHint: str
    commonWrongOptionId: str | None = None


class Question(BaseModel):
    id: str
    chapterId: str
    question: str
    text: str
    difficulty: Difficulty
    hints: list[str]
    solution: str
    topicId: str | None = None
    # Additive, Slice A1: stable relationship to LearningObjective ids (§B of
    # Structured-Learning-Content-Design-Proposal.md). Unused by any service
    # in this slice - not evaluation, coaching, or session-planning semantics.
    objectiveIds: list[str] | None = None
    # Additive, Slice 1 (M2, Question & Response Semantics): defaults
    # preserve today's behavior exactly for all 241 existing questions, with
    # no canonical content edits required. See
    # docs/Question-Response-Semantics-Design-Proposal.md §4/§13.
    questionType: QuestionType = "short_text"
    responseSpecification: ResponseSpecification | None = None
    maxScore: float = 1.0
    # Additive, optional (Self-Serve Learning Loop V1, Slice 5). Present on
    # the full Question model (same public-exposure precedent as `solution`
    # itself, already returned by the public GET /chapters/.../questions
    # routes) - answer_service.py reads it from the already-loaded Question
    # to build the answer response's own, separate `remediation` field; it
    # is deliberately NOT propagated into session.py's QuestionContent
    # (the pre-answer, hand-curated question-serving shape), which already
    # doesn't propagate every Question field either.
    remediation: QuestionRemediation | None = None
