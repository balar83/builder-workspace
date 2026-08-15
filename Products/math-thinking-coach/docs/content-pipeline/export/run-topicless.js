#!/usr/bin/env node
// One-off export path for a chapter that genuinely has no Topic (Practical
// Geometry) - the normal Stage 10 run.js cannot resolve a chapterId for
// questions without a Topic to anchor it (see referentialValidation.js).
// This reuses the same approval/transform/validate/merge modules as run.js -
// only the topic-coupled referential-resolution step is skipped, because
// the chapterId is already known directly (no Topic to infer it from).
//
// loadCanonical()'s structural loader (loadCanonical.js) is NOT reused here,
// despite covering similar ground: its requireFields() treats topicId as
// "missing" whenever it is undefined OR null, but this chapter's stage6-
// questions.json/answer-keys.json deliberately set topicId: null to signal
// "genuinely no Topic, not just none exported this run" (see
// stage2-topic-detection.md in this chapter's content-source directory).
// Verified directly: calling loadCanonical() against this chapter's files
// throws 'stage6-questions.json is missing required field "topicId"'.
// loadCanonicalQuestions/loadCanonicalAnswerKeys/loadChapters are also not
// individually exported from loadCanonical.js (only the composite
// loadCanonical() and ExportValidationError are) - so there's no way to
// reuse just the structural-validation piece without either hitting that
// same rejection or modifying loadCanonical.js itself, which would touch
// the normal Stage 10 pipeline. The minimal, targeted loading below is kept
// instead. applyApprovalGate() has no such conflict (it never reads
// topicId) and is reused as-is.
//
// Usage: node run-topicless.js --chapter=practical-geometry [--dry-run]

const path = require('path');
const fs = require('fs');

const { ExportValidationError } = require('./loadCanonical');
const { applyApprovalGate } = require('./approvalGate');
const { checkDuplicates } = require('./duplicateCheck');
const { transformQuestion } = require('./transform');
const { validateAgainstRuntimeSchemas } = require('./pydanticValidate');
const { mergeAndWrite, readExisting } = require('./mergeAndWrite');
const { mergeAnswerKeys } = require('./mergeAnswerKeys');

function parseArgs(argv) {
  const args = { chapter: null, dryRun: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') { args.dryRun = true; continue; }
    const eq = arg.indexOf('=');
    if (!arg.startsWith('--') || eq === -1) continue;
    const key = arg.slice(2, eq);
    if (key in args) args[key] = arg.slice(eq + 1);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.chapter) throw new Error('--chapter=<chapter-slug> is required');

  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const chapterDir = path.join(repoRoot, 'docs', 'content-source', args.chapter);
  const backendDir = path.join(repoRoot, 'backend');
  const dataDir = path.join(backendDir, 'app', 'data');
  const chaptersPath = path.join(dataDir, 'chapters.json');
  const questionsPath = path.join(dataDir, 'questions.json');
  const answerKeysPath = path.join(dataDir, 'answer_keys.json');

  // Chapter must already exist in chapters.json - same requirement the real
  // pipeline enforces for a Topic's chapterId.
  const chapters = JSON.parse(fs.readFileSync(chaptersPath, 'utf8'));
  if (!chapters.some((c) => c.id === args.chapter)) {
    throw new ExportValidationError('referential', [`chapterId "${args.chapter}" not found in chapters.json`]);
  }

  // Load canonical questions (no canonical-topic.json for this chapter, by design).
  const questionsFile = path.join(chapterDir, 'stage6-questions.json');
  const bank = JSON.parse(fs.readFileSync(questionsFile, 'utf8'));
  if (bank.topicId !== null) {
    throw new ExportValidationError('structural', ['topicless export requires stage6-questions.json topicId to be null']);
  }

  const answerKeysFile = path.join(chapterDir, 'answer-keys.json');
  const answerBank = JSON.parse(fs.readFileSync(answerKeysFile, 'utf8'));
  if (answerBank.reviewStatus !== 'approved') {
    throw new ExportValidationError('approval', ['answer-keys.json is not approved']);
  }

  // [2] approval gate - same shared function and precedence rule run.js uses.
  const { approvedQuestions } = applyApprovalGate({ topic: null, questionBank: bank });

  const existingQuestions = readExisting(questionsPath);
  checkDuplicates({ approvedQuestions, existingQuestions, touchedChapterId: args.chapter });

  const missingAnswerKeys = [];
  const newAnswerEntries = {};
  for (const q of approvedQuestions) {
    const value = answerBank.answers[q.id];
    if (value === undefined) missingAnswerKeys.push(q.id);
    else newAnswerEntries[q.id] = value;
  }
  if (missingAnswerKeys.length > 0) {
    throw new ExportValidationError('answer-keys', [`${missingAnswerKeys.length} approved question(s) have no approved answer-keys.json entry: ${missingAnswerKeys.join(', ')}`]);
  }

  const transformedQuestions = approvedQuestions.map((q) => transformQuestion(q, { chapterId: args.chapter, topicId: null }));

  const validation = validateAgainstRuntimeSchemas({ backendDir, chapters: [], topics: [], questions: transformedQuestions });
  if (!validation.valid) {
    console.log('Validation errors:', JSON.stringify(validation.errors, null, 2));
    throw new ExportValidationError('pydantic', ['see validation errors above']);
  }

  console.log(`Validated ${transformedQuestions.length} questions for "${args.chapter}" against the real Pydantic Question schema - 0 errors.`);

  if (args.dryRun) {
    console.log('Dry run: no files written.');
    return;
  }

  const questionResult = mergeAndWrite({ filePath: questionsPath, newItems: transformedQuestions, touchedChapterIds: [args.chapter] });
  const currentQuestionIds = new Set(readExisting(questionsPath).map((q) => q.id));
  const answerKeyResult = mergeAnswerKeys({ filePath: answerKeysPath, newEntries: newAnswerEntries, currentQuestionIds });

  const rewrittenQuestions = readExisting(questionsPath);
  const postWrite = validateAgainstRuntimeSchemas({ backendDir, chapters: [], topics: [], questions: rewrittenQuestions });
  if (!postWrite.valid) {
    console.log('Post-write validation errors:', JSON.stringify(postWrite.errors, null, 2));
    throw new ExportValidationError('post-write-verification', ['see errors above']);
  }

  console.log(`Wrote ${questionResult.newCount} questions (preserved ${questionResult.preservedCount} from other chapters, total ${questionResult.totalCount}).`);
  console.log(`Answer keys: ${answerKeyResult.totalCount} total after merge.`);
  console.log('Post-write re-validation passed.');
}

main();
