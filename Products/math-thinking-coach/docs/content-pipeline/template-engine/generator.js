// Generator: Question Template -> raw candidate parameter sets.
// Deliberately dumb — picks numbers inside the difficulty band's ranges and
// respects only the cheapest structural constraint (a !== c, checked here
// because it would otherwise force an infinite retry loop downstream in the
// Validator). Everything else (solvability, degeneracy, band fit) is the
// Validator's job, not this module's.

const { randInt } = require('./prng');

// Seam for future multi-variable support (x, y, z, m, n, t — listed today in
// template.metadata.supportedVariables but not yet used). Today this always
// returns the template's single active variable; when multi-variable
// generation is enabled, only this function's body changes — e.g.
// `return template.metadata.supportedVariables[randInt(rng, 0, n - 1)]` —
// not the call site in generateCandidates below.
function selectVariable({ template }) {
  return template.variableLabel;
}

function generateCandidates({ template, difficulty, count, rng }) {
  const band = template.difficultyBands[difficulty];
  if (!band) {
    throw new Error(`Unknown difficulty band "${difficulty}" for template ${template.templateId}`);
  }

  const candidates = [];
  for (let i = 0; i < count; i++) {
    let a, c;
    do {
      a = randInt(rng, band.aRange[0], band.aRange[1]);
      c = randInt(rng, band.cRange[0], band.cRange[1]);
    } while (a === c);

    const b = randInt(rng, band.bRange[0], band.bRange[1]);
    const d = randInt(rng, band.dRange[0], band.dRange[1]);

    candidates.push({ a, b, c, d, varLabel: selectVariable({ template }), difficulty });
  }
  return candidates;
}

module.exports = { generateCandidates };
