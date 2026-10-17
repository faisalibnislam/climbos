/**
 * Seeded pseudo-random number generation for reproducible simulations.
 *
 * Everything here is deterministic given a seed: no Math.random, no clocks,
 * no Node APIs. Safe to run in Node and in the Convex V8 runtime.
 */

/** A seeded generator returning uniform floats in [0, 1). */
export type UniformSource = () => number;

/**
 * mulberry32: a small, fast 32-bit generator. Good statistical quality for
 * Monte Carlo work of this size; NOT cryptographically secure.
 * The seed is coerced to an unsigned 32-bit integer.
 */
export function mulberry32(seed: number): UniformSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded random generator with distribution helpers. */
export interface Rng {
  /** Raw uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  uniform(min?: number, max?: number): number;
  /** Normal(mean, sd) via Box-Muller (spare value cached). */
  normal(mean?: number, sd?: number): number;
  /** Gamma(shape, scale) via Marsaglia-Tsang; shape < 1 uses the boost u^(1/shape). */
  gamma(shape: number, scale?: number): number;
  /** Beta(alpha, beta) via X/(X+Y) with X~Gamma(alpha), Y~Gamma(beta). */
  beta(alpha: number, beta: number): number;
  /**
   * Binomial(n, p). Exact inverse transform when n*min(p,1-p) < 30; otherwise
   * a normal approximation with continuity correction, rounded and clamped to
   * [0, n]. The approximation is accurate when the mean and variance are large.
   */
  binomial(n: number, p: number): number;
  /**
   * Poisson(lambda). Exact (Knuth multiplication) for lambda < 30; otherwise a
   * normal approximation with continuity correction, rounded and clamped at 0.
   */
  poisson(lambda: number): number;
}

/** Create a seeded {@link Rng}. Same seed => identical sequence of draws. */
export function createRng(seed: number): Rng {
  const u = mulberry32(seed);
  let spareNormal: number | null = null;

  const next = (): number => u();

  const uniform = (min = 0, max = 1): number => min + (max - min) * u();

  const standardNormal = (): number => {
    if (spareNormal !== null) {
      const s = spareNormal;
      spareNormal = null;
      return s;
    }
    let u1 = u();
    while (u1 <= Number.MIN_VALUE) u1 = u();
    const u2 = u();
    const r = Math.sqrt(-2 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    spareNormal = r * Math.sin(theta);
    return r * Math.cos(theta);
  };

  const normal = (mean = 0, sd = 1): number => mean + sd * standardNormal();

  const gamma = (shape: number, scale = 1): number => {
    if (!(shape > 0) || !(scale > 0)) {
      throw new RangeError(`gamma requires shape > 0 and scale > 0 (got ${shape}, ${scale})`);
    }
    if (shape < 1) {
      let uu = u();
      while (uu <= Number.MIN_VALUE) uu = u();
      return gamma(shape + 1, scale) * Math.pow(uu, 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number;
      let v: number;
      do {
        x = standardNormal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const uu = u();
      if (uu < 1 - 0.0331 * x * x * x * x) return d * v * scale;
      if (uu > 0 && Math.log(uu) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
    }
  };

  const beta = (a: number, b: number): number => {
    const x = gamma(a);
    const y = gamma(b);
    return x / (x + y);
  };

  const binomial = (n: number, p: number): number => {
    if (!Number.isInteger(n) || n < 0) throw new RangeError(`binomial n must be a non-negative integer (got ${n})`);
    if (!(p >= 0 && p <= 1)) throw new RangeError(`binomial p must be in [0,1] (got ${p})`);
    if (n === 0 || p === 0) return 0;
    if (p === 1) return n;
    if (p > 0.5) return n - binomial(n, 1 - p);
    if (n * p < 30) {
      // Inverse transform: walk the CDF from k = 0.
      const q = 1 - p;
      const ratio = p / q;
      let prob = Math.pow(q, n);
      let cdf = prob;
      const target = u();
      let k = 0;
      while (target > cdf && k < n) {
        prob *= (ratio * (n - k)) / (k + 1);
        cdf += prob;
        k += 1;
      }
      return k;
    }
    const mean = n * p;
    const sd = Math.sqrt(n * p * (1 - p));
    const draw = Math.floor(mean + sd * standardNormal() + 0.5);
    return Math.min(n, Math.max(0, draw));
  };

  const poisson = (lambda: number): number => {
    if (!(lambda >= 0) || !Number.isFinite(lambda)) throw new RangeError(`poisson lambda must be finite and >= 0 (got ${lambda})`);
    if (lambda === 0) return 0;
    if (lambda < 30) {
      const limit = Math.exp(-lambda);
      let k = 0;
      let prod = u();
      while (prod > limit) {
        k += 1;
        prod *= u();
      }
      return k;
    }
    const draw = Math.floor(lambda + Math.sqrt(lambda) * standardNormal() + 0.5);
    return Math.max(0, draw);
  };

  return { next, uniform, normal, gamma, beta, binomial, poisson };
}
