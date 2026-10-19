/**
 * Where every number behind a growth play comes from (spec §05): the owner,
 * research the writer read, a named benchmark, an allocation the planner
 * proposes, or an assumption. The writer's tags are model-reported; code then
 * checks them: "owner" survives only when the number is one the owner gave
 * (confirmed unit economics or confirmed facts), research counts as checked
 * only when the number sits next to the cited page in the research notes, and
 * benchmarks stay reported. Forecasts built on any assumed input are labelled
 * assumption-based scenarios; none is presented as calibrated to the
 * business's own results. Older plans without tags read as "not labelled".
 */
import type { Economics, OwnerEconomics, PlayLike, PlayModel } from "./economics";
import { OWNER_HOUR_USD } from "./economics";

export const PROVENANCE = ["owner", "research", "benchmark", "planned", "assumption"] as const;
export type Provenance = (typeof PROVENANCE)[number];

/** Set by code, never by the writer: how far a tag was verified. */
export type TagCheck = "owner_input" | "owner_facts" | "research_notes" | "reported";

export interface SourceTag {
  source: Provenance;
  /** Page (URL or domain), benchmark name, or owner fact the number came from; "" for assumptions. */
  ref: string;
  check?: TagCheck;
}
/** As read from a saved plan: older plans have no tag. */
export type InputSource = Provenance | "unlabelled";
export interface ReadTag {
  source: InputSource;
  ref: string;
  /** Owner, research and benchmark tags carry how they were checked ("reported" when unchecked or older). */
  check?: TagCheck;
}

export type EconomicsKey = "revenue" | "margin" | "churn";
export type EconomicsSources = Partial<Record<EconomicsKey | "ownerHour", SourceTag>>;

const UNLABELLED: ReadTag = { source: "unlabelled", ref: "" };
const CLAIMS = new Set<InputSource>(["owner", "research", "benchmark"]);
const CHECKS = new Set<string>(["owner_input", "owner_facts", "research_notes", "reported"]);

function read(t: Partial<SourceTag> | undefined): ReadTag {
  if (!t || !(PROVENANCE as readonly string[]).includes(t.source ?? "")) return UNLABELLED;
  const source = t.source as Provenance;
  const tag: ReadTag = { source, ref: (t.ref ?? "").slice(0, 200) };
  // A claim nobody verified is model-reported, including tags saved before checks existed.
  if (CLAIMS.has(source)) tag.check = t.check && CHECKS.has(t.check) ? t.check : "reported";
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
    // The owner's hourly value is the owner's when they set it; otherwise ClimbOS's default.
    ownerHour: e.ownerHourUsd && e.ownerHourUsd > 0 ? { source: "owner", ref: "Owner confirmed", check: "owner_input" } : { source: "assumption", ref: `$${OWNER_HOUR_USD}/hour default` },
  };
}

/** Keeps `assumed` in step with the tags (older code and the owner questions read it). */
export function withDerivedAssumed(e: Economics): Economics {
  if (!e.sources) return e;
  const src = economicsSources(e);
  return { ...e, assumed: (["revenue", "margin", "churn"] as const).filter((k) => src[k].source === "assumption") };
}

/* ---------------- Code checks ---------------- */

type Unit = "share" | "count" | "usd";

/** Ways a number is commonly written ("4%", "4.0%", "$29", "1,200"), normalised without commas or spaces. */
function forms(v: number, unit: Unit): string[] {
  if (!Number.isFinite(v)) return [];
  const trim = (x: number, d: number) => String(Math.round(x * 10 ** d) / 10 ** d);
  if (unit === "share") {
    const p = v * 100;
    return [...new Set([trim(p, 0), trim(p, 1), trim(p, 2)].map((x) => `${x}%`))];
  }
  const out = new Set([trim(v, 0), trim(v, 2)]);
  if (unit === "usd") for (const x of [...out]) out.add(`$${x}`);
  return [...out];
}

const norm = (s: string) => s.toLowerCase().replace(/[,\s]/g, "");

/** True when one of the values appears in the text as a whole number (not part of a bigger one). */
export function numberIn(text: string, values: (number | undefined)[], unit: Unit): boolean {
  const t = norm(text);
  return values.some((v) => v !== undefined && forms(v, unit).some((f) => new RegExp(`(?<![\\d.])${f.replace(/[$.%]/g, "\\$&")}(?![\\d])`).test(t)));
}

function domainOf(ref: string): string | null {
  return ref.toLowerCase().replace(/https?:\/\/(www\.)?/, "").match(/([a-z0-9-]+\.)+[a-z]{2,}/)?.[0]?.replace(/^www\./, "") ?? null;
}

/** The research notes around each mention of the cited page (3 lines either side). */
function notesNear(notes: string, ref: string): string {
  const d = domainOf(ref);
  if (!d) return "";
  const lines = notes.split("\n");
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (l.toLowerCase().includes(d)) for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) keep.add(j);
  });
  return [...keep].map((i) => lines[i]).join("\n");
}

export interface VerifyContext {
  /** This run's research notes (with their Sources list). */
  notes: string;
  /** The owner's confirmed business facts. */
  facts: string[];
  /** Unit economics the owner confirmed. */
  owner?: OwnerEconomics | null;
}

/**
 * Turns the writer's tags into checked ones. "owner" stays only for numbers the
 * owner gave; proposed spend and hours become "planned"; research is checked
 * against the notes beside the cited page; benchmarks stay reported.
 */
function verifyTag(t: SourceTag | undefined, values: (number | undefined)[], unit: Unit, ctx: VerifyContext, kind: "input" | "allocation"): SourceTag | undefined {
  if (!t) return t;
  const facts = ctx.facts.join("\n");
  switch (t.source) {
    case "owner":
      // A budget cap or time limit isn't the owner choosing this allocation.
      if (kind === "allocation") return { source: "planned", ref: t.ref };
      if (numberIn(facts, values, unit)) return { ...t, check: "owner_facts" };
      return { source: "assumption", ref: "Tagged as yours, but not found in what you gave" };
    case "research":
      return { ...t, check: numberIn(notesNear(ctx.notes, t.ref), values, unit) ? "research_notes" : "reported" };
    case "benchmark":
      return { ...t, check: "reported" };
    default:
      return { source: t.source, ref: t.ref };
  }
}

type PlaysLike = { economics: Economics; plays: { model?: PlayModel }[] };

export function verifyTags<O extends PlaysLike>(out: O, ctx: VerifyContext): O {
  const e = out.economics;
  const s = e.sources ?? {};
  const econ: EconomicsSources = { ...s };
  const pairs: [EconomicsKey, number | undefined, Unit][] = [
    ["revenue", e.revenuePerCustomerMonthUsd, "usd"],
    ["margin", e.grossMargin, "share"],
    ["churn", e.monthlyChurn, "share"],
  ];
  for (const [k, v, unit] of pairs) if (s[k]) econ[k] = verifyTag(s[k], [v], unit, ctx, "input");
  const plays = out.plays.map((p) => {
    const m = p.model;
    if (!m?.steps?.length) return p;
    return {
      ...p,
      model: {
        ...m,
        reachSource: verifyTag(m.reachSource, [m.weeklyReach, m.weeklyReachLow, m.weeklyReachHigh], "count", ctx, "input"),
        steps: m.steps.map((st) => {
          if (!st.source) return st;
          const t = verifyTag({ source: st.source, ref: st.ref ?? "" }, [st.rate, st.low, st.high], "share", ctx, "input")!;
          return { ...st, source: t.source, ref: t.ref, check: t.check };
        }),
        spendSource: verifyTag(m.spendSource, [m.monthlySpendUsd], "usd", ctx, "allocation"),
        hoursSource: verifyTag(m.hoursSource, [m.ownerHoursPerWeek], "count", ctx, "allocation"),
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
    ...m.steps.map((s, i): InputRow => ({ key: `step${i}`, label: s.name, value: s.rate, low: s.low, high: s.high, unit: "share", tag: read(s.source ? { source: s.source, ref: s.ref ?? "", check: s.check } : undefined), drives: "customers" })),
    { key: "spend", label: "Monthly spend", value: m.monthlySpendUsd, unit: "usd_month", tag: read(m.spendSource), drives: "cost" },
    { key: "hours", label: "Your hours a week", value: m.ownerHoursPerWeek, unit: "hours_week", tag: read(m.hoursSource), drives: "cost" },
    { key: "revenue", label: "Revenue per customer", value: e.revenuePerCustomerMonthUsd, unit: "usd_month", tag: econ.revenue, drives: "cost" },
    { key: "margin", label: "Margin", value: e.grossMargin, unit: "share", tag: econ.margin, drives: "cost" },
  ];
  if (typeof e.monthlyChurn === "number") rows.push({ key: "churn", label: "Monthly churn", value: e.monthlyChurn, unit: "share_month", tag: econ.churn, drives: "cost" });
  if (m.ownerHoursPerWeek > 0) rows.push({ key: "ownerHour", label: "Value of your hour", value: e.ownerHourUsd && e.ownerHourUsd > 0 ? e.ownerHourUsd : OWNER_HOUR_USD, unit: "usd_hour", tag: econ.ownerHour, drives: "cost" });
  return rows;
}

export type BasisKind = "assumption_scenario" | "sourced_estimate" | "unlabelled_scenario";
export interface ForecastBasis {
  kind: BasisKind;
  /** Labels of the assumed inputs, for "assumed: …". */
  assumed: string[];
  /** Labels of sourced inputs nobody could check (model-reported research, benchmarks). */
  unchecked: string[];
}

function basisOf(rows: InputRow[]): ForecastBasis {
  const assumed = rows.filter((r) => r.tag.source === "assumption").map((r) => r.label);
  const unchecked = rows.filter((r) => r.tag.check === "reported").map((r) => r.label);
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

export const CHECK_LABEL: Record<TagCheck, string> = {
  owner_input: "confirmed by you",
  owner_facts: "in your facts",
  research_notes: "in research notes",
  reported: "not checked",
};
