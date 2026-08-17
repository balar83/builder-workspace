// Shared test fixtures for the Slice A1 export-pipeline test suite. Builds a
// minimal, valid, structured canonical chapter (one concept, one worked
// example, one objective, one question) in a scratch temp directory, so
// individual tests can load it and mutate a deep-cloned copy to break one
// thing at a time. No test in this suite writes to the real
// docs/content-source/ or backend/app/data/ trees.

const fs = require('fs');
const os = require('os');
const path = require('path');

function validTopic() {
  return {
    id: 'topic-fixture',
    chapterId: 'fixture-chapter',
    title: 'Fixture Topic',
    reviewStatus: 'approved',
    explanation: {
      sections: [{ id: 'concept-a', title: 'Concept A', body: 'Body A' }],
    },
    workedExamples: [
      { id: 'we-1', conceptId: 'concept-a', problem: 'P', steps: ['S1'], finalAnswer: 'A' },
    ],
    learningObjectives: [
      { conceptId: 'concept-a', objectives: [{ id: 'obj-a1', text: 'Do A' }] },
    ],
  };
}

function validQuestionBank() {
  return {
    topicId: 'topic-fixture',
    reviewStatus: 'approved',
    questions: [
      {
        id: 'fx-q01',
        prompt: 'P1?',
        expectedAnswer: '42',
        hints: ['h1'],
        difficulty: 'Easy',
        objectiveIds: ['obj-a1'],
      },
    ],
  };
}

function validAnswerKeys() {
  return { topicId: 'topic-fixture', reviewStatus: 'approved', answers: { 'fx-q01': '42' } };
}

// Slice A1 corrective: a chapter that has NOT been migrated - the exact
// pre-A1 shape (no id on sections, no conceptId anywhere, bare-string
// objectives, legacy integer "objective" on questions). Must remain fully
// exportable without being migrated first.
function legacyTopic() {
  return {
    id: 'topic-fixture',
    chapterId: 'fixture-chapter',
    title: 'Fixture Topic',
    reviewStatus: 'approved',
    explanation: {
      sections: [{ title: 'Concept A', body: 'Body A' }],
    },
    workedExamples: [
      { id: 'we-1', section: 'Concept A', conceptRef: 'Some raw concept ref', problem: 'P', steps: ['S1'], finalAnswer: 'A' },
    ],
    learningObjectives: [{ section: 'Concept A', objectives: ['Do A'] }],
  };
}

function legacyQuestionBank() {
  return {
    topicId: 'topic-fixture',
    reviewStatus: 'approved',
    questions: [
      { id: 'fx-q01', objective: 1, prompt: 'P1?', expectedAnswer: '42', hints: ['h1'], difficulty: 'Easy' },
    ],
  };
}

// Deep clone via JSON round-trip - fine for these plain-data fixtures, and
// keeps each test's mutation from leaking into another test's fixture.
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Writes { canonicalTopic, questionBank, answerKeys } (any may be null/omitted
// to skip that file) into a scratch chapterDir, plus a dataDir with a
// matching chapters.json - returns { chapterDir, dataDir } ready for
// loadCanonical({ chapterDir, dataDir }).
function writeChapterFixture({ canonicalTopic, questionBank, answerKeys, chapterId = 'fixture-chapter' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'a1-fixture-'));
  const chapterDir = path.join(root, 'content-source', chapterId);
  const dataDir = path.join(root, 'data');
  fs.mkdirSync(chapterDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  if (canonicalTopic !== null) {
    fs.writeFileSync(
      path.join(chapterDir, 'canonical-topic.json'),
      JSON.stringify(canonicalTopic === undefined ? validTopic() : canonicalTopic, null, 2)
    );
  }
  if (questionBank !== null) {
    fs.writeFileSync(
      path.join(chapterDir, 'stage6-questions.json'),
      JSON.stringify(questionBank === undefined ? validQuestionBank() : questionBank, null, 2)
    );
  }
  if (answerKeys !== null) {
    fs.writeFileSync(
      path.join(chapterDir, 'answer-keys.json'),
      JSON.stringify(answerKeys === undefined ? validAnswerKeys() : answerKeys, null, 2)
    );
  }

  fs.writeFileSync(
    path.join(dataDir, 'chapters.json'),
    JSON.stringify([{ id: chapterId, title: 'Fixture Chapter', description: 'Fixture chapter for A1 tests' }], null, 2)
  );
  // Empty runtime files - loadCanonical itself doesn't read these, but
  // downstream phases (referentialValidation, duplicateCheck) some tests
  // exercise do.
  fs.writeFileSync(path.join(dataDir, 'topics.json'), '[]');
  fs.writeFileSync(path.join(dataDir, 'questions.json'), '[]');

  return { chapterDir, dataDir, root };
}

module.exports = {
  validTopic,
  validQuestionBank,
  validAnswerKeys,
  legacyTopic,
  legacyQuestionBank,
  clone,
  writeChapterFixture,
};
