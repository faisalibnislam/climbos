export interface ApprovedPlanContextInput {
  status: string;
  version: number;
  summary?: string;
  positioning?: string;
  audiences?: string[];
  expert?: unknown;
}

type PlanDetail = {
  snapshot?: { snapshotId?: string };
  diagnosis?: string;
  northStar?: unknown;
  plays?: {
    name?: string;
    oneLiner?: string;
    actionContract?: {
      intendedEffect?: string;
      measurement?: { metric?: string; baseline?: string; target?: string; windowDays?: number; source?: string };
    };
  }[];
};

const clean = (value: unknown, max = 500): string => typeof value === "string" ? value.trim().slice(0, max) : "";

/** A bounded, provenance-labeled summary of the exact owner-approved plan. */
export function approvedPlanContext(plan: ApprovedPlanContextInput): string {
  if (plan.status !== "approved") return "";
  const expert = plan.expert && typeof plan.expert === "object" ? plan.expert as PlanDetail : {};
  const snapshotId = clean(expert.snapshot?.snapshotId, 100) || "unavailable for this legacy plan";
  const lines = [
    `Plan version: ${plan.version}; context snapshot: ${snapshotId}`,
    clean(plan.summary) ? `Summary: ${clean(plan.summary)}` : "",
    clean(expert.diagnosis) ? `Diagnosis: ${clean(expert.diagnosis)}` : "",
    clean(plan.positioning) ? `Positioning: ${clean(plan.positioning)}` : "",
    plan.audiences?.length ? `Audiences: ${plan.audiences.slice(0, 5).map((x) => clean(x, 180)).filter(Boolean).join("; ")}` : "",
    expert.northStar ? `North Star: ${JSON.stringify(expert.northStar).slice(0, 500)}` : "",
    ...(expert.plays ?? []).slice(0, 5).map((play) => {
      const measure = play.actionContract?.measurement;
      const measurement = measure ? ` Measure: ${[measure.metric, measure.baseline, measure.target, measure.windowDays ? `${measure.windowDays} days` : "", measure.source].map((x) => clean(x, 100)).filter(Boolean).join("; ")}.` : "";
      return `Play: ${clean(play.name, 120)}. ${clean(play.oneLiner, 280)} ${clean(play.actionContract?.intendedEffect, 220)}${measurement}`.trim();
    }),
  ].filter(Boolean);
  return lines.join("\n").slice(0, 5_000);
}
