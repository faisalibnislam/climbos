/**
 * Cold-start funnel scenarios: visits → signups → paying accounts → MRR.
 *
 * When every input is a point assumption the output is plain arithmetic,
 * labelled `assumption_scenario`, with NO interval (an interval would imply
 * evidence that does not exist). Only when at least one input carries
 * uncertainty (Poisson visits, an explicit Beta prior, or observed
 * successes/trials) is a seeded Monte Carlo run and p10/p50/p90 reported,
 * labelled `simulated_from_observed`.
 */

import { createRng } from "./prng";

/** Visits: a fixed count (assumption) or `{ mean }` meaning Poisson(mean) per scenario run. */
export type VisitsInput = number | { mean: number };

/**
 * A conversion rate:
 *  - number: point assumption in [0, 1]
 *  - { alpha, beta }: explicit Beta prior
 *  - { successes, trials }: observed data → Beta(1 + s, 1 + n − s) (uniform prior)
 */
export type RateInput = number | { alpha: number; beta: number } | { successes: number; trials: number };

export interface FunnelInput {
  visits: VisitsInput;
  signupRate: RateInput;
  paidRate: RateInput;
  /** Average revenue per paying account per month (major currency units). */
  arpu: number;
  /** Monthly logo churn in [0, 1). */
  monthlyChurn: number;
  /** Days from visit to paid conversion. */
  lagDays: number;
  /** Planning horizon in days. */
  horizonDays: number;
  /** Monte Carlo runs (default 5000). Ignored for pure assumptions. */
  runs?: number;
  /** PRNG seed (default 1). */
  seed?: number;
}

export interface Quantiles {
  p10: number;
  p50: number;
  p90: number;
}

export interface FunnelResult {
  kind: "assumption_scenario" | "simulated_from_observed";
  /** visits × signupRate × paidRate using point values / distribution means. Rounded to 6 dp. */
  expectedNewPayingAccounts: number;
  /** expectedNewPayingAccounts × ARPU, i.e. MRR once the cohort has converted, before churn. Rounded to cents. */
  newCohortMrrAtMaturation: number;
  /** Matured MRR after churn over the months remaining in the horizon (0 if lag ≥ horizon). Rounded to cents. */
  expectedMrrAtHorizon: number;
  /** Present only for `simulated_from_observed`. */
  simulation?: {
    runs: number;
    seed: number;
    newPayingAccounts: Quantiles;
    newCohortMrrAtMaturation: Quantiles;
  };
  uncertaintySources: string[];
  assumptions: string[];
}

const DAYS_PER_MONTH = 30.4375;

function round(x: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

function rateMean(r: RateInput): number {
  if (typeof r === "number") return r;
  if ("alpha" in r) return r.alpha / (r.alpha + r.beta);
  return (1 + r.successes) / (2 + r.trials);
}

function validateRate(r: RateInput, name: string): void {
  if (typeof r === "number") {
    if (!(r >= 0 && r <= 1)) throw new RangeError(`${name} must be in [0,1]`);
  } else if ("alpha" in r) {
    if (!(r.alpha > 0 && r.beta > 0)) throw new RangeError(`${name} Beta prior needs alpha, beta > 0`);
  } else if (!(Number.isInteger(r.successes) && Number.isInteger(r.trials) && r.successes >= 0 && r.trials >= r.successes)) {
    throw new RangeError(`${name} observed data needs integers 0 ≤ successes ≤ trials`);
  }
}

function describeRate(r: RateInput, name: string): string | null {
  if (typeof r === "number") return null;
  if ("alpha" in r) return `${name}: explicit prior Beta(${r.alpha}, ${r.beta})`;
  return `${name}: observed ${r.successes}/${r.trials} → Beta(${1 + r.successes}, ${1 + r.trials - r.successes})`;
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Run a funnel scenario. Deterministic for a given input and seed. */
export function simulateFunnel(input: FunnelInput): FunnelResult {
  validateRate(input.signupRate, "signupRate");
  validateRate(input.paidRate, "paidRate");
  const visitsMean = typeof input.visits === "number" ? input.visits : input.visits.mean;
  if (!(visitsMean >= 0) || !Number.isFinite(visitsMean)) throw new RangeError("visits must be finite and ≥ 0");
  if (!(input.arpu >= 0)) throw new RangeError("arpu must be ≥ 0");
  if (!(input.monthlyChurn >= 0 && input.monthlyChurn < 1)) throw new RangeError("monthlyChurn must be in [0,1)");

  const signup = rateMean(input.signupRate);
  const paid = rateMean(input.paidRate);
  const accountsRaw = visitsMean * signup * paid;
  const expectedNewPayingAccounts = round(accountsRaw, 6);
  const newCohortMrrAtMaturation = round(expectedNewPayingAccounts * input.arpu, 2);
  const monthsActive = Math.max(0, (input.horizonDays - input.lagDays) / DAYS_PER_MONTH);
  const retention = input.horizonDays >= input.lagDays ? (1 - input.monthlyChurn) ** monthsActive : 0;
  const expectedMrrAtHorizon = round(expectedNewPayingAccounts * input.arpu * retention, 2);

  const uncertaintySources: string[] = [];
  if (typeof input.visits !== "number") uncertaintySources.push(`visits: Poisson(mean=${input.visits.mean})`);
  const s1 = describeRate(input.signupRate, "signupRate");
  const s2 = describeRate(input.paidRate, "paidRate");
  if (s1) uncertaintySources.push(s1);
  if (s2) uncertaintySources.push(s2);

  const assumptions = [
    "Single cohort: all visits in the scenario convert after the stated lag.",
    "MRR at maturation = paying accounts × ARPU, before churn.",
    `MRR at horizon applies ${(input.monthlyChurn * 100).toFixed(2)}% monthly churn over ${monthsActive.toFixed(2)} months after the ${input.lagDays}-day lag.`,
  ];
  if (input.lagDays > input.horizonDays) assumptions.push("Lag exceeds horizon: the cohort does not mature within the horizon.");

  if (uncertaintySources.length === 0) {
    assumptions.push("All inputs are point assumptions: deterministic arithmetic only, no interval.");
    return {
      kind: "assumption_scenario",
      expectedNewPayingAccounts,
      newCohortMrrAtMaturation,
      expectedMrrAtHorizon,
      uncertaintySources,
      assumptions,
    };
  }

  const runs = input.runs ?? 5000;
  const seed = input.seed ?? 1;
  if (!Number.isInteger(runs) || runs < 1) throw new RangeError("runs must be a positive integer");
  const rng = createRng(seed);
  const drawRate = (r: RateInput): number => {
    if (typeof r === "number") return r;
    if ("alpha" in r) return rng.beta(r.alpha, r.beta);
    return rng.beta(1 + r.successes, 1 + r.trials - r.successes);
  };
  const accounts: number[] = [];
  for (let i = 0; i < runs; i++) {
    const v = typeof input.visits === "number" ? Math.round(input.visits) : rng.poisson(input.visits.mean);
    const signups = rng.binomial(v, drawRate(input.signupRate));
    accounts.push(rng.binomial(signups, drawRate(input.paidRate)));
  }
  accounts.sort((a, b) => a - b);
  const q = (p: number) => quantile(accounts, p);
  const accQ: Quantiles = { p10: q(0.1), p50: q(0.5), p90: q(0.9) };
  assumptions.push(
    "Point-assumption inputs are held fixed in simulation; only the listed uncertainty sources vary. Visit counts are rounded to integers for binomial sampling.",
  );

  return {
    kind: "simulated_from_observed",
    expectedNewPayingAccounts,
    newCohortMrrAtMaturation,
    expectedMrrAtHorizon,
    simulation: {
      runs,
      seed,
      newPayingAccounts: accQ,
      newCohortMrrAtMaturation: {
        p10: round(accQ.p10 * input.arpu, 2),
        p50: round(accQ.p50 * input.arpu, 2),
        p90: round(accQ.p90 * input.arpu, 2),
      },
    },
    uncertaintySources,
    assumptions,
  };
}

export interface ScenarioComparison {
  /** b − a */
  deltaNewPayingAccounts: number;
  deltaNewCohortMrrAtMaturation: number;
  deltaExpectedMrrAtHorizon: number;
  /** (b − a) / a, null when a is 0. */
  relativeMrrChange: number | null;
  note: "Scenario difference, not evidence of causal uplift";
}

/** Difference between two scenarios (b − a). This is arithmetic on assumptions, not a measured effect. */
export function compareScenarios(a: FunnelResult, b: FunnelResult): ScenarioComparison {
  const dMrr = round(b.newCohortMrrAtMaturation - a.newCohortMrrAtMaturation, 2);
  return {
    deltaNewPayingAccounts: round(b.expectedNewPayingAccounts - a.expectedNewPayingAccounts, 6),
    deltaNewCohortMrrAtMaturation: dMrr,
    deltaExpectedMrrAtHorizon: round(b.expectedMrrAtHorizon - a.expectedMrrAtHorizon, 2),
    relativeMrrChange: a.newCohortMrrAtMaturation === 0 ? null : dMrr / a.newCohortMrrAtMaturation,
    note: "Scenario difference, not evidence of causal uplift",
  };
}
