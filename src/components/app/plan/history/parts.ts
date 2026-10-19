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
  expert?: unknown;
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
