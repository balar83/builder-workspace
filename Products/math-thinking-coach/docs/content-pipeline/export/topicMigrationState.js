// Slice A1 corrective: during the A1/A2/A3 transition, "legacy" and
// "migrated" canonical Topic content must coexist and both remain
// exportable (docs/Structured-Learning-Content-Design-Proposal.md §I/§K).
// Migration state is derived only from the canonical content itself - never
// from a separate flag, config file, or chapter allowlist - so a chapter
// becomes "migrated" the moment its own canonical-topic.json is actually
// migrated, and not before.
//
// Discriminator: explanation.sections[].id (legacy sections never had an
// "id" field - only title/body). workedExamples[].conceptId and
// learningObjectives[].conceptId (NOT workedExamples[].id - legacy worked
// examples already had an "id" field pre-A1, so "id" alone cannot
// distinguish them; "conceptId" only ever exists on migrated content).
//
// A Topic that mixes structured and legacy pieces in the same
// canonical-topic.json is neither state - it's reported as an explicit
// structural inconsistency (state: null) rather than guessed at, so a
// half-finished migration can never silently validate as one shape or the
// other.

function hasOwn(obj, key) {
  return obj != null && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
}

function partitionBy(items, key) {
  const withKey = [];
  const withoutKey = [];
  for (const item of items) {
    (hasOwn(item, key) ? withKey : withoutKey).push(item);
  }
  return { withKey, withoutKey };
}

function detectTopicMigrationState(topic) {
  const sections = topic.explanation && Array.isArray(topic.explanation.sections) ? topic.explanation.sections : [];
  const examples = Array.isArray(topic.workedExamples) ? topic.workedExamples : [];
  const groups = Array.isArray(topic.learningObjectives) ? topic.learningObjectives : [];

  const sectionSplit = partitionBy(sections, 'id');
  const exampleSplit = partitionBy(examples, 'conceptId');
  const groupSplit = partitionBy(groups, 'conceptId');

  const issues = [];
  if (sectionSplit.withKey.length > 0 && sectionSplit.withoutKey.length > 0) {
    issues.push(
      'canonical-topic.json: explanation.sections mixes structured (with "id") and legacy (without "id") entries - a Topic must be fully migrated or fully legacy, not partially'
    );
  }
  if (exampleSplit.withKey.length > 0 && exampleSplit.withoutKey.length > 0) {
    issues.push(
      'canonical-topic.json: workedExamples mixes structured (with "conceptId") and legacy (without "conceptId") entries - a Topic must be fully migrated or fully legacy, not partially'
    );
  }
  if (groupSplit.withKey.length > 0 && groupSplit.withoutKey.length > 0) {
    issues.push(
      'canonical-topic.json: learningObjectives mixes structured (with "conceptId") and legacy (without "conceptId") entries - a Topic must be fully migrated or fully legacy, not partially'
    );
  }

  const anyStructured = sectionSplit.withKey.length > 0 || exampleSplit.withKey.length > 0 || groupSplit.withKey.length > 0;
  const anyLegacy = sectionSplit.withoutKey.length > 0 || exampleSplit.withoutKey.length > 0 || groupSplit.withoutKey.length > 0;

  if (issues.length === 0 && anyStructured && anyLegacy) {
    // Each of sections/workedExamples/learningObjectives was internally
    // consistent on its own, but they disagree with each other (e.g. every
    // section has an id, but every workedExample lacks a conceptId).
    issues.push(
      'canonical-topic.json: explanation.sections, workedExamples, and learningObjectives disagree on migration state (some structured, some legacy) - a Topic must be fully migrated or fully legacy, not partially'
    );
  }

  if (issues.length > 0) {
    return { state: null, issues };
  }

  return { state: anyStructured ? 'structured' : 'legacy', issues: [] };
}

module.exports = { detectTopicMigrationState };
