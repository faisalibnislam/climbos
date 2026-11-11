"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui";
import type { OfferAssessment } from "@shared/agents/offerAssessment";
import { offerHorizon } from "@shared/growth/offerHorizon";
import { formatMoney } from "@shared/economics/currency";

export function OfferHorizon({ offer }: { offer: OfferAssessment }) {
  const [volume, setVolume] = useState("");
  const result = offerHorizon(offer, volume.trim() ? Number(volume) : null);
  return <details className="border-t border-line pt-3">
    <summary className="min-h-9 cursor-pointer text-sm font-medium">How many sales would make this offer worthwhile?</summary>
    <div className="mt-3 space-y-3 text-sm text-ink-2">
      <Field label={`Sales with the current offer over ${offer.horizonDays} days`} hint="Enter an observed count or a scenario you want to compare. Leave blank if unknown."><Input type="number" min={0} max={10_000_000} step={1} value={volume} onChange={(event) => setVolume(event.target.value)} /></Field>
      {result.state === "calculated" ? <p role="status">Your scenario: {volume} current-offer sales contribute {formatMoney(result.currentTotal, offer.currency)} in {offer.horizonDays} days. The proposed offer needs {result.unitsNeeded.toLocaleString()} sales in the same period to match that contribution{result.extraUnits > 0 ? ` (${result.extraUnits.toLocaleString()} more)` : ""}. At the same sales count, it contributes {formatMoney(result.proposedAtSameVolume, offer.currency)}.</p> : <p role="status">{result.state === "unknown_volume" ? "Not calculated: the number of sales in this period is unknown." : result.state === "unknown_costs" ? "Confirm the missing prices and variable costs before comparing sales volumes." : result.state === "current_not_profitable" ? "The current offer has no positive unit contribution. Review its price and costs first." : result.state === "cannot_match" ? "More sales cannot match the current contribution while the proposed offer makes zero or loses money per sale." : result.state === "invalid_amount" ? "These amounts exceed the supported calculation range. Check the prices and costs." : "Enter a whole sales count between zero and ten million."}</p>}
      <p className="text-xs text-ink-3">Calculation only in this view. This does not predict demand, approve an offer, or change the plan. It uses the cost boundary above and excludes unknown setup costs and fixed overhead. Changing the offer may change demand, returns or delivery costs.</p>
    </div>
  </details>;
}
