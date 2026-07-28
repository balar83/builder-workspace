// Phase [1]: load canonical content for one chapter and structurally validate
// it — before any approval filtering or transformation. Catches malformed
// input with canonical-specific error messages, separate from the later
// runtime-schema validation pass.

const fs = require('fs');
const path = require('path');

class ExportValidationError extends Error {
  constructor(phase, issues) {
    super(`Export validation failed at phase "${phase}": ${issues.length} issue(s)`);
    this.phase = phase;
    this.issues = issues;
  }
}

function requireFields(obj, fields, label, issues) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null) {
      issues.push(`${label} is missing required field "${field}"`);
    }
  }
}

function loadCanonicalTopic(chapterDir, issues) {
  const topicPath = path.join(chapterDir, 'canonical-topic.json');
  if (!fs.existsSync(topicPath)) {
    // Not every chapter has a consolidated Topic yet (Stage 10 design's
    // Finding 1) — absence is valid; Question-only export can still proceed.
    return null;
  }

  let topic;
  try {
    topic = JSON.parse(fs.readFileSync(topicPath, 'utf8'));
  } catch (err) {
    issues.push(`canonical-topic.json is not valid JSON: ${err.message}`);
    return null;
  }

  requireFields(topic, ['id', 'chapterId', 'title', 'reviewStatus', 'explanation', 'workedExamples', 'learningObjectives'], 'canonical-topic.json', issues);

  if (topic.explanation && !Array.isArray(topic.explanation.sections)) {
    issues.push('canonical-topic.json: explanation.sections must be an array');
  } else if (topic.explanation) {
    topic.explanation.sections.forEach((s, i) => {
      requireFields(s, ['title', 'body'], `canonical-topic.json explanation.sections[${i}]`, issues);
    });
  }

  if (topic.workedExamples && !Array.isArray(topic.workedExamples)) {
    issues.push('canonical-topic.json: workedExamples must be an array');
  } else if (topic.workedExamples) {
    topic.workedExamples.forEach((we, i) => {
      requireFields(we, ['problem', 'steps', 'finalAnswer'], `canonical-topic.json workedExamples[${i}]`, issues);
    });
  }

  if (topic.learningObjectives && !Array.isArray(topic.learningObjectives)) {
    issues.push('canonical-topic.json: learningObjectives must be an array');
  } else if (topic.learningObjectives) {
    topic.learningObjectives.forEach((g, i) => {
      requireFields(g, ['section', 'objectives'], `canonical-topic.json learningObjectives[${i}]`, issues);
    });
  }

  return topic;
}

function loadCanonicalQuestions(chapterDir, issues) {
  const questionsPath = path.join(chapterDir, 'stage6-questions.json');
  if (!fs.existsSync(questionsPath)) {
    issues.push(`stage6-questions.json not found at ${questionsPath}`);
    return { topicId: null, reviewStatus: null, questions: [] };
  }

  let bank;
  try {
    bank = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
  } catch (err) {
    issues.push(`stage6-questions.json is not valid JSON: ${err.message}`);
    return { topicId: null, reviewStatus: null, questions: [] };
  }

  requireFields(bank, ['topicId', 'reviewStatus', 'questions'], 'stage6-questions.json', issues);

  const seenIds = new Set();
  const questions = Array.isArray(bank.questions) ? bank.questions : [];
  questions.forEach((q, i) => {
    requireFields(q, ['id', 'prompt', 'expectedAnswer', 'hints', 'difficulty'], `stage6-questions.json questions[${i}]`, issues);
    if (q.id) {
      if (seenIds.has(q.id)) {
        issues.push(`stage6-questions.json: duplicate canonical id "${q.id}" within the same file`);
      }
      seenIds.add(q.id);
    }
  });

  return { topicId: bank.topicId, reviewStatus: bank.reviewStatus, questions };
}

function loadCanonicalAnswerKeys(chapterDir, issues) {
  const keysPath = path.join(chapterDir, 'answer-keys.json');
  if (!fs.existsSync(keysPath)) {
    // Not every chapter has this yet - absence means "no questions from this
    // chapter can be evaluated," caught later as a referential failure for
    // any approved question that needs one, not a structural error here.
    return null;
  }

  let bank;
  try {
    bank = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
  } catch (err) {
    issues.push(`answer-keys.json is not valid JSON: ${err.message}`);
    return null;
  }

  requireFields(bank, ['topicId', 'reviewStatus', 'answers'], 'answer-keys.json', issues);

  if (bank.answers && typeof bank.answers === 'object') {
    for (const [id, value] of Object.entries(bank.answers)) {
      if (typeof value !== 'string' || value.trim() === '') {
        issues.push(`answer-keys.json: answer for "${id}" must be a non-empty string`);
      }
    }
  } else if (bank.answers !== undefined) {
    issues.push('answer-keys.json: answers must be an object');
  }

  return bank;
}

function loadChapters(dataDir, issues) {
  const chaptersPath = path.join(dataDir, 'chapters.json');
  if (!fs.existsSync(chaptersPath)) {
    issues.push(`chapters.json not found at ${chaptersPath}`);
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(chaptersPath, 'utf8'));
  } catch (err) {
    issues.push(`chapters.json is not valid JSON: ${err.message}`);
    return [];
  }
}

function loadCanonical({ chapterDir, dataDir }) {
  const issues = [];
  const topic = loadCanonicalTopic(chapterDir, issues);
  const questionBank = loadCanonicalQuestions(chapterDir, issues);
  const answerKeyBank = loadCanonicalAnswerKeys(chapterDir, issues);
  const chapters = loadChapters(dataDir, issues);

  if (issues.length > 0) {
    throw new ExportValidationError('structural', issues);
  }

  return { topic, questionBank, answerKeyBank, chapters };
}

module.exports = { loadCanonical, ExportValidationError };
