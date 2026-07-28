// Phase [4]: whitelist transformation. Deliberately no spread operator
// anywhere in this file — every runtime object is built field-by-field, by
// name, from named canonical sources. A canonical field not explicitly read
// here cannot end up in runtime output; there is no code path that would
// carry it across. This is what makes "canonical metadata leak" and "unknown
// field in runtime JSON" structurally impossible rather than merely checked.

function formatWorkedExample(example) {
  const stepLines = [];
  for (let i = 0; i < example.steps.length; i++) {
    stepLines.push('Step ' + (i + 1) + ': ' + example.steps[i]);
  }
  return example.problem + '\n\n' + stepLines.join('\n') + '\n\n' + example.finalAnswer;
}

function transformTopic(canonicalTopic) {
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

  const learningObjectives = [];
  for (const group of canonicalTopic.learningObjectives) {
    for (const objective of group.objectives) {
      learningObjectives.push(objective);
    }
  }

  return {
    id: canonicalTopic.id,
    chapterId: canonicalTopic.chapterId,
    title: canonicalTopic.title,
    explanation: explanation,
    workedExampleContent: workedExampleContent,
    learningObjectives: learningObjectives,
  };
}

function transformQuestion(canonicalQuestion, context) {
  const hints = [];
  for (const hint of canonicalQuestion.hints) {
    hints.push(hint);
  }

  return {
    id: canonicalQuestion.id,
    chapterId: context.chapterId,
    question: canonicalQuestion.prompt,
    text: canonicalQuestion.prompt,
    difficulty: canonicalQuestion.difficulty,
    hints: hints,
    solution: canonicalQuestion.expectedAnswer,
    topicId: context.topicId,
  };
}

module.exports = { transformTopic, transformQuestion, formatWorkedExample };
