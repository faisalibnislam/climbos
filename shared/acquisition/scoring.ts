import { formatMoney, fromUsd, minorToMajor, thresholdIn, toUsd } from "../economics/currency";
import { budgetBand, CHANNELS, TYPE_BY_KEY, type Channel, type Execution, type Requirement, type Stage } from "./library";
import type { BindingConstraint } from "../agents/decision";

/**
 * Acquisition Intelligence: hard eligibility checks, rule-based priors for the
 * eight factors, bounded AI adjustments with evidence, and budget-disciplined
 * selection. Pure and deterministic, so owners can change a dimension and see
 * the ranking move instantly.
 */

/* ---------------- business dimensions (Part 12) ---------------- */

export const DIMENSIONS = {
  customerType: { label: "Who buys", values: ["b2b", "b2c", "b2g", "b2b2c"] },
  scale: { label: "Business size", values: ["solo", "startup", "smb", "mid_market", "enterprise"] },
  salesMotion: { label: "How people buy", values: ["self_service", "sales_assisted", "sales_led"] },
  revenueModel: { label: "Revenue model", values: ["subscription", "transactional", "one_time", "services", "licensing"] },
  aov: { label: "Typical order or contract", values: ["low", "medium", "high"] },
  salesCycle: { label: "Time to buy", values: ["immediate", "short", "medium", "long"] },
  geography: { label: "Where customers are", values: ["local", "regional", "national", "global"] },
  maturity: { label: "Market", values: ["new", "emerging", "established"] },
  complexity: { label: "Product complexity", values: ["simple", "moderate", "complex"] },
  frequency: { label: "Purchase frequency", values: ["one_time", "occasional", "recurring"] },
  competition: { label: "Competition", values: ["low", "medium", "high"] },
  awareness: { label: "Brand awareness", values: ["unknown", "emerging", "established"] },
  audience: { label: "Existing audience", values: ["none", "small", "medium", "large"] },
  regulation: { label: "Regulation", values: ["low", "medium", "high"] },
  team: { label: "Who does the marketing", values: ["solo", "small", "dedicated"] },
  tracking: { label: "Tracking in place", values: ["none", "basic", "full"] },
} as const;
export type DimensionKey = keyof typeof DIMENSIONS;

export const VALUE_LABEL: Record<string, string> = {
  b2b: "Businesses",
  b2c: "Consumers",
  b2g: "Government",
  b2b2c: "Businesses that serve consumers",
  solo: "Solo",
  startup: "Startup",
  smb: "Small business",
  mid_market: "Mid-market",
  enterprise: "Enterprise",
  self_service: "Sign up on their own",
  sales_assisted: "With some help",
  sales_led: "Through a sales process",
  subscription: "Subscription",
  transactional: "Per transaction",
  one_time: "One-time purchase",
  services: "Services",
  licensing: "Licensing",
  low: "Low",
  medium: "Medium",
  high: "High",
  immediate: "Same day",
  short: "Days to weeks",
  long: "Months",
  local: "Local",
  regional: "Regional",
  national: "National",
  global: "Global",
  new: "New category",
  emerging: "Emerging",
  established: "Established",
  simple: "Simple",
  moderate: "Moderate",
  complex: "Complex",
  occasional: "Occasional",
  recurring: "Recurring",
  unknown: "Unknown",
  none: "None",
  small: "Small",
  dedicated: "Dedicated team",
  basic: "Basic",
  full: "Full",
};

export type Confidence = "high" | "medium" | "low";
export interface DimensionValue {
  value: string;
  confidence: Confidence;
  source: "inferred" | "owner";
  evidence?: string;
}

export interface OwnerChannelPreference {
  channelId: string;
  preference: "prefer" | "avoid";
  rationale: string;
}

export interface AcquisitionProfile {
  /** Business type keys from the library (multi-label). */
  types: string[];
  /** Type labels can steer soft scores when inferred, but only owner-confirmed labels establish hard eligibility. */
  typesSource?: "owner" | "inferred";
  dims: Partial<Record<DimensionKey, DimensionValue>>;
  /** Owner-reported prior experience. Soft ranking input only; never bypasses eligibility or hard limits. */
  channelPreferences?: OwnerChannelPreference[];
  /** Monthly marketing budget in USD terms (the owner's budget scaled by a reference rate), to compare with the library's USD thresholds. */
  budgetUsd: number;
  /** Goal horizon in days. */
  horizonDays: number;
  /** Lowest paid price per customer per month in USD terms: the owner's revenue per customer, else the website's pricing facts. */
  priceUsdMonth?: number;
  /** Workspace currency (ISO code) the owner's amounts are in; absent means USD. Text shown to the owner uses it. */
  currency?: string;
}

/** A USD-terms amount from the profile, shown in the owner's currency. */
const shown = (p: AcquisitionProfile, usd: number) => formatMoney(fromUsd(usd, p.currency), p.currency);
/** A library threshold (written in USD), shown as a round amount in the owner's currency. */
const shownThreshold = (p: AcquisitionProfile, usd: number) => formatMoney(thresholdIn(usd, p.currency), p.currency);

/** Low-confidence model guesses are questions to resolve, not decision inputs. */
const dim = (p: AcquisitionProfile, k: DimensionKey) => {
  const value = p.dims[k];
  return value?.source === "inferred" && value.confidence === "low" ? undefined : value?.value;
};

/* ---------------- price fit ---------------- */

/** Below this monthly price, human effort per customer can't pay back (bench Run 4: creator recruitment for a $6/month product). */
export const LOW_TICKET_USD_MONTH = 25;

/** Low-ticket, not sales-led: the listed price when known, else the inferred order size. */
export function lowTicket(p: AcquisitionProfile): boolean {
  if (dim(p, "salesMotion") === "sales_led") return false;
  return p.priceUsdMonth !== undefined && p.priceUsdMonth > 0 ? p.priceUsdMonth < LOW_TICKET_USD_MONTH : dim(p, "aov") === "low";
}

/** Selling one customer at a time: cold or social outreach, demos, events, introductions. */
const perCustomer = (c: Channel) => c.family === "outreach" || c.family === "events" || c.id.startsWith("D");
/** Recruiting creators, partners or resellers one by one (user-generated content is self-serve). */
const perPartner = (c: Channel) => (c.family === "creators" && c.id !== "V20") || c.family === "partnerships" || c.family === "distribution";
/** Channels that sell without a person per customer: comparison and SEO pages, onboarding and activation, in-product virality. */
const selfServe = (c: Channel) => !perCustomer(c) && ["organic_search", "content", "product_led", "email", "referral", "marketplaces"].includes(c.family);

const MONTHLY = /\$\s?(\d+(?:\.\d+)?)\s*(?:(?:\/|per|a|an|each)\s*(?:seat|user|member|person|people|account|company|team)\s*)?(?:\/|per|a|an|each)\s*(month|mo|year|yr|annum)\b/gi;

/** Lowest paid monthly price in the website's pricing facts (yearly prices count as a twelfth); undefined when none is stated. */
export function entryPriceUsdMonth(facts: { statement: string; category?: string }[]): number | undefined {
  const monthly: number[] = [];
  const yearly: number[] = [];
  for (const f of facts) {
    if (f.category && f.category !== "pricing") continue;
    for (const m of f.statement.matchAll(MONTHLY)) {
      const n = Number(m[1]);
      if (!(n > 0)) continue;
      (/^(month|mo)$/i.test(m[2]) ? monthly : yearly).push(n);
    }
  }
  if (monthly.length) return Math.min(...monthly);
  if (yearly.length) return Math.round((Math.min(...yearly) / 12) * 100) / 100;
  return undefined;
}

/** Why a channel ranks lower on price, for the scorecard; undefined when price doesn't change it. */
export function priceFitReason(c: Channel, p: AcquisitionProfile): string | undefined {
  if (!lowTicket(p) || !(perCustomer(c) || perPartner(c))) return undefined;
  const price = p.priceUsdMonth ? `about ${shown(p, p.priceUsdMonth)}/month` : "a low price";
  return perCustomer(c) ? `Selling one customer at a time doesn't pay back at ${price}; self-serve channels first.` : `Recruiting partners one by one rarely pays back at ${price}; self-serve channels first.`;
}

/** One line for the plays agent: what the price allows. Empty when the price isn't low. */
export function priceFitText(p: AcquisitionProfile): string {
  if (!lowTicket(p)) return "";
  const price = p.priceUsdMonth ? `about ${shown(p, p.priceUsdMonth)} per customer per month` : "a low price per customer";
  return `PRICE FIT: ${price}, self-serve. A play that needs a person per customer or per partner (cold or social outreach, demos, creator or partner recruitment) can't pay back; build the bankable play on self-serve channels: comparison and SEO pages, onboarding and activation, in-product virality and referral. Use a labour-heavy play only as a capped test, with owner hours priced in. The first play improves an existing high-intent page (comparison, alternative, pricing or signup) and reaches people for free (creators, communities, existing users, a partner's newsletter); paid traffic starts only after that test reads out.`;
}

/** Dimensions worth asking the owner about: unknown or low confidence and decision-relevant. */
export const ASK_ORDER: DimensionKey[] = ["customerType", "geography", "salesMotion", "aov", "team", "salesCycle", "scale"];
export function dimensionsToConfirm(p: AcquisitionProfile, max = 3): DimensionKey[] {
  return ASK_ORDER.filter((k) => !p.dims[k] || (p.dims[k]!.source === "inferred" && p.dims[k]!.confidence === "low")).slice(0, max);
}

/* ---------------- eligibility ---------------- */

export function traitsOf(p: AcquisitionProfile): Set<Requirement> {
  const t = new Set<Requirement>();
  if (p.typesSource !== "inferred") for (const k of p.types) for (const r of TYPE_BY_KEY[k]?.traits ?? []) t.add(r);
  // Only an owner-confirmed dimension can unlock or exclude hard channel eligibility.
  // Inferred classifications may inform soft scores, but must not silently rule out a route.
  const c = p.dims.customerType?.source === "owner" ? p.dims.customerType.value : undefined;
  if (c === "b2b" || c === "b2b2c") t.add("b2b");
  if (c === "b2c" || c === "b2b2c") t.add("b2c");
  if (c === "b2g") {
    t.add("gov");
    t.add("b2b");
  }
  if (!c && !t.has("b2b") && !t.has("b2c")) {
    t.add("b2b");
    t.add("b2c");
  }
  if (p.dims.geography?.source === "owner" && p.dims.geography.value === "local") t.add("location");
  return t;
}

const REQ_LABEL: Record<Requirement, string> = {
  location: "a physical location customers visit or a local service area",
  products: "physical products to sell",
  app: "a mobile app",
  desktop: "a desktop app",
  software: "a software product",
  developer: "developers as buyers",
  ai: "an AI product",
  digital_goods: "digital goods like templates or assets",
  nonprofit: "nonprofit status",
  b2b: "business buyers",
  b2c: "consumer buyers",
  gov: "government buyers",
  booking: "bookable appointments or stays",
  property: "property listings",
  events: "ticketed events",
};

export function eligibility(c: Channel, p: AcquisitionProfile): { ok: boolean; reason?: string } {
  const traits = traitsOf(p);
  const missing = (c.requires ?? []).filter((r) => !traits.has(r));
  if (missing.length) return { ok: false, reason: `Needs ${missing.map((m) => REQ_LABEL[m]).join(" and ")}.` };
  return { ok: true };
}

/* ---------------- factors ---------------- */

export const FACTORS = ["audience", "intent", "budget", "time", "feasibility", "competition", "scalability", "measurement"] as const;
export type Factor = (typeof FACTORS)[number];
export const DEFAULT_WEIGHTS: Record<Factor, number> = { audience: 0.2, intent: 0.2, budget: 0.15, time: 0.1, feasibility: 0.1, competition: 0.1, scalability: 0.1, measurement: 0.05 };
export const FACTOR_LABEL: Record<Factor, string> = {
  audience: "Audience match",
  intent: "Purchase intent",
  budget: "Fits the budget",
  time: "Time to results",
  feasibility: "Doable with your team",
  competition: "Competitive opening",
  scalability: "Can scale",
  measurement: "Measurable",
};

const STAGE_INTENT: Record<Stage, number> = { high_intent: 95, product: 75, returning: 70, existing: 70, solution: 60, problem: 45, unaware: 30 };
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Rule-based starting scores (the framework's tendencies), before evidence. */
export function priors(c: Channel, p: AcquisitionProfile): Record<Factor, number> {
  const types = p.types.map((k) => TYPE_BY_KEY[k]).filter(Boolean);
  let audience = types.length ? Math.max(...types.map((t) => (t.starters.includes(c.id) ? 85 : t.channels.includes(c.id) ? 70 : 40))) : 55;
  const geo = dim(p, "geography");
  if ((c.family === "local" || (c.requires ?? []).includes("location")) && (geo === "global" || geo === "national")) audience -= 30;
  const enterpriseOnly = ["D05", "D06", "E01", "D11", "E02", "E03"].includes(c.id);
  if (enterpriseOnly && (dim(p, "aov") === "low" || dim(p, "scale") === "solo" || dim(p, "scale") === "startup")) audience -= 25;
  if (["O01", "P09", "D03", "O17", "N03", "N05", "N07"].includes(c.id) && dim(p, "customerType") === "b2c") audience -= 30;
  // Business model (Part 6): low-ticket B2B is self-serve; high-ticket B2B is sales-led.
  if (dim(p, "aov") === "low" && dim(p, "customerType") === "b2b" && ["organic_search", "content", "product_led"].includes(c.family)) audience += 8;
  if (dim(p, "salesMotion") === "sales_led" && c.family === "outreach") audience += 10;
  // One-to-one selling rarely pays back on a low-ticket, self-serve product.
  if ((dim(p, "aov") === "low" || dim(p, "salesMotion") === "self_service") && (c.family === "outreach" || c.family === "events") && dim(p, "salesMotion") !== "sales_led") audience -= 20;
  // Price fit: at a low price, labour per customer or per partner can't pay back; self-serve channels lead.
  const cheap = lowTicket(p);
  if (cheap && perCustomer(c)) audience -= 25;
  else if (cheap && perPartner(c)) audience -= 15;
  else if (cheap && selfServe(c)) audience += 10;

  const intent = Math.max(...c.stages.map((s) => STAGE_INTENT[s]));

  const budget = p.budgetUsd;
  const budgetScore = c.minMonthly > 0 ? (c.minMonthly > budget ? 5 : 100 - 60 * (c.minMonthly / Math.max(budget, 1))) : [95, 85, 70, 50][c.cash];

  let time = { days: 90, weeks: 70, months: 40 }[c.learn];
  if (p.horizonDays <= 90 && c.learn === "months") time -= 10;
  if (dim(p, "salesCycle") === "long") time = Math.min(time, 60);

  const team = dim(p, "team") ?? "small";
  let feasibility = c.exec === "auto" ? 90 : c.exec === "partial" ? 75 : team === "solo" ? 35 : team === "small" ? 55 : 75;
  if (c.cash >= 3 && (team === "solo" || dim(p, "scale") === "solo")) feasibility -= 15;
  if (cheap && perCustomer(c)) feasibility -= 15;

  const scalability = [40, 65, 90][c.scale];
  let measurement = c.measure;
  if (dim(p, "tracking") === "none" && ["paid_search", "paid_social", "retargeting"].includes(c.family)) measurement -= 15;

  return {
    audience: clamp(audience),
    intent: clamp(intent),
    budget: clamp(budgetScore),
    time: clamp(time),
    feasibility: clamp(feasibility),
    competition: 50,
    scalability: clamp(scalability),
    measurement: clamp(measurement),
  };
}

/* ---------------- hard limits before ranking (REQ-STRAT-03) ---------------- */

/** The owner's real limits, applied in code before any channel is ranked. */
export interface ChannelLimits {
  /** Hours a week the owner gives growth work (only when they said). */
  ownerHoursPerWeek?: number;
  /** Providers with status "connected" (null when unknown). */
  connected?: readonly string[] | null;
  /** Owner-confirmed number of additional customers the business can serve monthly with current operations. */
  newCustomersPerMonth?: number;
}

export type LimitKind = "cash" | "owner_time" | "sales_cycle" | "capability" | "measurement" | "capacity";
/** blocked: can't be in the plan now. late: first revenue lands after the goal date. setup: needs a connection first. */
export interface LimitCheck {
  kind: LimitKind;
  verdict: "blocked" | "late" | "setup";
  reason: string;
}

/** Days until a channel can show whether it works. */
const LEARN_DAYS: Record<Channel["learn"], number> = { days: 7, weeks: 28, months: 90 };
/** Days from first conversation to a paying customer. */
export const CYCLE_DAYS: Record<string, number> = { immediate: 0, short: 14, medium: 45, long: 120 };
/** Owner hours a week a channel needs at its smallest readable test. */
const MIN_OWNER_HOURS: Record<Execution, number> = { auto: 0, partial: 1, human: 3 };
/** What ClimbOS needs connected to run a family itself; without it the owner does that step by hand. */
const MAILBOX = { any: ["email_mailbox"], label: "the owner's mailbox for sending" };
const NEEDS_BY_ID: Record<string, { any: string[]; label: string }> = { D01: MAILBOX, D16: MAILBOX };
const NEEDS: Partial<Record<Channel["family"], { any: string[]; label: string }>> = {
  paid_search: { any: ["google_ads"], label: "a Google Ads account" },
  paid_social: { any: ["meta_ads"], label: "a Meta ads account" },
  organic_social: { any: ["instagram", "facebook_pages", "linkedin", "x"], label: "a social account for direct posting" },
};
/** Channels that work on existing customers don't wait on a new buyer's sales cycle. */
const ownBase = (c: Channel) => c.stages.every((st) => st === "existing" || st === "returning");

/** Cash, owner time, sales cycle and capability, checked before ranking. Pure and deterministic. */
export function limitChecks(c: Channel, p: AcquisitionProfile, l: ChannelLimits = {}): LimitCheck[] {
  const out: LimitCheck[] = [];
  if (c.minMonthly > p.budgetUsd) out.push({ kind: "cash", verdict: "blocked", reason: `Needs at least ${shownThreshold(p, c.minMonthly)}/month to learn anything; the budget is ${shown(p, p.budgetUsd)}.` });
  else if (p.budgetUsd === 0 && c.cash >= 2) out.push({ kind: "cash", verdict: "blocked", reason: "Needs upfront cash and there's no budget." });
  const need = MIN_OWNER_HOURS[c.exec];
  if (l.ownerHoursPerWeek !== undefined && need > l.ownerHoursPerWeek) out.push({ kind: "owner_time", verdict: "blocked", reason: `Needs about ${need} of your hours a week; you have ${l.ownerHoursPerWeek}.` });
  // Don't acquire new buyers when the owner says there is no delivery capacity.
  // Existing/returning-customer work can still improve value without adding net-new customers.
  if (l.newCustomersPerMonth === 0 && !ownBase(c)) out.push({ kind: "capacity", verdict: "blocked", reason: "You said you cannot take on any new customers this month; improve delivery, retention or pricing before creating more demand." });
  // Paid media without conversion tracking cannot be evaluated for customer economics.
  // This gate is only supplied for an owner-confirmed "none" value; inferred or unknown tracking stays a question.
  if (p.dims.tracking?.source === "owner" && p.dims.tracking.value === "none" && ["paid_search", "paid_social", "retargeting"].includes(c.family)) {
    out.push({ kind: "measurement", verdict: "blocked", reason: "Set up conversion tracking before paying for traffic, so the test can measure qualified leads or customers rather than clicks alone." });
  }
  const cycle = CYCLE_DAYS[dim(p, "salesCycle") ?? ""];
  if (cycle !== undefined && !ownBase(c)) {
    const first = LEARN_DAYS[c.learn] + cycle;
    if (first > p.horizonDays) out.push({ kind: "sales_cycle", verdict: "late", reason: `First revenue around day ${first} (${c.learn} to learn + ${cycle}-day sales cycle); the goal date is day ${p.horizonDays}.` });
  }
  const needs = NEEDS_BY_ID[c.id] ?? NEEDS[c.family];
  if (needs && l.connected && !needs.any.some((x) => l.connected!.includes(x))) out.push({ kind: "capability", verdict: "setup", reason: `Connect ${needs.label} first, or do that step by hand.` });
  return out;
}

/* ---------------- AI adjustments and final scores ---------------- */

export interface Adjustment {
  channelId: string;
  /** Bounded changes (−30…+30) to factor priors, each grounded in evidence. */
  deltas: Partial<Record<Factor, number>>;
  reason: string;
  evidence: string;
  platform?: string;
  tactic?: string;
  audienceName?: string;
}

export type ChannelStatus = "primary" | "in_plan" | "later" | "not_now" | "ineligible";
export const STATUS_LABEL: Record<ChannelStatus, string> = { primary: "Primary", in_plan: "In the plan", later: "Later", not_now: "Not now", ineligible: "Not a fit" };

export interface ScoredChannel {
  id: string;
  name: string;
  family: Channel["family"];
  exec: Channel["exec"];
  learn: Channel["learn"];
  minMonthly: number;
  paid: boolean;
  factors: Record<Factor, number>;
  score: number;
  status: ChannelStatus;
  why: string;
  evidence?: string;
  platform?: string;
  tactic?: string;
  audienceName?: string;
  caution?: string;
  /** Why the price ranks it lower (low-ticket, labour-heavy channels). */
  priceFit?: string;
  /** Hard-limit findings, when limits were applied (decision_contract plans). */
  limits?: LimitCheck[];
  /** True when this channel directly serves the supported, owner-data diagnosis. */
  diagnosisFit?: boolean;
  ownerPreference?: OwnerChannelPreference;
}

const PAID_FAMILIES = new Set(["paid_search", "paid_social", "traditional"]);

/** Buyer-journey stages a channel can directly help when the measured constraint is supported. */
const DIAGNOSIS_STAGES: Partial<Record<BindingConstraint, readonly Stage[]>> = {
  demand: ["unaware", "problem", "solution"],
  activation: ["product", "existing"],
  conversion: ["product", "high_intent"],
  offer: ["product", "high_intent"],
  positioning: ["problem", "solution", "product"],
  retention: ["existing", "returning"],
  delivery: ["existing", "returning"],
  economics: ["product", "high_intent"],
};

export function scoreChannels(p: AcquisitionProfile, adjustments: Adjustment[] = [], weights = DEFAULT_WEIGHTS, limits?: ChannelLimits, focus?: BindingConstraint): ScoredChannel[] {
  const adj = new Map(adjustments.map((a) => [a.channelId, a]));
  const ownerPreferences = new Map((p.channelPreferences ?? []).map((preference) => [preference.channelId, preference]));
  const regulated = p.types.map((k) => TYPE_BY_KEY[k]?.regulated).find(Boolean) ?? (dim(p, "regulation") === "high" ? "Regulated industry: check advertising rules before running this." : undefined);
  const rows = CHANNELS.map((c): ScoredChannel => {
    const el = eligibility(c, p);
    const base = priors(c, p);
    const a = adj.get(c.id);
    const ownerPreference = ownerPreferences.get(c.id);
    const priceFit = el.ok ? priceFitReason(c, p) : undefined;
    const factors = Object.fromEntries(FACTORS.map((f) => [f, clamp(base[f] + Math.max(-30, Math.min(30, a?.deltas[f] ?? 0)))])) as Record<Factor, number>;
    const baseScore = FACTORS.reduce((s, f) => s + factors[f] * weights[f], 0);
    const score = clamp(baseScore + (ownerPreference ? (ownerPreference.preference === "prefer" ? 12 : -12) : 0));
    return {
      id: c.id,
      name: c.name,
      family: c.family,
      exec: c.exec,
      learn: c.learn,
      minMonthly: c.minMonthly,
      paid: PAID_FAMILIES.has(c.family) || c.minMonthly > 0,
      factors,
      score: el.ok ? score : 0,
      status: el.ok ? "not_now" : "ineligible",
      why: el.ok ? (a?.reason ?? priceFit ?? "") : el.reason!,
      evidence: a?.evidence,
      platform: a?.platform,
      tactic: a?.tactic,
      audienceName: a?.audienceName,
      caution: el.ok && c.regulatedCaution && regulated ? regulated : undefined,
      priceFit,
      ...(ownerPreference ? { ownerPreference } : {}),
      ...(limits && el.ok ? { limits: limitChecks(c, p, limits) } : {}),
      ...(focus && DIAGNOSIS_STAGES[focus] ? { diagnosisFit: c.stages.some((stage) => DIAGNOSIS_STAGES[focus]!.includes(stage)) } : {}),
    };
  });
  return select(rows, p, focus && DIAGNOSIS_STAGES[focus] ? focus : undefined);
}

/** Budget discipline (Part 7): a few focused channels, paid ones only when the budget can feed a real test. */
function select(rows: ScoredChannel[], p: AcquisitionProfile, focus?: BindingConstraint): ScoredChannel[] {
  const band = budgetBand(p.budgetUsd);
  const ranked = rows.filter((r) => r.status !== "ineligible").sort((a, b) =>
    (focus ? Number(Boolean(b.diagnosisFit)) - Number(Boolean(a.diagnosisFit)) : 0) || b.score - a.score,
  );
  // Hard limits come before rank: a blocked channel is never picked; a late one only fills a slot no on-time channel can.
  const blocked = (r: ScoredChannel) => r.limits?.find((x) => x.verdict === "blocked");
  const late = (r: ScoredChannel) => r.limits?.find((x) => x.verdict === "late");
  let paid = 0;
  let spend = 0;
  let picked = 0;
  for (const r of [...ranked.filter((x) => !late(x)), ...ranked.filter((x) => late(x))]) {
    const affordable = !r.paid || (paid < band.maxPaid && spend + r.minMonthly <= p.budgetUsd);
    const stop = blocked(r);
    if (stop) {
      r.status = "not_now";
      r.why = stop.reason;
      continue;
    }
    if (late(r) && !r.why) r.why = late(r)!.reason;
    if (picked < band.maxChannels && affordable && r.score >= 50) {
      r.status = picked === 0 ? "primary" : "in_plan";
      picked++;
      if (r.paid) {
        paid++;
        spend += r.minMonthly;
      }
      if (!r.why) r.why = r.diagnosisFit
        ? `Fits the measured ${focus} bottleneck and the budget.`
        : picked === 1 ? "Highest score for your business, goal and budget." : "Strong fit that the budget can support alongside the primary channel.";
    } else if (r.score >= 60) {
      r.status = "later";
      if (!r.why) r.why = !affordable ? `Needs about ${shownThreshold(p, r.minMonthly)}/month on top of the plan.` : "Good fit; add once the first channels show results.";
    } else if (!r.why) {
      r.why = r.minMonthly > p.budgetUsd ? `Needs at least ${shownThreshold(p, r.minMonthly)}/month to learn anything.` : "Weaker fit for this business right now.";
    }
  }
  const ineligible = rows.filter((r) => r.status === "ineligible");
  return [...ranked, ...ineligible];
}

/** The candidates the scoring agent reviews: the best eligible priors plus every type starter. */
export function candidatesFor(p: AcquisitionProfile, n = 30): ScoredChannel[] {
  const all = scoreChannels(p);
  const starters = new Set(p.types.flatMap((k) => TYPE_BY_KEY[k]?.starters ?? []));
  const top = all.filter((r) => r.status !== "ineligible").slice(0, n);
  for (const r of all) if (starters.has(r.id) && r.status !== "ineligible" && !top.includes(r)) top.push(r);
  return top;
}

/* ---------------- profile assembly ---------------- */

export interface SavedAcquisition {
  types: string[];
  typesSource?: "owner" | "inferred";
  dims: Partial<Record<DimensionKey, DimensionValue>>;
  channelPreferences?: OwnerChannelPreference[];
}

/** Profile from what's saved, the onboarding type guess and the goal. */
/** `budgetMinor` and `priceUsdMonth` are in `currency` (the workspace's); the profile holds them in USD terms for the library's thresholds. */
export function profileFrom(p: { saved?: SavedAcquisition | null; legacyType?: string | null; budgetMinor: number; horizonDays: number; legacyTypes: (t: string | null | undefined) => string[]; priceUsdMonth?: number; currency?: string }): AcquisitionProfile {
  const cur = p.currency;
  return {
    types: p.saved?.types.length ? p.saved.types : p.legacyTypes(p.legacyType),
    typesSource: p.saved?.types.length ? p.saved.typesSource ?? "inferred" : "inferred",
    dims: { ...(p.saved?.dims ?? {}) },
    ...(p.saved?.channelPreferences ? { channelPreferences: [...p.saved.channelPreferences] } : {}),
    budgetUsd: Math.max(0, Math.round(toUsd(minorToMajor(p.budgetMinor, cur), cur))),
    horizonDays: p.horizonDays,
    ...(p.priceUsdMonth !== undefined && p.priceUsdMonth > 0 ? { priceUsdMonth: Math.round(toUsd(p.priceUsdMonth, cur) * 100) / 100 } : {}),
    ...(cur && cur.toUpperCase() !== "USD" ? { currency: cur } : {}),
  };
}

/** Merge the agent's classification; values the owner confirmed are never overwritten. */
export function mergeFit(profile: AcquisitionProfile, fit: { types: string[]; dimensions: { key: string; value: string; confidence: Confidence; evidence: string }[] }, validTypes: Set<string>): AcquisitionProfile {
  const dims = { ...profile.dims };
  for (const d of fit.dimensions) {
    const key = d.key as DimensionKey;
    if (!(key in DIMENSIONS) || !(DIMENSIONS[key].values as readonly string[]).includes(d.value)) continue;
    if (dims[key]?.source === "owner") continue;
    dims[key] = { value: d.value, confidence: d.confidence, source: "inferred", evidence: d.evidence.slice(0, 240) };
  }
  const types = fit.types.filter((t) => validTypes.has(t)).slice(0, 3);
  return { ...profile, types: profile.typesSource === "owner" ? profile.types : types.length ? types : profile.types, typesSource: profile.typesSource === "owner" ? "owner" : "inferred", dims };
}

/** The agent's channel rows as scoring adjustments. */
export function adjustmentsFrom(fit: { channels: { id: string; deltas: number[]; reason: string; evidence: string; platform: string; tactic: string; audience: string }[] }): Adjustment[] {
  return fit.channels.map((c) => ({
    channelId: c.id,
    deltas: Object.fromEntries(FACTORS.map((f, i) => [f, Math.max(-30, Math.min(30, Math.round(c.deltas[i] ?? 0)))])) as Partial<Record<Factor, number>>,
    reason: c.reason.slice(0, 280),
    evidence: c.evidence.slice(0, 280),
    platform: c.platform.slice(0, 80) || undefined,
    tactic: c.tactic.slice(0, 120) || undefined,
    audienceName: c.audience.slice(0, 120) || undefined,
  }));
}

/** Channels that publish a page or article and wait for visitors (search and content), as opposed to ones that send people. */
export const needsTraffic = (r: Pick<ScoredChannel, "family" | "paid">) => (r.family === "organic_search" || r.family === "content") && !r.paid;

/**
 * Bench Run 6 (Meetrao): the picks were two page channels and nothing that sends people to the pages. When every
 * picked channel needs traffic, name the best-scoring channel that sends people (unpaid first) to pair with them.
 */
export function distributionPair(rows: ScoredChannel[]): ScoredChannel | undefined {
  const picked = rows.filter((r) => r.status === "primary" || r.status === "in_plan");
  if (!picked.length || !picked.every(needsTraffic)) return undefined;
  const senders = rows.filter((r) => r.status !== "ineligible" && !needsTraffic(r) && r.score >= 50 && !r.limits?.some((x) => x.verdict === "blocked"));
  return senders.find((r) => !r.paid) ?? senders[0];
}

/** A compact scorecard for agent prompts. */
export function scorecardText(rows: ScoredChannel[], n = 14, currency?: string): string {
  const pair = distributionPair(rows);
  return rows
    .filter((r) => r.status !== "ineligible")
    .slice(0, n)
    .map((r) => `- ${r.id} ${r.name}: ${r.score}/100 · ${STATUS_LABEL[r.status]}${r.diagnosisFit ? " · fits measured bottleneck" : ""}${r.ownerPreference ? ` · owner-reported ${r.ownerPreference.preference}: ${r.ownerPreference.rationale}` : ""}${r.paid ? ` · min ${formatMoney(thresholdIn(r.minMonthly, currency), currency)}/mo` : ""}${r.tactic ? ` · tactic: ${r.tactic}` : ""}${r.why ? ` · ${r.why}` : ""}${r.priceFit && r.priceFit !== r.why ? ` · price: ${r.priceFit}` : ""}${(r.limits ?? []).filter((x) => x.reason !== r.why).map((x) => ` · ${x.verdict === "setup" ? "setup" : x.kind.replace("_", " ")}: ${x.reason}`).join("")}`)
    .join("\n")
    .concat(pair ? `\nThe picked channels are pages that wait for visitors: pair them with a route that sends qualified people, e.g. ${pair.id} ${pair.name} (${pair.score}/100), and give each page play its route.` : "");
}
