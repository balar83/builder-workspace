// Slice A1: phase-[3] referential validation for concept/objective ids, and
// rejection of the legacy integer "objective" field once a chapter's Topic
// has structured concepts.

const test = require('node:test');
const assert = require('node:assert/strict');

const { ExportValidationError } = require('../loadCanonical');
const { validateConceptReferences } = require('../conceptReferentialValidation');
const { validTopic, validQuestionBank, legacyTopic, legacyQuestionBank, clone } = require('./fixtures');

test('validateConceptReferences: valid concept/objective references pass (no throw)', () => {
  assert.doesNotThrow(() => validateConceptReferences({ topic: validTopic(), questionBank: validQuestionBank() }));
});

test('validateConceptReferences: a question with no objectiveIds at all is valid (no throw)', () => {
  const bank = clone(validQuestionBank());
  delete bank.questions[0].objectiveIds;
  assert.doesNotThrow(() => validateConceptReferences({ topic: validTopic(), questionBank: bank }));
});

test('validateConceptReferences: dangling workedExample.conceptId fails export', () => {
  const topic = clone(validTopic());
  topic.workedExamples[0].conceptId = 'concept-does-not-exist';

  assert.throws(
    () => validateConceptReferences({ topic, questionBank: validQuestionBank() }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.equal(err.phase, 'concept-referential');
      assert.ok(err.issues.some((i) => i.includes('workedExamples[0]') && i.includes('concept-does-not-exist')));
      return true;
    }
  );
});

test('validateConceptReferences: dangling learningObjectives.conceptId fails export', () => {
  const topic = clone(validTopic());
  topic.learningObjectives[0].conceptId = 'concept-does-not-exist';

  assert.throws(
    () => validateConceptReferences({ topic, questionBank: validQuestionBank() }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('learningObjectives[0]') && i.includes('concept-does-not-exist')));
      return true;
    }
  );
});

test('validateConceptReferences: dangling question objectiveIds fails export', () => {
  const bank = clone(validQuestionBank());
  bank.questions[0].objectiveIds = ['obj-does-not-exist'];

  assert.throws(
    () => validateConceptReferences({ topic: validTopic(), questionBank: bank }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('fx-q01') && i.includes('obj-does-not-exist')));
      return true;
    }
  );
});

test('validateConceptReferences: a legacy integer "objective" field on a question fails export once the Topic is structured', () => {
  const bank = clone(validQuestionBank());
  bank.questions[0].objective = 1;

  assert.throws(
    () => validateConceptReferences({ topic: validTopic(), questionBank: bank }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('fx-q01') && i.includes('legacy integer "objective"')));
      return true;
    }
  );
});

test('validateConceptReferences: a chapter with no Topic at all is unaffected (Practical Geometry shape)', () => {
  assert.doesNotThrow(() => validateConceptReferences({ topic: null, questionBank: validQuestionBank() }));
});

// --- Slice A1 corrective: legacy (not-yet-migrated) chapters -------------

test('validateConceptReferences: a legacy topic receives no structured referential checks (no throw)', () => {
  assert.doesNotThrow(() => validateConceptReferences({ topic: legacyTopic(), questionBank: legacyQuestionBank() }));
});

test('validateConceptReferences: a legacy topic\'s question with the legacy integer "objective" field is explicitly allowed', () => {
  const bank = legacyQuestionBank();
  assert.equal(bank.questions[0].objective, 1);
  assert.doesNotThrow(() => validateConceptReferences({ topic: legacyTopic(), questionBank: bank }));
});

test('validateConceptReferences: multiple broken references are aggregated, not fail-fast', () => {
  const topic = clone(validTopic());
  topic.workedExamples[0].conceptId = 'missing-1';
  topic.learningObjectives[0].conceptId = 'missing-2';

  assert.throws(
    () => validateConceptReferences({ topic, questionBank: validQuestionBank() }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.equal(err.issues.length, 2);
      return true;
    }
  );
});
