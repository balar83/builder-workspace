// Phase [2]: approval filter. Only reviewStatus === "approved" is eligible —
// no partial credit for "human-reviewed" or anything else. Precedence rule:
// a question's own reviewStatus (if present) overrides the file-level
// reviewStatus. Hand-authored files only ever set file-level status;
// template-generated batches carry both (see the Template Engine's
// canonicalFormatter.js), so this rule already matches the data as it exists.

const APPROVED = 'approved';

function effectiveStatus(question, fileLevelStatus) {
  return question.reviewStatus !== undefined ? question.reviewStatus : fileLevelStatus;
}

function applyApprovalGate({ topic, questionBank }) {
  const rejected = { topic: null, questions: [] };

  let approvedTopic = null;
  if (topic) {
    if (topic.reviewStatus === APPROVED) {
      approvedTopic = topic;
    } else {
      rejected.topic = { id: topic.id, reviewStatus: topic.reviewStatus };
    }
  }

  const approvedQuestions = [];
  for (const q of questionBank.questions) {
    const status = effectiveStatus(q, questionBank.reviewStatus);
    if (status === APPROVED) {
      approvedQuestions.push(q);
    } else {
      rejected.questions.push({ id: q.id, reviewStatus: status });
    }
  }

  return { approvedTopic, approvedQuestions, rejected };
}

module.exports = { applyApprovalGate, APPROVED };
