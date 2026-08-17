// Slice 3 (M2, Question & Response Semantics): Stage 10 pipeline support for
// multi_choice. No real docs/content-source/ chapter is touched by this
// milestone - every test here uses synthetic fixtures, matching the pattern
// already established for A1 and M2 Slice 2's pipeline tests
// (singleChoice.test.js).

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
  multiChoiceQuestionBank,
  multiChoiceAnswerKeys,
  clone,
  writeChapterFixture,
} = require('./fixtures');

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const backendDir = path.join(repoRoot, 'backend');

// --- loadCanonical.js: structural validation for multi_choice ---------------
// (the option-list shape/validation itself is shared with single_choice via
// loadCanonical.js's validateChoiceOptions - already covered exhaustively by
// singleChoice.test.js; these tests confirm multi_choice is wired to the
// same shared validator, not that every rule works a second time.)

test('loadCanonical: a valid multi_choice question loads without issues', () => {
  const { chapterDir, dataDir } = writeChapterFixture({
    questionBank: multiChoiceQuestionBank(),
    answerKeys: multiChoiceAnswerKeys(),
  });

  assert.doesNotThrow(() => loadCanonical({ chapterDir, dataDir }));
});

test('loadCanonical: multi_choice is now exportable (not reserved)', () => {
  const bank = clone(multiChoiceQuestionBank());
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank, answerKeys: multiChoiceAnswerKeys() });

  const { questionBank } = loadCanonical({ chapterDir, dataDir });
  assert.equal(questionBank.questions[0].questionType, 'multi_choice');
});

test('loadCanonical: a multi_choice question with no responseSpecification at all fails structural validation', () => {
  const bank = clone(multiChoiceQuestionBank());
  delete bank.questions[0].responseSpecification;
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank, answerKeys: multiChoiceAnswerKeys() });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(
        err.issues.some(
          (i) => i.includes('fx-mc-q01') && i.includes('multi_choice') && i.includes('no non-empty responseSpecification.options')
        )
      );
      return true;
    }
  );
});

test('loadCanonical: duplicate option ids within one multi_choice question fail structural validation', () => {
  const bank = clone(multiChoiceQuestionBank());
  bank.questions[0].responseSpecification.options[1].id = 'opt-a'; // collides with options[0]
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank, answerKeys: multiChoiceAnswerKeys() });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('duplicate option id "opt-a"')));
      return true;
    }
  );
});

test('loadCanonical: an invalid option id format fails structural validation for multi_choice too', () => {
  const bank = clone(multiChoiceQuestionBank());
  bank.questions[0].responseSpecification.options[0].id = 'opt a!'; // space + punctuation, not allowed
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank, answerKeys: multiChoiceAnswerKeys() });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('invalid option id')));
      return true;
    }
  );
});

test('loadCanonical: still-reserved types (e.g. matching) are still rejected, unaffected by multi_choice support', () => {
  const bank = clone(multiChoiceQuestionBank());
  bank.questions[0].questionType = 'matching';
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank, answerKeys: multiChoiceAnswerKeys() });

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

test('transformQuestion: emits options field-by-field for a multi_choice question', () => {
  const result = transformQuestion(multiChoiceQuestionBank().questions[0], {
    chapterId: 'fixture-chapter',
    topicId: 'topic-fixture',
  });

  assert.equal(result.questionType, 'multi_choice');
  assert.deepEqual(result.responseSpecification.options, [
    { id: 'opt-a', text: '2' },
    { id: 'opt-b', text: '3' },
    { id: 'opt-c', text: '4' },
    { id: 'opt-d', text: '5' },
  ]);
});

test('transformQuestion: the transformed multi_choice question never carries the correct answer set anywhere', () => {
  const result = transformQuestion(multiChoiceQuestionBank().questions[0], {
    chapterId: 'fixture-chapter',
    topicId: 'topic-fixture',
  });

  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('correctOptionIds'));
  // The actual security property: no *option* carries a correctness marker,
  // and no field anywhere holds the answer-keys.json comma-delimited value.
  for (const option of result.responseSpecification.options) {
    assert.deepEqual(Object.keys(option).sort(), ['id', 'text']);
  }
});

// --- End-to-end: real Pydantic round-trip -----------------------------------

test('end-to-end: a synthetic multi_choice question round-trips through load + transform + real Pydantic validation', () => {
  const { chapterDir, dataDir } = writeChapterFixture({
    questionBank: multiChoiceQuestionBank(),
    answerKeys: multiChoiceAnswerKeys(),
  });

  const { questionBank } = loadCanonical({ chapterDir, dataDir });
  const transformed = transformQuestion(questionBank.questions[0], { chapterId: 'fixture-chapter', topicId: 'topic-fixture' });

  const result = validateAgainstRuntimeSchemas({ backendDir, chapters: [], topics: [], questions: [transformed] });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

// --- The full real pipeline (run.js), via a genuine subprocess -------------
// Mirrors singleChoice.test.js's own real-pipeline harness exactly - kept as
// a per-file local helper (not shared via fixtures.js), matching that
// file's own convention.

const EXISTING_TOPIC_ID = 'topic-fixture-existing';

function writeRealPipelineFixture({ chapterId, questionBank, answerKeys }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'm2-slice3-run-'));
  const chapterDir = path.join(root, 'docs', 'content-source', chapterId);
  const dataDir = path.join(root, 'data');
  fs.mkdirSync(chapterDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const bank = { ...questionBank, topicId: EXISTING_TOPIC_ID };
  fs.writeFileSync(path.join(chapterDir, 'stage6-questions.json'), JSON.stringify(bank, null, 2));
  fs.writeFileSync(path.join(chapterDir, 'answer-keys.json'), JSON.stringify({ ...answerKeys, topicId: EXISTING_TOPIC_ID }, null, 2));
  fs.writeFileSync(
    path.join(dataDir, 'chapters.json'),
    JSON.stringify([{ id: chapterId, title: 'Fixture Chapter', description: 'Fixture chapter for Slice 3 tests' }], null, 2)
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

test('real pipeline (run.js): a valid multi_choice chapter exports cleanly', () => {
  const { root, dataDir } = writeRealPipelineFixture({
    chapterId: 'fixture-multi-choice-valid',
    questionBank: multiChoiceQuestionBank(),
    answerKeys: multiChoiceAnswerKeys(),
  });

  const result = runPipelineCli({ root, dataDir, chapterId: 'fixture-multi-choice-valid' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Questions Exported:\s+1/);
  assert.match(result.stdout, /Validation Errors:\s+0/);
});

test('real pipeline (run.js): an answer-key value naming an unknown option id fails export loudly', () => {
  const badAnswerKeys = { reviewStatus: 'approved', answers: { 'fx-mc-q01': 'opt-a,opt-does-not-exist' } };
  const { root, dataDir } = writeRealPipelineFixture({
    chapterId: 'fixture-multi-choice-bad-key',
    questionBank: multiChoiceQuestionBank(),
    answerKeys: badAnswerKeys,
  });

  const result = runPipelineCli({ root, dataDir, chapterId: 'fixture-multi-choice-bad-key' });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /contains option id\(s\) not among this question's options/);
});

test('real pipeline (run.js): a malformed (double-comma) answer-key value fails export loudly', () => {
  const badAnswerKeys = { reviewStatus: 'approved', answers: { 'fx-mc-q01': 'opt-a,,opt-b' } };
  const { root, dataDir } = writeRealPipelineFixture({
    chapterId: 'fixture-multi-choice-malformed-key',
    questionBank: multiChoiceQuestionBank(),
    answerKeys: badAnswerKeys,
  });

  const result = runPipelineCli({ root, dataDir, chapterId: 'fixture-multi-choice-malformed-key' });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /is not a well-formed comma-delimited list of option ids/);
});

test('loadCanonical: an empty-string multi_choice answer-key value is rejected at the pre-existing structural check (rule "expected empty set must not be permitted")', () => {
  // Not new Slice 3 logic: loadCanonical.js already rejects an empty-string
  // answers.json value for every questionType, before run.js's multi_choice-
  // specific token parsing ever runs - this test confirms multi_choice gets
  // that guarantee "for free" from existing, unmodified infrastructure.
  const bank = clone(multiChoiceQuestionBank());
  const answerKeys = clone(multiChoiceAnswerKeys());
  answerKeys.answers['fx-mc-q01'] = '';
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank, answerKeys });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('fx-mc-q01') && i.includes('must be a non-empty string')));
      return true;
    }
  );
});
