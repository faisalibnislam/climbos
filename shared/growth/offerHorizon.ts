import { evaluateOfferUnitEconomics, type OfferAssessment } from "../agents/offerAssessment";
import { majorToMinor, minorToMajor } from "../economics/currency";

/** Compare contribution in the SAME declared period; never forecast missing sales. */
export function offerHorizon(offer: OfferAssessment, currentUnits: number | null) {
  const economics = evaluateOfferUnitEconomics(offer);
  const base = { horizonDays: offer.horizonDays, currency: offer.currency, currentUnits };
  if (currentUnits === null) return { ...base, state: "unknown_volume" as const };
  if (!Number.isSafeInteger(currentUnits) || currentUnits < 0 || currentUnits > 10_000_000) return { ...base, state: "invalid_volume" as const };
  if (!economics.known) return { ...base, state: "unknown_costs" as const };
  const current = majorToMinor(economics.currentContribution!, offer.currency);
  const proposed = majorToMinor(economics.proposedContribution!, offer.currency);
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(proposed)) return { ...base, state: "invalid_amount" as const };
  if (current <= 0) return { ...base, state: "current_not_profitable" as const };
  const currentTotalMinor = current * currentUnits;
  if (!Number.isSafeInteger(currentTotalMinor)) return { ...base, state: "invalid_volume" as const };
  if (proposed <= 0 && currentTotalMinor > 0) return { ...base, state: "cannot_match" as const };
  const unitsNeeded = currentTotalMinor === 0 ? 0 : Math.ceil(currentTotalMinor / proposed);
  if (!Number.isSafeInteger(unitsNeeded) || !Number.isSafeInteger(proposed * currentUnits)) return { ...base, state: "invalid_amount" as const };
  return { ...base, state: "calculated" as const, currentTotal: minorToMajor(currentTotalMinor, offer.currency), unitsNeeded, extraUnits: unitsNeeded - currentUnits, proposedAtSameVolume: minorToMajor(proposed * currentUnits, offer.currency) };
}
