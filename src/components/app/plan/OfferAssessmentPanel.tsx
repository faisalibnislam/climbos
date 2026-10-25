import { ExternalLink } from "@/components/icons";
import { Badge } from "@/components/ui";
import { evaluateOfferUnitEconomics, type OfferAssessment, type OfferEvidenceValue } from "../../../../shared/agents/offerAssessment";
import { formatMoney } from "../../../../shared/economics/currency";
import { offerAlternativeLabel, offerCapacityLabel, offerEvidenceLabel, offerEvidenceStatusLabel, offerMechanismLabel, offerRecommendationLabel, offerReferenceLabel, offerRiskLabel } from "./offerPresentation";

export function OfferAssessmentPanel({ offer }: { offer: OfferAssessment }) {
  const economics = evaluateOfferUnitEconomics(offer);
  const nextStep = offer.recommendation === "recommend_promotion"
    ? "Next step: Review the test and confirm the details before deciding."
    : offer.recommendation === "validate_first"
      ? "Next step: Confirm the missing details before choosing an offer."
      : offer.recommendation === "improve_other_constraint"
        ? "Next step: Address the business issue above before changing the offer."
        : "Next step: Keep the offer as it is unless new evidence changes the decision.";
  const keyRisks = [
    ...offer.risks.filter((risk) => risk.kind === "margin" || risk.kind === "capacity"),
    ...offer.risks.filter((risk) => risk.kind !== "margin" && risk.kind !== "capacity"),
  ].slice(0, 2);

  return (
    <section aria-label="Offer recommendation and test" className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-ink-2">Offer recommendation</span><Badge tone={offer.recommendation === "recommend_promotion" ? "green" : "amber"}>{offerRecommendationLabel(offer.recommendation)}</Badge><Badge>{offerMechanismLabel(offer.mechanism)}</Badge><Badge>Advice only · changes need your approval</Badge></div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div><dt className="text-xs text-ink-3">Who it is for and why</dt><dd className="text-ui text-ink">{offer.segment} · {offer.needOrObstacle} · goal: {offer.objective}</dd></div>
        <div><dt className="text-xs text-ink-3">What supports this idea</dt><dd className="text-ui text-ink">{offerEvidenceLabel(offer.evidenceBasis)} · {offer.evidenceNote}{offer.evidenceRefs.length ? <span className="mt-1 flex flex-wrap gap-x-2">{offer.evidenceRefs.map((reference, index) => /^https?:\/\//i.test(reference) ? <a key={`${reference}-${index}`} href={reference} target="_blank" rel="noopener noreferrer" className="text-brand-800 underline">Open source<ExternalLink aria-hidden className="inline size-3" /></a> : <span key={`${reference}-${index}`}>{offerReferenceLabel(reference)}</span>)}</span> : null}</dd></div>
        {economics.known ? <>
          <div><dt className="text-xs text-ink-3">Money left per sale after listed costs · {offer.currency}</dt><dd className="text-ui text-ink">Current {formatMoney(economics.currentContribution, offer.currency)} from {formatMoney(offer.current.netPrice.amount, offer.currency)} · proposed {formatMoney(economics.proposedContribution, offer.currency)} from {formatMoney(offer.proposed.netPrice.amount, offer.currency)}<span className="mt-1 block text-xs text-ink-3">Calculated from the listed inputs. Cost boundary: {offer.costBoundary} · comparison period: {offer.horizonDays} days.</span><details className="mt-2"><summary className="min-h-8 cursor-pointer py-1 text-xs font-medium text-ink-2">See cost inputs, sources, and evidence types</summary><div className="mt-2 grid gap-3 text-xs"><OfferSideEvidence label="Current offer" side={offer.current} currency={offer.currency} /><OfferSideEvidence label="Proposed offer" side={offer.proposed} currency={offer.currency} /></div></details></dd></div>
          <div><dt className="text-xs text-ink-3">Sales needed to match one current sale</dt><dd className="text-ui text-ink">{economics.proposedUnitsPerCurrentUnitToMatchContribution === null ? (economics.currentContribution !== null && economics.currentContribution <= 0 ? "The current offer leaves no positive amount after these costs, so a sales comparison is not useful." : "The proposed offer leaves no positive amount after these costs, so there is no finite break-even number of sales.") : `About ${economics.proposedUnitsPerCurrentUnitToMatchContribution.toFixed(2)} proposed-price sales would leave the same amount as one current sale, using the listed costs.`}</dd></div>
        </> : <div><dt className="text-xs text-ink-3">Offer economics · {offer.currency}</dt><dd className="text-ui text-amber-800">Not enough inputs to calculate money left per sale: {economics.unknowns.join(" · ")}</dd></div>}
        <div><dt className="text-xs text-ink-3">Ability to take on more work</dt><dd className="text-ui text-ink">{offerCapacityLabel(offer.capacity.status)}{offer.capacity.claim ? ` · ${offer.capacity.claim}` : ""}</dd></div>
      </dl>
      <p className="text-xs font-medium text-ink-2">{nextStep}</p>
      {keyRisks.length ? <div><p className="text-xs font-medium text-ink-2">Key risks to check</p><ul className="mt-1 list-disc pl-5 text-ui text-ink">{keyRisks.map((risk) => <li key={risk.kind}><span className="font-medium">{offerRiskLabel(risk.kind)}</span> · {offerEvidenceStatusLabel(risk.status)}: {risk.note}</li>)}</ul></div> : null}
      <p className="text-xs text-amber-800">{offer.unknowns.length ? `Still to confirm: ${offer.unknowns.join(" · ")}` : "No material offer inputs are listed as unknown."}{offer.test.ownerInputs.length ? ` · Your team needs to provide: ${offer.test.ownerInputs.join(" · ")}` : ""}</p>
      <details className="border-t border-line pt-2 text-xs text-ink-2">
        <summary className="min-h-10 cursor-pointer py-2 font-medium">See the test plan, other options, and full risks</summary>
        <div className="mt-2 flex flex-col gap-3">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-xs text-ink-3">Test audience and comparison</dt><dd className="text-ui text-ink">{offer.test.eligibleAudience} · {offer.test.baselineOrComparison}</dd></div>
            <div><dt className="text-xs text-ink-3">Primary outcome and window</dt><dd className="text-ui text-ink">{offer.test.primaryOutcome} · {offer.test.observationWindowDays} days</dd></div>
            <div><dt className="text-xs text-ink-3">Continue / stop</dt><dd className="text-ui text-ink">{offer.test.continueCriteria} / {offer.test.stopCriteria}</dd></div>
          </dl>
          {offer.promotionHistory ? <div className="rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2"><p className="text-xs font-medium text-ink-2">Past offer results · {offer.promotionHistory.status === "unknown" ? "not available" : offer.promotionHistory.status === "measured" ? "measured" : "reported by your team"}{offer.promotionHistory.period ? ` · ${offer.promotionHistory.period}` : ""}</p>{offer.promotionHistory.claim ? <p className="mt-1 text-ui text-ink">Evidence: {offer.promotionHistory.claim}{offer.promotionHistory.reference ? ` · ${offerReferenceLabel(offer.promotionHistory.reference)}` : ""}</p> : null}<p className="mt-1 text-xs text-ink-2">Frequency: {offer.promotionHistory.promotionPattern} · Repeat purchases: {offer.promotionHistory.repeatPurchaseComparison} · Full price: {offer.promotionHistory.fullPriceComparison}</p><p className="mt-1 text-xs text-ink-3">Limit: {offer.promotionHistory.limitation}</p></div> : <p className="text-xs text-ink-3">Promotion and repeat-purchase history was not available for this older plan.</p>}
          <div><p className="text-xs font-medium text-ink-2">Other options considered</p><ul className="mt-1 list-disc pl-5 text-ui text-ink">{offer.alternatives.map((item) => <li key={item.alternative}><span className="font-medium">{offerAlternativeLabel(item.alternative)}:</span> {item.reason}</li>)}</ul></div>
          <div><p className="text-xs font-medium text-ink-2">All risks and unknowns</p><ul className="mt-1 list-disc pl-5 text-ui text-ink">{offer.risks.map((risk) => <li key={risk.kind}><span className="font-medium">{offerRiskLabel(risk.kind)}</span> · {offerEvidenceStatusLabel(risk.status)}: {risk.note}</li>)}</ul></div>
          <p className="text-xs text-ink-3">{offer.authorizationNote}</p>
        </div>
      </details>
    </section>
  );
}

function OfferSideEvidence({ label, side, currency }: { label: string; side: OfferAssessment["current"]; currency: string }) {
  return (
    <div>
      <p className="font-semibold text-ink-2">{label}</p>
      <ul className="mt-1 grid gap-1.5">
        <li><OfferValueEvidence label="Net price" value={side.netPrice} currency={currency} /></li>
        {side.variableCosts.map((cost, index) => <li key={`${cost.category}-${index}`}><OfferValueEvidence label={cost.category} value={cost.value} currency={currency} /></li>)}
        {side.unknownCosts.map((cost, index) => <li key={`${cost}-${index}`} className="text-amber-800">{cost}: not provided</li>)}
      </ul>
    </div>
  );
}

function OfferValueEvidence({ label, value, currency }: { label: string; value: OfferEvidenceValue; currency: string }) {
  const reference = value.reference?.trim() ?? "";
  return (
    <span className="block text-ink-2">
      <span className="font-medium">{label}: {value.amount === null ? "unknown" : formatMoney(value.amount, currency)}</span>
      <span className="text-ink-3"> · {offerEvidenceLabel(value.basis)}</span>
      {value.claim ? <span className="block text-ink-3">{value.claim}</span> : null}
      {reference ? /^https?:\/\//i.test(reference)
        ? <a href={reference} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 text-brand-800 underline">Open source<ExternalLink aria-hidden className="size-3" /></a>
        : <span className="block text-ink-3">{offerReferenceLabel(reference)}</span>
        : null}
    </span>
  );
}
