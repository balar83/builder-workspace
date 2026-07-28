#!/usr/bin/env node
// Stage 10 Export — CLI orchestrator.
//
// Canonical Content -> [1] Structural Validation -> [2] Approval Filter ->
// [3] Referential + Duplicate Validation -> [4] Whitelist Transformation ->
// [5] Real Pydantic Validation -> [6] Merge + Atomic Write -> [7] Verification Report
//
// Usage:
//   node run.js --chapter=linear-equations [--dry-run] [--repoRoot=<path>]

const path = require('path');

const { loadCanonical, ExportValidationError } = require('./loadCanonical');
const { applyApprovalGate } = require('./approvalGate');
const { validateReferences } = require('./referentialValidation');
const { checkDuplicates } = require('./duplicateCheck');
const { transformTopic, transformQuestion } = require('./transform');
const { validateAgainstRuntimeSchemas } = require('./pydanticValidate');
const { mergeAndWrite, readExisting } = require('./mergeAndWrite');
const { mergeAnswerKeys } = require('./mergeAnswerKeys');

function parseArgs(argv) {
  const args = { chapter: null, repoRoot: null, dataDir: null, dryRun: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    const eq = arg.indexOf('=');
    if (!arg.startsWith('--') || eq === -1) continue;
    const key = arg.slice(2, eq);
    const value = arg.slice(eq + 1);
    if (key in args) args[key] = value;
  }
  return args;
}

function printReport(report) {
  console.log('=== Stage 10 Export Report ===');
  console.log('Chapter:              ' + report.chapter);
  console.log('Aborted:              ' + report.aborted);
  if (report.aborted) console.log('Failed phase:         ' + report.phase);
  console.log('Topics Exported:      ' + report.topicsExported);
  console.log('Questions Exported:   ' + report.questionsExported);
  console.log('Answer Keys Exported: ' + (report.answerKeysExported || 0));
  console.log('Rejected Topic:       ' + (report.rejected.topic ? JSON.stringify(report.rejected.topic) : 'none'));
  console.log('Rejected Questions:   ' + report.rejected.questions.length);
  console.log('Validation Errors:    ' + report.validationErrors.length);
  for (const e of report.validationErrors) {
    console.log('  - ' + (typeof e === 'string' ? e : JSON.stringify(e)));
  }
  console.log('Output Files:         ' + (report.outputFiles.length > 0 ? report.outputFiles.join(', ') : 'none'));
  console.log('Export Duration:      ' + report.durationMs + 'ms');
  console.log('==============================');
}

function main() {
  const startTime = Date.now();
  const args = parseArgs(process.argv);
  if (!args.chapter) throw new Error('--chapter=<chapter-slug> is required');

  const repoRoot = args.repoRoot ? path.resolve(args.repoRoot) : path.resolve(__dirname, '..', '..', '..');
  const chapterDir = path.join(repoRoot, 'docs', 'content-source', args.chapter);
  // backendDir always resolves against the real repo root (for the real
  // Python venv + real Pydantic schemas) even when --dataDir points test
  // runs at a scratch fixture instead of the real backend/app/data/.
  const backendDir = path.join(path.resolve(__dirname, '..', '..', '..'), 'backend');
  const dataDir = args.dataDir ? path.resolve(args.dataDir) : path.join(backendDir, 'app', 'data');
  const topicsPath = path.join(dataDir, 'topics.json');
  const questionsPath = path.join(dataDir, 'questions.json');
  const answerKeysPath = path.join(dataDir, 'answer_keys.json');

  const report = {
    chapter: args.chapter,
    topicsExported: 0,
    questionsExported: 0,
    rejected: { topic: null, questions: [] },
    validationErrors: [],
    outputFiles: [],
    durationMs: null,
    aborted: false,
  };

  try {
    // [1]
    const { topic, questionBank, answerKeyBank, chapters } = loadCanonical({ chapterDir, dataDir });

    // [2]
    const { approvedTopic, approvedQuestions, rejected } = applyApprovalGate({ topic, questionBank });
    report.rejected = rejected;

    const existingTopics = readExisting(topicsPath);
    const existingQuestions = readExisting(questionsPath);

    // [3] referential
    const { topicChapterId, questionChapterId, topicId } = validateReferences({
      topic,
      approvedTopic,
      approvedQuestions,
      questionBankTopicId: questionBank.topicId,
      chapters,
      existingTopics,
    });

    // [3] duplicates - excludes the chapter this run is about to replace, so
    // re-exporting unchanged content isn't flagged as colliding with itself
    checkDuplicates({ approvedQuestions, existingQuestions, touchedChapterId: questionChapterId });

    // [3] answer-key co-requisite: a question cannot be exported without an
    // approved, matching entry in answer-keys.json - evaluation_service reads
    // expected answers from that separate file (ADR-001), never from the
    // Question.solution field. Discovered mid-milestone; see answer-keys.json's
    // own note for the full explanation.
    const answerKeysApproved = Boolean(answerKeyBank && answerKeyBank.reviewStatus === 'approved');
    const missingAnswerKeys = [];
    const newAnswerEntries = {};
    if (approvedQuestions.length > 0) {
      for (const q of approvedQuestions) {
        const value = answerKeysApproved ? answerKeyBank.answers[q.id] : undefined;
        if (value === undefined) {
          missingAnswerKeys.push(q.id);
        } else {
          newAnswerEntries[q.id] = value;
        }
      }
    }
    if (missingAnswerKeys.length > 0) {
      throw new ExportValidationError('answer-keys', [
        `${missingAnswerKeys.length} approved question(s) have no approved answer-keys.json entry: ${missingAnswerKeys.join(', ')}`,
      ]);
    }

    // [4] whitelist transformation
    const transformedTopics = [];
    if (approvedTopic) {
      transformedTopics.push(transformTopic(approvedTopic));
    }
    const transformedQuestions = [];
    for (const q of approvedQuestions) {
      transformedQuestions.push(transformQuestion(q, { chapterId: questionChapterId, topicId }));
    }

    // [5] real Pydantic validation, pre-write
    const validation = validateAgainstRuntimeSchemas({
      backendDir,
      chapters: [],
      topics: transformedTopics,
      questions: transformedQuestions,
    });
    if (!validation.valid) {
      report.validationErrors = validation.errors;
      throw new ExportValidationError('pydantic', ['see validationErrors']);
    }

    if (args.dryRun) {
      report.topicsExported = transformedTopics.length;
      report.questionsExported = transformedQuestions.length;
      report.answerKeysExported = Object.keys(newAnswerEntries).length;
      report.dryRun = true;
      report.durationMs = Date.now() - startTime;
      printReport(report);
      return;
    }

    // [6] merge + atomic write - topics and questions touch their own
    // chapterId partitions independently (see referentialValidation.js).
    const topicTouched = topicChapterId ? [topicChapterId] : [];
    const questionTouched = questionChapterId ? [questionChapterId] : [];

    const topicResult = mergeAndWrite({ filePath: topicsPath, newItems: transformedTopics, touchedChapterIds: topicTouched });
    const questionResult = mergeAndWrite({ filePath: questionsPath, newItems: transformedQuestions, touchedChapterIds: questionTouched });
    report.topicsPreserved = topicResult.preservedCount;
    report.questionsPreserved = questionResult.preservedCount;

    // Answer keys merge only after questions.json is rewritten, so orphan
    // cleanup (any key not matching a real, current question id) sees the
    // final, post-merge set of valid ids - not the pre-merge one.
    const currentQuestionIds = new Set(readExisting(questionsPath).map((q) => q.id));
    const answerKeyResult = mergeAnswerKeys({ filePath: answerKeysPath, newEntries: newAnswerEntries, currentQuestionIds });
    report.answerKeysExported = Object.keys(newAnswerEntries).length;
    report.answerKeysTotal = answerKeyResult.totalCount;

    report.outputFiles.push(topicsPath, questionsPath, answerKeysPath);

    // [7] post-write verification - re-read from disk, re-validate for real
    const rewrittenTopics = readExisting(topicsPath);
    const rewrittenQuestions = readExisting(questionsPath);
    const postWrite = validateAgainstRuntimeSchemas({
      backendDir,
      chapters: [],
      topics: rewrittenTopics,
      questions: rewrittenQuestions,
    });
    if (!postWrite.valid) {
      report.validationErrors = postWrite.errors;
      report.postWriteValidationFailed = true;
      report.aborted = true;
      report.phase = 'post-write-verification';
      report.durationMs = Date.now() - startTime;
      printReport(report);
      process.exitCode = 1;
      return;
    }

    report.topicsExported = transformedTopics.length;
    report.questionsExported = transformedQuestions.length;
    report.durationMs = Date.now() - startTime;
    printReport(report);
  } catch (err) {
    report.aborted = true;
    if (err instanceof ExportValidationError) {
      if (report.validationErrors.length === 0) report.validationErrors = err.issues;
      report.phase = err.phase;
    } else {
      report.validationErrors = [err.message];
      report.phase = 'unknown';
    }
    report.durationMs = Date.now() - startTime;
    printReport(report);
    process.exitCode = 1;
  }
}

main();
