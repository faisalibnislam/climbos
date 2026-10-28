import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { approvedPlanContext, approvedPlanOfferTerms } from "../../shared/agents/approvedPlanContext";
import { evaluateOfferUnitEconomics, lintApprovedOfferCopy, lintOfferAssessment, type OfferAssessment } from "../../shared/agents/offerAssessment";
import { OFFER_DECISION_POLICY, playsTask } from "../../shared/agents/planTasks";
import { adsSpec, emailSpec, outreachSpec, socialCalendarSpec, socialSpec } from "../../shared/agents/specs";
import { offerAlternativeLabel, offerCapacityLabel, offerEvidenceLabel, offerEvidenceStatusLabel, offerMechanismLabel, offerRecommendationLabel, offerReferenceLabel, offerRiskLabel } from "../../src/components/app/plan/offerPresentation";
import { OfferAssessmentPanel } from "../../src/components/app/plan/OfferAssessmentPanel";

const fact = "Owner reports that qualified quote requests do not book because of stated price objections. Current offer is $100 per service. Proposed offer is $95 per service. Variable labor is $40 per service, payment fee is $3 per sale, fulfillment costs $7 per service, and the proposed bonus costs $5 per service. Owner minimum contribution is $35 per sale and minimum contribution margin is 30%. The team has capacity for 20 additional jobs per month.";
const context = { facts: [fact], researchNotes: "", sourceUrls: [], evidenceText: fact };
const value = (amount: number | null, claim: string, reference: string | null = "fact:0") => ({ amount, basis: "owner_reported" as const, reference, claim });
const costs = (bonus = false) => [
  { category: "variable labor", value: value(40, "Variable labor is $40 per service") },
  { category: "payment fee", value: value(3, "payment fee is $3 per sale") },
  { category: "fulfillment", value: value(7, "fulfillment costs $7 per service") },
  ...(bonus ? [{ category: "bonus", value: value(5, "proposed bonus costs $5 per service") }] : []),
];
const assessment = (overrides: Partial<OfferAssessment> = {}): OfferAssessment => ({
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
  current: { netPrice: value(100, "Current offer is $100 per service"), variableCosts: costs(), unknownCosts: [] },
  proposed: { netPrice: value(95, "Proposed offer is $95 per service"), variableCosts: costs(true), unknownCosts: [] },
  minimumContribution: value(35, "Owner minimum contribution is $35 per sale"),
  minimumMarginRate: value(0.3, "minimum contribution margin is 30%"),
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
const play = (overrides: Record<string, unknown> = {}) => ({
  name: "Bounded introductory price test",
  oneLiner: "Test a lower net price with eligible first-time quote requesters.",
  hook: "A clear price for the service you requested.",
  mechanic: "Offer an introductory discount at a $95 net price to eligible first-time quote requesters.",
  test: "Compare eligible quote requests with the existing full-price baseline.",
  killIf: "Stop at the owner-set contribution floor or safe service capacity.",
  scaleIf: "Continue only after measured contribution and service outcomes meet owner-set criteria.",
  actionContract: { diagnosis: "Qualified quote requests are not booking because of stated price objections" },
  ...overrides,
});

describe("offer and promotion recommendations", () => {
  it("shows the decision-critical offer details first and places the full comparison behind a disclosure", () => {
    const markup = renderToStaticMarkup(createElement(OfferAssessmentPanel, { offer: assessment() }));
    expect(markup).toContain("Advice only · changes need your approval");
    expect(markup).toContain("Who and why");
    expect(markup).toContain("Money left per sale after listed costs");
    expect(markup).toContain("Room for more work");
    expect(markup).toContain("Next step: Review the test, then decide.");
    expect(markup).toContain("Still to confirm:");
    expect(markup).toContain("See test plan, options, and risks");
    expect(markup).not.toMatch(/<details[^>]*open/);
    expect(markup.indexOf("Money left per sale") ).toBeLessThan(markup.indexOf("See test plan"));
    expect(markup.indexOf("See test plan")).toBeLessThan(markup.indexOf("Other options"));
  });

  it("shows the provenance and supporting evidence for each price and cost input", () => {
    const offer = assessment({
      current: {
        ...assessment().current,
        netPrice: { ...assessment().current.netPrice, basis: "measured", reference: "https://example.com/sales-report", claim: "Sales report shows $100 per service." },
        variableCosts: assessment().current.variableCosts.map((cost, index) => index === 0 ? { ...cost, value: { ...cost.value, basis: "inferred", reference: null, claim: "Labor cost inferred from the owner's estimate." } } : cost),
      },
      proposed: {
        ...assessment().proposed,
        netPrice: { ...assessment().proposed.netPrice, basis: "source_reported", reference: "https://example.com/pricing", claim: "Published proposed price is $95 per service." },
        variableCosts: assessment().proposed.variableCosts.map((cost, index) => index === 0 ? { ...cost, value: { ...cost.value, basis: "assumed", reference: null, claim: "Assumption pending an updated labor estimate." } } : cost),
      },
    });
    const markup = renderToStaticMarkup(createElement(OfferAssessmentPanel, { offer }));
    expect(markup).toContain("Calculated from the listed inputs.");
    expect(markup).toContain("Measured in this business");
    expect(markup).toContain("Open source");
    expect(markup).toContain("Educated guess");
    expect(markup).toContain("Reported by a source");
    expect(markup).toContain("Assumption to check");
    expect(markup).toContain("Labor cost inferred from the owner&#x27;s estimate.");
  });

  it("uses owner-facing labels without exposing internal decision values or fact IDs", () => {
    expect(offerRecommendationLabel("improve_other_constraint")).toBe("Fix something else first");
    expect(offerMechanismLabel("referral_incentive")).toBe("Referral reward");
    expect(offerEvidenceLabel("owner_reported")).toBe("Reported by your team");
    expect(offerCapacityLabel("unknown")).toBe("Capacity not confirmed");
    expect(offerAlternativeLabel("conversion_path")).toBe("Make it easier to buy or book");
    expect(offerRiskLabel("pull_forward")).toBe("Sales may come earlier, not grow");
    expect(offerEvidenceStatusLabel("hypothesis")).toBe("possible risk to test");
    expect(offerReferenceLabel("fact:3")).toBe("Your business information");
    expect(offerReferenceLabel("https://example.com/offer")).toBe("https://example.com/offer");
  });

  it("computes positive unit contribution and the deterministic volume needed to match current contribution", () => {
    const offer = assessment();
    expect(evaluateOfferUnitEconomics(offer)).toMatchObject({ currentContribution: 50, proposedContribution: 40, priceChangeFromCurrent: -5, currentMarginRate: 0.5, proposedMarginRate: 40 / 95, proposedUnitsPerCurrentUnitToMatchContribution: 50 / 40, contributionBreakEvenUnits: 2, known: true });
    expect(lintOfferAssessment(offer, play(), context, "plays[0].offerAssessment")).toEqual([]);
  });

  it("blocks a promotion that fails the supplied contribution or margin guardrail", () => {
    const belowFloor = assessment({ minimumContribution: value(45, "Owner minimum contribution is $45 per sale") });
    const guardrailContext = { ...context, facts: [fact.replace("minimum contribution is $35", "minimum contribution is $45")], evidenceText: fact.replace("minimum contribution is $35", "minimum contribution is $45") };
    const issues = lintOfferAssessment(belowFloor, play(), guardrailContext, "plays[0].offerAssessment");
    expect(issues.some((issue) => /fails the supplied minimum contribution/u.test(issue.message))).toBe(true);
  });

  it("uses sourced promotion and repeat-purchase history when available, and keeps it unknown otherwise", () => {
    expect(lintOfferAssessment(assessment(), play(), context, "plays[0].offerAssessment")).toEqual([]);
    const historyFact = `${fact} The owner reports two comparable seasonal promotions in the last 12 months; customers who first purchased with a promotion had the same observed repeat purchase count as full-price customers during the following 90 days.`;
    const withHistory = assessment({
      promotionHistory: {
        status: "owner_reported",
        reference: "fact:0",
        claim: "The owner reports two comparable seasonal promotions in the last 12 months; customers who first purchased with a promotion had the same observed repeat purchase count as full-price customers during the following 90 days.",
        period: "Last 12 months; 90-day repeat-purchase observation.",
        promotionPattern: "Two comparable seasonal promotions were reported.",
        repeatPurchaseComparison: "Same observed repeat purchase count for promotion and full-price cohorts.",
        fullPriceComparison: "Full-price customers are the comparison group.",
        limitation: "Owner-reported comparison; cohort size and causal effect are unknown.",
      },
    });
    expect(lintOfferAssessment(withHistory, play(), { ...context, facts: [historyFact] }, "plays[0].offerAssessment")).toEqual([]);
    const unsupported = assessment({ promotionHistory: { status: "measured", reference: null, claim: "Promotion buyers repeat 30% less.", period: "Last year.", promotionPattern: "Promotions were frequent.", repeatPurchaseComparison: "Promotion buyers repeat less.", fullPriceComparison: "Compared with full-price buyers.", limitation: "Not supported by supplied evidence." } });
    expect(lintOfferAssessment(unsupported, play(), context, "plays[0].offerAssessment").some((issue) => /promotion history must quote/u.test(issue.message))).toBe(true);
  });

  it("keeps missing price or variable cost unknown and blocks a promotion recommendation", () => {
    const missing = assessment({ proposed: { netPrice: value(95, "Proposed offer is $95 per service"), variableCosts: [{ category: "variable labor", value: value(null, "") }], unknownCosts: ["payment and fulfillment cost per service"] } });
    const economics = evaluateOfferUnitEconomics(missing);
    expect(economics.known).toBe(false);
    expect(economics.proposedContribution).toBeNull();
    expect(lintOfferAssessment(missing, play(), context, "plays[0].offerAssessment").some((issue) => /cannot be recommended while unit costs or price are unknown/u.test(issue.message))).toBe(true);
  });

  it("rejects numeric offer inputs that conflict with their cited owner claim", () => {
    const conflicting = assessment({ current: { ...assessment().current, netPrice: value(1_000, "Current offer is $100 per service") } });
    const issues = lintOfferAssessment(conflicting, play(), context, "plays[0].offerAssessment");
    expect(issues.some((issue) => issue.path?.endsWith("current.netPrice.amount") && /does not match the amount in its cited claim/u.test(issue.message))).toBe(true);
    expect(lintOfferAssessment(assessment(), play(), context, "plays[0].offerAssessment")).toEqual([]);
  });

  it("blocks an irrelevant discount when the supported diagnosis is retention", () => {
    const irrelevant = assessment({ recommendation: "recommend_promotion", diagnosis: "Measured retention loss after onboarding", evidenceNote: "The measured issue is retention, not a first-purchase price obstacle." });
    const issues = lintOfferAssessment(irrelevant, play({ actionContract: { diagnosis: "Measured retention loss after onboarding" } }), { ...context, diagnosedConstraint: "retention", diagnosisMeasured: true }, "plays[0].offerAssessment");
    expect(issues.some((issue) => /measured constraint is retention/u.test(issue.message))).toBe(true);
  });

  it("rejects unsupported deadline or scarcity language", () => {
    const issues = lintOfferAssessment(assessment(), play({ mechanic: "Offer a limited-time $95 price; sale ends tomorrow." }), context, "plays[0].offerAssessment");
    expect(issues.some((issue) => /Deadline, scarcity, or limited-availability copy needs direct/u.test(issue.message))).toBe(true);
  });

  it("blocks a promotion when delivery capacity is constrained", () => {
    const full = assessment({ capacity: { status: "constrained", evidenceRef: "fact:0", claim: "The team has capacity for 20 additional jobs per month." } });
    expect(lintOfferAssessment(full, play(), context, "plays[0].offerAssessment").some((issue) => /capacity is unknown or constrained/u.test(issue.message))).toBe(true);
  });

  it("keeps non-promotion constraint fixes available and makes approved offer context advisory", () => {
    const noOffer = assessment({ recommendation: "improve_other_constraint", mechanism: "none", diagnosis: "Measured retention loss after onboarding" });
    expect(lintOfferAssessment(noOffer, play({ mechanic: "Improve first-week product onboarding for new customers.", actionContract: { diagnosis: "Measured retention loss after onboarding" } }), { ...context, diagnosedConstraint: "retention", diagnosisMeasured: true }, "plays[0].offerAssessment")).toEqual([]);
    expect(OFFER_DECISION_POLICY).toContain("never changes price or billing terms");
    expect(playsTask({ scorecard: "", insights: "" })).toContain("OFFER AND PROMOTION DECISION");
    const approved = approvedPlanContext({ status: "approved", version: 1, expert: { version: 7, plays: [{ name: "Test offer", oneLiner: "Compare a bounded price test", offerAssessment: noOffer }] } });
    expect(approved).toContain("Offer decision: improve_other_constraint");
    expect(approved).toContain("no offer change is recommended");
    expect(approved).toContain("do not use hypothetical proposed terms");
    expect(approved).not.toContain("proposed net price 95 USD");

    const offerContext = approvedPlanContext({ status: "approved", version: 2, expert: { version: 7, plays: [{ name: "Test offer", oneLiner: "Compare a bounded price test", mechanic: "Test a $95 introductory service price with qualified new customers.", offerAssessment: assessment() }] } });
    expect(offerContext).toContain("current net price 100 USD");
    expect(offerContext).toContain("proposed net price 95 USD");
    expect(offerContext).toContain("supported discount percentage 5%");
    expect(offerContext).toContain("eligibility First-time quote requesters");
    expect(offerContext).toContain("Use these stated terms consistently in drafts");
    expect(offerContext).toContain("not an offer currently available to customers");

    const termContext = { status: "approved", version: 2, expert: { version: 7, plays: [{ name: "Test offer", offerAssessment: assessment() }] } };
    const terms = approvedPlanOfferTerms(termContext);
    expect(terms).toEqual([{ playName: "Test offer", recommendation: "recommend_promotion", currency: "USD", allowedPrices: [100, 95], allowedDiscountPercentages: [5], allowedMechanisms: ["discount"], urgencyClaim: null, eligibleAudience: "First-time quote requesters who cite price; exclude existing full-price bookings." }]);
    expect(lintApprovedOfferCopy("Try it for $95 USD.", terms, "email.body")).toEqual([]);
    expect(lintApprovedOfferCopy("Try it for $89 USD.", terms, "email.body")).toMatchObject([{ rule: "approved_offer_price", severity: "error" }]);
    const noOfferTerms = approvedPlanOfferTerms({ status: "approved", version: 3, expert: { version: 7, plays: [{ name: "Fix onboarding", offerAssessment: assessment({ recommendation: "improve_other_constraint", mechanism: "none" }) }] } });
    expect(lintApprovedOfferCopy("Special offer: save 10% this week.", noOfferTerms, "email.body", "Fix onboarding")).toMatchObject([{ rule: "offer_not_recommended", severity: "error" }]);
    const twoOffers = [...terms, { playName: "Annual service", recommendation: "recommend_promotion", currency: "USD", allowedPrices: [200], urgencyClaim: null, eligibleAudience: null }];
    expect(lintApprovedOfferCopy("A helpful note about preparing for a service visit.", twoOffers, "email.body")).toEqual([]);
    expect(lintApprovedOfferCopy("The offer is $95 USD.", twoOffers, "email.body")).toMatchObject([{ rule: "approved_offer_play", severity: "error" }]);
    expect(lintApprovedOfferCopy("The offer is $95 USD.", twoOffers, "email.body", "Test offer")).toEqual([]);
    expect(lintApprovedOfferCopy("The offer is $200 USD.", twoOffers, "email.body", "Test offer")).toMatchObject([{ rule: "approved_offer_price", severity: "error" }]);
    expect(lintApprovedOfferCopy("The offer is $200 USD.", twoOffers, "email.body", "Missing play")).toMatchObject([{ rule: "approved_offer_play", severity: "error" }]);
    const paymentOffers = [
      { ...terms[0], allowedMechanisms: ["discount"] },
      { ...twoOffers[1], allowedMechanisms: ["payment_terms"] },
    ];
    expect(lintApprovedOfferCopy("Pay in installments for first-time quote requesters.", paymentOffers, "email.body")).toMatchObject([{ rule: "approved_offer_play", severity: "error" }]);
    expect(lintApprovedOfferCopy("Pay in installments for first-time quote requesters.", paymentOffers, "email.body", "Test offer")).toMatchObject([{ rule: "approved_offer_mechanism", severity: "error" }]);
    expect(lintApprovedOfferCopy("Pay in installments.", paymentOffers, "email.body", "Annual service")).toEqual([]);
    expect(lintApprovedOfferCopy("The offer costs 200 BDT.", [{ ...twoOffers[0], currency: "BDT" }, { ...twoOffers[1], currency: "BDT", allowedPrices: [300] }], "email.body")).toMatchObject([{ rule: "approved_offer_play", severity: "error" }]);
    expect(lintApprovedOfferCopy("Limited-time offer ends tomorrow.", terms, "email.body").some((issue) => issue.rule === "approved_offer_urgency")).toBe(true);
    const supportedUrgency = [{ ...terms[0], urgencyClaim: "Limited-time offer ends November 30, 2026." }];
    expect(lintApprovedOfferCopy("Limited-time offer ends November 30, 2026.", supportedUrgency, "email.body").some((issue) => issue.rule === "approved_offer_urgency")).toBe(false);
    expect(lintApprovedOfferCopy("Special offer available to everyone.", terms, "email.body").some((issue) => issue.rule === "approved_offer_eligibility")).toBe(true);
    expect(lintApprovedOfferCopy("Special offer for first-time quote requesters only.", terms, "email.body").some((issue) => issue.rule === "approved_offer_eligibility")).toBe(false);
    expect(lintApprovedOfferCopy("Get a 5% discount today.", terms, "email.body")).toMatchObject([{ rule: "approved_offer_eligibility", severity: "error" }]);
    const separateAudiences = [
      ...terms,
      { ...terms[0], playName: "Member offer", eligibleAudience: "Current subscribers" },
    ];
    expect(lintApprovedOfferCopy("Get a 5% discount for first-time quote requesters.", separateAudiences, "email.body")).toMatchObject([{ rule: "approved_offer_play", severity: "error" }]);
    expect(lintApprovedOfferCopy("Get a 5% discount for first-time quote requesters.", separateAudiences, "email.body", "Test offer").some((issue) => issue.rule === "approved_offer_eligibility")).toBe(false);
    expect(lintApprovedOfferCopy("Get a 5% discount for current subscribers.", separateAudiences, "email.body", "Test offer")).toMatchObject([{ rule: "approved_offer_eligibility", severity: "error" }]);
    expect(lintApprovedOfferCopy("Get a free trial for first-time quote requesters.", terms, "email.body").some((issue) => issue.rule === "approved_offer_mechanism")).toBe(true);
    expect(lintApprovedOfferCopy("Get a 5% discount for first-time quote requesters.", terms, "email.body").some((issue) => issue.rule === "approved_offer_mechanism")).toBe(false);
    expect(lintApprovedOfferCopy("Get a 10% discount for first-time quote requesters.", terms, "email.body")).toMatchObject([{ rule: "approved_offer_discount", severity: "error" }]);
    expect(approvedPlanOfferTerms({ ...termContext, status: "needs_approval" })).toEqual([]);

    const validationOnlyAssessment = assessment({ recommendation: "validate_first" });
    const validationOnlyPlan = { ...termContext, expert: { version: 7, plays: [{ name: "Test offer", offerAssessment: validationOnlyAssessment }] } };
    const validationOnlyTerms = approvedPlanOfferTerms(validationOnlyPlan);
    expect(validationOnlyTerms[0]).toMatchObject({ allowedPrices: [100], allowedDiscountPercentages: [], allowedMechanisms: [], eligibleAudience: null });
    expect(lintApprovedOfferCopy("Get 5% off for first-time quote requesters.", validationOnlyTerms, "email.body", "Test offer")).toEqual(expect.arrayContaining([expect.objectContaining({ rule: "offer_validation_only", severity: "error" })]));

    const copyBrief = { reader: "new buyer", situation: "reviewing the service", awarenessStage: "unknown" as const, relationshipStage: "unknown" as const, objective: "explain the offer", offerFactIndexes: [], problemJob: "choose a service", trigger: "need", centralIdea: "clear terms", objection: "price", proofFactIndexes: [], prohibitedClaims: [], channel: "email", format: "plain text", deliveryContext: "draft only", brandVoice: "clear", approvedExamples: [], cta: "learn more", afterAction: "measure qualified replies", trackingMetric: "qualified replies", trackingMethod: "count replies", supportingFactIndexes: [], supportingSourceUrls: [], unknowns: [] };
    const copyInput = { task: "Draft", brief: "", facts: [], approvedOfferTerms: terms };
    const emailOutput = { copyBrief, angle: "clear service terms", emails: [{ subject: "A service option", previewText: "Review the details", body: "This offer costs $89 USD.", callToAction: "Learn more", sendAfterDays: 0, angle: "clear details" }], sender: "Owner", goal: "Explain the offer", successMetric: "qualified replies", name: "Offer details", audience: "new buyers", factIndexes: [] };
    const socialOutput = { copyBrief, posts: [{ channel: "instagram" as const, title: "Offer details", body: "Review the service offer and ask us what is included.", hashtags: [], altText: "", imageIdea: "", factIndexes: [], suggestedDay: 2, angle: "clear details", format: "text" as const, hook: "The service costs $89 USD.", slides: [], videoScript: "", shotList: [], visualBrief: "", firstComment: "" }] };
    const adsOutput = { copyBrief, searchAds: [], metaAds: [{ primaryText: "Try the service for $89 USD.", headline: "Clear service terms", description: "Review the details.", imageIdea: "", audience: "new buyers", concept: "service offer", angle: "clear offer", format: "image" as const, creativeBrief: "A simple service card." }], budgetNote: "No spend authorized", factIndexes: [] };
    expect(emailSpec().lint?.(emailOutput, copyInput).some((issue) => issue.rule === "approved_offer_price")).toBe(true);
    expect(socialSpec(["instagram"]).lint?.(socialOutput, copyInput).some((issue) => issue.rule === "approved_offer_price")).toBe(true);
    expect(adsSpec().lint?.(adsOutput, copyInput).some((issue) => issue.rule === "approved_offer_price")).toBe(true);
    const calendarOutput = { weekTheme: "Service offers", pillars: [], slots: [{ channel: "instagram", day: 1, pillar: "offers", purpose: "teach" as const, format: "text" as const, idea: "Share a 5% discount.", angle: "price", hookDraft: "Get a 5% discount today.", proof: "", callToAction: "Learn more", needsOwner: false, ownerNote: "" }], learningsApplied: [] };
    expect(socialCalendarSpec({ instagram: 1 }).lint?.(calendarOutput, copyInput).some((issue) => issue.rule === "approved_offer_eligibility")).toBe(true);
    const multipleOfferInput = { ...copyInput, approvedOfferTerms: twoOffers };
    expect(socialCalendarSpec({ instagram: 1 }).lint?.(calendarOutput, multipleOfferInput).some((issue) => issue.rule === "approved_offer_play")).toBe(true);
    const offerInCalendarCta = { ...calendarOutput, slots: [{ ...calendarOutput.slots[0], idea: "Explain how to prepare.", hookDraft: "Planning starts with one small step.", callToAction: "Claim the $95 USD offer." }] };
    expect(socialCalendarSpec({ instagram: 1 }).lint?.(offerInCalendarCta, multipleOfferInput).some((issue) => issue.rule === "approved_offer_play")).toBe(true);
    const boundCalendarOutput = { ...calendarOutput, slots: [{ ...calendarOutput.slots[0], approvedOfferPlayName: "Test offer" }] };
    expect(socialCalendarSpec({ instagram: 1 }).lint?.(boundCalendarOutput, multipleOfferInput).some((issue) => issue.rule === "approved_offer_play")).toBe(false);
    const postBoundToSecondOffer = { ...socialOutput, posts: [{ ...socialOutput.posts[0], hook: "The annual service is $200 USD.", approvedOfferPlayName: "Annual service" }] };
    expect(socialSpec(["instagram"]).lint?.(postBoundToSecondOffer, multipleOfferInput).some((issue) => issue.rule === "approved_offer_play" || issue.rule === "approved_offer_price")).toBe(false);
    const postBoundToWrongOffer = { ...postBoundToSecondOffer, posts: [{ ...postBoundToSecondOffer.posts[0], approvedOfferPlayName: "Test offer" }] };
    expect(socialSpec(["instagram"]).lint?.(postBoundToWrongOffer, multipleOfferInput).some((issue) => issue.rule === "approved_offer_price")).toBe(true);
  });

  it("checks cold outreach against the selected approved offer terms", () => {
    const terms = approvedPlanOfferTerms({ status: "approved", version: 2, expert: { version: 7, plays: [{ name: "Test offer", offerAssessment: assessment() }] } });
    const output = {
      approvedOfferPlayName: "Test offer",
      sequence: [
        { day: 0, subject: "A question", body: "{{firstLine}}\nFirst-time quote requesters can try the service for $95 USD.", purpose: "Introduce the service" },
        { day: 3, subject: "Following up", body: "A short note for first-time quote requesters about the service.", purpose: "Follow up" },
      ],
      firstLines: [{ company: "Example Co", line: "Your recent service launch caught my eye." }],
      ownerNotes: [],
    };
    const input = { task: "Write outreach", brief: "", facts: [], approvedOfferTerms: terms };
    expect(outreachSpec().lint?.(output, input)).not.toContainEqual(expect.objectContaining({ rule: "approved_offer_price", severity: "error" }));
    const unsupported = { ...output, sequence: output.sequence.map((step, i) => i ? step : { ...step, body: step.body.replace("$95", "$89") }) };
    expect(outreachSpec().lint?.(unsupported, input)).toContainEqual(expect.objectContaining({ rule: "approved_offer_price", severity: "error" }));
    const wrongPlay = { ...output, approvedOfferPlayName: "Missing play" };
    expect(outreachSpec().lint?.(wrongPlay, input)).toContainEqual(expect.objectContaining({ rule: "approved_offer_play", severity: "error" }));
  });
});
