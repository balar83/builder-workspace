// Phase [3] (partial): referential validation — chapter consistency and
// topic consistency. Runs on the *approved* set, before transformation.
// Determines the chapterId for the question set here (canonical Question has
// no chapterId field at all — only the file-level topicId), since transform
// needs it and referential validation is where "can we even resolve this"
// gets decided.

const { ExportValidationError } = require('./loadCanonical');

function findChapter(chapters, chapterId) {
  for (const c of chapters) {
    if (c.id === chapterId) return c;
  }
  return null;
}

function findExistingTopic(existingTopics, topicId) {
  for (const t of existingTopics) {
    if (t.id === topicId) return t;
  }
  return null;
}

// Topic and Question partitions are resolved and touched *independently* -
// they must not share a single "chapterId" decision. If they did, exporting
// a chapter's Topic on a run with zero approved Questions would cause the
// Question merge to treat that chapterId as "touched" and wipe out whatever
// questions an earlier run had already exported for it, with nothing to
// replace them with. Each file's partition is only touched when this run has
// an actual, resolvable opinion about that specific file's content for this
// chapter.
function validateReferences({ topic, approvedTopic, approvedQuestions, questionBankTopicId, chapters, existingTopics }) {
  const issues = [];

  // Topic chapterId: resolved whenever a canonical-topic.json exists at all
  // (approved or not) - an unapproved Topic should still correctly cause
  // topics.json's partition for its chapter to end up empty, not stale.
  let topicChapterId = null;
  if (topic) {
    const chapter = findChapter(chapters, topic.chapterId);
    if (!chapter) {
      issues.push(`Topic "${topic.id}" references chapterId "${topic.chapterId}", which does not exist in chapters.json`);
    } else {
      topicChapterId = topic.chapterId;
    }
  }

  // Question chapterId: only resolved (and only required to resolve) when
  // there are approved questions to place. With zero approved questions,
  // failing to resolve a chapterId is not an error - it just means we don't
  // touch questions.json for this chapter at all this run.
  let questionChapterId = null;
  if (approvedQuestions.length > 0) {
    if (!questionBankTopicId) {
      issues.push('Question bank has no topicId — cannot resolve chapterId for export');
    } else if (topic && topic.id === questionBankTopicId && topicChapterId) {
      questionChapterId = topicChapterId;
    } else {
      const existing = findExistingTopic(existingTopics, questionBankTopicId);
      if (!existing) {
        issues.push(
          `Questions reference topicId "${questionBankTopicId}", which is neither being exported in this run nor already present in the runtime topics.json`
        );
      } else {
        const chapter = findChapter(chapters, existing.chapterId);
        if (!chapter) {
          issues.push(`Existing runtime topic "${existing.id}" references chapterId "${existing.chapterId}", which does not exist in chapters.json`);
        } else {
          questionChapterId = existing.chapterId;
        }
      }
    }
  }

  if (issues.length > 0) {
    throw new ExportValidationError('referential', issues);
  }

  return { topicChapterId, questionChapterId, topicId: questionBankTopicId };
}

module.exports = { validateReferences };
