// Slice A1: structural validation for the new id/conceptId requirements on
// canonical-topic.json (loadCanonical.js phase [1]).

const test = require('node:test');
const assert = require('node:assert/strict');

const { loadCanonical, ExportValidationError } = require('../loadCanonical');
const { validTopic, legacyTopic, legacyQuestionBank, clone, writeChapterFixture } = require('./fixtures');

test('loadCanonical: a valid structured topic loads without structural issues', () => {
  const { chapterDir, dataDir } = writeChapterFixture();
  const { topic } = loadCanonical({ chapterDir, dataDir });
  assert.equal(topic.explanation.sections[0].id, 'concept-a');
  assert.equal(topic.workedExamples[0].conceptId, 'concept-a');
  assert.equal(topic.learningObjectives[0].conceptId, 'concept-a');
  assert.equal(topic.learningObjectives[0].objectives[0].id, 'obj-a1');
});

// Slice A1 corrective: validTopic() has exactly one section/workedExample/
// group, so deleting the sole discriminator field (section.id,
// workedExample.conceptId, or group.conceptId) doesn't just leave that one
// item "structured but incomplete" - it flips that entire dimension to
// "legacy" while the other two dimensions stay "structured", which is
// itself the cross-dimension migration-state disagreement
// topicMigrationState.js is designed to catch (see topicMigrationState.test.js
// for the dedicated unit tests of that detector). This is correct, improved
// behavior over the original A1 implementation, not a regression - these
// three tests now assert exactly that.

test('loadCanonical: removing the only section\'s id (the sole structured signal) is caught as a migration-state disagreement, not silently accepted', () => {
  const topic = clone(validTopic());
  delete topic.explanation.sections[0].id;
  const { chapterDir, dataDir } = writeChapterFixture({ canonicalTopic: topic });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.equal(err.phase, 'structural');
      assert.ok(err.issues.some((i) => i.includes('migration state')));
      return true;
    }
  );
});

test('loadCanonical: removing the only workedExample\'s conceptId (the sole structured signal) is caught as a migration-state disagreement, not silently accepted', () => {
  const topic = clone(validTopic());
  delete topic.workedExamples[0].conceptId;
  const { chapterDir, dataDir } = writeChapterFixture({ canonicalTopic: topic });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('migration state')));
      return true;
    }
  );
});

test('loadCanonical: removing the only learningObjectives group\'s conceptId (the sole structured signal) is caught as a migration-state disagreement, not silently accepted', () => {
  const topic = clone(validTopic());
  delete topic.learningObjectives[0].conceptId;
  const { chapterDir, dataDir } = writeChapterFixture({ canonicalTopic: topic });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('migration state')));
      return true;
    }
  );
});

test('loadCanonical: a structured section missing "title" (a non-discriminator field, id still present) still fails structural validation directly', () => {
  const topic = clone(validTopic());
  delete topic.explanation.sections[0].title;
  const { chapterDir, dataDir } = writeChapterFixture({ canonicalTopic: topic });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('explanation.sections[0]') && i.includes('"title"')));
      return true;
    }
  );
});

test('loadCanonical: a structured workedExample missing "id" (a non-discriminator field, conceptId still present) still fails structural validation directly', () => {
  const topic = clone(validTopic());
  delete topic.workedExamples[0].id;
  const { chapterDir, dataDir } = writeChapterFixture({ canonicalTopic: topic });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('workedExamples[0]') && i.includes('"id"')));
      return true;
    }
  );
});

test('loadCanonical: an objective missing id/text fails structural validation', () => {
  const topic = clone(validTopic());
  delete topic.learningObjectives[0].objectives[0].id;
  const { chapterDir, dataDir } = writeChapterFixture({ canonicalTopic: topic });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('learningObjectives[0].objectives[0]') && i.includes('"id"')));
      return true;
    }
  );
});

test('loadCanonical: a chapter with no canonical-topic.json at all is unaffected (Practical Geometry shape)', () => {
  const { chapterDir, dataDir } = writeChapterFixture({ canonicalTopic: null });
  const { topic } = loadCanonical({ chapterDir, dataDir });
  assert.equal(topic, null);
});

// --- Slice A1 corrective: legacy (not-yet-migrated) chapters -------------

test('loadCanonical: a legacy topic (no ids anywhere) loads without structural issues', () => {
  const { chapterDir, dataDir } = writeChapterFixture({ canonicalTopic: legacyTopic(), questionBank: legacyQuestionBank() });
  const { topic, questionBank } = loadCanonical({ chapterDir, dataDir });
  assert.equal(topic.explanation.sections[0].id, undefined);
  assert.equal(questionBank.questions[0].objective, 1);
});

test('loadCanonical: a legacy topic does NOT require section.id/workedExample.conceptId/objective.id', () => {
  // The exact pre-A1 shape must still be accepted - this is the corrective
  // slice's core guarantee.
  assert.doesNotThrow(() => {
    const { chapterDir, dataDir } = writeChapterFixture({ canonicalTopic: legacyTopic(), questionBank: legacyQuestionBank() });
    loadCanonical({ chapterDir, dataDir });
  });
});

test('loadCanonical: a legacy topic missing its required legacy field (section.body) still fails structural validation', () => {
  const topic = clone(legacyTopic());
  delete topic.explanation.sections[0].body;
  const { chapterDir, dataDir } = writeChapterFixture({ canonicalTopic: topic, questionBank: legacyQuestionBank() });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('explanation.sections[0]') && i.includes('"body"')));
      return true;
    }
  );
});

test('loadCanonical: a topic that mixes legacy and structured sections fails structural validation with an explicit "mixes" error', () => {
  const topic = clone(legacyTopic());
  topic.explanation.sections.push({ id: 'concept-b', title: 'Concept B', body: 'Body B' });
  const { chapterDir, dataDir } = writeChapterFixture({ canonicalTopic: topic, questionBank: legacyQuestionBank() });

  assert.throws(
    () => loadCanonical({ chapterDir, dataDir }),
    (err) => {
      assert.ok(err instanceof ExportValidationError);
      assert.ok(err.issues.some((i) => i.includes('mixes')));
      return true;
    }
  );
});
