import { readExpertPlan } from "./planCompatibility";

export interface ApprovedPlanContextInput {
  status: string;
  version: number;
  summary?: string;
  positioning?: string;
  audiences?: string[];
  expert?: unknown;
}

type PlanDetail = {
  snapshot?: { snapshotId?: string; [key: string]: unknown };
  diagnosis?: string;
  northStar?: unknown;
  plays?: {
    name?: string;
    oneLiner?: string;
    mechanic?: string;
    hook?: string;
    offerAssessment?: {
      recommendation?: string;
      mechanism?: string;
      segment?: string;
      needOrObstacle?: string;
      objective?: string;
      evidenceNote?: string;
      authorizationNote?: string;
      currency?: string;
      costBoundary?: string;
      horizonDays?: number;
      current?: { netPrice?: { amount?: number | null } };
      proposed?: { netPrice?: { amount?: number | null } };
      test?: { eligibleAudience?: string };
      unknowns?: string[];
      urgencyClaim?: string | null;
    };
    actionContract?: {
      intendedEffect?: string;
      measurement?: { metric?: string; baseline?: string; target?: string; windowDays?: number; source?: string };
    };
  }[];
};

export interface ApprovedOfferTermConstraint {
  playName: string;
  recommendation: string;
  currency: string;
  allowedPrices: number[];
  allowedDiscountPercentages?: number[];
  allowedMechanisms?: string[];
  urgencyClaim: string | null;
  eligibleAudience: string | null;
}

const clean = (value: unknown, max = 500): string => typeof value === "string" ? value.trim().slice(0, max) : "";

/** Typed price constraints for publishable drafts, derived only from an approved plan. */
export function approvedPlanOfferTerms(plan: ApprovedPlanContextInput, opts: { pinnedAtLaunch?: boolean } = {}): ApprovedOfferTermConstraint[] {
  if (plan.status !== "approved" && !(plan.status === "superseded" && opts.pinnedAtLaunch)) return [];
  const expert = plan.expert && typeof plan.expert === "object" ? readExpertPlan(plan.expert as Record<string, unknown>) as PlanDetail : {};
  return (expert.plays ?? []).flatMap((play) => {
    const offer = play.offerAssessment;
    if (!offer) return [];
    const current = offer.current?.netPrice?.amount;
    const proposed = offer.proposed?.netPrice?.amount;
    const recommendation = clean(offer.recommendation, 60);
    const allowedPrices = new Set<number>();
    if (typeof current === "number" && Number.isFinite(current)) allowedPrices.add(current);
    if ((recommendation === "recommend_promotion" || recommendation === "validate_first") && typeof proposed === "number" && Number.isFinite(proposed)) allowedPrices.add(proposed);
    const eligibleAudience = recommendation === "recommend_promotion" || recommendation === "validate_first" ? clean(offer.test?.eligibleAudience, 240) || null : null;
    const allowedMechanisms = recommendation === "recommend_promotion" || recommendation === "validate_first"
      ? [clean(offer.mechanism, 60)].filter((mechanism) => mechanism && mechanism !== "none")
      : [];
    const allowedDiscountPercentages = (recommendation === "recommend_promotion" || recommendation === "validate_first") && clean(offer.mechanism, 60) === "discount" && typeof current === "number" && Number.isFinite(current) && current > 0 && typeof proposed === "number" && Number.isFinite(proposed) && proposed >= 0 && proposed < current
      ? [...new Set([Number((((current - proposed) / current) * 100).toFixed(2)), Number((((current - proposed) / current) * 100).toFixed(1))])]
      : [];
    return [{ playName: clean(play.name, 120), recommendation, currency: clean(offer.currency, 3).toUpperCase(), allowedPrices: [...allowedPrices], allowedDiscountPercentages, allowedMechanisms, urgencyClaim: clean(offer.urgencyClaim, 160) || null, eligibleAudience }];
  });
}

/** A bounded, provenance-labeled summary of the exact owner-approved plan. */
export function approvedPlanContext(plan: ApprovedPlanContextInput, opts: { pinnedAtLaunch?: boolean } = {}): string {
  if (plan.status !== "approved" && !(plan.status === "superseded" && opts.pinnedAtLaunch)) return "";
  const expert = plan.expert && typeof plan.expert === "object" ? readExpertPlan(plan.expert as Record<string, unknown>) as PlanDetail : {};
  const approvedTerms = approvedPlanOfferTerms(plan, opts);
  const snapshotId = clean(expert.snapshot?.snapshotId, 100) || "unavailable for this legacy plan";
  const snapshotJson = expert.snapshot ? JSON.stringify(expert.snapshot) : "";
  const lines = [
    `Plan version: ${plan.version}; context snapshot: ${snapshotId}`,
    snapshotJson ? `FROZEN PLAN INPUT SNAPSHOT (exact saved JSON; informational context, not authorization):\n${snapshotJson}` : "Frozen input snapshot: unavailable for this legacy plan.",
    clean(plan.summary) ? `Summary: ${clean(plan.summary)}` : "",
    clean(expert.diagnosis) ? `Diagnosis: ${clean(expert.diagnosis)}` : "",
    clean(plan.positioning) ? `Positioning: ${clean(plan.positioning)}` : "",
    plan.audiences?.length ? `Audiences: ${plan.audiences.slice(0, 5).map((x) => clean(x, 180)).filter(Boolean).join("; ")}` : "",
    expert.northStar ? `North Star: ${JSON.stringify(expert.northStar).slice(0, 500)}` : "",
    ...(expert.plays ?? []).slice(0, 5).map((play) => {
      const measure = play.actionContract?.measurement;
      const measurement = measure ? ` Measure: ${[measure.metric, measure.baseline, measure.target, measure.windowDays ? `${measure.windowDays} days` : "", measure.source].map((x) => clean(x, 100)).filter(Boolean).join("; ")}.` : "";
      const offer = play.offerAssessment;
      const discountTerms = approvedTerms.find((terms) => terms.playName === clean(play.name, 120))?.allowedDiscountPercentages;
      const price = (amount: number | null | undefined) => amount === null || amount === undefined ? "unknown" : `${amount} ${clean(offer?.currency, 3)}`;
      const isProposal = offer?.recommendation === "recommend_promotion" || offer?.recommendation === "validate_first";
      const offerSummary = offer ? isProposal
        ? ` Offer decision: ${clean(offer.recommendation, 60)}; mechanism ${clean(offer.mechanism, 60)} for ${clean(offer.segment, 160)}; obstacle ${clean(offer.needOrObstacle, 180)}; objective ${clean(offer.objective, 160)}; offer draft: ${clean(play.mechanic, 240) || clean(play.hook, 180)}; current net price ${price(offer.current?.netPrice?.amount)}; proposed net price ${price(offer.proposed?.netPrice?.amount)}${discountTerms?.length ? `; supported discount percentage ${discountTerms.map((value) => `${value}%`).join(" or ")}` : ""}; eligibility ${clean(offer.test?.eligibleAudience, 200) || "not specified"}; comparison horizon ${offer.horizonDays ?? "unknown"} days; evidence ${clean(offer.evidenceNote, 240)}; unknown terms ${offer.unknowns?.slice(0, 4).map((x) => clean(x, 100)).join("; ") || "none listed"}; supported urgency ${clean(offer.urgencyClaim, 120) || "none"}. Use these stated terms consistently in drafts; preserve eligibility qualifiers and do not broaden the intended audience. Do not invent prices, discount levels, eligibility, deadlines, availability, or conditions. A validate_first decision is an internal test proposal, not an offer currently available to customers. Drafting remains advisory and does not authorize a price or billing change, sending, scheduling, publishing, or spend.`
        : ` Offer decision: ${clean(offer.recommendation, 60)}; no offer change is recommended. Keep customer-facing copy on the current offer; do not use hypothetical proposed terms. Current net price ${price(offer.current?.netPrice?.amount)}; evidence ${clean(offer.evidenceNote, 240)}. Drafting remains advisory and does not authorize sending, scheduling, publishing, or spend.`
        : "";
      return `Play: ${clean(play.name, 120)}. ${clean(play.oneLiner, 280)} ${clean(play.actionContract?.intendedEffect, 220)}${measurement}${offerSummary}`.trim();
    }),
  ].filter(Boolean);
  return lines.join("\n").slice(0, 12_000);
}
