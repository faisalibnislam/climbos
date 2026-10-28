import type { OfferAssessment } from "../../../../shared/agents/offerAssessment";

export function offerRecommendationLabel(value: OfferAssessment["recommendation"]): string {
  switch (value) {
    case "recommend_promotion": return "Consider an offer change";
    case "validate_first": return "Check the details first";
    case "improve_other_constraint": return "Fix something else first";
    case "no_change": return "Keep the current offer";
  }
}

export function offerMechanismLabel(value: OfferAssessment["mechanism"]): string {
  switch (value) {
    case "discount": return "Lower price";
    case "bundle": return "Bundle";
    case "bonus": return "Add an extra";
    case "trial": return "Free trial";
    case "payment_terms": return "Change payment options";
    case "guarantee": return "Guarantee";
    case "referral_incentive": return "Referral reward";
    case "non_price_change": return "Change the offer, not the price";
    case "none": return "No offer change";
  }
}

export function offerEvidenceLabel(value: OfferAssessment["evidenceBasis"]): string {
  switch (value) {
    case "owner_reported": return "Reported by your team";
    case "measured": return "Measured in this business";
    case "source_reported": return "Reported by a source";
    case "inferred": return "Educated guess";
    case "assumed": return "Assumption to check";
  }
}

export function offerCapacityLabel(value: OfferAssessment["capacity"]["status"]): string {
  switch (value) {
    case "available": return "Room to take on more work";
    case "constrained": return "Limited room for more work";
    case "unknown": return "Capacity not confirmed";
    case "not_applicable": return "No extra work needed";
  }
}

export function offerAlternativeLabel(value: OfferAssessment["alternatives"][number]["alternative"]): string {
  switch (value) {
    case "positioning": return "Explain the offer more clearly";
    case "conversion_path": return "Make it easier to buy or book";
    case "retention": return "Keep current customers";
    case "capacity": return "Improve capacity";
    case "no_change": return "Keep the offer as it is";
  }
}

export function offerRiskLabel(value: OfferAssessment["risks"][number]["kind"]): string {
  switch (value) {
    case "margin": return "Profit per sale may fall";
    case "wait_for_sale": return "Customers may wait for another deal";
    case "pull_forward": return "Sales may come earlier, not grow";
    case "cannibalization": return "Full-price buyers may switch to the deal";
    case "capacity": return "You may not be able to deliver";
    case "support_burden": return "More support time needed";
    case "poor_fit": return "May attract poor-fit customers";
  }
}

export function offerEvidenceStatusLabel(value: OfferAssessment["risks"][number]["status"]): string {
  switch (value) {
    case "measured": return "measured";
    case "calculated": return "calculated";
    case "hypothesis": return "possible risk to test";
    case "unknown": return "not known yet";
    case "not_applicable": return "does not apply";
  }
}

export function offerReferenceLabel(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  if (/^fact:\d+$/i.test(value)) return "Your business information";
  return "Supporting information";
}
