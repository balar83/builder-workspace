// Slice A1 corrective: end-to-end regression pin proving a real,
// not-yet-migrated Topic-bearing chapter remains re-exportable through the
// real Stage 10 phases (dry-run style: no writes) - the exact operational
// gap the Product Architect flagged after reviewing the initial A1
// implementation. Rational Numbers is the primary case (explicitly named in
// the corrective brief); Linear Equations is a second, independent chapter
// spot-checked for extra confidence.

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
const backendDir = path.join(repoRoot, 'backend');
const dataDir = path.join(backendDir, 'app', 'data');

function runChapterPipeline(chapterSlug) {
  const chapterDir = path.join(repoRoot, 'docs', 'content-source', chapterSlug);
  const { topic, questionBank, chapters } = loadCanonical({ chapterDir, dataDir });
  const { approvedTopic, approvedQuestions } = applyApprovalGate({ topic, questionBank });
  const existingTopics = readExisting(path.join(dataDir, 'topics.json'));
  const { questionChapterId, topicId } = validateReferences({
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

  return { transformedTopic, transformedQuestions };
}

test('legacy export (rational-numbers): loads and validates without throwing - not yet migrated, must not require migration first', () => {
  assert.doesNotThrow(() => runChapterPipeline('rational-numbers'));
});

test('legacy export (rational-numbers): produces a topic with empty structured fields and populated legacy fields', () => {
  const { transformedTopic } = runChapterPipeline('rational-numbers');
  assert.deepEqual(transformedTopic.concepts, []);
  assert.deepEqual(transformedTopic.workedExamples, []);
  assert.ok(transformedTopic.explanation.length > 0);
  assert.ok(transformedTopic.learningObjectives.length > 0);
  assert.ok(transformedTopic.learningObjectives.every((o) => typeof o === 'string'));
});

test('legacy export (rational-numbers): questions have no objectiveIds and validate against the real Pydantic schemas', () => {
  const { transformedTopic, transformedQuestions } = runChapterPipeline('rational-numbers');
  assert.ok(transformedQuestions.length > 0);
  assert.ok(transformedQuestions.every((q) => !('objectiveIds' in q)));

  const result = validateAgainstRuntimeSchemas({
    backendDir,
    chapters: [],
    topics: [transformedTopic],
    questions: transformedQuestions,
  });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('legacy export (linear-equations): a second, independent un-migrated chapter is also unaffected', () => {
  const { transformedTopic, transformedQuestions } = runChapterPipeline('linear-equations');
  assert.deepEqual(transformedTopic.concepts, []);
  assert.ok(transformedQuestions.length > 0);

  const result = validateAgainstRuntimeSchemas({
    backendDir,
    chapters: [],
    topics: [transformedTopic],
    questions: transformedQuestions,
  });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});
