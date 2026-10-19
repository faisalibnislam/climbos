/**
 * Where every number behind a growth play comes from (spec §05): the owner,
 * research the writer read, a named benchmark, or an assumption. Forecasts
 * built on any assumed input are labelled assumption-based scenarios; none is
 * presented as calibrated to the business's own results. Older plans without
 * tags read as "not labelled".
 */
import type { Economics, PlayLike, PlayModel } from "./economics";
import { OWNER_HOUR_USD } from "./economics";

export const PROVENANCE = ["owner", "research", "benchmark", "assumption"] as const;
export type Provenance = (typeof PROVENANCE)[number];
/** What the plays agent writes for each input. */
export interface SourceTag {
  source: Provenance;
  /** Page (URL or domain), benchmark name, or owner fact the number came from; "" for assumptions. */
  ref: string;
}
/** As read from a saved plan: older plans have no tag. */
export type InputSource = Provenance | "unlabelled";
export interface ReadTag {
  source: InputSource;
  ref: string;
}

export type EconomicsKey = "revenue" | "margin" | "churn";
export type EconomicsSources = Partial<Record<EconomicsKey | "ownerHour", SourceTag>>;

const UNLABELLED: ReadTag = { source: "unlabelled", ref: "" };

function read(t: Partial<SourceTag> | undefined): ReadTag {
  return t && (PROVENANCE as readonly string[]).includes(t.source ?? "") ? { source: t.source as Provenance, ref: (t.ref ?? "").slice(0, 200) } : UNLABELLED;
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
    ownerHour: e.ownerHourUsd && e.ownerHourUsd > 0 ? (s.ownerHour ? read(s.ownerHour) : { source: "owner", ref: "Owner confirmed" }) : { source: "assumption", ref: `$${OWNER_HOUR_USD}/hour default` },
  };
}

/** Keeps `assumed` in step with the tags (older code and the owner questions read it). */
export function withDerivedAssumed(e: Economics): Economics {
  if (!e.sources) return e;
  const src = economicsSources(e);
  return { ...e, assumed: (["revenue", "margin", "churn"] as const).filter((k) => src[k].source === "assumption") };
}

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
    ...m.steps.map((s, i): InputRow => ({ key: `step${i}`, label: s.name, value: s.rate, low: s.low, high: s.high, unit: "share", tag: read(s.source ? { source: s.source, ref: s.ref ?? "" } : undefined), drives: "customers" })),
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
  /** Labels of the assumed inputs, for "Assumed: …". */
  assumed: string[];
}

function basisOf(rows: InputRow[]): ForecastBasis {
  const assumed = rows.filter((r) => r.tag.source === "assumption").map((r) => r.label);
  if (assumed.length) return { kind: "assumption_scenario", assumed };
  if (rows.some((r) => r.tag.source === "unlabelled")) return { kind: "unlabelled_scenario", assumed: [] };
  return { kind: "sourced_estimate", assumed: [] };
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

export const SOURCE_LABEL: Record<InputSource, string> = { owner: "You", research: "Research", benchmark: "Benchmark", assumption: "Assumed", unlabelled: "Not labelled" };
