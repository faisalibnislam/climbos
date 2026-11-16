import type { OfferAssessment } from "../../shared/agents/offerAssessment";

export const offerFact = "Owner reports that qualified quote requests do not book because of stated price objections. Current offer is $100 per service. Proposed offer is $95 per service. Variable labor is $40 per service, payment fee is $3 per sale, fulfillment costs $7 per service, and the proposed bonus costs $5 per service. Owner minimum contribution is $35 per sale and minimum contribution margin is 30%. The team has capacity for 20 additional jobs per month.";
export const offerContext = { facts: [offerFact], researchNotes: "", sourceUrls: [], evidenceText: offerFact };
export const offerValue = (amount: number | null, claim: string, reference: string | null = "fact:0") => ({ amount, basis: "owner_reported" as const, reference, claim });
export const costs = (bonus = false) => [
  { category: "variable labor", value: offerValue(40, "Variable labor is $40 per service") },
  { category: "payment fee", value: offerValue(3, "payment fee is $3 per sale") },
  { category: "fulfillment", value: offerValue(7, "fulfillment costs $7 per service") },
  ...(bonus ? [{ category: "bonus", value: offerValue(5, "proposed bonus costs $5 per service") }] : []),
];
export const offerAssessmentFixture = (overrides: Partial<OfferAssessment> = {}): OfferAssessment => ({
  recommendation: "recommend_promotion",
  mechanism: "discount",
  segment: "First-time local service customers who have requested a quote",
  needOrObstacle: "Owner reports price is the main stated reason qualified quote requests do not book.",
  objective: "Increase completed first-time jobs while preserving unit contribution.",
  diagnosis: "Qualified quote requests are not booking because of stated price objections",
  evidenceBasis: "owner_reported",
  evidenceRefs: ["fact:0"],
  evidenceNote: "Owner reports that qualified quote requests do not book because of stated price objections.",
  promotionHistory: { status: "unknown", reference: null, claim: "", period: null, promotionPattern: "Promotion frequency is unknown.", repeatPurchaseComparison: "Repeat purchase after a promotion is unknown.", fullPriceComparison: "Full-price comparison is unavailable.", limitation: "No comparable promotion history was supplied.", },
  alternatives: [
    { alternative: "positioning", reason: "Test clearer explanation of the included work before lowering price." },
    { alternative: "conversion_path", reason: "Review quote follow-up and booking friction." },
    { alternative: "retention", reason: "A repeat-customer program would not directly address first-time quote objections." },
    { alternative: "capacity", reason: "Capacity is confirmed for a bounded incremental test." },
    { alternative: "no_change", reason: "Keep the current offer if a price test would add complexity without sufficient contribution." },
  ],
  costBoundary: "Per completed service: net price less variable labor, payment fee, fulfillment, and any bonus; excludes fixed overhead and acquisition cost.",
  horizonDays: 30,
  currency: "USD",
  current: { netPrice: offerValue(100, "Current offer is $100 per service"), variableCosts: costs(), unknownCosts: [] },
  proposed: { netPrice: offerValue(95, "Proposed offer is $95 per service"), variableCosts: costs(true), unknownCosts: [] },
  minimumContribution: offerValue(35, "Owner minimum contribution is $35 per sale"),
  minimumMarginRate: offerValue(0.3, "minimum contribution margin is 30%"),
  risks: [
    { kind: "margin", status: "calculated", note: "Compare the calculated unit contribution with the owner guardrail.", evidenceRef: null, evidenceClaim: "" },
    { kind: "wait_for_sale", status: "hypothesis", note: "Repeated discounts may teach eligible customers to wait.", evidenceRef: null, evidenceClaim: "" },
    { kind: "pull_forward", status: "unknown", note: "The test cannot yet distinguish incremental jobs from earlier purchases.", evidenceRef: null, evidenceClaim: "" },
    { kind: "cannibalization", status: "hypothesis", note: "Some full-price buyers may use the promotion.", evidenceRef: null, evidenceClaim: "" },
    { kind: "capacity", status: "measured", note: "Owner reports 20 additional jobs monthly.", evidenceRef: "fact:0", evidenceClaim: "The team has capacity for 20 additional jobs per month." },
    { kind: "support_burden", status: "unknown", note: "Incremental support time has not been measured.", evidenceRef: null, evidenceClaim: "" },
    { kind: "poor_fit", status: "hypothesis", note: "Price-led acquisition may attract lower-fit customers.", evidenceRef: null, evidenceClaim: "" },
  ],
  capacity: { status: "available", evidenceRef: "fact:0", claim: "The team has capacity for 20 additional jobs per month." },
  test: {
    eligibleAudience: "First-time quote requesters who cite price; exclude existing full-price bookings.",
    baselineOrComparison: "Compare completed jobs and contribution with the current price for similar eligible quote requests.",
    primaryOutcome: "Incremental completed first-time jobs and contribution per eligible quote request",
    observationWindowDays: 21,
    continueCriteria: "Continue only if contribution clears the owner-set floor and service quality holds.",
    stopCriteria: "Stop if unit contribution falls below the owner floor or the team reaches its safe capacity.",
    thresholdEvidenceRef: "fact:0",
    ownerInputs: [],
  },
  urgencyClaim: null,
  urgencyEvidenceRef: null,
  unknowns: ["Incrementality versus purchases brought forward", "No measured or owner-reported promotion and repeat-purchase history was supplied."],
  authorizationNote: "This assessment is advisory only and requires owner approval before any external change.",
  ...overrides,
});
