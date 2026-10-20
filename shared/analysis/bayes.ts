/**
 * Small-sample rate uncertainty (decision books: Downey, Think Bayes 1st ed.
 * Ch 4 "the Euro problem"; Kochenderfer et al., Algorithms for Decision
 * Making §4.2 beta-binomial learning, eqs 4.25–4.28; Ch 15 Bayesian model
 * estimation). A rate seen in few trials is a range, not a number: these
 * helpers turn counts into a Beta posterior and answer the questions the
 * decision code asks ("is it probably below the reference?", "is this link
 * probably weaker than that one?", "is this count surprising for the plan?").
 *
 * Priors are explicit and labelled. The default is Beta(1,1) ("uniform",
 * worth 2 observations), so owner counts dominate quickly. Benchmarks are
 * never used as priors here: they stay comparison thresholds, so a generic
 * benchmark can't quietly become the owner's evidence.
 */
import { logGamma } from "./stats";

export interface BetaPrior {
  a: number;
  b: number;
  /** Where the prior came from; shown wherever a posterior is used. */
  origin: "uniform" | "planned_rate" | "pooled_tenants" | "owner_history";
}

export const UNIFORM_PRIOR: BetaPrior = { a: 1, b: 1, origin: "uniform" };

export interface BetaPosterior {
  a: number;
  b: number;
  mean: number;
  /** Central 90% credible interval. */
  low: number;
  high: number;
  successes: number;
  trials: number;
  prior: BetaPrior;
  /** Pseudo-observations the prior is worth (a + b). */
  priorWeight: number;
}

/** Counts must be whole, non-negative and nested (successes ≤ trials). */
export function validCounts(successes: number, trials: number): boolean {
  return Number.isFinite(successes) && Number.isFinite(trials) && successes >= 0 && trials >= 0 && successes <= trials;
}

/** Continued fraction for the incomplete beta (Numerical Recipes betacf, modified Lentz). */
function betacf(a: number, b: number, x: number): number {
  const TINY = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b) = P(X ≤ x) for X ~ Beta(a, b). */
export function betaCdf(x: number, a: number, b: number): number {
  if (!(a > 0 && b > 0)) throw new RangeError("beta parameters must be > 0");
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbt = logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const bt = Math.exp(lbt);
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Inverse of betaCdf by bisection (60 halvings: error below 1e-15). */
export function betaQuantile(q: number, a: number, b: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (betaCdf(mid, a, b) < q) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Beta posterior for `successes` of `trials` under a labelled prior. */
export function betaPosterior(successes: number, trials: number, prior: BetaPrior = UNIFORM_PRIOR): BetaPosterior {
  if (!validCounts(successes, trials)) throw new RangeError("successes must be between 0 and trials");
  if (!(prior.a > 0 && prior.b > 0)) throw new RangeError("prior parameters must be > 0");
  const a = prior.a + successes;
  const b = prior.b + trials - successes;
  return { a, b, mean: a / (a + b), low: betaQuantile(0.05, a, b), high: betaQuantile(0.95, a, b), successes, trials, prior, priorWeight: prior.a + prior.b };
}

/** P(true rate < x) under the posterior. */
export function probBelow(post: Pick<BetaPosterior, "a" | "b">, x: number): number {
  return betaCdf(x, post.a, post.b);
}

/**
 * P(rate X < rate Y) for independent Beta posteriors, by Simpson integration
 * of pdf_X(t)·(1 − CDF_Y(t)) on a fixed 2,000-interval grid (deterministic).
 */
export function probLess(x: Pick<BetaPosterior, "a" | "b">, y: Pick<BetaPosterior, "a" | "b">): number {
  const n = 2000;
  const lnorm = logGamma(x.a + x.b) - logGamma(x.a) - logGamma(x.b);
  const pdf = (t: number) => (t <= 0 || t >= 1 ? 0 : Math.exp(lnorm + (x.a - 1) * Math.log(t) + (x.b - 1) * Math.log(1 - t)));
  // Endpoint densities can be infinite (a or b < 1); the integrand is integrated on the open grid only.
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    s += w * pdf(t) * (1 - betaCdf(t, y.a, y.b));
  }
  return Math.min(1, Math.max(0, s / (3 * n)));
}

/** Poisson P(X ≤ k) with mean λ (for "is this count surprising for the plan?"). */
export function poissonCdf(k: number, lambda: number): number {
  if (!(lambda >= 0) || !Number.isFinite(lambda)) throw new RangeError("lambda must be ≥ 0");
  if (k < 0) return 0;
  if (lambda === 0) return 1;
  let term = Math.exp(-lambda);
  let sum = term;
  for (let i = 1; i <= Math.floor(k); i++) {
    term *= lambda / i;
    sum += term;
  }
  return Math.min(1, sum);
}

/** Display: "4/30 (5–25%)". */
export function rangeText(p: BetaPosterior): string {
  const pc = (v: number) => `${Math.round(v * 1000) / 10}%`;
  return `${p.successes}/${p.trials} (likely ${pc(p.low)}–${pc(p.high)})`;
}
