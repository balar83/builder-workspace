// Canonical formatter: validated candidate -> today's canonical Question JSON
// shape (same shape as stage6-questions.json), plus provenance-only fields
// that the export mapping already ignores for hand-authored questions
// (templateId, generatorVersion, generatedParams, generationSeed).
//
// The id is a deterministic hash of (templateId, generatorVersion, params) —
// not a counter — so regenerating from the same template+params+version always
// produces the same id and the same content, never a re-roll.

const crypto = require('crypto');
const fraction = require('./fraction');

function formatLinearTerm(coeff, varLabel) {
  if (coeff === 1) return varLabel;
  if (coeff === -1) return `-${varLabel}`;
  return `${coeff}${varLabel}`;
}

function formatSignedConstant(value) {
  if (value === 0) return '';
  return value > 0 ? ` + ${value}` : ` - ${Math.abs(value)}`;
}

function formatEquation({ a, b, c, d, varLabel }) {
  const lhs = `${formatLinearTerm(a, varLabel)}${formatSignedConstant(b)}`;
  const rhs = `${formatLinearTerm(c, varLabel)}${formatSignedConstant(d)}`;
  return `${lhs} = ${rhs}`;
}

function formatExpectedAnswer(params, x, verification) {
  const { a, b, c, d, varLabel } = params;
  const xShort = fraction.toShortString(x);
  const xAnnotated = fraction.toAnnotatedString(x);
  const lhsExpr = `${a}(${xShort})${formatSignedConstant(b)}`;
  const rhsExpr = `${c}(${xShort})${formatSignedConstant(d)}`;
  const lhsVal = fraction.toShortString(verification.lhs);
  const rhsVal = fraction.toShortString(verification.rhs);
  return `${varLabel} = ${xAnnotated}. Check: LHS = ${lhsExpr} = ${lhsVal}, RHS = ${rhsExpr} = ${rhsVal}. LHS = RHS.`;
}

function makeQuestionId({ template, params }) {
  const key = `${template.templateId}|${template.generatorVersion}|${params.a}|${params.b}|${params.c}|${params.d}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 8);
  return `le-gen-${hash}`;
}

function formatCanonicalQuestion({ template, params, solution, verification, generationSeed }) {
  const prompt = `Solve for ${params.varLabel} and check your result: ${formatEquation(params)}`;
  const expectedAnswer = formatExpectedAnswer(params, solution, verification);

  return {
    id: makeQuestionId({ template, params }),
    sourceRef: { generated: true, templateId: template.templateId },
    objective: template.objective,
    bloomLevel: template.bloomLevel,
    prompt,
    expectedAnswer,
    hints: [...template.hintTemplate],
    difficulty: params.difficulty,
    tags: [...template.baseTags],
    misconception: { ...template.misconception },
    reviewStatus: 'ai-generated',
    // Canonical-only provenance — never read by the export mapping, same
    // treatment as tags/bloomLevel/misconception today.
    templateId: template.templateId,
    generatorVersion: template.generatorVersion,
    generatedParams: { a: params.a, b: params.b, c: params.c, d: params.d, varLabel: params.varLabel },
    generationSeed: generationSeed ?? null,
  };
}

module.exports = { formatEquation, formatExpectedAnswer, makeQuestionId, formatCanonicalQuestion };
