import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import { Badge, buttonClasses } from "@/components/ui";
import type { TodayTargetPreview } from "@convex/targets";

const STATUS: Record<TodayTargetPreview["status"], { label: string; tone: "blue" | "green" | "red"; summary: string }> = {
  researching: { label: "In progress", tone: "blue", summary: "Now looking for possible matches." },
  review: { label: "Ready to review", tone: "green", summary: "Open your plan to see results and evidence." },
  failed: { label: "Search stopped", tone: "red", summary: "Didn't finish. Retry from your plan." },
};

/** Compact, read-only Home glimpse; the plan remains the full evidence and review surface. */
export function TodayTargetPreviewCard({ slug, preview }: { slug: string; preview: TodayTargetPreview | null }) {
  if (!preview) return null;
  const status = STATUS[preview.status];
  const isCreatorSearch = preview.kind === "creators";
  const kind = isCreatorSearch ? "creator profiles" : "businesses";
  const title = isCreatorSearch ? "Possible creator partners" : "Possible customers";
  const evidenceNote = isCreatorSearch
    ? "From public research, not confirmed partners. Check fit before contacting. Nothing is sent from Home."
    : "From public research, not confirmed customers. Check fit before contacting. Nothing is sent from Home.";

  return (
    <section aria-labelledby="today-targets-heading" className="rounded-xl border border-line bg-surface p-4 shadow-[var(--card-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="today-targets-heading" className="heading-card">{title}</h2>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="mt-1 text-xs text-ink-3">From your plan: {preview.playName}</p>
      <p className="mt-2 text-sm text-ink-2">{status.summary}</p>
      {preview.matches.length ? (
        <>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {preview.matches.map((match) => <li key={match.id} className="px-3 py-2 text-sm font-medium text-ink">{match.name}</li>)}
          </ul>
          {preview.hasMore ? <p className="mt-2 text-xs text-ink-3">More {kind} are listed in your plan.</p> : null}
          <p className="mt-2 text-xs text-ink-3">{evidenceNote}</p>
        </>
      ) : null}
      <Link href={`/app/${slug}/plan#plays`} className={`${buttonClasses({ variant: "link" })} mt-3`}>
        Review in your plan <ArrowRight aria-hidden />
      </Link>
    </section>
  );
}
