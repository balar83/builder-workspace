// Slice 1 (M2, Question & Response Semantics): pipeline support for
// Question.questionType / maxScore / responseSpecification. No real
// docs/content-source/ chapter is touched by this milestone - every test
// here uses synthetic fixtures, matching the pattern already established
// for Slice A1's pipeline tests.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { loadCanonical, ExportValidationError } = require('../loadCanonical');
const { transformQuestion } = require('../transform');
const { validateAgainstRuntimeSchemas } = require('../pydanticValidate');
const { validQuestionBank, multiPartQuestionBank, multiPartAnswerKeys, clone, writeChapterFixture } = require('./fixtures');

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const backendDir = path.join(repoRoot, 'backend');

// --- loadCanonical.js: structural validation for questionType --------------

test('loadCanonical: a question with no questionType at all loads without issues (defaults later, at transform)', () => {
  const { chapterDir, dataDir } = writeChapterFixture();
  const { questionBank } = loadCanonical({ chapterDir, dataDir });
  assert.equal(questionBank.questions[0].questionType, undefined);
});

test('loadCanonical: a question explicitly typed "short_text" loads without issues', () => {
  const bank = clone(validQuestionBank());
  bank.questions[0].questionType = 'short_text';
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank });

  assert.doesNotThrow(() => loadCanonical({ chapterDir, dataDir }));
});

test('loadCanonical: a question explicitly typed "numeric" loads without issues', () => {
  const bank = clone(validQuestionBank());
  bank.questions[0].questionType = 'numeric';
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank });

  assert.doesNotThrow(() => loadCanonical({ chapterDir, dataDir }));
});

test('loadCanonical: an unknown questionType fails structural validation', () => {
  const bank = clone(validQuestionBank());
  bank.questions[0].questionType = 'essay';
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.equal(err.phase, 'structural');
      assert.ok(err.issues.some((i) => i.includes('fx-q01') && i.includes('unknown questionType') && i.includes('essay')));
      return true;
    }
  );
});

test('loadCanonical: a reserved-but-unimplemented questionType (fill_blank) is rejected, not silently exported', () => {
  // single_choice/multi_choice were this test's original examples - both
  // gained real evaluator/pipeline support (Slice 2, Slice 3), so this now
  // specifically needs a still-reserved type. fill_blank's own rejection is
  // also covered by the parametrized loop below; this one stays as the
  // detailed issue-message assertion.
  const bank = clone(validQuestionBank());
  bank.questions[0].questionType = 'fill_blank';
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('fx-q01') && i.includes('fill_blank') && i.includes('reserved')));
      return true;
    }
  );
});

// single_choice/multi_choice were this loop's original examples too, then
// multi_part gained real evaluator/pipeline support (M3) - both moved out
// the same way, leaving only the types that are still genuinely reserved.
for (const reserved of ['fill_blank', 'matching']) {
  test(`loadCanonical: reserved questionType "${reserved}" is also rejected`, () => {
    const bank = clone(validQuestionBank());
    bank.questions[0].questionType = reserved;
    const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank });

    assert.throws(() => loadCanonical({ chapterDir, dataDir }), ExportValidationError);
  });
}

// --- loadCanonical.js: structural validation for multi_part (M3) -----------

test('loadCanonical: a multi_part question with a well-formed parts array loads without issues', () => {
  const { chapterDir, dataDir } = writeChapterFixture({
    questionBank: multiPartQuestionBank(),
    answerKeys: multiPartAnswerKeys(),
  });

  assert.doesNotThrow(() => loadCanonical({ chapterDir, dataDir }));
});

test('loadCanonical: a multi_part question with no parts array is rejected', () => {
  const bank = clone(multiPartQuestionBank());
  delete bank.questions[0].responseSpecification;
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('fx-mp-q01') && i.includes('no non-empty responseSpecification.parts')));
      return true;
    }
  );
});

test('loadCanonical: a multi_part question with an empty parts array is rejected', () => {
  const bank = clone(multiPartQuestionBank());
  bank.questions[0].responseSpecification.parts = [];
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank });

  assert.throws(() => loadCanonical({ chapterDir, dataDir }), ExportValidationError);
});

test('loadCanonical: a multi_part question with duplicate part ids is rejected', () => {
  const bank = clone(multiPartQuestionBank());
  bank.questions[0].responseSpecification.parts[1].id = 'lhs';
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('duplicate part id')));
      return true;
    }
  );
});

test('loadCanonical: a multi_part part naming an unsupported questionType (e.g. single_choice) is rejected', () => {
  const bank = clone(multiPartQuestionBank());
  bank.questions[0].responseSpecification.parts[1].questionType = 'single_choice';
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('does not support')));
      return true;
    }
  );
});

test('loadCanonical: nested multi_part (a part whose own questionType is multi_part) is rejected', () => {
  const bank = clone(multiPartQuestionBank());
  bank.questions[0].responseSpecification.parts[1].questionType = 'multi_part';
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank });

  assert.throws(() => loadCanonical({ chapterDir, dataDir }), ExportValidationError);
});

// --- transform.js: multi_part parts / derived maxScore emission (M3) -------

test('transformQuestion: multi_part parts are emitted field-by-field, in order', () => {
  const result = transformQuestion(multiPartQuestionBank().questions[0], {
    chapterId: 'fixture-chapter',
    topicId: 'topic-fixture',
  });

  assert.deepEqual(result.responseSpecification.parts, [
    { id: 'lhs', prompt: 'LHS (left-hand side)', questionType: 'short_text', responseSpecification: null, maxScore: 1.0, objectiveIds: null },
    { id: 'rhs', prompt: 'RHS (right-hand side)', questionType: 'short_text', responseSpecification: null, maxScore: 1.0, objectiveIds: null },
  ]);
});

test('transformQuestion: a multi_part question\'s maxScore is derived as the sum of its parts\' maxScore, not independently authored', () => {
  const canonical = multiPartQuestionBank().questions[0];
  canonical.maxScore = 99; // must be ignored - the sum of parts (1.0 + 1.0) wins
  const result = transformQuestion(canonical, { chapterId: 'fixture-chapter', topicId: 'topic-fixture' });

  assert.equal(result.maxScore, 2.0);
});

test('transformQuestion: a multi_part part\'s own explicit maxScore contributes to the derived total', () => {
  const canonical = multiPartQuestionBank().questions[0];
  canonical.responseSpecification.parts[0].maxScore = 2.0;
  canonical.responseSpecification.parts[1].maxScore = 3.0;
  const result = transformQuestion(canonical, { chapterId: 'fixture-chapter', topicId: 'topic-fixture' });

  assert.equal(result.maxScore, 5.0);
});

// --- transform.js: questionType / maxScore / responseSpecification emission ---

test('transformQuestion: omitted questionType/maxScore default to "short_text"/1.0 (backward compatibility)', () => {
  const result = transformQuestion(
    { id: 'q1', prompt: 'P?', expectedAnswer: 'A', hints: [], difficulty: 'Easy' },
    { chapterId: 'fixture-chapter', topicId: 'topic-fixture' }
  );

  assert.equal(result.questionType, 'short_text');
  assert.equal(result.maxScore, 1.0);
  assert.equal('responseSpecification' in result, false);
});

test('transformQuestion: an explicit questionType/maxScore is passed through unchanged', () => {
  const result = transformQuestion(
    { id: 'q1', prompt: 'P?', expectedAnswer: '4', hints: [], difficulty: 'Easy', questionType: 'numeric', maxScore: 2.0 },
    { chapterId: 'fixture-chapter', topicId: 'topic-fixture' }
  );

  assert.equal(result.questionType, 'numeric');
  assert.equal(result.maxScore, 2.0);
});

test('transformQuestion: responseSpecification is emitted field-by-field when the canonical question opts in', () => {
  const result = transformQuestion(
    {
      id: 'q1',
      prompt: 'P?',
      expectedAnswer: '3.14',
      hints: [],
      difficulty: 'Easy',
      questionType: 'numeric',
      responseSpecification: { numericTolerance: 0.05 },
    },
    { chapterId: 'fixture-chapter', topicId: 'topic-fixture' }
  );

  assert.deepEqual(result.responseSpecification, { numericTolerance: 0.05 });
});

test('transformQuestion: responseSpecification.numericTolerance defaults to 0.0 if the canonical question omits it', () => {
  const result = transformQuestion(
    {
      id: 'q1',
      prompt: 'P?',
      expectedAnswer: '4',
      hints: [],
      difficulty: 'Easy',
      questionType: 'numeric',
      responseSpecification: {},
    },
    { chapterId: 'fixture-chapter', topicId: 'topic-fixture' }
  );

  assert.deepEqual(result.responseSpecification, { numericTolerance: 0.0 });
});

// --- End-to-end: synthetic numeric question validates against the real ------
// --- backend Pydantic schemas -----------------------------------------------

test('end-to-end: a synthetic numeric question round-trips through load + transform + real Pydantic validation', () => {
  const bank = clone(validQuestionBank());
  bank.questions[0].questionType = 'numeric';
  bank.questions[0].expectedAnswer = '0.5';
  bank.questions[0].responseSpecification = { numericTolerance: 0.01 };
  const answerKeys = { topicId: 'topic-fixture', reviewStatus: 'approved', answers: { 'fx-q01': '0.5' } };
  const { chapterDir, dataDir } = writeChapterFixture({ questionBank: bank, answerKeys });

  const { questionBank: loaded } = loadCanonical({ chapterDir, dataDir });
  const transformed = transformQuestion(loaded.questions[0], { chapterId: 'fixture-chapter', topicId: 'topic-fixture' });

  const result = validateAgainstRuntimeSchemas({ backendDir, chapters: [], topics: [], questions: [transformed] });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('end-to-end: a synthetic multi_part question round-trips through load + transform + real Pydantic validation', () => {
  const { chapterDir, dataDir } = writeChapterFixture({
    questionBank: multiPartQuestionBank(),
    answerKeys: multiPartAnswerKeys(),
  });

  const { questionBank: loaded } = loadCanonical({ chapterDir, dataDir });
  const transformed = transformQuestion(loaded.questions[0], { chapterId: 'fixture-chapter', topicId: 'topic-fixture' });

  assert.equal(transformed.maxScore, 2.0);
  const result = validateAgainstRuntimeSchemas({ backendDir, chapters: [], topics: [], questions: [transformed] });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('end-to-end: a legacy question with no questionType still validates against the real Pydantic schemas', () => {
  const { chapterDir, dataDir } = writeChapterFixture();
  const { questionBank: loaded } = loadCanonical({ chapterDir, dataDir });
  const transformed = transformQuestion(loaded.questions[0], { chapterId: 'fixture-chapter', topicId: 'topic-fixture' });

  assert.equal(transformed.questionType, 'short_text');
  const result = validateAgainstRuntimeSchemas({ backendDir, chapters: [], topics: [], questions: [transformed] });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});
