// Batch exporter — intentionally thin. Writes exactly what it's given; no
// business logic, no validation, no formatting decisions belong here.

const fs = require('fs');

function exportBatch({ outputPath, topicId, templateId, generatorVersion, questions }) {
  const payload = {
    topicId,
    templateId,
    generatorVersion,
    generatedAt: new Date().toISOString(),
    reviewStatus: 'ai-generated',
    questions,
  };
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return payload;
}

module.exports = { exportBatch };
