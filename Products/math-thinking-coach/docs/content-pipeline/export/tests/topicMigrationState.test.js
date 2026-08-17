// Slice A1 corrective: the migration-state discriminator must be
// unambiguous - a fully legacy Topic and a fully structured Topic must be
// correctly identified, and any mix of the two must be reported as an
// explicit inconsistency, never silently guessed at.

const test = require('node:test');
const assert = require('node:assert/strict');

const { detectTopicMigrationState } = require('../topicMigrationState');
const { validTopic, legacyTopic, clone } = require('./fixtures');

test('detectTopicMigrationState: a fully structured topic is detected as "structured"', () => {
  const result = detectTopicMigrationState(validTopic());
  assert.equal(result.state, 'structured');
  assert.deepEqual(result.issues, []);
});

test('detectTopicMigrationState: a fully legacy topic is detected as "legacy"', () => {
  const result = detectTopicMigrationState(legacyTopic());
  assert.equal(result.state, 'legacy');
  assert.deepEqual(result.issues, []);
});

test('detectTopicMigrationState: mixed sections (some with id, some without) is ambiguous', () => {
  const topic = clone(legacyTopic());
  topic.explanation.sections.push({ id: 'concept-b', title: 'Concept B', body: 'Body B' });

  const result = detectTopicMigrationState(topic);
  assert.equal(result.state, null);
  assert.ok(result.issues.some((i) => i.includes('explanation.sections') && i.includes('mixes')));
});

test('detectTopicMigrationState: mixed workedExamples (some with conceptId, some without) is ambiguous', () => {
  const topic = clone(validTopic());
  topic.workedExamples.push({ id: 'we-2', section: 'Concept A', problem: 'P2', steps: ['S2'], finalAnswer: 'A2' });

  const result = detectTopicMigrationState(topic);
  assert.equal(result.state, null);
  assert.ok(result.issues.some((i) => i.includes('workedExamples') && i.includes('mixes')));
});

test('detectTopicMigrationState: mixed learningObjectives groups (some with conceptId, some without) is ambiguous', () => {
  const topic = clone(validTopic());
  topic.learningObjectives.push({ section: 'Legacy Group', objectives: ['Do B'] });

  const result = detectTopicMigrationState(topic);
  assert.equal(result.state, null);
  assert.ok(result.issues.some((i) => i.includes('learningObjectives') && i.includes('mixes')));
});

test('detectTopicMigrationState: sections say structured but workedExamples/objectives say legacy is ambiguous', () => {
  // Each of the three groups is internally consistent, but they disagree
  // with each other - a different flavor of "partially migrated".
  const topic = {
    id: 'topic-fixture',
    chapterId: 'fixture-chapter',
    title: 'Fixture Topic',
    reviewStatus: 'approved',
    explanation: { sections: [{ id: 'concept-a', title: 'Concept A', body: 'Body A' }] },
    workedExamples: [{ id: 'we-1', section: 'Concept A', problem: 'P', steps: ['S1'], finalAnswer: 'A' }],
    learningObjectives: [{ section: 'Concept A', objectives: ['Do A'] }],
  };

  const result = detectTopicMigrationState(topic);
  assert.equal(result.state, null);
  assert.ok(result.issues.length > 0);
});

test('detectTopicMigrationState: an empty topic (no sections/examples/objectives) defaults to "legacy", not an error', () => {
  const topic = {
    id: 'topic-fixture',
    chapterId: 'fixture-chapter',
    title: 'Fixture Topic',
    reviewStatus: 'approved',
    explanation: { sections: [] },
    workedExamples: [],
    learningObjectives: [],
  };

  const result = detectTopicMigrationState(topic);
  assert.equal(result.state, 'legacy');
  assert.deepEqual(result.issues, []);
});
