import type { DealAttention } from "@shared/growth/pipeline";

/** Review prompts on a pipeline card: an overdue next step, or no stage change for a while. Unknown stage age shows nothing. */
export function DealAttentionBadges({ attention }: { attention: DealAttention }) {
  if (!attention.overdue && attention.stalledDays === null) return null;
  return (
    <>
      {attention.overdue ? <span className="rounded-[var(--radius-badge)] bg-amber-100 px-1.5 font-medium text-amber-800">Next step overdue</span> : null}
      {attention.stalledDays !== null ? <span className="rounded-[var(--radius-badge)] bg-surface-2 px-1.5 text-ink-2">No stage change in {attention.stalledDays} days</span> : null}
    </>
  );
}
