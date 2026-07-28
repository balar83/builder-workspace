// Validator: candidate parameters -> solved + independently verified, or rejected.
//
// "Independent verification" here means: x is computed once via the closed-form
// transposition formula, then checked by a *separate* computation — substituting
// x back into the original a*x+b and c*x+d and confirming they're exactly equal
// as rationals (never floats). A bug in the solve formula's implementation will
// not, in general, also satisfy the substitution check, so this catches
// arithmetic mistakes in the formula itself, not just in the caller's usage of it.

const fraction = require('./fraction');

function solve({ a, b, c, d }) {
  // a*x + b = c*x + d  =>  (a-c)*x = d-b  =>  x = (d-b)/(a-c)
  return fraction.makeFraction(d - b, a - c);
}

function verifyBySubstitution({ a, b, c, d }, x) {
  const lhs = fraction.add(fraction.mul(fraction.fromInt(a), x), fraction.fromInt(b));
  const rhs = fraction.add(fraction.mul(fraction.fromInt(c), x), fraction.fromInt(d));
  return { lhs, rhs, matches: fraction.equals(lhs, rhs) };
}

function validateCandidate({ template, params }) {
  const { a, c, difficulty } = params;
  const band = template.difficultyBands[difficulty];
  if (!band) throw new Error(`Unknown difficulty band "${difficulty}"`);

  // Each reason carries a category so the CLI can report "Rejected (constraints)"
  // vs. "Rejected (verification)" without string-sniffing free-text messages.
  const reasons = [];

  if (a === c) {
    reasons.push({ category: 'constraint', message: 'degenerate: a equals c, the x term cancels after transposition' });
    return { valid: false, reasons, solution: null, verification: null };
  }

  const x = solve(params);
  const verification = verifyBySubstitution(params, x);

  if (!verification.matches) {
    reasons.push({ category: 'verification', message: 'verification failed: substituting x back into both sides did not produce equal values' });
  }
  if (fraction.equals(x, fraction.fromInt(0))) {
    reasons.push({ category: 'constraint', message: 'degenerate: solution is x = 0' });
  }

  const absSolution = Math.abs(fraction.toDecimal(x));
  if (absSolution > band.maxAbsSolution) {
    reasons.push({ category: 'constraint', message: `solution magnitude ${absSolution} exceeds band limit ${band.maxAbsSolution}` });
  }

  if (band.solutionType === 'integer' && !fraction.isInteger(x)) {
    reasons.push({ category: 'constraint', message: `band "${difficulty}" requires an integer solution, got ${fraction.toShortString(x)}` });
  }
  if (band.solutionType === 'integer-or-simple-fraction' && !fraction.isInteger(x) && x.den > band.maxDenominator) {
    reasons.push({ category: 'constraint', message: `fraction denominator ${x.den} exceeds band limit ${band.maxDenominator}` });
  }

  return {
    valid: reasons.length === 0,
    reasons,
    solution: x,
    verification,
  };
}

module.exports = { solve, verifyBySubstitution, validateCandidate };
