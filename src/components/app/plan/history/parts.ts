import { PLAN_PARTS, type PlanPartKey } from "../../../../../shared/planParts";

/* Each plan part as short lines of text, so two versions can be compared line by line. */

interface Expert {
  diagnosis?: string;
  affordableCac?: string;
  northStar?: { metric: string; baseline: string; target: string };
  leadingIndicators?: { metric: string; weeklyTarget: string; source: string }[];
  phases?: { name: string; days: string; focus: string }[];
  weekOneChecklist?: string[];
  risks?: { risk: string; mitigation: string }[];
  notDoing?: { channel: string; why: string }[];
  plays?: { name: string; kind: string; oneLiner: string; unit: string; p10: number; p50: number; p90: number; confidence: string; firstActionToday: string }[];
}

export interface ComparablePlan {
  summary: string;
  positioning: string;
  audiences: { name: string; hypothesis: string; evidence: string }[];
  channels: { name: string; priority: number; status: string; why: string; monthlyCostMicros: number; adSpendMinor: number }[];
  constraints: string[];
  measurementPlan: string;
  savedDecisions?: {
    diagnosis: string | null;
    plays: { id: string; name: string; kind: string; oneLiner: string; unit: string; p10: number | null; p50: number | null; p90: number | null }[] | null;
    portfolio: { selected: string[]; customers: number | null; horizonDays: number | null } | null;
  } | null;
  expert?: unknown;
}

export interface DecisionChange {
  key: string;
  label: string;
  before: string;
  after: string;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const number = (n: number | null) => n === null ? "unknown" : new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);

type SavedPlay = NonNullable<NonNullable<ComparablePlan["savedDecisions"]>["plays"]>[number];
type SavedPortfolio = NonNullable<NonNullable<ComparablePlan["savedDecisions"]>["portfolio"]>;

function savedPlayDescription(play: SavedPlay, portfolio: SavedPortfolio | null | undefined): string {
  const range = play.p10 === null && play.p50 === null && play.p90 === null
    ? "saved outcome range unknown"
    : `saved lower/middle/upper modeled customers: ${number(play.p10)} / ${number(play.p50)} / ${number(play.p90)}${play.unit ? ` ${play.unit}` : ""}`;
  const selected = portfolio && Array.isArray(portfolio.selected)
    ? portfolio.selected.includes(play.name) ? "in the chosen set" : "not in the chosen set"
    : "chosen set not recorded";
  return [play.kind, play.oneLiner, range, selected].filter(Boolean).join(" · ");
}

/** Compares the choices as originally saved, not numbers recalculated from today's inputs. */
export function compareSavedDecisions(a: ComparablePlan, b: ComparablePlan): DecisionChange[] | null {
  const left = a.savedDecisions;
  const right = b.savedDecisions;
  if (!left?.plays || !right?.plays || !left.portfolio || !right.portfolio) return null;
  const changes: DecisionChange[] = [];
  if (left.diagnosis !== right.diagnosis && (left.diagnosis || right.diagnosis)) {
    changes.push({ key: "diagnosis", label: "What ClimbOS thinks is holding growth back", before: left.diagnosis ?? "Not recorded", after: right.diagnosis ?? "Not recorded" });
  }
  if (left.plays && right.plays) {
    const oldById = new Map(left.plays.map((play) => [play.id, play]));
    const newById = new Map(right.plays.map((play) => [play.id, play]));
    for (const id of new Set([...oldById.keys(), ...newById.keys()])) {
      const oldPlay = oldById.get(id);
      const newPlay = newById.get(id);
      if (oldPlay && newPlay && same(oldPlay, newPlay) && same(left.portfolio?.selected.includes(oldPlay.name), right.portfolio?.selected.includes(newPlay.name))) continue;
      const name = newPlay?.name ?? oldPlay?.name ?? "Growth play";
      changes.push({
        key: `play-${id}`,
        label: name,
        before: oldPlay ? savedPlayDescription(oldPlay, left.portfolio) : "Not recommended in this version",
        after: newPlay ? savedPlayDescription(newPlay, right.portfolio) : "No longer recommended",
      });
    }
  }
  if (left.portfolio && right.portfolio && (
    !same([...left.portfolio.selected].sort(), [...right.portfolio.selected].sort())
      || left.portfolio.customers !== right.portfolio.customers
      || left.portfolio.horizonDays !== right.portfolio.horizonDays
  )) {
    changes.push({
      key: "chosen-set",
      label: "Chosen set and modeled result",
      before: describePortfolio(left.portfolio),
      after: describePortfolio(right.portfolio),
    });
  }
  const channels = (plan: ComparablePlan) => [...plan.channels].sort((x, y) => x.priority - y.priority).map((channel) => `${channel.priority}. ${channel.name} (${channel.status})`);
  const oldChannels = channels(a);
  const newChannels = channels(b);
  if (!same(oldChannels, newChannels)) changes.push({ key: "channels", label: "Recommended places to reach customers", before: oldChannels.join("; ") || "None recorded", after: newChannels.join("; ") || "None recorded" });
  const audienceNames = (plan: ComparablePlan) => plan.audiences.map((audience) => audience.name);
  const oldAudiences = audienceNames(a);
  const newAudiences = audienceNames(b);
  if (!same(oldAudiences, newAudiences)) changes.push({ key: "audiences", label: "Customer groups", before: oldAudiences.join("; ") || "None recorded", after: newAudiences.join("; ") || "None recorded" });
  return changes;
}

function describePortfolio(portfolio: SavedPortfolio): string {
  const selected = portfolio.selected.join(" + ") || "No set recorded";
  const modeled = portfolio.customers === null ? "modeled customer total unknown" : `${number(portfolio.customers)} modeled customers${portfolio.horizonDays === null ? "" : ` over ${portfolio.horizonDays} days`}`;
  return `${selected} · ${modeled}`;
}

export interface ComparableExperiment {
  name: string;
  hypothesis: string;
  primaryMetric: string;
  durationDays: number;
}

const sentences = (t: string) =>
  (t ?? "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

const money = (minor: number) => (minor > 0 ? `$${Math.round(minor / 100)}/month ads` : "no ads");

export function partLines(key: PlanPartKey, s: ComparablePlan, experiments: ComparableExperiment[]): string[] {
  const x = (s.expert ?? {}) as Expert;
  switch (key) {
    case "summary":
      return sentences(s.summary);
    case "positioning":
      return sentences(s.positioning);
    case "target":
      return [
        ...(x.diagnosis ? sentences(x.diagnosis) : []),
        ...(x.affordableCac ? [`Affordable cost per customer: ${x.affordableCac}`] : []),
        ...(x.northStar ? [`North star: ${x.northStar.metric}, ${x.northStar.baseline} → ${x.northStar.target}`] : []),
        ...(x.leadingIndicators ?? []).map((l) => `${l.metric}: ${l.weeklyTarget} a week (${l.source})`),
      ];
    case "plays":
      return (x.plays ?? []).flatMap((p) => [`${p.name} · ${p.kind}`, `  ${p.oneLiner}`, `  Expected ${p.p50} ${p.unit} (${p.p10}–${p.p90}), ${p.confidence} confidence`, `  Today: ${p.firstActionToday}`]);
    case "execution":
      return [
        ...(x.phases ?? []).map((p) => `${p.name} · ${p.days}: ${p.focus}`),
        ...(x.weekOneChecklist ?? []).map((w) => `This week: ${w}`),
        ...(x.risks ?? []).map((r) => `Risk: ${r.risk} → ${r.mitigation}`),
        ...(x.notDoing ?? []).map((n) => `Not doing: ${n.channel}. ${n.why}`),
      ];
    case "audiences":
      return s.audiences.flatMap((a) => [a.name, `  ${a.hypothesis}`, `  Evidence: ${a.evidence}`]);
    case "channels":
      return [...s.channels]
        .sort((a, b) => a.priority - b.priority)
        .flatMap((c) => [`${c.priority}. ${c.name} · ${money(c.adSpendMinor)}`, `  ${c.why}`]);
    case "experiments":
      return experiments.flatMap((e) => [`${e.name} · ${e.primaryMetric} · ${e.durationDays} days`, `  ${e.hypothesis}`]);
    case "basics":
      return [...s.constraints.map((c) => `Limit: ${c}`), ...sentences(s.measurementPlan).map((m) => `Measure: ${m}`)];
  }
}

export interface PartComparison {
  key: PlanPartKey;
  label: string;
  left: string[];
  right: string[];
  changed: boolean;
}

export function comparePlans(a: ComparablePlan, aExp: ComparableExperiment[], b: ComparablePlan, bExp: ComparableExperiment[]): PartComparison[] {
  return PLAN_PARTS.map((p) => {
    const left = partLines(p.key, a, aExp);
    const right = partLines(p.key, b, bExp);
    return { key: p.key, label: p.label, left, right, changed: JSON.stringify(left) !== JSON.stringify(right) };
  });
}
