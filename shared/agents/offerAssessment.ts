import { z } from "zod";
import type { LintIssue } from "./types";

export const OfferEvidenceValueSchema = z.object({
  amount: z.number().finite().nonnegative().nullable(),
  basis: z.enum(["owner_reported", "measured", "source_reported", "inferred", "assumed"]),
  reference: z.string().nullable(),
  claim: z.string().max(500),
});
export type OfferEvidenceValue = z.infer<typeof OfferEvidenceValueSchema>;

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
  promotionHistory: z.object({
    status: z.enum(["measured", "owner_reported", "unknown"]),
    reference: z.string().nullable(),
    claim: z.string().max(500),
    period: z.string().nullable(),
    promotionPattern: z.string().min(1).max(240),
    repeatPurchaseComparison: z.string().min(1).max(240),
    fullPriceComparison: z.string().min(1).max(240),
    limitation: z.string().min(1).max(240),
  }).optional(),
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
  allowedDiscountPercentages?: number[];
  allowedMechanisms?: string[];
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
  const statedDiscounts = new Set<number>();
  const discountPatterns = [
    /\b(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:off|discount|savings?)\b/gi,
    /\b(?:discount|savings?)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*(?:%|percent)\b/gi,
  ];
  for (const pattern of discountPatterns) {
    for (const match of text.matchAll(pattern)) {
      const amount = Number(match[1]);
      if (Number.isFinite(amount)) statedDiscounts.add(amount);
    }
  }
  const allowedDiscounts = new Set((offers ?? []).flatMap((offer) => offer.allowedDiscountPercentages ?? []));
  for (const discount of statedDiscounts) {
    if (![...allowedDiscounts].some((allowed) => Math.abs(allowed - discount) < 0.005)) {
      const allowed = [...allowedDiscounts].map((value) => `${value}%`).join(" or ");
      issues.push({ severity: "error", rule: "approved_offer_discount", message: `This copy states a ${discount}% discount, which does not match the owner-approved offer${allowed ? ` (${allowed})` : ""}. Use only a supported discount level or remove the percentage.`, path });
    }
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
const PROMOTION_WORDS = /\b(?:discount|%\s*off|save\s+\$|sale price|coupon|promo code|limited[- ]time|bonus|bundle|free trial|payment terms|pay later|installments?|split payments?|guarantee|referral reward|incentive|special offer|offer change|change the offer|non[- ]price offer|free (?:setup|shipping|delivery|consultation|onboarding))\b/i;
const URGENCY_WORDS = /\b(?:limited[- ]time|ends? (?:today|tomorrow|this week|on|in)|last chance|only \d+|limited (?:spots?|seats?|stock|inventory)|while supplies last|deadline|scarcity|expires? (?:today|tomorrow|on|in))\b/i;
const RESTRICTED_AUDIENCE = /\b(?:first[- ]time|new (?:customers?|clients?|buyers?|users?)|existing (?:customers?|clients?|buyers?|users?|subscribers?|members?)|qualified|invited|waitlist|members? only|(?:for )?(?:returning|current) (?:customers?|clients?|buyers?|users?|subscribers?|members?))\b/i;
const UNIVERSAL_AUDIENCE = /\b(?:available to everyone|open to everyone|for everyone|all customers|all users|any customer|any user|anyone can|no restrictions)\b/i;
const AUDIENCE_QUALIFIERS = [
  /\bfirst[- ]time\b/i,
  /\bnew (?:customers?|clients?|buyers?|users?)\b/i,
  /\bexisting (?:customers?|clients?|buyers?|users?|subscribers?|members?)\b/i,
  /\bqualified\b/i,
  /\binvited\b/i,
  /\bwaitlist\b/i,
  /\bmembers? only\b/i,
  /\b(?:returning|current) (?:customers?|clients?|buyers?|users?|subscribers?|members?)\b/i,
];
const OFFER_MECHANISM_PATTERNS: Record<string, RegExp> = {
  discount: /\b(?:discount|\d+(?:\.\d+)?%\s*off|save\s+(?:[$£€]\s*)?\d|promo(?:tion)? code|coupon|sale price|introductory price)\b/i,
  bundle: /\bbundles?\b/i,
  bonus: /\b(?:bonus|free gift|free add[- ]on|complimentary (?:item|service|month))\b/i,
  trial: /\b(?:free trial|trial period|try(?: it)? free)\b/i,
  payment_terms: /\b(?:pay later|installments?|payment terms|split payments?)\b/i,
  guarantee: /\b(?:guarantee|money[- ]back|refund promise)\b/i,
  referral_incentive: /\b(?:referral reward|referral incentive|refer (?:a friend|someone) and get)\b/i,
};

/** Bind every recognized offer mechanism, deadline, or price to its exact approved play. */
const OFFER_SPECIFIC_COPY = new RegExp([
  PROMOTION_WORDS.source,
  URGENCY_WORDS.source,
  ...Object.values(OFFER_MECHANISM_PATTERNS).map((pattern) => pattern.source),
  String.raw`(?:[$£€]\s*\d|\b\d[\d,.]*\s*(?:USD|EUR|GBP|CAD|AUD)\b)`,
].join("|"), "i");

function hasOfferCurrencyAmount(text: string, offers: ApprovedOfferCopyTerms[]): boolean {
  const amount = "(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)";
  return offers.some((offer) => {
    if (!/^[A-Z]{3}$/.test(offer.currency)) return false;
    let symbol = offer.currency;
    try {
      symbol = new Intl.NumberFormat("en", { style: "currency", currency: offer.currency }).formatToParts(1).find((part) => part.type === "currency")?.value ?? symbol;
    } catch { /* Fall back to matching the ISO currency code. */ }
    const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const marker = `(?:${escape(symbol)}|${escape(offer.currency)})`;
    return new RegExp(`(?:${marker}\\s*${amount}|${amount}\\s*${marker})`, "i").test(text);
  });
}

/** Validate offer language against the exact approved plan play it represents. */
export function lintApprovedOfferCopy(text: string, offers: ApprovedOfferCopyTerms[] | undefined, path: string, approvedOfferPlayName?: string): LintIssue[] {
  if (!offers?.length) return [];
  const hasOfferSpecificCopy = OFFER_SPECIFIC_COPY.test(text) || hasOfferCurrencyAmount(text, offers);
  const issues: LintIssue[] = [];
  let applicableOffers = offers;
  if (approvedOfferPlayName) {
    const selected = offers.find((offer) => offer.playName === approvedOfferPlayName);
    if (!selected) {
      if (hasOfferSpecificCopy) issues.push({ severity: "error", rule: "approved_offer_play", message: "This draft names an approved plan play that is not available in the current approved plan. Choose its exact play name or remove the offer claims.", path });
      applicableOffers = [];
    } else applicableOffers = [selected];
  } else if (offers.length > 1 && hasOfferSpecificCopy) {
    issues.push({ severity: "error", rule: "approved_offer_play", message: "This draft uses offer terms but does not identify which approved plan play it belongs to. Add the exact play name to the campaign brief or calendar slot so its price, audience, and conditions can be checked together.", path });
    applicableOffers = [];
  }
  if (applicableOffers.some((offer) => offer.recommendation === "validate_first") && PROMOTION_WORDS.test(text)) {
    issues.push({ severity: "error", rule: "offer_validation_only", message: "This promotion is only a test proposal, not an offer available to customers. Remove customer-facing promotion terms until the test is validated and the offer is approved.", path });
  }
  if (applicableOffers.some((offer) => offer.recommendation !== "recommend_promotion" && offer.recommendation !== "validate_first") && PROMOTION_WORDS.test(text)) {
    issues.push({ severity: "error", rule: "offer_not_recommended", message: "The selected plan play does not recommend changing the offer. Remove customer-facing promotion terms or review the plan with its owner first.", path });
  }
  const priceIssues = lintApprovedOfferPrices(text, applicableOffers, path);
  issues.push(...priceIssues);
  if (!applicableOffers.length) return issues;
  const mechanismBound = applicableOffers.some((offer) => offer.allowedMechanisms?.length);
  if (mechanismBound) {
    const approvedMechanisms = new Set(applicableOffers.flatMap((offer) => offer.allowedMechanisms ?? []));
    for (const [mechanism, pattern] of Object.entries(OFFER_MECHANISM_PATTERNS)) {
      if (pattern.test(text) && !approvedMechanisms.has(mechanism)) {
        issues.push({ severity: "error", rule: "approved_offer_mechanism", message: `This copy introduces a ${mechanism.replaceAll("_", " ")} mechanism that is not in the owner-approved promotion terms. Keep the offer mechanism consistent with the approved plan.`, path });
      }
    }
  }
  if (URGENCY_WORDS.test(text)) {
    const supportedClaims = applicableOffers.map((offer) => offer.urgencyClaim?.trim()).filter((claim): claim is string => Boolean(claim));
    const normalizedText = text.normalize("NFKC").replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
    const exactSupportedClaim = supportedClaims.some((claim) => normalizedText.includes(claim.normalize("NFKC").replace(/\s+/gu, " ").toLocaleLowerCase("en-US")));
    if (!exactSupportedClaim) {
      issues.push({ severity: "error", rule: "approved_offer_urgency", message: "This copy adds a deadline, scarcity, or limited-availability claim that is not present in the approved offer evidence. Remove it or use the exact supported claim from the plan.", path });
    }
  }
  const promotionOffers = applicableOffers.filter((offer) => offer.recommendation === "recommend_promotion" || offer.recommendation === "validate_first");
  const restrictedAudiences = promotionOffers
    .map((offer) => offer.eligibleAudience?.split(/;\s*(?:exclude|except|not eligible)\b/i)[0]?.trim())
    .filter((audience): audience is string => Boolean(audience && RESTRICTED_AUDIENCE.test(audience)));
  const distinctRestrictedAudiences = [...new Set(restrictedAudiences.map((audience) => audience.normalize("NFKC").replace(/\s+/gu, " ").toLocaleLowerCase("en-US")))];
  const requiredQualifiers = restrictedAudiences.length === 1 || distinctRestrictedAudiences.length === 1
    ? [...new Set(restrictedAudiences.flatMap((audience) => AUDIENCE_QUALIFIERS.filter((qualifier) => qualifier.test(audience)).map((qualifier) => qualifier.source)))]
    : [];
  const hasUnrestrictedPromotion = promotionOffers.some((offer) => !offer.eligibleAudience || !RESTRICTED_AUDIENCE.test(offer.eligibleAudience));
  if (PROMOTION_WORDS.test(text) && restrictedAudiences.length && !hasUnrestrictedPromotion) {
    if (UNIVERSAL_AUDIENCE.test(text)) {
      issues.push({ severity: "error", rule: "approved_offer_eligibility", message: "This copy presents a restricted offer as open to everyone. Preserve the audience qualifiers from the approved plan or remove the broader claim.", path });
    } else if (requiredQualifiers.length && !requiredQualifiers.every((source) => new RegExp(source, "i").test(text))) {
      issues.push({ severity: "error", rule: "approved_offer_eligibility", message: "This copy mentions a restricted promotion but omits its eligible-audience condition. Include the relevant approved qualifier or remove the promotion wording.", path });
    }
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

  if (!assessment.promotionHistory) {
    error("State whether prior promotion and repeat-purchase history is evidenced or unknown.", "promotionHistory");
  } else if (assessment.promotionHistory.status === "unknown") {
    if (assessment.promotionHistory.reference || assessment.promotionHistory.claim || assessment.promotionHistory.period) error("Unknown promotion history must not contain an unsupported citation, claim, or period.", "promotionHistory");
    if (!assessment.unknowns.some((item) => /promotion|discount|repeat purchase|full.price/i.test(item))) error("When promotion history is unavailable, name the missing history as an unknown.", "unknowns");
  } else {
    const historyEvidence = resolveEvidence(assessment.promotionHistory.reference, context);
    if (!historyEvidence || !assessment.promotionHistory.claim || !historyEvidence.includes(assessment.promotionHistory.claim)) error("Measured or owner-reported promotion history must quote a supplied fact or retrieved source.", "promotionHistory.reference");
    if (!assessment.promotionHistory.period?.trim()) error("State the observed period for promotion and repeat-purchase history, or leave the history unknown.", "promotionHistory.period");
    if (assessment.promotionHistory.status === "measured" && !/^fact:\d+$/.test(assessment.promotionHistory.reference ?? "") && !context.sourceUrls.includes(assessment.promotionHistory.reference ?? "")) error("Measured promotion history must point to a measured fact or exact retrieved source.", "promotionHistory.reference");
  }

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
