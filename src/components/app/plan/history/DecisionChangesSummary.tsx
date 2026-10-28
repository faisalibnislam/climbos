import type { DecisionChange } from "./parts";

/** Compact, plain-language overview shown before the full plan text diff. */
export function DecisionChangesSummary({ changes, beforeLabel, afterLabel }: { changes: DecisionChange[] | null; beforeLabel: string; afterLabel: string }) {
  return (
    <section aria-labelledby="decision-changes-heading" className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <h3 id="decision-changes-heading" className="heading-card">What changed in the recommendation?</h3>
      <p className="mt-1 text-xs text-ink-3">Customer ranges are scenarios, not actual results.</p>
      {changes === null ? (
        <p className="mt-3 text-sm text-ink-2">No saved details for one version. See the full comparison below.</p>
      ) : changes.length ? (
        <ul className="mt-3 flex flex-col divide-y divide-line">
          {changes.map((change) => (
            <li key={change.key} className="grid gap-2 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(9rem,0.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <p className="text-sm font-medium text-ink">{change.label}</p>
              <div><p className="text-overline text-ink-3">Before · {beforeLabel}</p><p className="mt-1 whitespace-pre-wrap text-sm text-ink-2">{change.before}</p></div>
              <div><p className="text-overline text-ink-3">After · {afterLabel}</p><p className="mt-1 whitespace-pre-wrap text-sm text-ink-2">{change.after}</p></div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-2">No changes to plays, channels, or customer groups. The text may still differ below.</p>
      )}
    </section>
  );
}
