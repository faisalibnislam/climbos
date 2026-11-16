/**
 * Why a play is behind (cycle 2 failure diagnostics; BK06 Ch 3 Twyman's law
 * "check the data before believing the result", pack LEARNING_COLLECTIONS
 * "a campaign that never ran says nothing about the channel"). Checks run in
 * order and the first failing one decides the next step; more spend is only
 * suggested when reach is the sole shortfall and conversion holds.
 */
import { formatMinorMoney, majorToMinor } from "../economics/currency";
import { costCheck, stepClearlyShort, stepTooThin, type PlayActuals } from "./actuals";

export type ShortfallVerdict = "execution_unknown" | "plan_assumptions" | "tracking" | "reach" | "conversion" | "reach_only" | "too_few" | "fine";

export interface ShortfallCheck {
  check: "executed" | "measured" | "reach" | "conversion" | "cost" | "sample";
  status: "pass" | "fail" | "unknown";
  detail: string;
}

export interface Shortfall {
  verdict: ShortfallVerdict;
  checks: ShortfallCheck[];
  /** One next step for the owner. */
  next: string;
  /** Evidence supports reviewing a bounded reach increase; never proves capacity, cash availability or authorization. */
  moreSpendJustified: boolean;
}

const money = (n: number, currency?: string) => formatMinorMoney(majorToMinor(n, currency), currency);

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function diagnoseShortfall(a: PlayActuals, play: { killIf?: string } = {}, opts: { affordableCacUsd?: number | null; currency?: string } = {}): Shortfall {
  const checks: ShortfallCheck[] = [];
  const stop = play.killIf ? ` Your stop rule: ${play.killIf}` : "";
  if (a.unloggedWeeks > 0 || a.currentWeekIncluded) {
    return { verdict: "too_few", checks: [{ check: "measured", status: "unknown", detail: a.unloggedWeeks > 0 ? "Completed reporting weeks are missing; their results are unknown." : "The current weekly report is provisional." }], next: "Complete the reporting window before judging performance or increasing spend.", moreSpendJustified: false };
  }
  // 1. Did it run?
  if (a.weeks === 0 || a.reach === 0) {
    checks.push({ check: "executed", status: "unknown", detail: a.weeks === 0 ? "No weeks logged; execution is unknown." : "Zero reach was reported; this does not establish whether the activity ran or tracking worked." });
    return { verdict: "execution_unknown", checks, next: "Confirm whether the activity ran, reached the intended people and was measured. Missing or zero counts alone do not show that the channel failed or the work never ran.", moreSpendJustified: false };
  }
  checks.push({ check: "executed", status: "pass", detail: `${a.weeks} week${a.weeks === 1 ? "" : "s"} logged, ${a.reach} reached according to the owner; execution is not independently verified.` });
  // 2. Is it being measured? Reach with nothing at all recorded downstream for 2+ weeks.
  const recorded = a.steps.reduce((s, x) => s + x.successes, 0);
  // Zero recorded is only suspicious when the plan expected at least 3 at the first step (P(0) ≤ 5%); at 30 reached and a 2% rate, zero is the likeliest result.
  const expectedFirst = a.reach * (a.steps[0]?.planned ?? 0);
  if (a.weeks >= 2 && recorded === 0 && a.reach >= 30 && expectedFirst >= 3) {
    checks.push({ check: "measured", status: "unknown", detail: `${a.reach} reached but nothing recorded at "${a.steps[0]?.name ?? "the first step"}".` });
    return { verdict: "tracking", checks, next: "Check the tracking first: people were reached but no step recorded anything. A broken count looks like a failed play.", moreSpendJustified: false };
  }
  checks.push({ check: "measured", status: "pass", detail: "Steps are being recorded." });
  // 3. Did it reach the planned people?
  const reachShort = a.reachVsPlan !== null && a.reachVsPlan < 0.5;
  checks.push({ check: "reach", status: a.reachVsPlan === null ? "unknown" : reachShort ? "fail" : "pass", detail: a.reachVsPlan === null ? "No planned reach to compare." : `Reach is ${pct(a.reachVsPlan)} of the plan.` });
  // 4. Which step converts worse than planned (with enough people to tell)?
  // A step fails only when its counts make a big shortfall at least 95% likely (decision books: 0 of 30 at a planned 2% is the most likely result, not a failure).
  const weak = a.steps.find((s) => s.observed !== null && stepClearlyShort(s));
  const thinAny = !a.steps.length || a.steps.some((s) => stepTooThin(s));
  checks.push({ check: "conversion", status: weak ? "fail" : thinAny ? "unknown" : "pass", detail: weak ? `"${weak.name}" converts ${pct(weak.observed!)} vs ${pct(weak.planned)} planned (${weak.successes}/${weak.trials}).` : thinAny ? "Too few observations at one or more steps to judge the whole funnel." : "Steps convert at or near plan." });
  if (weak) return { verdict: "conversion", checks, next: `Fix "${weak.name}" before adding people: test one change at that step.${stop}`, moreSpendJustified: false };
  if (reachShort && !thinAny) {
    // More spend needs a logged cost per customer within what a customer is worth (decision books: don't scale an unprofitable channel).
    const sameCurrency = !!opts.currency && opts.currency === a.spendCurrency;
    const c = costCheck(a, sameCurrency ? opts.affordableCacUsd : null);
    const m = (n: number) => money(n, a.spendCurrency ?? undefined);
    const detail = {
      within: `Logged cash cost per customer ${m(c.cashCostPerCustomerUsd ?? 0)} is within the ${m(c.affordableUsd ?? 0)} a customer is worth in the payback window.`,
      above: `Logged cash cost per customer ${m(c.cashCostPerCustomerUsd ?? 0)} is above the ${m(c.affordableUsd ?? 0)} a customer is worth in the payback window.`,
      no_spend: "No spend logged, so there's no cost per customer to judge more spend by.",
      no_customers: `${m(a.spendUsd ?? 0)} spent with no customers logged yet.`,
      spend_unknown: a.spendIssue ?? "Spending is unknown or uses incompatible currencies; no cost comparison is available.",
      value_unknown: `Logged cash cost per customer is ${m(c.cashCostPerCustomerUsd ?? 0)}, but what a customer is worth is unknown (price, margin or churn).`,
    }[c.status];
    checks.push({ check: "cost", status: c.status === "within" ? "pass" : c.status === "above" || c.status === "no_customers" ? "fail" : "unknown", detail });
    if (c.status === "within") return { verdict: "reach_only", checks, next: `Reported conversion and cash cost support reviewing a small reach increase. First confirm current capacity, cash availability, stop rules and the required approval.${stop}`, moreSpendJustified: true };
    const why = { above: "cost per customer is above what a customer is worth, so lower it before adding spend", no_customers: "no customers yet, so more spend isn't justified", no_spend: "there's no logged cost per customer, so don't start or raise paid spend from this result", value_unknown: "confirm price, margin, churn and matching currency before adding spend", spend_unknown: "confirm the original spending and currency before judging affordability or adding spend" }[c.status];
    return { verdict: "reach_only", checks, next: `Conversion holds; only reach is short. Fix the route to the page; ${why}.${stop}`, moreSpendJustified: false };
  }
  if (reachShort) return { verdict: "reach", checks, next: `Reach is short and there are too few people to judge conversion. Fix the route first; don't add spend yet.${stop}`, moreSpendJustified: false };
  // 5. Enough to judge every step?
  if (thinAny) {
    checks.push({ check: "sample", status: "unknown", detail: `${a.customers} customers so far${a.expectedByNow ? ` vs about ${Math.round(a.expectedByNow.p50)} expected` : "; the original forecast is unavailable"}.` });
    return { verdict: "too_few", checks, next: `Too few observations to judge the whole funnel. Review the measurement window and stop rules before deciding whether to continue; do not extend the test automatically.${stop}`, moreSpendJustified: false };
  }
  if (a.reachVsPlan === null) return { verdict: "plan_assumptions", checks, next: `The original reach baseline is unknown. Confirm the intended audience volume and timing before judging delivery or changing spend.${stop}`, moreSpendJustified: false };
  if (a.status === "below_scenario") return { verdict: "plan_assumptions", checks, next: `Review the original reach, timing and outcome assumptions against these reports. The recorded funnel does not explain the scenario shortfall; missing inputs and conversion delays remain possible.${stop}`, moreSpendJustified: false };
  return { verdict: "fine", checks, next: a.horizonComplete ? "Review the completed window against the original success and stop rules before choosing the next test." : "No clear shortfall is identified in the reported steps. Check the original measurement window and stop rules before continuing.", moreSpendJustified: false };
}

/** One line for the next plan's brief, so a behind play is diagnosed rather than fed more budget. */
export function shortfallLine(name: string, s: Shortfall): string {
  return `${name}: next check. ${s.next}${s.moreSpendJustified ? "" : " Don't raise its spend."}`;
}

/** Reuse the same review trigger in owner UI and future-plan context. Missing/open windows stay provisional. */
export function needsShortfallReview(a: PlayActuals): boolean {
  return a.weeks > 0 && !a.unloggedWeeks && !a.currentWeekIncluded && (a.status === "below_scenario" || a.reach === 0 || (a.reachVsPlan !== null && a.reachVsPlan < 0.5) || a.steps.some(stepClearlyShort));
}
