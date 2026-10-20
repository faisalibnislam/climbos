/**
 * Growth formula catalog (spec §15–16), pure and null-safe: any missing
 * input gives `null`, never a default. Rates are shares in [0, 1]; money is
 * in the business's major currency unit; periods are billing months.
 */

export type N = number | null | undefined;

/** All inputs as finite numbers, or null if any is missing. */
function nums(...xs: N[]): number[] | null {
  return xs.every((x) => typeof x === "number" && Number.isFinite(x)) ? (xs as number[]) : null;
}
const share = (x: number) => x >= 0 && x <= 1;

/** One cohort through a funnel: reach × Π step rates. */
export function funnelCustomers(reach: N, rates: N[]): number | null {
  const v = nums(reach, ...rates);
  if (!v || v[0] < 0 || !v.slice(1).every(share)) return null;
  return v.slice(1).reduce((acc, r) => acc * r, v[0]);
}

/** Paid clicks bought with a budget. */
export function clicks(spend: N, cpc: N): number | null {
  const v = nums(spend, cpc);
  return v && v[0] >= 0 && v[1] > 0 ? v[0] / v[1] : null;
}

/** Media-only CAC: spend / new customers. */
export function cacMedia(spend: N, customers: N): number | null {
  const v = nums(spend, customers);
  return v && v[0] >= 0 && v[1] > 0 ? v[0] / v[1] : null;
}

/** Fully loaded CAC: (spend + hours × hourly cost + other costs) / customers. */
export function cacFull(spend: N, hours: N, hourlyCost: N, other: N, customers: N): number | null {
  const v = nums(spend, hours, hourlyCost, other, customers);
  if (!v || v[4] <= 0) return null;
  const [s, h, rate, o, c] = v;
  return (Math.max(0, s) + Math.max(0, h) * Math.max(0, rate) + Math.max(0, o)) / c;
}

/** Monthly contribution per customer: revenue × contribution margin. */
export function contributionMonth(revenueMonth: N, margin: N): number | null {
  const v = nums(revenueMonth, margin);
  return v && v[0] >= 0 && share(v[1]) ? v[0] * v[1] : null;
}

/** Contribution over n periods with churn c between periods: cm × (1 − (1−c)^n) / c (cm × n when c = 0). */
export function contributionOver(cmMonth: N, churn: N, periods: N): number | null {
  const v = nums(cmMonth, churn, periods);
  if (!v || !share(v[1]) || v[2] < 0) return null;
  const [cm, c, n] = v;
  return c === 0 ? cm * n : (cm * (1 - (1 - c) ** n)) / c;
}

/** Simple (no-churn) payback in periods: CAC / cm. */
export function paybackSimple(cac: N, cmMonth: N): number | null {
  const v = nums(cac, cmMonth);
  return v && v[1] > 0 && v[0] >= 0 ? v[0] / v[1] : null;
}

/** Payback with churn: periods until cumulative contribution covers CAC; null if it never does. */
export function paybackWithChurn(cac: N, cmMonth: N, churn: N): number | null {
  const v = nums(cac, cmMonth, churn);
  if (!v || v[1] <= 0 || !share(v[2]) || v[0] < 0) return null;
  const [k, cm, c] = v;
  if (c === 0) return k / cm;
  const x = 1 - (k * c) / cm;
  if (x <= 0 || c >= 1) return null;
  return Math.log(x) / Math.log(1 - c);
}

/** Allowable CAC for a payback horizon: the contribution one customer earns within it. */
export function allowableCac(cmMonth: N, churn: N, horizonPeriods: N): number | null {
  return contributionOver(cmMonth, churn, horizonPeriods);
}

/** Break-even CPC: allowable CAC × click→signup × signup→paid. */
export function breakevenCpc(allowable: N, clickToSignup: N, signupToPaid: N): number | null {
  const v = nums(allowable, clickToSignup, signupToPaid);
  return v && share(v[1]) && share(v[2]) ? v[0] * v[1] * v[2] : null;
}

/** Break-even cost per person reached: allowable CAC × Π funnel rates. */
export function breakevenPerReach(allowable: N, rates: N[]): number | null {
  const v = nums(allowable, funnelCustomers(1, rates));
  return v ? v[0] * v[1] : null;
}

/** Next month's MRR: MRR × (1 − churn) + new customers × price. */
export function nextMrr(mrr: N, churn: N, newCustomers: N, price: N): number | null {
  const v = nums(mrr, churn, newCustomers, price);
  return v && share(v[1]) ? v[0] * (1 - v[1]) + v[2] * v[3] : null;
}

/**
 * Portfolio customers with a stated overlap share: the largest play counts in
 * full and each other play loses `overlap` of its customers to people the
 * others also reach. Adding a play can never lower the total (the earlier
 * formula discounted the first play too, so [12, 2] gave 11.2 < 12; decision
 * books, Kochenderfer Ch 14 validation by enumeration).
 */
export function portfolioCustomers(perPlay: N[], overlap: N): number | null {
  const v = nums(overlap, ...perPlay);
  if (!v || !share(v[0])) return null;
  const xs = v.slice(1).map((x) => Math.max(0, x));
  if (!xs.length) return 0;
  const top = Math.max(...xs);
  const rest = xs.reduce((s, x) => s + x, 0) - top;
  return top + rest * (1 - v[0]);
}

/** Monthly churn implied by an average customer lifetime in months (1 / months). */
export function churnFromLifetime(months: N): number | null {
  const v = nums(months);
  return v && v[0] >= 1 ? 1 / v[0] : null;
}
