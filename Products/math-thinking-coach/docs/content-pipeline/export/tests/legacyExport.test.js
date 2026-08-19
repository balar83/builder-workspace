// Slice A1 corrective: end-to-end regression pin proving a legacy
// (not-yet-migrated) Topic shape remains fully re-exportable through the
// real Stage 10 phases (dry-run style: no writes) - the exact operational
// gap the Product Architect flagged after reviewing the initial A1
// implementation. Originally run against a real content-source chapter
// (Rational Numbers, then the sole remaining unmigrated Topic-bearing
// chapter); switched to the synthetic `legacyTopic()`/`legacyQuestionBank()`
// fixture (tests/fixtures.js) when Slice A2b-4 (2026-08-19) migrated
// Rational Numbers, leaving zero real production Topic-bearing chapters in
// the legacy shape. This is not a new pattern: `legacyTopic()`/
// `legacyQuestionBank()` and `writeChapterFixture()` already existed and are
// already used the same way by loadCanonical.test.js, transform.test.js,
// conceptReferentialValidation.test.js, and topicMigrationState.test.js -
// this file was the one outlier still pointed at a real chapter. The legacy
// code path itself (loadCanonical's legacy structural checks,
// conceptReferentialValidation's 'legacy' early-return, transformTopic's
// legacy branch) is unchanged, still real production architecture (removed
// only in Slice A3, not authorized), and still needs exactly this kind of
// full-pipeline-sequence proof - a synthetic fixture proves it as validly as
// a real chapter did, and is immune to a future real chapter's content
// drifting and silently invalidating the premise. See Development-Journal.md's
// 2026-08-19 (A2b-4) entry for the full record.

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
const { legacyTopic, legacyQuestionBank, writeChapterFixture } = require('./fixtures');

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const backendDir = path.join(repoRoot, 'backend');

function runFixturePipeline({ chapterDir, dataDir }) {
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

function legacyFixture() {
  return writeChapterFixture({ canonicalTopic: legacyTopic(), questionBank: legacyQuestionBank() });
}

test('legacy export (synthetic fixture): loads and validates without throwing - a legacy Topic shape must not require migration first', () => {
  assert.doesNotThrow(() => runFixturePipeline(legacyFixture()));
});

test('legacy export (synthetic fixture): produces a topic with empty structured fields and populated legacy fields', () => {
  const { transformedTopic } = runFixturePipeline(legacyFixture());
  assert.deepEqual(transformedTopic.concepts, []);
  assert.deepEqual(transformedTopic.workedExamples, []);
  assert.ok(transformedTopic.explanation.length > 0);
  assert.ok(transformedTopic.learningObjectives.length > 0);
  assert.ok(transformedTopic.learningObjectives.every((o) => typeof o === 'string'));
});

test('legacy export (synthetic fixture): questions have no objectiveIds and validate against the real Pydantic schemas', () => {
  const { transformedTopic, transformedQuestions } = runFixturePipeline(legacyFixture());
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
