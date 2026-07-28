#!/usr/bin/env node
// Thin CLI glue: Template -> Generator -> Validator -> Duplicate detector ->
// Canonical formatter -> Batch exporter. No business logic lives here beyond
// the retry-until-count loop, since not every raw candidate survives
// validation/dedup.
//
// Usage:
//   node run.js --template=<path> --difficulty=Easy --count=5 [--seed=42] [--out=<path>]

const path = require('path');
const fs = require('fs');

const { createRng } = require('./prng');
const { generateCandidates } = require('./generator');
const { validateCandidate } = require('./validator');
const { createDuplicateRegistry } = require('./duplicateDetector');
const { formatCanonicalQuestion } = require('./canonicalFormatter');
const { exportBatch } = require('./batchExporter');

function parseArgs(argv) {
  const args = { difficulty: 'Easy', count: '5', seed: null, template: null, chapterDir: null, out: null };
  for (const arg of argv.slice(2)) {
    const eq = arg.indexOf('=');
    if (!arg.startsWith('--') || eq === -1) continue;
    const key = arg.slice(2, eq);
    const value = arg.slice(eq + 1);
    if (key in args) args[key] = value;
  }
  return { ...args, count: Number(args.count) };
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.template) {
    throw new Error('--template=<path to template JSON> is required');
  }
  if (!Number.isInteger(args.count) || args.count < 1) {
    throw new Error(`--count must be a positive integer, got "${args.count}"`);
  }

  const templatePath = path.resolve(args.template);
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

  // templates/<file>.json -> chapter dir is one level up from templates/
  const chapterDir = args.chapterDir
    ? path.resolve(args.chapterDir)
    : path.dirname(path.dirname(templatePath));
  const existingBankPath = path.join(chapterDir, 'stage6-questions.json');
  const outputPath = args.out
    ? path.resolve(args.out)
    : path.join(chapterDir, 'stage6-questions-generated-batch1.json');

  // Seed is always recorded, even if not passed explicitly, so every batch is
  // reproducible — "how was this generated" should never be "we don't know."
  const seed = args.seed ?? String(Date.now());
  const rng = createRng(seed);
  const registry = createDuplicateRegistry({ existingBankPath });

  const accepted = [];
  const rejectedLog = [];
  const maxAttempts = args.count * 40 + 200;
  let attempts = 0;

  while (accepted.length < args.count && attempts < maxAttempts) {
    const stillNeeded = args.count - accepted.length;
    const candidates = generateCandidates({ template, difficulty: args.difficulty, count: stillNeeded, rng });

    for (const params of candidates) {
      if (accepted.length >= args.count) break;
      attempts++;

      const validation = validateCandidate({ template, params });
      if (!validation.valid) {
        rejectedLog.push({ params, reasons: validation.reasons });
        continue;
      }

      const question = formatCanonicalQuestion({
        template,
        params,
        solution: validation.solution,
        verification: validation.verification,
        generationSeed: seed,
      });

      const dup = registry.isDuplicate(params, question.prompt);
      if (dup.duplicate) {
        rejectedLog.push({ params, reasons: [dup.reason] });
        continue;
      }

      registry.register(params);
      accepted.push(question);
    }
  }

  if (accepted.length < args.count) {
    console.warn(
      `Warning: only generated ${accepted.length}/${args.count} valid, non-duplicate questions after ${attempts} attempts (cap: ${maxAttempts}).`
    );
  }

  exportBatch({
    outputPath,
    topicId: template.topicId,
    templateId: template.templateId,
    generatorVersion: template.generatorVersion,
    questions: accepted,
  });

  // Tally rejections by category (constraint / verification / duplicate) for
  // the generation statistics report — no string-sniffing, categories come
  // directly from validator.js / duplicateDetector.js.
  const byCategory = { constraint: 0, verification: 0, duplicate: 0 };
  for (const r of rejectedLog) {
    for (const reason of r.reasons) {
      byCategory[reason.category] = (byCategory[reason.category] || 0) + 1;
    }
  }

  const meta = template.metadata;
  console.log(`Template: ${template.templateId} (${meta ? meta.mathematicalFamily : 'n/a'}) v${meta ? meta.templateVersion : template.generatorVersion}`);
  console.log(`Difficulty: ${args.difficulty} | Seed: ${seed} | Output: ${outputPath}`);
  console.log('---');
  console.log(`Generated:               ${attempts}`);
  console.log(`Accepted:                ${accepted.length}`);
  console.log(`Rejected (constraints):  ${byCategory.constraint}`);
  console.log(`Rejected (verification): ${byCategory.verification}`);
  console.log(`Rejected (duplicates):   ${byCategory.duplicate}`);
}

main();
