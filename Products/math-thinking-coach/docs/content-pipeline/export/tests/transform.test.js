// Slice A1: transform.js emits BOTH the legacy joined-string shape and the
// new structured shape from the same canonical source (§K additive
// migration), preserving the pre-existing whitelist discipline.

const test = require('node:test');
const assert = require('node:assert/strict');

const { transformTopic, transformQuestion } = require('../transform');
const { validTopic, legacyTopic, clone } = require('./fixtures');

function twoConceptTopic() {
  const topic = clone(validTopic());
  topic.explanation.sections.push({ id: 'concept-b', title: 'Concept B', body: 'Body B' });
  topic.workedExamples.push({ id: 'we-2', conceptId: 'concept-b', problem: 'P2', steps: ['S2a', 'S2b'], finalAnswer: 'A2' });
  topic.learningObjectives.push({ conceptId: 'concept-b', objectives: [{ id: 'obj-b1', text: 'Do B' }] });
  return topic;
}

test('transformTopic: emits structured concepts nested with their learning objectives', () => {
  const result = transformTopic(twoConceptTopic());

  assert.equal(result.concepts.length, 2);
  assert.deepEqual(result.concepts[0], {
    id: 'concept-a',
    title: 'Concept A',
    body: 'Body A',
    learningObjectives: [{ id: 'obj-a1', text: 'Do A' }],
  });
  assert.deepEqual(result.concepts[1], {
    id: 'concept-b',
    title: 'Concept B',
    body: 'Body B',
    learningObjectives: [{ id: 'obj-b1', text: 'Do B' }],
  });
});

test('transformTopic: emits structured workedExamples with their conceptId FK intact', () => {
  const result = transformTopic(twoConceptTopic());

  assert.equal(result.workedExamples.length, 2);
  assert.deepEqual(result.workedExamples[1], {
    id: 'we-2',
    conceptId: 'concept-b',
    problem: 'P2',
    steps: ['S2a', 'S2b'],
    finalAnswer: 'A2',
  });
});

test('transformTopic: still emits the legacy joined-string fields, unchanged in content, alongside the structured ones', () => {
  const result = transformTopic(twoConceptTopic());

  assert.equal(result.explanation, 'Body A\n\nBody B');
  assert.ok(result.workedExampleContent.includes('P2'));
  assert.ok(result.workedExampleContent.includes('---'));
  assert.deepEqual(result.learningObjectives, ['Do A', 'Do B']);
});

test('transformTopic: a section with no matching learningObjectives group produces an empty objectives list, not a crash', () => {
  const topic = clone(validTopic());
  topic.learningObjectives = []; // no group at all for concept-a

  const result = transformTopic(topic);
  assert.deepEqual(result.concepts[0].learningObjectives, []);
});

// --- Slice A1 corrective: legacy (not-yet-migrated) chapters -------------

test('transformTopic: a legacy topic (bare-string objectives, no ids) transforms to the exact pre-A1 legacy shape', () => {
  const result = transformTopic(legacyTopic());

  assert.equal(result.explanation, 'Body A');
  assert.ok(result.workedExampleContent.includes('P'));
  assert.deepEqual(result.learningObjectives, ['Do A']);
});

test('transformTopic: a legacy topic produces empty structured concepts/workedExamples, not a crash', () => {
  const result = transformTopic(legacyTopic());

  assert.deepEqual(result.concepts, []);
  assert.deepEqual(result.workedExamples, []);
});

test('transformQuestion: includes objectiveIds when the canonical question has it', () => {
  const result = transformQuestion(
    { id: 'q1', prompt: 'P?', expectedAnswer: 'A', hints: [], difficulty: 'Easy', objectiveIds: ['obj-a1'] },
    { chapterId: 'fixture-chapter', topicId: 'topic-fixture' }
  );
  assert.deepEqual(result.objectiveIds, ['obj-a1']);
});

test('transformQuestion: omits objectiveIds entirely when the canonical question does not have it (un-migrated-chapter regression pin)', () => {
  const result = transformQuestion(
    { id: 'q1', prompt: 'P?', expectedAnswer: 'A', hints: [], difficulty: 'Easy' },
    { chapterId: 'fixture-chapter', topicId: 'topic-fixture' }
  );
  assert.equal('objectiveIds' in result, false);
});
