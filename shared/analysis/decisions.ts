/**
 * Decision calculators (expansion plan slice 1). Owners ask "is $30 enough?",
 * "did the new page win?", "how long would a test take?". These answer the
 * arithmetic part in code, with units, denominators and the right causal
 * label, so neither Climb AI nor a plan agent does it in prose.
 *
 * Sources: BK02 Monetizing Innovation (cost floor is a viability check, not a
 * way to set price); BK06 Trustworthy Online Controlled Experiments (points vs
 * relative change, sample-ratio mismatch, sample size, no verdict before the
 * planned end); Book 12 of the Growth Intelligence Library (contribution vs profit).
 */
import { z } from "zod";
import { chiSquareSf, fisherExact, normalQuantile, twoProportionP } from "./stats";

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

/* ---------------- money ---------------- */

export interface MarginResult {
  price: number;
  totalCost: number;
  contribution: number;
  /** Contribution ÷ price. */
  contributionMargin: number | null;
  /** Contribution ÷ cost: a markup, not a margin. */
  markupOnCost: number | null;
  costBoundary: string;
  meetsTarget: boolean | null;
  notes: string[];
}

/** Contribution and margin at a price under a stated cost boundary. Not company profit. */
export function margin(p: { price: number; costs: { name: string; amount: number }[]; costBoundary?: string; targetMargin?: number }): MarginResult {
  if (!(p.price > 0)) throw new RangeError("price must be above 0");
  const totalCost = p.costs.reduce((s, c) => s + c.amount, 0);
  const contribution = p.price - totalCost;
  const cm = contribution / p.price;
  return {
    price: p.price,
    totalCost: round(totalCost, 2),
    contribution: round(contribution, 2),
    contributionMargin: round(cm),
    markupOnCost: totalCost > 0 ? round(contribution / totalCost) : null,
    costBoundary: p.costBoundary ?? "the listed costs only",
    meetsTarget: p.targetMargin === undefined ? null : cm >= p.targetMargin - 1e-9,
    notes: [
      "Contribution margin covers only the listed costs; it is not company net profit (payment fees, refunds, acquisition, fixed costs and tax are outside unless listed).",
      ...(totalCost > 0 ? [`A ${Math.round((contribution / totalCost) * 100)}% markup on cost is a ${Math.round(cm * 100)}% margin on price; don't swap them.`] : []),
    ],
  };
}

/** The lowest price that keeps `targetMargin` over `unitCost`. A viability floor, never evidence anyone will pay it. */
export function priceFloor(p: { unitCost: number; targetMargin: number; statedWillingnessToPay?: number }) {
  if (!(p.targetMargin >= 0 && p.targetMargin < 1)) throw new RangeError("targetMargin must be in [0, 1)");
  const floor = p.unitCost / (1 - p.targetMargin);
  const wtp = p.statedWillingnessToPay;
  return {
    floor: round(floor, 2),
    marginAtStated: wtp !== undefined && wtp > 0 ? round((wtp - p.unitCost) / wtp) : null,
    gap: wtp !== undefined ? round(floor - wtp, 2) : null,
    notes: [
      "The floor is what the economics need, not what buyers will pay; it needs its own evidence (a real offer or purchase).",
      ...(wtp !== undefined && wtp < floor ? ["Stated willingness to pay is below the floor: revisit cost, package, segment or value before raising the price."] : []),
    ],
  };
}

/* ---------------- rates and tests ---------------- */

export interface RateComparison {
  controlRate: number;
  treatmentRate: number;
  /** Treatment − control, as a share (0.01 = 1 percentage point). */
  absoluteChange: number;
  /** (Treatment − control) ÷ control; null when control is 0. */
  relativeChange: number | null;
  pValue: number;
  method: "fisher_exact" | "two_proportion_z";
  verdict: "no_reliable_difference" | "difference_detected" | "too_early";
  /** 95% interval for treatment − control (Newcombe hybrid score), in rate units. */
  differenceInterval: [number, number];
  /**
   * The interval read against the smallest change worth acting on, set before the test (Kohavi Ch 2's
   * six cases): worth_acting, harmful, flat (precise and small), small_but_real, inconclusive. Absent without `practicalChange`.
   */
  practical?: "worth_acting" | "harmful" | "flat" | "small_but_real" | "inconclusive";
  notes: string[];
}

/** Wilson 95% score interval for x of n. */
function wilson(x: number, n: number, z = 1.959964): [number, number] {
  const p = x / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
}

/** Newcombe's hybrid score interval for p2 − p1 (method 10): good coverage at small counts, unlike Wald. */
export function differenceInterval(x1: number, n1: number, x2: number, n2: number): [number, number] {
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const [l1, u1] = wilson(x1, n1);
  const [l2, u2] = wilson(x2, n2);
  const d = p2 - p1;
  return [d - Math.sqrt((p2 - l2) ** 2 + (u1 - p1) ** 2), d + Math.sqrt((u2 - p2) ** 2 + (p1 - l1) ** 2)];
}

/** Compare two conversion rates. Fixed-horizon reading only: no verdict before the planned end. */
export function compareRates(p: { control: { visitors: number; conversions: number }; treatment: { visitors: number; conversions: number }; plannedEndReached?: boolean; alpha?: number; practicalChange?: number }): RateComparison {
  const { control: c, treatment: t } = p;
  if (!(c.visitors > 0 && t.visitors > 0)) throw new RangeError("each arm needs visitors");
  // Counts must be whole and nested: more conversions than visitors used to read as a certain difference (p = 0).
  for (const a of [c, t]) if (!(Number.isInteger(a.visitors) && Number.isInteger(a.conversions) && a.conversions >= 0 && a.conversions <= a.visitors)) throw new RangeError("conversions must be whole numbers between 0 and visitors");
  const cr = c.conversions / c.visitors;
  const tr = t.conversions / t.visitors;
  const small = Math.min(c.conversions, t.conversions, c.visitors - c.conversions, t.visitors - t.conversions) < 10;
  const pValue = small ? fisherExact(c.conversions, c.visitors - c.conversions, t.conversions, t.visitors - t.conversions) : twoProportionP(c.conversions, c.visitors, t.conversions, t.visitors);
  const alpha = p.alpha ?? 0.05;
  const verdict: RateComparison["verdict"] = p.plannedEndReached === false ? "too_early" : pValue < alpha ? "difference_detected" : "no_reliable_difference";
  const pts = round((tr - cr) * 100, 2);
  const [lo, hi] = differenceInterval(c.conversions, c.visitors, t.conversions, t.visitors);
  const pc = p.practicalChange;
  const practical: RateComparison["practical"] =
    pc === undefined || !(pc > 0) ? undefined : lo >= pc ? "worth_acting" : hi <= -pc ? "harmful" : lo > -pc && hi < pc ? "flat" : (lo > 0 || hi < 0) ? "small_but_real" : "inconclusive";
  const ptsOf = (x: number) => `${round(x * 100, 1)}`;
  return {
    controlRate: round(cr),
    treatmentRate: round(tr),
    absoluteChange: round(tr - cr),
    relativeChange: cr > 0 ? round((tr - cr) / cr) : null,
    pValue: round(pValue),
    method: small ? "fisher_exact" : "two_proportion_z",
    verdict,
    differenceInterval: [round(lo), round(hi)],
    ...(practical ? { practical } : {}),
    notes: [
      `The change is ${pts} percentage points${cr > 0 ? ` (${Math.round(((tr - cr) / cr) * 100)}% relative)` : ""}, likely between ${ptsOf(lo)} and ${ptsOf(hi)} points; the relative number alone overstates small rates.`,
      ...(practical === "inconclusive" ? [`Too few to tell whether the change reaches the ${ptsOf(pc!)}-point bar worth acting on: not evidence of no effect.`] : []),
      ...(practical === "flat" ? [`Any change is smaller than the ${ptsOf(pc!)}-point bar worth acting on.`] : []),
      ...(verdict === "too_early" ? ["The planned end isn't reached: reading the result now (peeking) makes the p-value meaningless."] : []),
      ...(verdict === "no_reliable_difference" ? ["Not a proven win or loss: the data can't tell the arms apart. That isn't proof they're the same."] : []),
      ...(verdict === "difference_detected" ? ["A detected difference still needs a valid split (check sample ratio), guardrails and whether it's worth the cost."] : []),
    ],
  };
}

/** Where a split usually goes wrong, in order (Microsoft ExP, "Diagnosing Sample Ratio Mismatch"): check each before reading any lift. */
export const SPLIT_CHECKLIST = [
  "Assignment: does every eligible person get an arm, in the planned shares?",
  "Exposure: did people in each arm actually see their version (a broken page, slow load or redirect can drop one arm)?",
  "Logging: are both arms counted the same way, with the same events and filters?",
  "Analysis: were people or bots removed from one arm only, or the window changed for one arm?",
];

/**
 * Sample-ratio mismatch: do the arm counts fit the planned split?
 * p < 0.001 blocks any reading; p < 0.01 warns (no winner wording until checked).
 */
export function sampleRatio(p: { planned: number[]; observed: number[] }) {
  if (p.planned.length !== p.observed.length || p.planned.length < 2) throw new RangeError("planned and observed need the same 2+ arms");
  const total = p.observed.reduce((s, n) => s + n, 0);
  const share = p.planned.reduce((s, n) => s + n, 0);
  const expected = p.planned.map((w) => (w / share) * total);
  const chi = p.observed.reduce((s, o, i) => s + (o - expected[i]) ** 2 / expected[i], 0);
  const pValue = chiSquareSf(chi, p.planned.length - 1);
  const mismatch = pValue < 0.001;
  const warning = !mismatch && pValue < 0.01;
  // The arm furthest above its expected count (where to look first).
  const over = p.observed.map((o, i) => (o - expected[i]) / expected[i]).reduce((best, x, i, arr) => (x > arr[best] ? i : best), 0);
  return {
    expected: expected.map((e) => round(e, 1)),
    chiSquare: round(chi, 2),
    pValue,
    mismatch,
    warning,
    overArm: mismatch || warning ? over : null,
    checklist: mismatch || warning ? SPLIT_CHECKLIST : [],
    notes: mismatch
      ? [`The split doesn't match the plan (arm ${over + 1} has too many): find the cause before reading any lift. Don't trim arms to make them match.`]
      : warning
        ? [`The split is suspicious (arm ${over + 1} has more than expected): check it before calling a winner.`]
        : ["The split fits the plan."],
  };
}

/** Visitors per arm to detect an absolute change `minDetectable` from `baseline` (two-sided, normal approximation). */
export function sampleSize(p: { baseline: number; minDetectable: number; alpha?: number; power?: number; arms?: number; weeklyEligible?: number }) {
  if (!(p.baseline > 0 && p.baseline < 1)) throw new RangeError("baseline must be a rate in (0, 1)");
  if (!(p.minDetectable > 0)) throw new RangeError("minDetectable must be above 0 (an absolute change, e.g. 0.01 for 1 point)");
  const alpha = p.alpha ?? 0.05;
  const power = p.power ?? 0.8;
  const p1 = p.baseline;
  const p2 = Math.min(0.9999, p1 + p.minDetectable);
  const za = normalQuantile(1 - alpha / 2);
  const zb = normalQuantile(power);
  const bar = (p1 + p2) / 2;
  const n = Math.ceil((za * Math.sqrt(2 * bar * (1 - bar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (p2 - p1) ** 2);
  const arms = p.arms ?? 2;
  const weeks = p.weeklyEligible && p.weeklyEligible > 0 ? Math.ceil((n * arms) / p.weeklyEligible) : null;
  return {
    perArm: n,
    total: n * arms,
    weeks,
    notes: [
      ...(weeks !== null ? [`At ${p.weeklyEligible} eligible a week that's about ${weeks} week${weeks === 1 ? "" : "s"}; run whole weeks, at least one.`] : []),
      ...(weeks !== null && weeks > 12 ? ["Too long for an A/B test here: use interviews, an assisted pilot, or one bigger change measured before and after (labelled observational)."] : []),
    ],
  };
}

/** A before/after change. Without a comparison group it is observational: the confounders listed may explain it. */
export function beforeAfter(p: { before: number; after: number; confounders?: string[] }) {
  const change = p.after - p.before;
  return {
    change: round(change, 2),
    relativeChange: p.before !== 0 ? round(change / p.before) : null,
    label: "observed" as const,
    notes: [
      "Observed change, not proven impact: there's no comparison group.",
      ...(p.confounders?.length ? [`Other things changed too: ${p.confounders.join(", ")}. Any of them may explain it.`] : []),
    ],
  };
}

/* ---------------- one tool for Climb AI ---------------- */

export const CalcInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("margin"), price: z.number(), costs: z.array(z.object({ name: z.string(), amount: z.number() })), costBoundary: z.string().optional(), targetMargin: z.number().optional() }),
  z.object({ kind: z.literal("price_floor"), unitCost: z.number(), targetMargin: z.number(), statedWillingnessToPay: z.number().optional() }),
  z.object({ kind: z.literal("compare_rates"), control: z.object({ visitors: z.number(), conversions: z.number() }), treatment: z.object({ visitors: z.number(), conversions: z.number() }), plannedEndReached: z.boolean().optional(), practicalChange: z.number().optional() }),
  z.object({ kind: z.literal("sample_ratio"), planned: z.array(z.number()), observed: z.array(z.number()) }),
  z.object({ kind: z.literal("sample_size"), baseline: z.number(), minDetectable: z.number(), arms: z.number().optional(), weeklyEligible: z.number().optional() }),
  z.object({ kind: z.literal("before_after"), before: z.number(), after: z.number(), confounders: z.array(z.string()).optional() }),
]);
export type CalcInput = z.infer<typeof CalcInput>;

const KINDS = ["margin", "price_floor", "compare_rates", "sample_ratio", "sample_size", "before_after"] as const;
const Arm = z.object({ visitors: z.number(), conversions: z.number() });

/**
 * The tool's input as one flat object (OpenAI strict tools need an object at the
 * root, no unions there): `kind` picks the calculation, the fields it needs are
 * checked against CalcInput when it runs.
 */
export const CalcToolInput = z.object({
  kind: z.enum(KINDS),
  price: z.number().optional().describe("margin: price per unit or month"),
  costs: z.array(z.object({ name: z.string(), amount: z.number() })).optional().describe("margin: variable costs per unit or month"),
  costBoundary: z.string().optional().describe("margin: which costs are included"),
  targetMargin: z.number().optional().describe("margin/price_floor: target contribution margin as a share, e.g. 0.3"),
  unitCost: z.number().optional().describe("price_floor: variable cost per unit or month"),
  statedWillingnessToPay: z.number().optional().describe("price_floor: what buyers said they'd pay (stated, not observed)"),
  control: Arm.optional().describe("compare_rates: control arm"),
  treatment: Arm.optional().describe("compare_rates: treatment arm"),
  plannedEndReached: z.boolean().optional().describe("compare_rates: has the planned test end been reached"),
  practicalChange: z.number().optional().describe("compare_rates: smallest change worth acting on, as a share (0.01 = 1 point), set before the test"),
  planned: z.array(z.number()).optional().describe("sample_ratio: planned split, e.g. [50, 50]"),
  observed: z.array(z.number()).optional().describe("sample_ratio: units actually in each arm"),
  baseline: z.number().optional().describe("sample_size: current conversion rate as a share"),
  minDetectable: z.number().optional().describe("sample_size: smallest absolute change worth finding, e.g. 0.01 = 1 point"),
  arms: z.number().optional().describe("sample_size: number of arms (default 2)"),
  weeklyEligible: z.number().optional().describe("sample_size: eligible visitors per week"),
  before: z.number().optional().describe("before_after: value before"),
  after: z.number().optional().describe("before_after: value after"),
  confounders: z.array(z.string()).optional().describe("before_after: other things that changed in the same period"),
});
export type CalcToolInput = z.infer<typeof CalcToolInput>;

/** Run one calculation; errors come back as a plain message (never thrown at the model). */
export function calculate(raw: CalcToolInput | CalcInput): unknown {
  const parsed = CalcInput.safeParse(Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== null && v !== undefined)));
  if (!parsed.success) return { error: `Missing or invalid inputs for ${raw.kind}: ${parsed.error.issues.map((i) => i.path.join(".") || i.message).join(", ")}` };
  const input = parsed.data;
  try {
    switch (input.kind) {
      case "margin":
        return margin(input);
      case "price_floor":
        return priceFloor(input);
      case "compare_rates":
        return compareRates(input);
      case "sample_ratio":
        return sampleRatio(input);
      case "sample_size":
        return sampleSize(input);
      case "before_after":
        return beforeAfter(input);
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
}
