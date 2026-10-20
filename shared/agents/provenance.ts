/**
 * Where every number behind a growth play comes from (spec §05): the owner,
 * research the writer read, a named benchmark, an allocation the planner
 * proposes, or an assumption. The writer's tags are model-reported; code then
 * checks them and stamps the result:
 * - owner: kept only for metrics the owner confirmed in structured unit
 *   economics (fixed metric, unit and period); anything else is an assumption;
 * - research: verified only when ClimbOS loads the cited page itself (a page
 *   this run's search actually returned) and finds the writer's quote there,
 *   with the number in the right unit and the metric named;
 * - benchmarks stay model-reported.
 * Checks without ClimbOS's stamp read as "not checked". Forecasts built on any
 * assumed input are assumption-based scenarios; none is calibrated to the
 * business's own results. Older plans without tags read as "not labelled".
 */
import type { Economics, OwnerEconomics, PlayLike, PlayModel } from "./economics";
import { ownerHourOf } from "./economics";
import { formatMoney } from "../economics/currency";

export const PROVENANCE = ["owner", "research", "benchmark", "planned", "assumption"] as const;
export type Provenance = (typeof PROVENANCE)[number];

/** Set by code, never by the writer: how far a tag was verified. */
export type TagCheck = "owner_input" | "source_verified" | "retrieved" | "reported";
/** Marks checks ClimbOS set; a check without it (forged, or from older code) reads as "not checked". */
export const CHECK_STAMP = "climbos-provenance-1";

export interface SourceTag {
  source: Provenance;
  /** Page URL, benchmark name, or owner input the number came from; "" for assumptions. */
  ref: string;
  /** Research only: the exact sentence from the page that states the number. */
  quote?: string;
  check?: TagCheck;
  checkedBy?: string;
  /** Owner inputs: when the owner confirmed the value. */
  confirmedAt?: number;
  /** Research: how the cited page was reached. "search_only" = returned by search but not loaded; "not_in_search" = stale or invented. */
  access?: "read" | "search_only" | "unavailable" | "not_in_search";
  /** Research read by ClimbOS: when, and a hash of the page text (no full page kept). */
  receipt?: { fetchedAt: number; contentHash: string };
  /** Owner override: the value and source it replaced, so lineage survives (REQ-EVID-06). */
  replaced?: { value: number; source: string };
}
/** As read from a saved plan: older plans have no tag. */
export type InputSource = Provenance | "unlabelled";
export interface ReadTag {
  source: InputSource;
  ref: string;
  /** Owner, research and benchmark tags carry how they were checked ("reported" when unchecked or older). */
  check?: TagCheck;
  confirmedAt?: number;
  access?: SourceTag["access"];
  /** The value an owner confirmation replaced (lineage). */
  replaced?: SourceTag["replaced"];
}

export type EconomicsKey = "revenue" | "margin" | "churn";
export type EconomicsSources = Partial<Record<EconomicsKey | "ownerHour", SourceTag>>;

const UNLABELLED: ReadTag = { source: "unlabelled", ref: "" };
const CLAIMS = new Set<InputSource>(["owner", "research", "benchmark"]);
const CHECKS = new Set<string>(["owner_input", "source_verified", "retrieved", "reported"]);

/** Stamps a check as ClimbOS's own. */
function stamped(t: SourceTag, check: TagCheck): SourceTag {
  return { ...t, check, checkedBy: CHECK_STAMP };
}

function read(t: Partial<SourceTag> | undefined): ReadTag {
  if (!t || !(PROVENANCE as readonly string[]).includes(t.source ?? "")) return UNLABELLED;
  const source = t.source as Provenance;
  const tag: ReadTag = { source, ref: (t.ref ?? "").slice(0, 200) };
  // A claim counts as checked only with ClimbOS's stamp; anything else (older plans, forged values) is model-reported.
  if (CLAIMS.has(source)) tag.check = t.checkedBy === CHECK_STAMP && t.check && CHECKS.has(t.check) ? t.check : "reported";
  // "Owner" without a stamped owner input was never confirmed.
  if (source === "owner" && tag.check !== "owner_input") tag.check = "reported";
  if (tag.check === "owner_input" && typeof t.confirmedAt === "number") tag.confirmedAt = t.confirmedAt;
  if (tag.check === "owner_input" && typeof t.replaced?.value === "number") tag.replaced = { value: t.replaced.value, source: String(t.replaced.source ?? "").slice(0, 20) };
  if (source === "research" && t.checkedBy === CHECK_STAMP && t.access) tag.access = t.access;
  return tag;
}

/** Each economics input's source; older plans fall back to their `assumed` list. */
export function economicsSources(e: Economics): Record<EconomicsKey | "ownerHour", ReadTag> {
  const s = e.sources ?? {};
  const legacy = (k: EconomicsKey): ReadTag => (s[k] ? read(s[k]) : e.assumed?.includes(k) ? { source: "assumption", ref: "" } : UNLABELLED);
  return {
    revenue: legacy("revenue"),
    margin: legacy("margin"),
    churn: legacy("churn"),
    // The owner's hourly value counts as theirs only with a stamped owner input; a bare value is unconfirmed.
    ownerHour: s.ownerHour ? read(s.ownerHour) : e.ownerHourUsd && e.ownerHourUsd > 0 ? { source: "owner", ref: "", check: "reported" } : { source: "assumption", ref: `${formatMoney(ownerHourOf(e), e.currency)}/hour default` },
  };
}

/** Keeps `assumed` in step with the tags (older code and the owner questions read it). */
export function withDerivedAssumed(e: Economics): Economics {
  if (!e.sources) return e;
  const src = economicsSources(e);
  return { ...e, assumed: (["revenue", "margin", "churn"] as const).filter((k) => src[k].source === "assumption") };
}

/* ---------------- Code checks ---------------- */

type Unit = "share" | "count" | "usd_month";

const norm = (s: string) => s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, " ").trim();

/** A cited URL in comparable form: no scheme, www, hash, query or trailing slash. */
export function urlKey(u: string): string {
  return u.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
}

/** Numbers written in the quote with the unit the metric needs. */
function quoteNumbers(quote: string, unit: Unit): number[] {
  const q = quote.toLowerCase().replace(/(\d),(\d{3})/g, "$1$2");
  if (unit === "share") return [...q.matchAll(/(\d+(?:\.\d+)?)\s?(?:%|percent\b)/g)].map((m) => Number(m[1]) / 100);
  if (unit === "usd_month") {
    // A price only counts with a currency and a monthly period; yearly prices don't match a monthly metric.
    if (/(per|a|\/)\s?(year|yr|annum)|annual(ly)?|yearly/.test(q) && !/(per|a|\/)\s?(month|mo)\b|monthly/.test(q)) return [];
    if (!/(per|a|\/)\s?(month|mo)\b|monthly|\/mo\b/.test(q)) return [];
    return [...q.matchAll(/(?:[$£€]\s?(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s?(?:usd|dollars|eur|gbp))/g)].map((m) => Number(m[1] ?? m[2]));
  }
  return [...q.matchAll(/(?<![\d.$£€])(\d+(?:\.\d+)?)\s?(k\b)?(?!\s?%)/g)].map((m) => Number(m[1]) * (m[2] ? 1000 : 1));
}

/** Exact match only: "$30" doesn't support 29.99, and 15% doesn't support 0.149 (shares compared as percents). */
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 + Math.abs(b) * 1e-9;

/** The quote states the value itself, or both ends of its range (one end alone isn't enough). */
function quoteHasValue(quote: string, unit: Unit, value: number, low?: number, high?: number): boolean {
  const ns = quoteNumbers(quote, unit);
  if (ns.some((n) => close(n, value))) return true;
  return low !== undefined && high !== undefined && low !== high && ns.some((n) => close(n, low)) && ns.some((n) => close(n, high));
}

const STOP = new Set(["to", "the", "a", "an", "of", "and", "or", "per", "from", "rate", "step"]);
/** The quote names the metric: a word from the step's name, or the metric's own words. */
function quoteNamesMetric(quote: string, metricWords: string[]): boolean {
  const q = ` ${norm(quote).replace(/[^a-z0-9%$ ]/g, " ")} `;
  return metricWords.some((w) => w.length >= 4 && q.includes(` ${w}`));
}

function wordsOf(name: string): string[] {
  return norm(name).replace(/[^a-z ]/g, " ").split(" ").filter((w) => w && !STOP.has(w)).map((w) => (w.length > 5 ? w.slice(0, 5) : w));
}

/** A small stable hash of page text (FNV-1a), for receipts; no full page is stored. */
export function textHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}

export interface VerifyContext {
  /** Text of cited pages ClimbOS loaded itself, by `urlKey`; null when the page couldn't be loaded. */
  pages: Record<string, string | null>;
  /** `urlKey`s of pages this run's search returned (to tell search-only results from stale citations). */
  searched?: string[];
  /** When the pages were fetched (for receipts). */
  fetchedAt?: number;
  /** Unit economics the owner confirmed (the only basis for an "owner" tag). */
  owner?: OwnerEconomics | null;
}

const ECON_OWNER_KEY: Record<EconomicsKey, keyof OwnerEconomics> = { revenue: "revenuePerCustomerMonthUsd", margin: "grossMargin", churn: "monthlyChurn" };

interface Claim {
  values: [number, number | undefined, number | undefined];
  unit: Unit;
  metricWords: string[];
  kind: "input" | "allocation";
  /** Economics metric this is, for the owner check. */
  econ?: EconomicsKey;
}

/** Research: verified only when the loaded page contains the quote, and the quote states this number for this metric. */
function checkResearch(t: SourceTag, c: Claim, ctx: VerifyContext): SourceTag {
  const key = urlKey(t.ref);
  const page = ctx.pages[key];
  const quote = (t.quote ?? "").trim();
  const access: SourceTag["access"] = typeof page === "string" ? "read" : page === null ? "unavailable" : ctx.searched?.includes(key) ? "search_only" : "not_in_search";
  const withAccess: SourceTag = { ...t, access, ...(typeof page === "string" ? { receipt: { fetchedAt: ctx.fetchedAt ?? 0, contentHash: textHash(page) } } : {}) };
  if (!page || !quote) return stamped(withAccess, "reported");
  if (!norm(page).includes(norm(quote))) return stamped(withAccess, "retrieved");
  const [v, low, high] = c.values;
  return stamped(withAccess, quoteHasValue(quote, c.unit, v, low, high) && quoteNamesMetric(quote, c.metricWords) ? "source_verified" : "retrieved");
}

function verifyTag(t: SourceTag | undefined, c: Claim, ctx: VerifyContext): SourceTag | undefined {
  if (!t) return t;
  const base: SourceTag = { source: t.source, ref: t.ref, ...(t.quote ? { quote: t.quote.slice(0, 300) } : {}) };
  switch (t.source) {
    case "owner": {
      // A budget cap or time limit isn't the owner choosing this allocation.
      if (c.kind === "allocation") return { source: "planned", ref: t.ref };
      // Only structured, confirmed owner metrics count; applyOwnerEconomics stamps them.
      if (c.econ && typeof ctx.owner?.[ECON_OWNER_KEY[c.econ]] === "number") return base;
      return { source: "assumption", ref: "Not confirmed by you. Add it under Sharpen this plan." };
    }
    case "research":
      return checkResearch(base, c, ctx);
    case "benchmark":
      return stamped(base, "reported");
    default:
      return { source: t.source, ref: t.ref };
  }
}

type PlaysLike = { economics: Economics; plays: { model?: PlayModel }[] };

/** Research URLs with quotes that need their page loaded (only ones this run's search returned are fetched). */
export function citedUrls(out: PlaysLike): string[] {
  const urls = new Set<string>();
  const add = (t?: { source?: string; ref?: string; quote?: string }) => {
    if (t?.source === "research" && t.ref && t.quote?.trim()) urls.add(t.ref.trim());
  };
  for (const t of Object.values(out.economics.sources ?? {})) add(t);
  for (const p of out.plays) {
    add(p.model?.reachSource);
    for (const st of p.model?.steps ?? []) add(st);
  }
  return [...urls];
}

export function verifyTags<O extends PlaysLike>(out: O, ctx: VerifyContext): O {
  const e = out.economics;
  const s = e.sources ?? {};
  const econ: EconomicsSources = { ...s };
  const pairs: [EconomicsKey, number | undefined, Unit, string[]][] = [
    ["revenue", e.revenuePerCustomerMonthUsd, "usd_month", ["price", "plan", "month", "revenue", "costs"]],
    ["margin", e.grossMargin, "share", ["margin", "gross"]],
    ["churn", e.monthlyChurn, "share", ["churn", "cancel", "retention", "retain"]],
  ];
  for (const [k, v, unit, words] of pairs) if (s[k] && v !== undefined) econ[k] = verifyTag(s[k], { values: [v, undefined, undefined], unit, metricWords: words, kind: "input", econ: k }, ctx);
  const plays = out.plays.map((p) => {
    const m = p.model;
    if (!m?.steps?.length) return p;
    return {
      ...p,
      model: {
        ...m,
        reachSource: verifyTag(m.reachSource, { values: [m.weeklyReach, m.weeklyReachLow, m.weeklyReachHigh], unit: "count", metricWords: ["visit", "users", "member", "subsc", "follo", "reach", "audie", "searc", "month", "week"], kind: "input" }, ctx),
        steps: m.steps.map((st) => {
          if (!st.source) return st;
          const t = verifyTag({ source: st.source, ref: st.ref ?? "", quote: st.quote }, { values: [st.rate, st.low, st.high], unit: "share", metricWords: [...wordsOf(st.name), "conve", "rate", "reply", "open", "click", "signu", "trial", "close", "book"], kind: "input" }, ctx)!;
          return { ...st, source: t.source, ref: t.ref, quote: t.quote, check: t.check, checkedBy: t.checkedBy, access: t.access, receipt: t.receipt };
        }),
        spendSource: verifyTag(m.spendSource, { values: [m.monthlySpendUsd, undefined, undefined], unit: "usd_month", metricWords: [], kind: "allocation" }, ctx),
        hoursSource: verifyTag(m.hoursSource, { values: [m.ownerHoursPerWeek, undefined, undefined], unit: "count", metricWords: [], kind: "allocation" }, ctx),
      },
    };
  });
  return { ...out, economics: e.sources ? { ...e, sources: econ } : e, plays } as O;
}

/* ---------------- Rows and forecast basis ---------------- */

export type InputUnit = "people_week" | "share" | "usd_month" | "hours_week" | "share_month" | "usd_hour";
export interface InputRow {
  key: string;
  label: string;
  value: number;
  low?: number;
  high?: number;
  unit: InputUnit;
  tag: ReadTag;
  /** Which output it drives: the customer forecast, or cost and payback. */
  drives: "customers" | "cost";
}

/** Every number behind one play, with where it came from. */
export function playInputs(p: PlayLike, e: Economics): InputRow[] {
  const m: PlayModel | undefined = p.model;
  if (!m?.steps?.length) return [];
  const econ = economicsSources(e);
  const rows: InputRow[] = [
    { key: "reach", label: "Weekly reach", value: m.weeklyReach, low: m.weeklyReachLow, high: m.weeklyReachHigh, unit: "people_week", tag: read(m.reachSource), drives: "customers" },
    ...m.steps.map((s, i): InputRow => ({ key: `step${i}`, label: s.name, value: s.rate, low: s.low, high: s.high, unit: "share", tag: read(s.source ? { source: s.source, ref: s.ref ?? "", check: s.check, checkedBy: s.checkedBy } : undefined), drives: "customers" })),
    { key: "spend", label: "Monthly spend", value: m.monthlySpendUsd, unit: "usd_month", tag: read(m.spendSource), drives: "cost" },
    { key: "hours", label: "Your hours a week", value: m.ownerHoursPerWeek, unit: "hours_week", tag: read(m.hoursSource), drives: "cost" },
    { key: "revenue", label: "Revenue per customer", value: e.revenuePerCustomerMonthUsd, unit: "usd_month", tag: econ.revenue, drives: "cost" },
    { key: "margin", label: "Margin", value: e.grossMargin, unit: "share", tag: econ.margin, drives: "cost" },
  ];
  if (typeof e.monthlyChurn === "number") rows.push({ key: "churn", label: "Monthly churn", value: e.monthlyChurn, unit: "share_month", tag: econ.churn, drives: "cost" });
  if ((m.otherMonthlyUsd ?? 0) > 0) rows.push({ key: "other", label: "Tools and freelancers", value: m.otherMonthlyUsd!, unit: "usd_month", tag: read(undefined), drives: "cost" });
  if (m.ownerHoursPerWeek > 0) rows.push({ key: "ownerHour", label: "Value of your hour", value: ownerHourOf(e), unit: "usd_hour", tag: econ.ownerHour, drives: "cost" });
  return rows;
}

export type BasisKind = "assumption_scenario" | "sourced_estimate" | "unlabelled_scenario";
export interface ForecastBasis {
  kind: BasisKind;
  /** Labels of the assumed inputs, for "assumed: …". */
  assumed: string[];
  /** Labels of sourced inputs not verified (model-reported research, unmatched pages, benchmarks, unconfirmed owner values). */
  unchecked: string[];
}

function basisOf(rows: InputRow[]): ForecastBasis {
  const assumed = rows.filter((r) => r.tag.source === "assumption").map((r) => r.label);
  const unchecked = rows.filter((r) => r.tag.check === "reported" || r.tag.check === "retrieved").map((r) => r.label);
  if (assumed.length) return { kind: "assumption_scenario", assumed, unchecked };
  if (rows.some((r) => r.tag.source === "unlabelled")) return { kind: "unlabelled_scenario", assumed: [], unchecked };
  return { kind: "sourced_estimate", assumed: [], unchecked };
}

/** The basis of a play's customer forecast and of its cost and payback. Nothing here is calibrated to observed results. */
export function forecastBasis(p: PlayLike, e: Economics): { customers: ForecastBasis; cost: ForecastBasis } {
  const rows = playInputs(p, e);
  return { customers: basisOf(rows.filter((r) => r.drives === "customers")), cost: basisOf(rows) };
}

export const BASIS_LABEL: Record<BasisKind, string> = {
  assumption_scenario: "Assumption-based scenario",
  sourced_estimate: "Estimate from sources, not yet your results",
  unlabelled_scenario: "Scenario (older plan: sources not labelled)",
};

/** Short form for the cost line. */
export const COST_BASIS_LABEL: Record<BasisKind, string> = {
  assumption_scenario: "rests on assumptions",
  sourced_estimate: "from sources, not yet your results",
  unlabelled_scenario: "sources not labelled",
};

export const SOURCE_LABEL: Record<InputSource, string> = { owner: "You", research: "Research", benchmark: "Benchmark", planned: "Planned", assumption: "Assumed", unlabelled: "Not labelled" };

export const ACCESS_LABEL: Record<NonNullable<SourceTag["access"]>, string> = {
  read: "page read",
  search_only: "search result only",
  unavailable: "page couldn't be loaded",
  not_in_search: "not among the pages searched",
};

export const CHECK_LABEL: Record<TagCheck, string> = {
  owner_input: "confirmed by you",
  source_verified: "verified on page",
  retrieved: "page retrieved, claim not matched",
  reported: "not checked",
};
