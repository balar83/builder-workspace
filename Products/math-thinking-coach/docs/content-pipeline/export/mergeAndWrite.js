// Phase [6]: merge-by-chapterId partition strategy + atomic write.
//
// Never a whole-file overwrite: existing runtime entries whose chapterId is
// NOT part of this export run are preserved byte-for-byte. Only the touched
// chapter(s)' entries are replaced. This is what keeps rational-numbers'
// hand-seeded content (no canonical source, no reviewStatus at all) safe
// from being silently deleted by an unrelated chapter's export.

const fs = require('fs');

function readExisting(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function mergeAndWrite({ filePath, newItems, touchedChapterIds }) {
  const existing = readExisting(filePath);

  const preserved = [];
  for (const item of existing) {
    if (touchedChapterIds.indexOf(item.chapterId) === -1) {
      preserved.push(item);
    }
  }

  const combined = preserved.concat(newItems);

  const seenIds = new Set();
  const duplicates = [];
  for (const item of combined) {
    if (seenIds.has(item.id)) duplicates.push(item.id);
    seenIds.add(item.id);
  }
  if (duplicates.length > 0) {
    throw new Error(`mergeAndWrite: duplicate id(s) in final merged output for ${filePath}: ${duplicates.join(', ')}`);
  }

  combined.sort((a, b) => {
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(combined, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, filePath);

  return {
    preservedCount: preserved.length,
    newCount: newItems.length,
    totalCount: combined.length,
  };
}

module.exports = { mergeAndWrite, readExisting };
