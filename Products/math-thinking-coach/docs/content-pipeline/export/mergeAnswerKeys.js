// answer_keys.json is a flat { questionId: answer } map - no chapterId field
// per entry, unlike topics.json/questions.json. So "which entries belong to
// this chapter" can't be determined by partition key. Instead: any key that
// isn't a real id in the (already-merged) questions.json is provably dead
// (evaluation_service looks up by exact question id, so an orphaned key can
// never be read) and is dropped on every write. This is what cleans up stale
// entries left behind when a chapter's question ids change between exports.

const fs = require('fs');
const { readExisting } = require('./mergeAndWrite');

function mergeAnswerKeys({ filePath, newEntries, currentQuestionIds }) {
  const existingRaw = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};

  const combined = {};
  for (const [id, value] of Object.entries(existingRaw)) {
    if (currentQuestionIds.has(id)) {
      combined[id] = value;
    }
  }
  for (const [id, value] of Object.entries(newEntries)) {
    combined[id] = value;
  }

  const sortedKeys = Object.keys(combined).sort();
  const sorted = {};
  for (const key of sortedKeys) sorted[key] = combined[key];

  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, filePath);

  return { totalCount: sortedKeys.length };
}

module.exports = { mergeAnswerKeys, readExisting };
