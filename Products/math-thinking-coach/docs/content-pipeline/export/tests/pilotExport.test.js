// Slice A1: end-to-end regression pin for the real, migrated A Square and A
// Cube pilot chapter - runs the actual Stage 10 phases (the same functions
// run.js composes, in dry-run style: no writes) against the real
// docs/content-source/squares-and-cubes/ files and the real Pydantic
// schemas via the backend venv. Fails loudly if a future edit to the
// migrated content or the pipeline code silently breaks the pilot.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { loadCanonical } = require('../loadCanonical');
const { applyApprovalGate } = require('../approvalGate');
const { validateReferences } = require('../referentialValidation');
const { validateConceptReferences } = require('../conceptReferentialValidation');
const { transformTopic, transformQuestion } = require('../transform');
const { validateAgainstRuntimeSchemas } = require('../pydanticValidate');
const { readExisting } = require('../mergeAndWrite');

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const chapterDir = path.join(repoRoot, 'docs', 'content-source', 'squares-and-cubes');
const backendDir = path.join(repoRoot, 'backend');
const dataDir = path.join(backendDir, 'app', 'data');

function runPilotPipeline() {
  const { topic, questionBank, chapters } = loadCanonical({ chapterDir, dataDir });
  const { approvedTopic, approvedQuestions } = applyApprovalGate({ topic, questionBank });
  const existingTopics = readExisting(path.join(dataDir, 'topics.json'));
  const { topicChapterId, questionChapterId, topicId } = validateReferences({
    topic,
    approvedTopic,
    approvedQuestions,
    questionBankTopicId: questionBank.topicId,
    chapters,
    existingTopics,
  });
  validateConceptReferences({ topic, questionBank });

  const transformedTopic = approvedTopic ? transformTopic(approvedTopic) : null;
  const transformedQuestions = approvedQuestions.map((q) =>
    transformQuestion(q, { chapterId: questionChapterId, topicId })
  );

  return { transformedTopic, transformedQuestions, topicChapterId };
}

test('pilot export: loads and validates without throwing (canonical content is well-formed)', () => {
  assert.doesNotThrow(runPilotPipeline);
});

test('pilot export: produces exactly 4 concepts, each with a non-empty learningObjectives list, and 4 worked examples', () => {
  const { transformedTopic } = runPilotPipeline();
  assert.equal(transformedTopic.concepts.length, 4);
  for (const concept of transformedTopic.concepts) {
    assert.ok(concept.learningObjectives.length > 0, `concept "${concept.id}" has no learning objectives`);
  }
  assert.equal(transformedTopic.workedExamples.length, 4);
});

test('pilot export: legacy explanation/workedExampleContent/learningObjectives are still populated (additive, not replaced)', () => {
  const { transformedTopic } = runPilotPipeline();
  assert.ok(transformedTopic.explanation.length > 0);
  assert.ok(transformedTopic.workedExampleContent.length > 0);
  assert.equal(transformedTopic.learningObjectives.length, 11);
});

test('pilot export: produces exactly 40 questions, every one carrying exactly one objectiveId and no legacy "objective" field', () => {
  const { transformedQuestions } = runPilotPipeline();
  assert.equal(transformedQuestions.length, 40);
  for (const q of transformedQuestions) {
    assert.ok(Array.isArray(q.objectiveIds) && q.objectiveIds.length === 1, `question "${q.id}" missing exactly one objectiveId`);
    assert.equal('objective' in q, false, `question "${q.id}" still carries the legacy "objective" field`);
  }
});

test('pilot export: pins the exact objective:N -> objectiveId mapping for a spot-checked sample of questions', () => {
  const { transformedQuestions } = runPilotPipeline();
  const byId = Object.fromEntries(transformedQuestions.map((q) => [q.id, q.objectiveIds[0]]));

  // Spot-check against the original objective:N values from the
  // pre-migration file (sc-q01=1, sc-q07=4, sc-q19=8, sc-q31=9, sc-q40=11).
  assert.equal(byId['sc-q01'], 'obj-squares-unit-digit');
  assert.equal(byId['sc-q07'], 'obj-squares-pythagorean-triplet');
  assert.equal(byId['sc-q19'], 'obj-square-roots-smallest-multiplier');
  assert.equal(byId['sc-q31'], 'obj-cubes-prime-factorisation');
  assert.equal(byId['sc-q40'], 'obj-cube-roots-prime-factorisation');
});

test('pilot export: validates against the real backend Pydantic schemas', () => {
  const { transformedTopic, transformedQuestions } = runPilotPipeline();
  const result = validateAgainstRuntimeSchemas({
    backendDir,
    chapters: [],
    topics: [transformedTopic],
    questions: transformedQuestions,
  });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});
