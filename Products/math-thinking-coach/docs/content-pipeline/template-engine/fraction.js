// Exact rational arithmetic — used so that solving and verifying template
// instances never relies on floating point (0.1 + 0.2 !== 0.3 territory).
// A fraction is always kept reduced, with a positive denominator.

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function makeFraction(num, den) {
  if (den === 0) throw new Error('Fraction denominator cannot be zero');
  if (den < 0) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

function fromInt(n) {
  return { num: n, den: 1 };
}

function add(a, b) {
  return makeFraction(a.num * b.den + b.num * a.den, a.den * b.den);
}

function mul(a, b) {
  return makeFraction(a.num * b.num, a.den * b.den);
}

function equals(a, b) {
  // Both sides are always kept reduced, so equal fractions have identical num/den.
  return a.num === b.num && a.den === b.den;
}

function isInteger(a) {
  return a.den === 1;
}

function toDecimal(a) {
  return a.num / a.den;
}

function toShortString(a) {
  return a.den === 1 ? String(a.num) : `${a.num}/${a.den}`;
}

function toAnnotatedString(a) {
  if (a.den === 1) return String(a.num);
  const rounded = Math.round(toDecimal(a) * 1000) / 1000;
  return `${a.num}/${a.den} (= ${rounded})`;
}

module.exports = {
  makeFraction,
  fromInt,
  add,
  mul,
  equals,
  isInteger,
  toDecimal,
  toShortString,
  toAnnotatedString,
};
