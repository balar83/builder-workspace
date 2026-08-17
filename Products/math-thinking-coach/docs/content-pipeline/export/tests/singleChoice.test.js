// Slice 2 (M2, Question & Response Semantics): Stage 10 pipeline support for
// single_choice. No real docs/content-source/ chapter is touched by this
// milestone - every test here uses synthetic fixtures, matching the pattern
// already established for A1 and M2 Slice 1's pipeline tests.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const { loadCanonical, ExportValidationError } = require('../loadCanonical');
const { transformQuestion } = require('../transform');
const { validateAgainstRuntimeSchemas } = require('../pydanticValidate');
const {
  singleChoiceQuestionBank,
  singleChoiceAnswerKeys,
  clone,
  writeChapterFixture,
} = require('./fixtures');

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const backendDir = path.join(repoRoot, 'backend');

// --- loadCanonical.js: structural validation for single_choice -------------

test('loadCanonical: a valid single_choice question loads without issues', () => {
  const { chapterDir, dataDir } = writeChapterFixture({
    questionBank: singleChoiceQuestionBank(),
    answerKeys: singleChoiceAnswerKeys(),
  });

  assert.doesNotThrow(() => loadCanonical({ chapterDir, dataDir }));
});

test('loadCanonical: single_choice is now exportable (not reserved)', () => {
  const bank = clone(singleChoiceQuestionBank());
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank, answerKeys: singleChoiceAnswerKeys() });

  const { questionBank } = loadCanonical({ chapterDir, dataDir });
  assert.equal(questionBank.questions[0].questionType, 'single_choice');
});

test('loadCanonical: a single_choice question with no responseSpecification at all fails structural validation', () => {
  const bank = clone(singleChoiceQuestionBank());
  delete bank.questions[0].responseSpecification;
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank, answerKeys: singleChoiceAnswerKeys() });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('fx-sc-q01') && i.includes('no non-empty responseSpecification.options')));
      return true;
    }
  );
});

test('loadCanonical: a single_choice question with an empty options array fails structural validation', () => {
  const bank = clone(singleChoiceQuestionBank());
  bank.questions[0].responseSpecification.options = [];
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank, answerKeys: singleChoiceAnswerKeys() });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('no non-empty responseSpecification.options')));
      return true;
    }
  );
});

test('loadCanonical: a single_choice question with an option missing text fails structural validation', () => {
  const bank = clone(singleChoiceQuestionBank());
  delete bank.questions[0].responseSpecification.options[1].text;
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank, answerKeys: singleChoiceAnswerKeys() });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('options[1]') && i.includes('"text"')));
      return true;
    }
  );
});

test('loadCanonical: duplicate option ids within one question fail structural validation', () => {
  const bank = clone(singleChoiceQuestionBank());
  bank.questions[0].responseSpecification.options[1].id = 'opt-a'; // collides with options[0]
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank, answerKeys: singleChoiceAnswerKeys() });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('duplicate option id "opt-a"')));
      return true;
    }
  );
});

test('loadCanonical: an invalid option id format fails structural validation', () => {
  const bank = clone(singleChoiceQuestionBank());
  bank.questions[0].responseSpecification.options[0].id = 'opt a!'; // space + punctuation, not allowed
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank, answerKeys: singleChoiceAnswerKeys() });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('invalid option id')));
      return true;
    }
  );
});

test('loadCanonical: an unknown questionType still fails, unaffected by single_choice support', () => {
  const bank = clone(singleChoiceQuestionBank());
  bank.questions[0].questionType = 'essay';
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank, answerKeys: singleChoiceAnswerKeys() });

  assert.throws(() => loadCanonical({ chapterDir, dataDir }), ExportValidationError);
});

test('loadCanonical: still-reserved types (e.g. matching) are still rejected, unaffected by single_choice support', () => {
  const bank = clone(singleChoiceQuestionBank());
  bank.questions[0].questionType = 'matching';
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank, answerKeys: singleChoiceAnswerKeys() });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('reserved for a future slice')));
      return true;
    }
  );
});

// --- transform.js: emission --------------------------------------------------

test('transformQuestion: emits options field-by-field for a single_choice question', () => {
  const result = transformQuestion(singleChoiceQuestionBank().questions[0], {
    chapterId: 'fixture-chapter',
    topicId: 'topic-fixture',
  });

  assert.equal(result.questionType, 'single_choice');
  assert.deepEqual(result.responseSpecification.options, [
    { id: 'opt-a', text: '12' },
    { id: 'opt-b', text: '16' },
    { id: 'opt-c', text: '20' },
  ]);
});

test('transformQuestion: the transformed single_choice question never carries the correct answer anywhere', () => {
  const result = transformQuestion(singleChoiceQuestionBank().questions[0], {
    chapterId: 'fixture-chapter',
    topicId: 'topic-fixture',
  });

  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('correctOptionId'));
  // `solution` is the pre-existing, intentionally-public "reveal solution"
  // field (unchanged behavior for every questionType) - the actual security
  // property is that no *option* carries a correctness marker.
  for (const option of result.responseSpecification.options) {
    assert.deepEqual(Object.keys(option).sort(), ['id', 'text']);
  }
});

// --- End-to-end: real Pydantic round-trip -----------------------------------

test('end-to-end: a synthetic single_choice question round-trips through load + transform + real Pydantic validation', () => {
  const { chapterDir, dataDir } = writeChapterFixture({
    questionBank: singleChoiceQuestionBank(),
    answerKeys: singleChoiceAnswerKeys(),
  });

  const { questionBank } = loadCanonical({ chapterDir, dataDir });
  const transformed = transformQuestion(questionBank.questions[0], { chapterId: 'fixture-chapter', topicId: 'topic-fixture' });

  const result = validateAgainstRuntimeSchemas({ backendDir, chapters: [], topics: [], questions: [transformed] });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

// --- The full real pipeline (run.js), via a genuine subprocess -------------
//
// The answer-key <-> option-id referential check added this slice lives
// inline in run.js's main(), not as a separately-exported function - tested
// here by actually invoking the real, unmodified CLI against a scratch
// docs/content-source/<chapter>/ tree, never the real one.

// run.js (unlike run-topicless.js) requires every question bank's topicId
// to resolve to a real Topic - either one exported in the same run, or one
// already present in runtime topics.json. Rather than also authoring a
// canonical-topic.json (irrelevant to what this test is checking), a
// minimal pre-existing topic is seeded directly into the scratch
// topics.json, simulating "this topic was exported in an earlier run" -
// valid for a --dry-run, which never re-validates pre-existing runtime data
// against Pydantic, only the newly transformed items.
const EXISTING_TOPIC_ID = 'topic-fixture-existing';

function writeRealPipelineFixture({ chapterId, questionBank, answerKeys }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'm2-slice2-run-'));
  const chapterDir = path.join(root, 'docs', 'content-source', chapterId);
  const dataDir = path.join(root, 'data');
  fs.mkdirSync(chapterDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const bank = { ...questionBank, topicId: EXISTING_TOPIC_ID };
  fs.writeFileSync(path.join(chapterDir, 'stage6-questions.json'), JSON.stringify(bank, null, 2));
  fs.writeFileSync(path.join(chapterDir, 'answer-keys.json'), JSON.stringify({ ...answerKeys, topicId: EXISTING_TOPIC_ID }, null, 2));
  fs.writeFileSync(
    path.join(dataDir, 'chapters.json'),
    JSON.stringify([{ id: chapterId, title: 'Fixture Chapter', description: 'Fixture chapter for Slice 2 tests' }], null, 2)
  );
  fs.writeFileSync(
    path.join(dataDir, 'topics.json'),
    JSON.stringify([{ id: EXISTING_TOPIC_ID, chapterId, title: 'Existing Topic', explanation: 'x', workedExampleContent: 'x', learningObjectives: [] }], null, 2)
  );
  fs.writeFileSync(path.join(dataDir, 'questions.json'), '[]');

  return { root, dataDir };
}

function runPipelineCli({ root, dataDir, chapterId }) {
  return spawnSync(
    process.execPath,
    [path.join(__dirname, '..', 'run.js'), `--chapter=${chapterId}`, `--repoRoot=${root}`, `--dataDir=${dataDir}`, '--dry-run'],
    { encoding: 'utf8' }
  );
}

test('real pipeline (run.js): a valid single_choice chapter exports cleanly', () => {
  const { root, dataDir } = writeRealPipelineFixture({
    chapterId: 'fixture-single-choice-valid',
    questionBank: singleChoiceQuestionBank(),
    answerKeys: singleChoiceAnswerKeys(),
  });

  const result = runPipelineCli({ root, dataDir, chapterId: 'fixture-single-choice-valid' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Questions Exported:\s+1/);
  assert.match(result.stdout, /Validation Errors:\s+0/);
});

test('real pipeline (run.js): an answer-key value that is not one of the question\'s option ids fails export loudly', () => {
  const badAnswerKeys = { reviewStatus: 'approved', answers: { 'fx-sc-q01': 'opt-does-not-exist' } };
  const { root, dataDir } = writeRealPipelineFixture({
    chapterId: 'fixture-single-choice-bad-key',
    questionBank: singleChoiceQuestionBank(),
    answerKeys: badAnswerKeys,
  });

  const result = runPipelineCli({ root, dataDir, chapterId: 'fixture-single-choice-bad-key' });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /is not one of this question's option ids/);
});
