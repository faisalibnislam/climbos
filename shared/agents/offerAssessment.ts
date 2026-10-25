import { z } from "zod";
import type { LintIssue } from "./types";

export const OfferEvidenceValueSchema = z.object({
  amount: z.number().finite().nonnegative().nullable(),
  basis: z.enum(["owner_reported", "measured", "source_reported", "inferred", "assumed"]),
  reference: z.string().nullable(),
  claim: z.string().max(500),
});

const OfferCostSchema = z.object({
  category: z.string().min(1).max(100),
  value: OfferEvidenceValueSchema,
});

const OfferSideSchema = z.object({
  netPrice: OfferEvidenceValueSchema,
  variableCosts: z.array(OfferCostSchema).max(12),
  unknownCosts: z.array(z.string().min(1).max(120)).max(8),
});

const OfferComparisonSchema = z.object({
  alternative: z.enum(["positioning", "conversion_path", "retention", "capacity", "no_change"]),
  reason: z.string().min(1).max(240),
});

export const OfferAssessmentSchema = z.object({
  recommendation: z.enum(["recommend_promotion", "validate_first", "improve_other_constraint", "no_change"]),
  mechanism: z.enum(["discount", "bundle", "bonus", "trial", "payment_terms", "guarantee", "referral_incentive", "non_price_change", "none"]),
  segment: z.string().min(1).max(240),
  needOrObstacle: z.string().min(1).max(240),
  objective: z.string().min(1).max(240),
  diagnosis: z.string().min(1).max(300),
  evidenceBasis: z.enum(["owner_reported", "measured", "source_reported", "inferred", "assumed"]),
  evidenceRefs: z.array(z.string()).max(8),
  evidenceNote: z.string().min(1).max(500),
  alternatives: z.array(OfferComparisonSchema).length(5),
  costBoundary: z.string().min(1).max(240),
  horizonDays: z.number().int().min(1).max(365),
  currency: z.string().length(3),
  current: OfferSideSchema,
  proposed: OfferSideSchema,
  minimumContribution: OfferEvidenceValueSchema.nullable(),
  minimumMarginRate: OfferEvidenceValueSchema.nullable(),
  risks: z.array(z.object({
    kind: z.enum(["margin", "wait_for_sale", "pull_forward", "cannibalization", "capacity", "support_burden", "poor_fit"]),
    status: z.enum(["measured", "calculated", "hypothesis", "unknown", "not_applicable"]),
    note: z.string().min(1).max(240),
    evidenceRef: z.string().nullable(),
    evidenceClaim: z.string().max(500),
  })).length(7),
  capacity: z.object({
    status: z.enum(["available", "constrained", "unknown", "not_applicable"]),
    evidenceRef: z.string().nullable(),
    claim: z.string().max(500),
  }),
  test: z.object({
    eligibleAudience: z.string().min(1).max(240),
    baselineOrComparison: z.string().min(1).max(300),
    primaryOutcome: z.string().min(1).max(180),
    observationWindowDays: z.number().int().min(1).max(365),
    continueCriteria: z.string().min(1).max(240),
    stopCriteria: z.string().min(1).max(240),
    thresholdEvidenceRef: z.string().nullable(),
    ownerInputs: z.array(z.string().min(1).max(180)).max(8),
  }),
  urgencyClaim: z.string().nullable(),
  urgencyEvidenceRef: z.string().nullable(),
  unknowns: z.array(z.string().min(1).max(180)).max(8),
  authorizationNote: z.string().min(1).max(180),
});

export type OfferAssessment = z.infer<typeof OfferAssessmentSchema>;

export interface ApprovedOfferCopyTerms {
  playName: string;
  recommendation: string;
  currency: string;
  allowedPrices: number[];
  urgencyClaim: string | null;
  eligibleAudience: string | null;
}

/** Rejects monetary amounts in publishable copy that conflict with the approved plan's offer prices. */
export function lintApprovedOfferPrices(text: string, offers: ApprovedOfferCopyTerms[] | undefined, path: string): LintIssue[] {
  if (!offers?.length || !text.trim()) return [];
  const issues: LintIssue[] = [];
  const rules = new Map<string, { symbols: Set<string>; prices: Set<number>; playNames: Set<string> }>();
  for (const offer of offers) {
    if (!offer.currency || !/^[A-Z]{3}$/.test(offer.currency)) continue;
    let symbol = offer.currency;
    try {
      symbol = new Intl.NumberFormat("en", { style: "currency", currency: offer.currency }).formatToParts(1).find((part) => part.type === "currency")?.value ?? symbol;
    } catch { /* Currency code matching still works when Intl has no symbol data. */ }
    const rule = rules.get(offer.currency) ?? { symbols: new Set<string>(), prices: new Set<number>(), playNames: new Set<string>() };
    rule.symbols.add(symbol);
    offer.allowedPrices.forEach((price) => { if (Number.isFinite(price)) rule.prices.add(price); });
    if (offer.playName) rule.playNames.add(offer.playName);
    rules.set(offer.currency, rule);
  }
  const invalid = new Set<string>();
  for (const [currency, rule] of rules) {
    const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const amount = "(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)";
    const marker = `(?:${[...rule.symbols, currency].map(escape).join("|")})`;
    const pattern = new RegExp(`(?:${marker}\\s*(${amount})|(${amount})\\s*${marker})`, "gi");
    for (const match of text.matchAll(pattern)) {
      const raw = match[1] ?? match[3];
      const value = Number.parseFloat(raw.replace(/,/g, ""));
      if (!Number.isFinite(value)) continue;
      if (![...rule.prices].some((approved) => Math.abs(approved - value) < 0.005)) invalid.add(`${currency}:${value}`);
    }
  }
  for (const entry of invalid) {
    const [currency, value] = entry.split(":");
    const names = [...(rules.get(currency)?.playNames ?? [])].slice(0, 3).map((name) => `“${name}”`).join(", ");
    issues.push({ severity: "error", rule: "approved_offer_price", message: `This copy states ${value} ${currency}, which is not an approved price${names ? ` for ${names}` : ""}. Use a stated plan price or remove the amount; unknown pricing must remain unknown.`, path });
  }
  return issues;
}

export interface OfferUnitEconomics {
  known: boolean;
  currentContribution: number | null;
  proposedContribution: number | null;
  priceChangeFromCurrent: number | null;
  currentMarginRate: number | null;
  proposedMarginRate: number | null;
  proposedUnitsPerCurrentUnitToMatchContribution: number | null;
  contributionBreakEvenUnits: number | null;
  unknowns: string[];
}

/** Per-unit arithmetic only; excludes fixed overhead and acquisition cost unless explicitly in the supplied boundary. */
export function evaluateOfferUnitEconomics(assessment: OfferAssessment): OfferUnitEconomics {
  const unknowns = [
    ...assessment.current.unknownCosts.map((item) => `Current offer: ${item}`),
    ...assessment.proposed.unknownCosts.map((item) => `Proposed offer: ${item}`),
    ...(assessment.current.netPrice.amount === null ? ["Current net price"] : []),
    ...(assessment.proposed.netPrice.amount === null ? ["Proposed net price"] : []),
    ...assessment.current.variableCosts.filter((cost) => cost.value.amount === null).map((cost) => `Current ${cost.category}`),
    ...assessment.proposed.variableCosts.filter((cost) => cost.value.amount === null).map((cost) => `Proposed ${cost.category}`),
  ];
  const known = unknowns.length === 0;
  if (!known) return { known, currentContribution: null, proposedContribution: null, priceChangeFromCurrent: null, currentMarginRate: null, proposedMarginRate: null, proposedUnitsPerCurrentUnitToMatchContribution: null, contributionBreakEvenUnits: null, unknowns };
  const contribution = (side: OfferAssessment["current"]) => side.netPrice.amount! - side.variableCosts.reduce((sum, cost) => sum + cost.value.amount!, 0);
  const currentContribution = contribution(assessment.current);
  const proposedContribution = contribution(assessment.proposed);
  const currentPrice = assessment.current.netPrice.amount!;
  const proposedPrice = assessment.proposed.netPrice.amount!;
  const contributionBreakEvenUnits = currentContribution > 0 && proposedContribution > 0 ? Math.ceil(currentContribution / proposedContribution) : null;
  return {
    known,
    currentContribution,
    proposedContribution,
    priceChangeFromCurrent: proposedPrice - currentPrice,
    currentMarginRate: currentPrice > 0 ? currentContribution / currentPrice : null,
    proposedMarginRate: proposedPrice > 0 ? proposedContribution / proposedPrice : null,
    proposedUnitsPerCurrentUnitToMatchContribution: currentContribution > 0 && proposedContribution > 0 ? currentContribution / proposedContribution : null,
    contributionBreakEvenUnits,
    unknowns,
  };
}

export interface OfferAssessmentContext {
  facts: string[];
  researchNotes: string;
  sourceUrls: string[];
  evidenceText: string;
  diagnosedConstraint?: string;
  diagnosisMeasured?: boolean;
}

const REQUIRED_ALTERNATIVES = ["positioning", "conversion_path", "retention", "capacity", "no_change"] as const;
const PROMOTION_WORDS = /\b(?:discount|%\s*off|save\s+\$|sale price|coupon|promo code|limited[- ]time|bonus|bundle|free trial|payment terms|pay later|guarantee|referral reward|incentive|special offer|offer change|change the offer|non[- ]price offer|free (?:setup|shipping|delivery|consultation|onboarding))\b/i;
const URGENCY_WORDS = /\b(?:limited[- ]time|ends? (?:today|tomorrow|this week|on|in)|last chance|only \d+|limited (?:spots?|seats?|stock|inventory)|while supplies last|deadline|scarcity|expires? (?:today|tomorrow|on|in))\b/i;
const RESTRICTED_AUDIENCE = /\b(?:first[- ]time|new (?:customers?|clients?|buyers?|users?)|existing (?:customers?|clients?|buyers?|users?)|qualified|invited|waitlist|members? only|for (?:returning|current) (?:customers?|clients?|buyers?|users?))\b/i;
const UNIVERSAL_AUDIENCE = /\b(?:available to everyone|open to everyone|for everyone|all customers|all users|any customer|any user|anyone can|no restrictions)\b/i;

/** Adds approved-plan deadline/scarcity checks to deterministic price consistency. */
export function lintApprovedOfferCopy(text: string, offers: ApprovedOfferCopyTerms[] | undefined, path: string): LintIssue[] {
  const issues = lintApprovedOfferPrices(text, offers, path);
  if (!offers?.length) return issues;
  if (URGENCY_WORDS.test(text)) {
    const supportedClaims = offers.map((offer) => offer.urgencyClaim?.trim()).filter((claim): claim is string => Boolean(claim));
    const normalizedText = text.normalize("NFKC").replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
    const exactSupportedClaim = supportedClaims.some((claim) => normalizedText.includes(claim.normalize("NFKC").replace(/\s+/gu, " ").toLocaleLowerCase("en-US")));
    if (!exactSupportedClaim) {
      issues.push({ severity: "error", rule: "approved_offer_urgency", message: "This copy adds a deadline, scarcity, or limited-availability claim that is not present in the approved offer evidence. Remove it or use the exact supported claim from the plan.", path });
    }
  }
  if (PROMOTION_WORDS.test(text) && offers.some((offer) => offer.eligibleAudience && RESTRICTED_AUDIENCE.test(offer.eligibleAudience)) && UNIVERSAL_AUDIENCE.test(text)) {
    issues.push({ severity: "error", rule: "approved_offer_eligibility", message: "This copy presents a restricted offer as open to everyone. Preserve the audience qualifiers from the approved plan or remove the broader claim.", path });
  }
  return issues;
}

function resolveEvidence(reference: string | null, context: OfferAssessmentContext): string | undefined {
  if (!reference) return undefined;
  const fact = /^fact:(\d+)$/i.exec(reference);
  if (fact) return context.facts[Number(fact[1])];
  return context.sourceUrls.includes(reference) ? context.researchNotes : undefined;
}

function claimSupportsAmount(claim: string, amount: number, isRate = false): boolean {
  const numbers = [...claim.matchAll(/(?<![\w])\d+(?:,\d{3})*(?:\.\d+)?\s*%?/g)]
    .map(([raw]) => {
      const percent = raw.trim().endsWith("%");
      const value = Number.parseFloat(raw.replace(/[,\s%]/g, ""));
      return percent && isRate ? value / 100 : value;
    })
    .filter(Number.isFinite);
  return numbers.some((value) => Math.abs(value - amount) < 0.000001);
}

/** Validates recommendation evidence and checks offer economics against stated guardrails. */
export function lintOfferAssessment(
  assessment: OfferAssessment | undefined,
  play: { name?: string; oneLiner?: string; hook?: string; mechanic?: string; test?: string; killIf?: string; scaleIf?: string; actionContract?: { diagnosis?: string } },
  context: OfferAssessmentContext,
  path: string,
): LintIssue[] {
  const issues: LintIssue[] = [];
  const error = (message: string, suffix = "") => issues.push({ severity: "error", rule: "offer_assessment", message, path: suffix ? `${path}.${suffix}` : path });
  const text = [play.name, play.oneLiner, play.hook, play.mechanic, play.test, play.killIf, play.scaleIf].filter(Boolean).join(" ");
  const containsPromotion = PROMOTION_WORDS.test(text);
  if (!assessment) {
    if (containsPromotion) error("A play that proposes an offer change needs a structured evidence, alternatives, economics, risk, and test assessment.");
    return issues;
  }
  if (assessment.diagnosis !== play.actionContract?.diagnosis) error("The offer assessment must use the play's diagnosed constraint exactly; a promotion must respond to that constraint.", "diagnosis");
  if (assessment.alternatives.length !== REQUIRED_ALTERNATIVES.length || REQUIRED_ALTERNATIVES.some((alternative) => !assessment.alternatives.some((item) => item.alternative === alternative))) error("Compare the promotion with positioning, conversion path, retention, capacity, and no offer change.", "alternatives");
  if (assessment.test.observationWindowDays > assessment.horizonDays) error("The offer test observation window cannot exceed its economic comparison horizon.", "test.observationWindowDays");
  const criteria = `${assessment.test.continueCriteria} ${assessment.test.stopCriteria}`;
  if (/\d/.test(criteria) && !assessment.test.thresholdEvidenceRef && !assessment.test.ownerInputs.some((item) => /threshold|target|minimum|maximum|set|confirm/i.test(item))) error("Numeric test thresholds need a cited evidence basis or an explicit owner input to set them.", "test.thresholdEvidenceRef");
  if (assessment.test.thresholdEvidenceRef && !resolveEvidence(assessment.test.thresholdEvidenceRef, context)) error("Test threshold reference must resolve to a supplied owner fact or retrieved source.", "test.thresholdEvidenceRef");
  if (assessment.recommendation === "recommend_promotion" && assessment.mechanism === "none") error("A promotion recommendation must name its mechanism.", "mechanism");
  if (assessment.recommendation !== "recommend_promotion" && assessment.mechanism !== "none" && assessment.recommendation !== "validate_first") error("Do not describe an offer mechanism as recommended when the chosen action is to improve another constraint or make no change.", "mechanism");
  if (assessment.recommendation === "recommend_promotion" && !containsPromotion) error("The play must describe the recommended offer mechanism clearly.");
  if (assessment.recommendation === "recommend_promotion" && context.diagnosedConstraint && !["offer", "conversion"].includes(context.diagnosedConstraint)) error(`The ${context.diagnosisMeasured ? "measured" : "selected"} constraint is ${context.diagnosedConstraint}; this promotion does not address that constraint.`, "recommendation");
  if (["improve_other_constraint", "no_change"].includes(assessment.recommendation) && PROMOTION_WORDS.test([play.oneLiner, play.hook, play.mechanic].filter(Boolean).join(" "))) error("The selected recommendation is not to change the offer; remove promotion copy from the play or choose validate_first.", "mechanism");
  if (assessment.evidenceBasis === "assumed" || assessment.evidenceBasis === "inferred" || assessment.evidenceBasis === "source_reported") {
    if (assessment.recommendation === "recommend_promotion") error("Assumed, inferred, or general source-reported demand supports a validation test, not a business-specific promotion recommendation.", "recommendation");
  }
  if (assessment.evidenceBasis === "owner_reported" || assessment.evidenceBasis === "measured") {
    if (!assessment.evidenceRefs.length) error("Owner-reported or measured promotion evidence needs an exact fact or source reference.", "evidenceRefs");
  }
  const supportingEvidence = assessment.evidenceRefs.map((ref) => resolveEvidence(ref, context));
  assessment.evidenceRefs.forEach((ref, index) => { if (!supportingEvidence[index]) error(`Evidence reference ${ref} was not supplied or retrieved.`, "evidenceRefs"); });
  if (assessment.recommendation === "recommend_promotion" && !supportingEvidence.some((source) => source?.includes(assessment.evidenceNote))) error("A promotion recommendation needs a verbatim owner or measured evidence claim that supports the stated customer obstacle.", "evidenceNote");

  const checkValue = (value: OfferAssessment["current"]["netPrice"], field: string, isRate = false) => {
    if (value.amount === null) return;
    const supporting = resolveEvidence(value.reference, context);
    if (["owner_reported", "measured", "source_reported"].includes(value.basis) && !supporting) error("This numeric offer input needs an exact supplied fact or retrieved-source reference.", field);
    if (supporting && value.claim && !supporting.includes(value.claim)) error("The numeric input claim must appear verbatim in its cited fact or source notes.", `${field}.claim`);
    if (supporting && value.claim && !claimSupportsAmount(value.claim, value.amount, isRate)) error("The stated numeric input does not match the amount in its cited claim; preserve the value as unknown until the source is reconciled.", `${field}.amount`);
    if (["assumed", "inferred"].includes(value.basis) && assessment.recommendation === "recommend_promotion") error("A promotion cannot be recommended with assumed or inferred unit-economic inputs.", field);
  };
  checkValue(assessment.current.netPrice, "current.netPrice");
  checkValue(assessment.proposed.netPrice, "proposed.netPrice");
  assessment.current.variableCosts.forEach((cost, index) => checkValue(cost.value, `current.variableCosts[${index}].value`));
  assessment.proposed.variableCosts.forEach((cost, index) => checkValue(cost.value, `proposed.variableCosts[${index}].value`));
  if (assessment.minimumContribution) checkValue(assessment.minimumContribution, "minimumContribution");
  if (assessment.minimumMarginRate) checkValue(assessment.minimumMarginRate, "minimumMarginRate", true);
  if (assessment.minimumMarginRate && assessment.minimumMarginRate.amount !== null && assessment.minimumMarginRate.amount > 1) error("The minimum contribution margin must be a rate from 0 to 1.", "minimumMarginRate.amount");
  if (assessment.capacity.status === "available" || assessment.capacity.status === "constrained") {
    const supporting = resolveEvidence(assessment.capacity.evidenceRef, context);
    if (!supporting || !assessment.capacity.claim || !supporting.includes(assessment.capacity.claim)) error("Capacity must be supported by an exact supplied owner fact or retrieved source claim.", "capacity.evidenceRef");
  }
  if (assessment.capacity.status === "not_applicable" && assessment.capacity.claim.trim().length < 15) error("Explain why delivery capacity does not apply to this offer.", "capacity.claim");
  if (assessment.capacity.status === "unknown" && !assessment.unknowns.some((item) => /capacity|service|fulfillment|fulfilment|inventory|delivery/i.test(item))) error("Unknown capacity must be named as an unresolved input.", "unknowns");

  const economics = evaluateOfferUnitEconomics(assessment);
  assessment.risks.forEach((risk, index) => {
    if (risk.status === "measured") {
      const supporting = resolveEvidence(risk.evidenceRef, context);
      if (!supporting || !risk.evidenceClaim || !supporting.includes(risk.evidenceClaim)) error("A measured risk statement needs an exact evidence claim and source reference; otherwise label it hypothesis or unknown.", `risks[${index}]`);
    }
    if (risk.status === "calculated" && !economics.known) error("A calculated offer risk requires complete unit-economic inputs.", `risks[${index}]`);
  });
  if (assessment.recommendation === "recommend_promotion" && !economics.known) error(`A promotion cannot be recommended while unit costs or price are unknown: ${economics.unknowns.join(", ")}.`, "proposed.unknownCosts");
  if (assessment.recommendation === "recommend_promotion" && economics.known) {
    for (const [sideName, side] of [["current", assessment.current], ["proposed", assessment.proposed]] as const) {
      if (!side.variableCosts.some((cost) => /payment|processing fee|transaction fee/i.test(cost.category))) error(`List the ${sideName} payment or transaction fee, or keep it unknown and do not recommend the promotion.`, `${sideName}.variableCosts`);
      if (!side.variableCosts.some((cost) => /fulfill|service|labor|delivery|shipping|cogs|materials?|manufactur|production|unit cost/i.test(cost.category))) error(`List the ${sideName} variable fulfillment, product, or service delivery cost, or keep it unknown and do not recommend the promotion.`, `${sideName}.variableCosts`);
    }
    if (["bonus", "bundle", "referral_incentive"].includes(assessment.mechanism) && !assessment.proposed.variableCosts.some((cost) => /bonus|promo|referral|reward|bundle/i.test(cost.category))) error("Include the proposed bonus or incentive cost as a variable cost before recommending this mechanism.", "proposed.variableCosts");
  }
  if (assessment.recommendation === "recommend_promotion" && ["unknown", "constrained"].includes(assessment.capacity.status)) error("Do not recommend a promotion while delivery capacity is unknown or constrained; resolve the bottleneck or run a capacity-safe validation first.", "capacity.status");
  if (assessment.recommendation === "recommend_promotion" && economics.known && (economics.proposedContribution === null || economics.proposedContribution <= 0)) error("The proposed offer has no positive unit contribution under its stated cost boundary.", "proposed");
  if (assessment.recommendation === "recommend_promotion" && assessment.mechanism === "discount" && economics.known && (economics.priceChangeFromCurrent ?? 0) >= 0) error("A discount mechanism must reduce the proposed net price from the current offer.", "proposed.netPrice");
  if (assessment.recommendation === "recommend_promotion" && economics.known && assessment.minimumContribution?.amount !== null && assessment.minimumContribution?.amount !== undefined && economics.proposedContribution! < assessment.minimumContribution.amount) error("The proposed offer fails the supplied minimum contribution guardrail.", "minimumContribution");
  if (assessment.recommendation === "recommend_promotion" && economics.known && assessment.minimumMarginRate?.amount !== null && assessment.minimumMarginRate?.amount !== undefined && economics.proposedMarginRate! < assessment.minimumMarginRate.amount) error("The proposed offer fails the supplied minimum contribution-margin guardrail.", "minimumMarginRate");

  const urgency = URGENCY_WORDS.test(text);
  if (urgency && (!assessment.urgencyClaim || !assessment.urgencyEvidenceRef)) error("Deadline, scarcity, or limited-availability copy needs direct owner or current source evidence; otherwise remove it.", "urgencyClaim");
  if (assessment.urgencyClaim) {
    if (!text.includes(assessment.urgencyClaim)) error("The urgency evidence must support the exact deadline or scarcity language used in the play.", "urgencyClaim");
    const supporting = resolveEvidence(assessment.urgencyEvidenceRef, context);
    if (!supporting || !supporting.includes(assessment.urgencyClaim)) error("Deadline or scarcity claims must be present in the cited supplied fact or retrieved source.", "urgencyEvidenceRef");
  }
  if (assessment.authorizationNote && /approved|authorized|ready to publish|will send|will apply/i.test(assessment.authorizationNote)) error("An offer recommendation is advisory and cannot itself authorize a price, billing, message, or publishing change.", "authorizationNote");
  if (!context.evidenceText.trim() && assessment.recommendation === "recommend_promotion") error("There is no business-specific evidence to support a promotion recommendation.", "recommendation");
  return issues;
}
