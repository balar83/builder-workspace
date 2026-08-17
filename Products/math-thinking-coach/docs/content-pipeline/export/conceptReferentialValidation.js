// Phase [3] (extension): concept/objective referential validation, plus
// rejection of the legacy integer "objective" field - both apply only to a
// Topic that has entered structured migration (topicMigrationState.js). A
// legacy (not-yet-migrated) Topic has no conceptIds/objectiveIds to resolve
// against and must continue to permit the legacy "objective" field - it
// receives no structured checks here at all, so it remains re-exportable
// without being migrated first (Slice A1 corrective;
// docs/Structured-Learning-Content-Design-Proposal.md §I/§K).
//
// Same aggregated-issues pattern as referentialValidation.js's chapter/topic
// checks - a failure here aborts the export loudly, before transform,
// exactly like a bad topicId does.
//
// Concepts/objectives are entirely self-contained within one
// canonical-topic.json, so (unlike topicId/chapterId resolution) this never
// needs to look at existing runtime data or other chapters - only this
// chapter's own topic and question bank.
//
// Runs only when `topic` is non-null - a chapter with no Topic at all (e.g.
// Practical Geometry) is unaffected, matching run-topicless.js.

const { ExportValidationError } = require('./loadCanonical');
const { detectTopicMigrationState } = require('./topicMigrationState');

function collectConceptIds(topic) {
  const ids = new Set();
  for (const section of topic.explanation.sections) {
    ids.add(section.id);
  }
  return ids;
}

function collectObjectiveIds(topic) {
  const ids = new Set();
  for (const group of topic.learningObjectives) {
    for (const objective of group.objectives) {
      ids.add(objective.id);
    }
  }
  return ids;
}

function validateConceptReferences({ topic, questionBank }) {
  if (!topic) return;

  // loadCanonical.js's phase-1 structural check already threw if this
  // Topic's migration state were ambiguous (mixed legacy/structured), so by
  // the time execution reaches here `state` is always 'legacy' or
  // 'structured', never null - re-checked defensively rather than assumed,
  // since this function has its own explicit contract independent of
  // caller order.
  const { state, issues: stateIssues } = detectTopicMigrationState(topic);
  if (state === null) {
    throw new ExportValidationError('concept-referential', stateIssues);
  }

  if (state === 'legacy') {
    // Nothing to check: a legacy Topic has no conceptIds/objectiveIds, and
    // its questions' legacy "objective" field is explicitly still allowed.
    return;
  }

  const issues = [];
  const conceptIds = collectConceptIds(topic);
  const objectiveIds = collectObjectiveIds(topic);

  topic.workedExamples.forEach((we, i) => {
    if (!conceptIds.has(we.conceptId)) {
      issues.push(
        `canonical-topic.json workedExamples[${i}] ("${we.id}") references conceptId "${we.conceptId}", which does not resolve to any section in this topic`
      );
    }
  });

  topic.learningObjectives.forEach((group, i) => {
    if (!conceptIds.has(group.conceptId)) {
      issues.push(
        `canonical-topic.json learningObjectives[${i}] references conceptId "${group.conceptId}", which does not resolve to any section in this topic`
      );
    }
  });

  const questions = (questionBank && Array.isArray(questionBank.questions)) ? questionBank.questions : [];
  questions.forEach((q, i) => {
    if (Object.prototype.hasOwnProperty.call(q, 'objective')) {
      issues.push(
        `stage6-questions.json questions[${i}] ("${q.id}") carries the legacy integer "objective" field, which is not allowed once this chapter's Topic has structured concepts - use "objectiveIds" instead`
      );
    }

    if (q.objectiveIds !== undefined && q.objectiveIds !== null) {
      if (!Array.isArray(q.objectiveIds)) {
        issues.push(`stage6-questions.json questions[${i}] ("${q.id}") has an "objectiveIds" field that is not an array`);
      } else {
        q.objectiveIds.forEach((objectiveId) => {
          if (!objectiveIds.has(objectiveId)) {
            issues.push(
              `stage6-questions.json questions[${i}] ("${q.id}") references objectiveIds "${objectiveId}", which does not resolve to any learning objective in this topic`
            );
          }
        });
      }
    }
  });

  if (issues.length > 0) {
    throw new ExportValidationError('concept-referential', issues);
  }
}

module.exports = { validateConceptReferences };
