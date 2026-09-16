from app.schemas.performance import ConceptPerformance
from app.services import attempt_service, question_service, topic_service


def get_concept_performance(student_id: str) -> list[ConceptPerformance]:
    """
    Read-time join only (D1): attempt -> question.objectiveIds -> learning
    objective -> concept -> topic. Deliberately not denormalized onto
    `attempts` - accepted tradeoff is that retagging a question's
    objectiveIds later re-attributes its historical attempts the next time
    this is computed, since there is no stored record of what a question's
    objectiveIds were at attempt time.

    Cross-concept attribution rule: a question's distinct concepts (via its
    objectiveIds, deduplicated - two objectives in the same concept count
    once) each receive the attempt's full, unsplit correctness outcome.
    Concept aggregates are therefore not disjoint and must not be summed
    to a chapter total (le-q30 is the one production question spanning two
    concepts today).
    """
    objective_to_concept, concept_meta = _build_content_index()

    attempted: dict[str, int] = {}
    correct: dict[str, int] = {}

    for question_id, is_correct in attempt_service.get_question_outcomes(student_id):
        question = question_service.get_question_by_id(question_id)
        if question is None or not question.objectiveIds:
            continue

        concept_ids = {
            objective_to_concept[objective_id]
            for objective_id in question.objectiveIds
            if objective_id in objective_to_concept
        }

        for concept_id in concept_ids:
            attempted[concept_id] = attempted.get(concept_id, 0) + 1
            if is_correct:
                correct[concept_id] = correct.get(concept_id, 0) + 1

    return [
        ConceptPerformance(
            conceptId=concept_id,
            conceptTitle=concept_meta[concept_id]["title"],
            topicId=concept_meta[concept_id]["topicId"],
            chapterId=concept_meta[concept_id]["chapterId"],
            questionsAttempted=count,
            questionsCorrect=correct.get(concept_id, 0),
            accuracy=round(correct.get(concept_id, 0) / count, 4),
        )
        for concept_id, count in attempted.items()
    ]


def _build_content_index() -> tuple[dict[str, str], dict[str, dict]]:
    """
    objectiveId -> conceptId, and conceptId -> display metadata, built from
    every chapter's Topic(s). A chapter with no Topic (Practical Geometry)
    contributes nothing here, which is exactly why its questions - already
    carrying no objectiveIds - never produce a concept breakdown; no
    separate topic-less special case is needed.
    """
    objective_to_concept: dict[str, str] = {}
    concept_meta: dict[str, dict] = {}

    for chapter in question_service.get_chapters():
        for topic in topic_service.get_topics(chapter.id):
            for concept in topic.concepts:
                concept_meta[concept.id] = {
                    "title": concept.title,
                    "topicId": topic.id,
                    "chapterId": topic.chapterId,
                }
                for objective in concept.learningObjectives:
                    objective_to_concept[objective.id] = concept.id

    return objective_to_concept, concept_meta
