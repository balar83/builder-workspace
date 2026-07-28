// Phase [3] (partial): duplicate detection. Same Level-1 approach already
// established in the Template Engine's duplicateDetector.js — exact id match
// and exact normalized-text match. Not re-deriving a new strategy here.

const { ExportValidationError } = require('./loadCanonical');

function normalizeText(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function checkDuplicates({ approvedQuestions, existingQuestions, touchedChapterId }) {
  const issues = [];

  // Exclude the chapter this run is about to replace — otherwise a re-export
  // of unchanged canonical content would flag its own previous export as a
  // collision with itself, breaking the "regenerate at any time" guarantee.
  const comparableExisting = touchedChapterId
    ? existingQuestions.filter((q) => q.chapterId !== touchedChapterId)
    : existingQuestions;

  const seenIdsThisRun = new Set();
  const seenPromptsThisRun = new Set();
  const existingIds = new Set(comparableExisting.map((q) => q.id));
  const existingPrompts = new Set(comparableExisting.map((q) => normalizeText(q.question)));

  for (const q of approvedQuestions) {
    if (seenIdsThisRun.has(q.id)) {
      issues.push(`Duplicate id "${q.id}" within the approved set being exported`);
    }
    seenIdsThisRun.add(q.id);

    if (existingIds.has(q.id)) {
      issues.push(`id "${q.id}" collides with an existing runtime question id (possibly in a different chapter)`);
    }

    const normalizedPrompt = normalizeText(q.prompt);
    if (seenPromptsThisRun.has(normalizedPrompt)) {
      issues.push(`Duplicate prompt text for id "${q.id}" within the approved set being exported`);
    }
    seenPromptsThisRun.add(normalizedPrompt);

    if (existingPrompts.has(normalizedPrompt)) {
      issues.push(`Prompt text for id "${q.id}" duplicates an existing runtime question (possibly in a different chapter)`);
    }
  }

  if (issues.length > 0) {
    throw new ExportValidationError('duplicate-detection', issues);
  }
}

module.exports = { checkDuplicates, normalizeText };
