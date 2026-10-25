import Link from "next/link";
import { ArrowRight, BarChart3 } from "@/components/icons";
import { Badge, buttonClasses } from "@/components/ui";
import { formatNumber } from "@/lib/utils";

type Snapshot = {
  from: string;
  to: string;
  timezone: string;
  metrics: {
    key: "visits" | "signups";
    label: string;
    definition: string;
    hasData: boolean;
    total: number;
    recordedDays: number;
    sourceName: string | null;
    freshness: number | null;
    isFixture: boolean;
  }[];
};

function updatedDate(timestamp: number | null): string | null {
  if (!timestamp || !Number.isFinite(timestamp)) return null;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(timestamp));
}

/** A compact, source-labeled view of recorded analytics. No records are not shown as zero. */
export function HomeBusinessSnapshot({ slug, snapshot }: { slug: string; snapshot: Snapshot | null | undefined }) {
  if (snapshot === undefined) {
    return <section aria-label="Business snapshot" aria-busy="true" className="h-40 animate-pulse rounded-xl border border-line bg-surface" />;
  }

  const hasAnyData = Boolean(snapshot?.metrics.some((metric) => metric.hasData));
  return (
    <section aria-labelledby="business-snapshot-heading" className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="business-snapshot-heading" className="heading-section flex items-center gap-2">
            <BarChart3 aria-hidden="true" className="size-4 text-brand-800" /> Business snapshot
          </h2>
          <p className="mt-1 text-xs text-ink-3">Recorded website activity · {snapshot ? `${snapshot.from} to ${snapshot.to} (${snapshot.timezone})` : "last 30 complete days"}</p>
        </div>
        <Link href={`/app/${slug}/results`} className={buttonClasses({ variant: "link" })}>See results <ArrowRight aria-hidden="true" /></Link>
      </div>

      {!hasAnyData ? (
        <div className="mt-4 rounded-lg border border-dashed border-line-strong px-4 py-3">
          <p className="text-sm font-medium text-ink">No website activity data recorded yet</p>
          <p className="mt-1 text-sm text-ink-3">Connect Google Analytics 4 to see visits and sign-ups here. No data is different from zero.</p>
          <Link href={`/app/${slug}/connections`} className={`${buttonClasses({ variant: "link" })} mt-2`}>Connect analytics <ArrowRight aria-hidden="true" /></Link>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {snapshot?.metrics.map((metric) => (
            <article key={metric.key} className="rounded-lg border border-line px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium text-ink">{metric.label}</h3>
                {metric.isFixture ? <Badge tone="neutral">Demo data</Badge> : <Badge tone="blue">Recorded</Badge>}
              </div>
              {metric.hasData ? (
                <>
                  <p className="metric mt-1">{formatNumber(metric.total)}</p>
                  <p className="mt-1 text-xs text-ink-3">
                    {metric.sourceName ?? "Source not recorded"} · data in {metric.recordedDays} reported {metric.recordedDays === 1 ? "day" : "days"}
                    {updatedDate(metric.freshness) ? ` · last updated ${updatedDate(metric.freshness)}` : ""}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-3">No data recorded for this measure.</p>
              )}
              <p className="mt-2 text-xs text-ink-3">{metric.definition}</p>
            </article>
          ))}
        </div>
      )}
      {hasAnyData ? <p className="mt-3 text-xs text-ink-3">Visits and sign-ups are recorded activity, not proof that a campaign caused a change or produced revenue.</p> : null}
    </section>
  );
}
