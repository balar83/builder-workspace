// Phase [4]: whitelist transformation. Deliberately no spread operator
// anywhere in this file — every runtime object is built field-by-field, by
// name, from named canonical sources. A canonical field not explicitly read
// here cannot end up in runtime output; there is no code path that would
// carry it across. This is what makes "canonical metadata leak" and "unknown
// field in runtime JSON" structurally impossible rather than merely checked.
//
// Slice A1 (Structured Learning Content Foundation): transformTopic now
// additionally emits structured concepts/workedExamples alongside the
// legacy explanation/workedExampleContent/learningObjectives strings - both
// shapes are populated from the same canonical source, for a Topic that has
// actually been migrated. The legacy fields are retained deliberately
// (Slice A1 is additive; removal is Slice A3, see
// docs/Structured-Learning-Content-Design-Proposal.md §K/§M) and are NOT
// removed here.
//
// Slice A1 corrective: a Topic that has NOT been migrated
// (topicMigrationState.js: 'legacy') has bare-string objectives and no
// id/conceptId fields at all - it is transformed exactly as the original,
// pre-A1 transform.js did, with empty structured fields. Only a 'structured'
// (migrated) Topic gets the new concepts/workedExamples projection.

const { detectTopicMigrationState } = require('./topicMigrationState');

function formatWorkedExample(example) {
  const stepLines = [];
  for (let i = 0; i < example.steps.length; i++) {
    stepLines.push('Step ' + (i + 1) + ': ' + example.steps[i]);
  }
  return example.problem + '\n\n' + stepLines.join('\n') + '\n\n' + example.finalAnswer;
}

function findObjectiveGroup(learningObjectives, conceptId) {
  for (const group of learningObjectives) {
    if (group.conceptId === conceptId) return group;
  }
  return null;
}

function transformLegacyTopic(canonicalTopic) {
  const sectionBodies = [];
  for (const section of canonicalTopic.explanation.sections) {
    sectionBodies.push(section.body);
  }
  const explanation = sectionBodies.join('\n\n');

  const exampleBlocks = [];
  for (const example of canonicalTopic.workedExamples) {
    exampleBlocks.push(formatWorkedExample(example));
  }
  const workedExampleContent = exampleBlocks.join('\n\n---\n\n');

  const legacyLearningObjectives = [];
  for (const group of canonicalTopic.learningObjectives) {
    for (const objective of group.objectives) {
      legacyLearningObjectives.push(objective);
    }
  }

  return {
    id: canonicalTopic.id,
    chapterId: canonicalTopic.chapterId,
    title: canonicalTopic.title,
    explanation: explanation,
    workedExampleContent: workedExampleContent,
    learningObjectives: legacyLearningObjectives,
    concepts: [],
    workedExamples: [],
  };
}

function transformStructuredTopic(canonicalTopic) {
  // Legacy string fields (retained during Slice A1 - deleted only in Slice
  // A3), generated from the same structured canonical source.
  const sectionBodies = [];
  for (const section of canonicalTopic.explanation.sections) {
    sectionBodies.push(section.body);
  }
  const explanation = sectionBodies.join('\n\n');

  const exampleBlocks = [];
  for (const example of canonicalTopic.workedExamples) {
    exampleBlocks.push(formatWorkedExample(example));
  }
  const workedExampleContent = exampleBlocks.join('\n\n---\n\n');

  const legacyLearningObjectives = [];
  for (const group of canonicalTopic.learningObjectives) {
    for (const objective of group.objectives) {
      legacyLearningObjectives.push(objective.text);
    }
  }

  // Structured shape (new, Slice A1).
  const concepts = [];
  for (const section of canonicalTopic.explanation.sections) {
    const group = findObjectiveGroup(canonicalTopic.learningObjectives, section.id);
    const learningObjectives = [];
    if (group) {
      for (const objective of group.objectives) {
        learningObjectives.push({ id: objective.id, text: objective.text });
      }
    }
    concepts.push({
      id: section.id,
      title: section.title,
      body: section.body,
      learningObjectives: learningObjectives,
    });
  }

  const workedExamples = [];
  for (const example of canonicalTopic.workedExamples) {
    workedExamples.push({
      id: example.id,
      conceptId: example.conceptId,
      problem: example.problem,
      steps: example.steps,
      finalAnswer: example.finalAnswer,
    });
  }

  return {
    id: canonicalTopic.id,
    chapterId: canonicalTopic.chapterId,
    title: canonicalTopic.title,
    explanation: explanation,
    workedExampleContent: workedExampleContent,
    learningObjectives: legacyLearningObjectives,
    concepts: concepts,
    workedExamples: workedExamples,
  };
}

function transformTopic(canonicalTopic) {
  const { state } = detectTopicMigrationState(canonicalTopic);
  // loadCanonical.js's phase-1 structural check already threw if state were
  // ambiguous (mixed legacy/structured) - transform.js only ever runs on
  // content that already passed that gate, so state is 'legacy' or
  // 'structured' here, never null.
  return state === 'structured' ? transformStructuredTopic(canonicalTopic) : transformLegacyTopic(canonicalTopic);
}

function transformQuestion(canonicalQuestion, context) {
  const hints = [];
  for (const hint of canonicalQuestion.hints) {
    hints.push(hint);
  }

  const question = {
    id: canonicalQuestion.id,
    chapterId: context.chapterId,
    question: canonicalQuestion.prompt,
    text: canonicalQuestion.prompt,
    difficulty: canonicalQuestion.difficulty,
    hints: hints,
    solution: canonicalQuestion.expectedAnswer,
    topicId: context.topicId,
  };

  // Additive, optional (Slice A1) - only set when the canonical question
  // actually carries it, so an un-migrated chapter's questions keep
  // producing exactly the same runtime shape as before this slice.
  if (canonicalQuestion.objectiveIds !== undefined) {
    const objectiveIds = [];
    for (const id of canonicalQuestion.objectiveIds) {
      objectiveIds.push(id);
    }
    question.objectiveIds = objectiveIds;
  }

  return question;
}

module.exports = { transformTopic, transformQuestion, formatWorkedExample };
