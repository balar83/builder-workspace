// Duplicate detector — roadmap and current scope.
//
// Level 1 — Exact match. IMPLEMENTED.
//   a) Identical (a,b,c,d) parameter tuple already produced earlier in this run.
//   b) Identical prompt text (normalized: lowercased, whitespace-collapsed)
//      already present in the existing, hand-authored bank (stage6-questions.json).
//
// Level 2 — Normalized algebraic form. NOT IMPLEMENTED.
//   Would catch equations that are the same up to presentation: sides swapped
//   (existing "5x + 9 = 5 + 3x" vs. a generated "3x + 5 = 9 + 5x"), or terms
//   reordered. Requires reducing both equations to a canonical normal form
//   (e.g. always (a-c)x = d-b, coefficients sign-normalized) before comparing,
//   rather than comparing surface text or raw params.
//
// Level 3 — Equivalent mathematical family. NOT IMPLEMENTED.
//   Would catch equations that are scalar multiples of one another (e.g.
//   "3x = 2x + 18" vs. a generated "6x = 4x + 36", the same relationship
//   scaled by 2) even though no single normal form makes them textually
//   identical. Requires comparing the reduced ratio (a-c):(d-b) rather than
//   the raw coefficients.
//
// Only Level 1 is implemented today — sufficient at current volume (~10
// existing questions in this exact shape). Level 2/3 become worth building
// once template-generated batches grow large enough, or enough templates
// share overlapping families, that presentation/scaling duplicates actually
// start occurring rather than being a theoretical risk.

const fs = require('fs');

function normalizePromptText(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function loadExistingPrompts(existingBankPath) {
  if (!fs.existsSync(existingBankPath)) return [];
  const raw = JSON.parse(fs.readFileSync(existingBankPath, 'utf8'));
  const questions = Array.isArray(raw) ? raw : raw.questions;
  return questions.map((q) => normalizePromptText(q.prompt));
}

function makeTupleKey({ a, b, c, d }) {
  return `${a}|${b}|${c}|${d}`;
}

function createDuplicateRegistry({ existingBankPath }) {
  const existingPromptSet = new Set(loadExistingPrompts(existingBankPath));
  const seenTuplesThisRun = new Set();

  return {
    isDuplicate(params, formattedPrompt) {
      const tupleKey = makeTupleKey(params);
      if (seenTuplesThisRun.has(tupleKey)) {
        return {
          duplicate: true,
          reason: { category: 'duplicate', message: 'duplicate: identical parameter tuple already generated in this run' },
        };
      }
      if (existingPromptSet.has(normalizePromptText(formattedPrompt))) {
        return {
          duplicate: true,
          reason: { category: 'duplicate', message: 'duplicate: identical prompt text already exists in the authored bank' },
        };
      }
      return { duplicate: false };
    },
    register(params) {
      seenTuplesThisRun.add(makeTupleKey(params));
    },
  };
}

module.exports = { createDuplicateRegistry, normalizePromptText };
