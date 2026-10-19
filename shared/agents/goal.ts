/**
 * Goal, scenario and gap (REQ-MATH, spec §8.1), kept apart:
 * - goal: what the owner asked for, as stated (never rewritten to match a forecast);
 * - scenario: what the selected plays support over the goal's horizon;
 * - gap: what the goal needs minus what the scenario supports.
 * Code computes all three; the model only explains them.
 */

export type GoalMetric = "customers" | "revenue_month" | "other";

/** The owner's structured target. `total` means "reach this number" (baseline counts); `incremental` means "this many more". */
export interface GoalTarget {
  metric: GoalMetric;
  baseline: number | null;
  desired: number | null;
  mode: "total" | "incremental";
}

export type GapState = "met" | "short" | "out_of_reach" | "unknown" | "not_comparable";

export interface GoalGap {
  metric: GoalMetric;
  horizonDays: number;
  /** New units the goal needs within the horizon (net of expected losses from the base when churn is known). */
  needed: number | null;
  /** Expected losses from the existing base over the horizon; null when churn or baseline is unknown. */
  lostFromBase: number | null;
  /** What the plays support over the same horizon (P10/P50/P90), in the goal's unit. */
  supported: { p10: number; p50: number; p90: number } | null;
  /** needed − supported P50 (positive = short). */
  gap: number | null;
  state: GapState;
  /** Owner-facing explanation, one or two short sentences. */
  note: string;
}

const DAYS_PER_MONTH = 365.25 / 12;
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * Compare the owner's target with the plays' scenario.
 * `customers` is the plays' new-customer range over the goal horizon; `revenuePerCustomerMonth`
 * converts it to monthly revenue for revenue goals. Unknown inputs give an unknown gap, never a default.
 */
export function goalGap(
  target: GoalTarget | null | undefined,
  horizonDays: number,
  customers: { p10: number; p50: number; p90: number } | null,
  opts: { churn: number | null; revenuePerCustomerMonth: number | null },
): GoalGap {
  const base: Omit<GoalGap, "state" | "note"> = { metric: target?.metric ?? "other", horizonDays, needed: null, lostFromBase: null, supported: null, gap: null };
  if (!target || !finite(target.desired) || target.desired <= 0) return { ...base, state: "unknown", note: "No number in your goal yet, so ClimbOS can't say how far the plays get you. Add one under Business & goal." };
  if (target.metric === "other") return { ...base, state: "not_comparable", note: "The plays forecast new customers. Your goal uses another measure, so ClimbOS doesn't convert one into the other." };

  let supported: GoalGap["supported"] = null;
  if (customers) {
    if (target.metric === "customers") supported = customers;
    else if (finite(opts.revenuePerCustomerMonth) && opts.revenuePerCustomerMonth >= 0) {
      const r = opts.revenuePerCustomerMonth;
      supported = { p10: customers.p10 * r, p50: customers.p50 * r, p90: customers.p90 * r };
    }
  }

  // What the goal needs from new business within the horizon.
  let needed: number | null;
  let lostFromBase: number | null = null;
  if (target.mode === "incremental") needed = target.desired;
  else if (!finite(target.baseline) || target.baseline < 0) needed = null;
  else {
    const months = horizonDays / DAYS_PER_MONTH;
    if (finite(opts.churn) && opts.churn >= 0 && opts.churn <= 1) lostFromBase = target.baseline * (1 - (1 - opts.churn) ** months);
    needed = Math.max(0, target.desired - target.baseline + (lostFromBase ?? 0));
  }

  const out = { ...base, needed, lostFromBase, supported };
  if (needed === null) return { ...out, state: "unknown", note: "Your goal is a total, but today's number isn't set, so the gap can't be worked out. Add today's number under Business & goal." };
  if (!supported) return { ...out, state: "unknown", note: target.metric === "revenue_month" ? "Revenue per customer is unknown, so the plays can't be turned into revenue yet." : "No play has a forecast yet." };
  const gap = needed - supported.p50;
  const unit = target.metric === "customers" ? "customers" : "a month in revenue";
  const fmt = (n: number) => (target.metric === "customers" ? `${Math.round(n)}` : `$${Math.round(n).toLocaleString("en-US")}`);
  const churnNote = target.mode === "total" && lostFromBase === null && target.baseline ? " Churn is unknown, so losses from your current base aren't counted; the real need is higher." : "";
  if (gap <= 0) return { ...out, gap, state: "met", note: `The plays support about ${fmt(supported.p50)} ${unit}; your goal needs ${fmt(needed)}.${churnNote}` };
  return {
    ...out,
    gap,
    state: supported.p90 < needed ? "out_of_reach" : "short",
    note: `Your goal needs about ${fmt(needed)} ${unit}; the plays support about ${fmt(supported.p50)} (up to ${fmt(supported.p90)}). Short by ${fmt(gap)}: add budget or time, extend the timeline, or improve the offer.${churnNote}`,
  };
}

export const GAP_LABEL: Record<GapState, string> = {
  met: "Plays cover your goal",
  short: "Plays fall short of your goal",
  out_of_reach: "Goal out of reach with these plays",
  unknown: "Gap unknown",
  not_comparable: "Different measure",
};

/** Lines for the locked numbers: the goal stays as the owner stated it. */
export function goalLines(statement: string | undefined, gap: GoalGap): string[] {
  return [
    `- OWNER GOAL (keep exactly as stated; never replace it with a forecast): "${(statement ?? "").slice(0, 200)}" within ${gap.horizonDays} days.`,
    `- GOAL GAP (${GAP_LABEL[gap.state]}): ${gap.note} Say this plainly in the plan; if short, name the binding constraint and the options.`,
  ];
}
