/**
 * Small, dependency-free statistics for owner decisions (Kohavi et al., BK06,
 * Ch 2, 3, 17, 21: test the arithmetic in code, not in model prose). Standard
 * methods only; each function says what it assumes.
 */

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 erf approximation, |error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-((z / Math.SQRT2) ** 2));
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Inverse normal CDF (Acklam's rational approximation, relative error < 1.2e-9). */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError("p must be in (0, 1)");
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export function logGamma(x: number): number {
  // Lanczos approximation (g = 7).
  const g = 7;
  const coef = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = coef[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += coef[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Upper regularized incomplete gamma Q(s, x) (series / continued fraction, Numerical Recipes). */
function gammaQ(s: number, x: number): number {
  if (x <= 0) return 1;
  if (x < s + 1) {
    let sum = 1 / s;
    let term = sum;
    for (let n = 1; n < 500; n++) {
      term *= x / (s + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return Math.max(0, 1 - sum * Math.exp(-x + s * Math.log(x) - logGamma(s)));
  }
  let b = x + 1 - s;
  let c = 1 / 1e-300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return Math.exp(-x + s * Math.log(x) - logGamma(s)) * h;
}

/** Chi-square survival function: P(X ≥ x) for `df` degrees of freedom. */
export function chiSquareSf(x: number, df: number): number {
  return gammaQ(df / 2, x / 2);
}

const logChoose = (n: number, k: number) => logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);

/** Two-sided Fisher exact p for a 2×2 table [[a, b], [c, d]] (sums the tables no more likely than the observed one). */
export function fisherExact(a: number, b: number, c: number, d: number): number {
  const row1 = a + b;
  const col1 = a + c;
  const n = a + b + c + d;
  const p = (x: number) => Math.exp(logChoose(col1, x) + logChoose(n - col1, row1 - x) - logChoose(n, row1));
  const observed = p(a);
  let total = 0;
  for (let x = Math.max(0, row1 + col1 - n); x <= Math.min(row1, col1); x++) {
    const px = p(x);
    if (px <= observed * (1 + 1e-7)) total += px;
  }
  return Math.min(1, total);
}

/** Two-sided two-proportion z-test p (pooled standard error). Assumes independent units and enough conversions. */
export function twoProportionP(x1: number, n1: number, x2: number, n2: number): number {
  const pool = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pool * (1 - pool) * (1 / n1 + 1 / n2));
  if (!(se > 0)) return 1;
  const z = (x2 / n2 - x1 / n1) / se;
  return 2 * (1 - normalCdf(Math.abs(z)));
}
