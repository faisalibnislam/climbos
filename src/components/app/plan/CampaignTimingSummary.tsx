import type { CampaignTiming } from "../../../../shared/agents/campaignTiming";
import { Badge } from "@/components/ui";
import { ExternalLink } from "@/components/icons";
import { formatTimingWindow, timingCapacityLabel, timingDecisionLabel, timingDurationLabel } from "./timingPresentation";

export function CampaignTimingSummary({ timing }: { timing: CampaignTiming & { researchRetrievedAt?: string | null } }) {
  const windowLabel = formatTimingWindow(timing.proposedWindow);
  return (
    <section className="rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 py-2" aria-label="Campaign timing recommendation">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink-2">{timingDecisionLabel(timing.decision)}</span>
        {windowLabel ? <Badge>{windowLabel}</Badge> : <span className="text-xs text-ink-3">No dates suggested</span>}
      </div>
      <p className="mt-1 text-xs text-ink-2">{timing.rationale}</p>
      {timing.moment.name ? <>
        <p className="mt-1 text-xs text-ink-2"><span className="font-semibold">Timing to consider:</span> {timing.moment.name}</p>
        <p className="mt-1 text-xs text-ink-2"><span className="font-semibold">Why it may matter to this business:</span> {timing.moment.businessReason}</p>
      </> : null}
      {timing.unknowns.length ? <p className="mt-1 text-xs text-amber-800"><span className="font-semibold">Still to confirm:</span> {timing.unknowns.slice(0, 2).join(" · ")}{timing.unknowns.length > 2 ? ` · and ${timing.unknowns.length - 2} more` : ""}</p> : null}
      <p className="mt-1 text-xs text-ink-3">This is a suggestion only. Nothing is scheduled.</p>
      <details className="mt-2 border-t border-line pt-2 text-xs text-ink-2">
        <summary className="min-h-8 cursor-pointer py-1 font-medium">Timing details and sources</summary>
        <dl className="mt-2 grid gap-2">
          <div><dt className="font-semibold">Business area</dt><dd>{timing.geographyBasis}</dd></div>
          <div><dt className="font-semibold">Time zone</dt><dd>{timing.timezone ?? "Not confirmed"} · {timing.timezoneBasis}</dd></div>
          <div><dt className="font-semibold">Time to prepare and deliver</dt><dd>{timingDurationLabel(timing.preparation.leadTimeDays, "Preparation")} · {timingDurationLabel(timing.preparation.deliveryLeadTimeDays, "Delivery or service")} · {timing.preparation.feasible === null ? "Whether there is enough time is not confirmed" : timing.preparation.feasible ? "There is enough time based on these inputs" : "There may not be enough time"}</dd></div>
          <div><dt className="font-semibold">Ability to take on the work</dt><dd>{timingCapacityLabel(timing.capacity.status)}. {timing.capacity.basis}</dd></div>
          {timing.assumptions.length ? <div><dt className="font-semibold">Assumptions</dt><dd>{timing.assumptions.join(" · ")}</dd></div> : null}
          {timing.unknowns.length ? <div><dt className="font-semibold">Information not confirmed</dt><dd>{timing.unknowns.join(" · ")}</dd></div> : null}
          {timing.moment.evidence.length ? (
            <div>
              <dt className="font-semibold">Evidence</dt>
              <dd>
                <ul className="mt-1 grid gap-2">
                  {timing.moment.evidence.map((evidence, index) => (
                    <li key={`${evidence.reference}-${index}`} className="rounded-[var(--radius-control)] bg-surface px-2 py-2">
                      <p>{evidence.claim}</p>
                      <p className="mt-1 text-ink-3">
                        {evidence.basis === "owner_reported" ? "Reported by your team" : evidence.basis === "measured" ? "Measured" : "Reported by a source"}
                        {evidence.publishedDate ? ` · Published ${evidence.publishedDate}` : ""}
                        {timing.researchRetrievedAt ? ` · Checked ${timing.researchRetrievedAt.slice(0, 10)}` : ""}
                      </p>
                      {evidence.sourceUrl ? <a href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-8 items-center gap-1 text-brand-800 underline">Open source<ExternalLink aria-hidden className="size-3" /></a> : null}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {timing.geographyEvidenceRef?.startsWith("https://") ? <div><dt className="font-semibold">Geography source</dt><dd><a href={timing.geographyEvidenceRef} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 text-brand-800 underline">Open source<ExternalLink aria-hidden className="size-3" /></a></dd></div> : null}
        </dl>
      </details>
    </section>
  );
}
