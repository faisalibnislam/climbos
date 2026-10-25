/** Owner-reported business stage is a planning lens, not proof of demand or performance. */
export const BUSINESS_LIFECYCLE_STAGES = [
  "idea_validation",
  "pre_launch",
  "early_traction",
  "growth",
  "maturity",
  "decline",
] as const;

export type BusinessLifecycleStage = (typeof BUSINESS_LIFECYCLE_STAGES)[number];

const LABELS: Record<BusinessLifecycleStage, string> = {
  idea_validation: "Idea validation",
  pre_launch: "Pre-launch",
  early_traction: "Early traction",
  growth: "Growth",
  maturity: "Maturity",
  decline: "Possible decline",
};

const GUIDANCE: Record<BusinessLifecycleStage, string> = {
  idea_validation: "Test whether a specific customer problem is urgent and whether people will commit money or time before recommending broad acquisition or major build work.",
  pre_launch: "Prioritize launch readiness, credible demand tests, offer and price validation, and a small qualified pilot; a waitlist or interest alone does not prove demand.",
  early_traction: "Look for a repeatable customer segment and acquisition path, then check first-value experience, retention, and delivery before widening channels.",
  growth: "Scale only what has evidence of repeatable customer and contribution economics, within the owner's cash, time, and delivery limits.",
  maturity: "Protect the profitable core, improve retention and efficiency, and test adjacent growth options without assuming the business is declining.",
  decline: "Treat decline as the owner's concern, not a proven diagnosis. Check seasonality, cohort/customer loss, offer relevance, and market change before recommending a pivot or more acquisition spend.",
};

export function businessLifecycleContext(stage?: BusinessLifecycleStage | null, updatedAt?: number): string {
  if (!stage) {
    return "BUSINESS DEVELOPMENT STAGE: unknown (not provided by the owner). Do not infer idea validation, launch, growth, maturity, or decline from the website alone. If stage would materially change the recommendation, ask one short question or give a plan that remains valid across stages.";
  }
  const label = LABELS[stage];
  const updated = updatedAt && Number.isFinite(updatedAt) ? `; owner-confirmed ${new Date(updatedAt).toISOString().slice(0, 10)}` : "";
  return `BUSINESS DEVELOPMENT STAGE: ${label} (owner-reported${updated}). Use this only as a planning lens, not proof of demand, customer fit, growth, or decline. ${GUIDANCE[stage]}`;
}

