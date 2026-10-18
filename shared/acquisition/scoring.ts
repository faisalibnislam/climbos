import { budgetBand, CHANNELS, TYPE_BY_KEY, type Channel, type Requirement, type Stage } from "./library";

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

export interface AcquisitionProfile {
  /** Business type keys from the library (multi-label). */
  types: string[];
  dims: Partial<Record<DimensionKey, DimensionValue>>;
  /** Monthly marketing budget in USD (owner's goal setting). */
  budgetUsd: number;
  /** Goal horizon in days. */
  horizonDays: number;
}

const dim = (p: AcquisitionProfile, k: DimensionKey) => p.dims[k]?.value;

/** Dimensions worth asking the owner about: unknown or low confidence and decision-relevant. */
export const ASK_ORDER: DimensionKey[] = ["customerType", "geography", "salesMotion", "aov", "team", "salesCycle", "scale"];
export function dimensionsToConfirm(p: AcquisitionProfile, max = 3): DimensionKey[] {
  return ASK_ORDER.filter((k) => !p.dims[k] || (p.dims[k]!.source === "inferred" && p.dims[k]!.confidence === "low")).slice(0, max);
}

/* ---------------- eligibility ---------------- */

export function traitsOf(p: AcquisitionProfile): Set<Requirement> {
  const t = new Set<Requirement>();
  for (const k of p.types) for (const r of TYPE_BY_KEY[k]?.traits ?? []) t.add(r);
  const c = dim(p, "customerType");
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
  if (dim(p, "geography") === "local") t.add("location");
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

  const intent = Math.max(...c.stages.map((s) => STAGE_INTENT[s]));

  const budget = p.budgetUsd;
  const budgetScore = c.minMonthly > 0 ? (c.minMonthly > budget ? 5 : 100 - 60 * (c.minMonthly / Math.max(budget, 1))) : [95, 85, 70, 50][c.cash];

  let time = { days: 90, weeks: 70, months: 40 }[c.learn];
  if (p.horizonDays <= 90 && c.learn === "months") time -= 10;
  if (dim(p, "salesCycle") === "long") time = Math.min(time, 60);

  const team = dim(p, "team") ?? "small";
  let feasibility = c.exec === "auto" ? 90 : c.exec === "partial" ? 75 : team === "solo" ? 35 : team === "small" ? 55 : 75;
  if (c.cash >= 3 && (team === "solo" || dim(p, "scale") === "solo")) feasibility -= 15;

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
}

const PAID_FAMILIES = new Set(["paid_search", "paid_social", "traditional"]);

export function scoreChannels(p: AcquisitionProfile, adjustments: Adjustment[] = [], weights = DEFAULT_WEIGHTS): ScoredChannel[] {
  const adj = new Map(adjustments.map((a) => [a.channelId, a]));
  const regulated = p.types.map((k) => TYPE_BY_KEY[k]?.regulated).find(Boolean) ?? (dim(p, "regulation") === "high" ? "Regulated industry: check advertising rules before running this." : undefined);
  const rows = CHANNELS.map((c): ScoredChannel => {
    const el = eligibility(c, p);
    const base = priors(c, p);
    const a = adj.get(c.id);
    const factors = Object.fromEntries(FACTORS.map((f) => [f, clamp(base[f] + Math.max(-30, Math.min(30, a?.deltas[f] ?? 0)))])) as Record<Factor, number>;
    const score = clamp(FACTORS.reduce((s, f) => s + factors[f] * weights[f], 0));
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
      why: el.ok ? (a?.reason ?? "") : el.reason!,
      evidence: a?.evidence,
      platform: a?.platform,
      tactic: a?.tactic,
      audienceName: a?.audienceName,
      caution: el.ok && c.regulatedCaution && regulated ? regulated : undefined,
    };
  });
  return select(rows, p);
}

/** Budget discipline (Part 7): a few focused channels, paid ones only when the budget can feed a real test. */
function select(rows: ScoredChannel[], p: AcquisitionProfile): ScoredChannel[] {
  const band = budgetBand(p.budgetUsd);
  const ranked = rows.filter((r) => r.status !== "ineligible").sort((a, b) => b.score - a.score);
  let paid = 0;
  let spend = 0;
  let picked = 0;
  for (const r of ranked) {
    const affordable = !r.paid || (paid < band.maxPaid && spend + r.minMonthly <= p.budgetUsd);
    if (picked < band.maxChannels && affordable && r.score >= 50) {
      r.status = picked === 0 ? "primary" : "in_plan";
      picked++;
      if (r.paid) {
        paid++;
        spend += r.minMonthly;
      }
      if (!r.why) r.why = picked === 1 ? "Highest score for your business, goal and budget." : "Strong fit that the budget can support alongside the primary channel.";
    } else if (r.score >= 60) {
      r.status = "later";
      if (!r.why) r.why = !affordable ? `Needs about $${r.minMonthly}/month on top of the plan.` : "Good fit; add once the first channels show results.";
    } else if (!r.why) {
      r.why = r.minMonthly > p.budgetUsd ? `Needs at least $${r.minMonthly}/month to learn anything.` : "Weaker fit for this business right now.";
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
  dims: Partial<Record<DimensionKey, DimensionValue>>;
}

/** Profile from what's saved, the onboarding type guess and the goal. */
export function profileFrom(p: { saved?: SavedAcquisition | null; legacyType?: string | null; budgetMinor: number; horizonDays: number; legacyTypes: (t: string | null | undefined) => string[] }): AcquisitionProfile {
  return {
    types: p.saved?.types.length ? p.saved.types : p.legacyTypes(p.legacyType),
    dims: { ...(p.saved?.dims ?? {}) },
    budgetUsd: Math.max(0, Math.round(p.budgetMinor / 100)),
    horizonDays: p.horizonDays,
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
  return { ...profile, types: types.length ? types : profile.types, dims };
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

/** A compact scorecard for agent prompts. */
export function scorecardText(rows: ScoredChannel[], n = 14): string {
  return rows
    .filter((r) => r.status !== "ineligible")
    .slice(0, n)
    .map((r) => `- ${r.id} ${r.name}: ${r.score}/100 · ${STATUS_LABEL[r.status]}${r.paid ? ` · min $${r.minMonthly}/mo` : ""}${r.tactic ? ` · tactic: ${r.tactic}` : ""}${r.why ? ` · ${r.why}` : ""}`)
    .join("\n");
}
