import type { BusinessModelCheck } from "../../../../shared/agents/businessModel";
import type { BusinessModelEvidence } from "../../../../shared/agents/businessModelFreshness";
import { PRESSURE_LABELS, type LandscapeResponse, type StrategicLandscape } from "../../../../shared/agents/strategicLandscape";
import { EvidenceReferences } from "./EvidenceReferences";

/** Review-only reasoning with source observations kept distinct from proposed responses. */
export function StrategicLandscapeView({ landscape, signals, facts }: { landscape: StrategicLandscape; signals: BusinessModelCheck["marketSignals"]; facts?: BusinessModelEvidence["facts"] | null }) {
  const rows: { key: string; label: string; judgment: string; row: LandscapeResponse }[] = [
    ...landscape.forces.map(row => ({ key: `force:${row.force}`, label: PRESSURE_LABELS[row.force], judgment: `${row.pressure} pressure`, row })),
    ...landscape.macroFactors.map(row => ({ key: `macro:${row.factor}`, label: PRESSURE_LABELS[row.factor], judgment: row.direction, row })),
  ];
  return <section aria-label="Competitive and market pressures" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4">
    <h2 className="heading-card">What could change this decision</h2>
    <p className="text-sm text-ink">{landscape.decisionSummary}</p>
    <p className="text-xs text-ink-3">AI interpretations for review. These do not establish causes or authorize changes.</p>
    <details className="text-sm">
      <summary className="min-h-10 cursor-pointer py-2 font-medium text-ink">See competitive and market reasoning</summary>
      <dl className="mb-3 grid gap-2 text-xs sm:grid-cols-3">
        <div><dt className="text-ink-3">Market considered</dt><dd>{landscape.market ?? "Unknown"}</dd></div>
        <div><dt className="text-ink-3">Customer segment</dt><dd>{landscape.customerSegment ?? "Unknown"}</dd></div>
        <div><dt className="text-ink-3">Served geography</dt><dd>{landscape.geography ?? "Unknown"}</dd></div>
      </dl>
      <p className="text-xs text-ink-3">Scope basis: {landscape.scopeBasis.replace(/_/g, " ")} · {landscape.scopeLimitation}</p>
      <EvidenceReferences references={landscape.scopeEvidenceRefs} factSnapshot={facts ?? null} />
      {rows.length ? <ul className="mt-3 flex flex-col gap-4">{rows.map(({ key, label, judgment, row }) => <li key={key} className="flex flex-col gap-2 border-t border-line pt-3">
        <h3 className="font-semibold text-ink">{label}{landscape.priorityRefs.includes(key) ? <span className="ml-2 text-xs font-normal text-ink-3">Decision focus</span> : null}</h3>
        <p className="text-xs text-ink-3">{judgment} · {row.basis === "speculative_hypothesis" ? "Speculative hypothesis" : "Evidence-supported inference"} · AI judgment</p>
        <dl className="flex flex-col gap-2 text-sm">
          <div><dt className="text-xs text-ink-3">How it could affect the business</dt><dd>{row.mechanism}</dd></div>
          <div><dt className="text-xs text-ink-3">Why it matters here</dt><dd>{row.businessImplication}</dd></div>
          <div><dt className="text-xs text-ink-3">Possible response</dt><dd>{row.possibleResponse}</dd></div>
          <div><dt className="text-xs text-ink-3">Tradeoff</dt><dd>{row.tradeoff}</dd></div>
          <div><dt className="text-xs text-ink-3">Smallest useful check</dt><dd>{row.nextCheck}</dd></div>
        </dl>
        {row.signalIndexes.length ? <details><summary className="min-h-10 cursor-pointer py-2 text-xs text-ink-2">Supporting observations and limits</summary><ul className="flex flex-col gap-2 text-xs">{row.signalIndexes.map(index => {
          const signal = signals[index];
          return <li key={index}>{signal ? <><p>{signal.finding}</p><p className="text-ink-3">{signal.basis.replace(/_/g, " ")} · {signal.observedAt ?? "Evidence date unknown"} · {signal.limitation}</p><EvidenceReferences references={signal.evidenceRefs} factSnapshot={facts ?? null} /></> : <p className="text-ink-3">The original supporting observation is unavailable.</p>}</li>;
        })}</ul></details> : <p className="text-xs text-ink-3">No direct supporting observation is attached. Treat this as a hypothesis to check.</p>}
      </li>)}</ul> : <p className="mt-3 text-ink-2">No business-specific pressure has been assessed in this report.</p>}
      <div className="mt-4 flex flex-col gap-1 border-t border-line pt-3 text-xs text-ink-3">
        <p>Not assessed means unknown, not low risk or no effect.</p>
        {landscape.unassessedForces.length ? <p>Competitive gaps: {landscape.unassessedForces.map(key => PRESSURE_LABELS[key]).join("; ")}.</p> : null}
        {landscape.unassessedMacroFactors.length ? <p>External-context gaps: {landscape.unassessedMacroFactors.map(key => PRESSURE_LABELS[key]).join("; ")}.</p> : null}
      </div>
    </details>
  </section>;
}
