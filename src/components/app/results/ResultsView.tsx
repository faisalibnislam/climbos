"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { ArrowRight, PlugZap } from "@/components/icons"
import Link from "next/link";
import { useState } from "react";
import { Button, Callout, LineChart, buttonClasses } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { minorToDisplay } from "../money";
import { AttributionSection, PlatformClaimsSection } from "./AttributionSection";
import { CohortsSection } from "./CohortsSection";
import { ForecastsSection } from "./ForecastsSection";
import { changeText, formatMetric, formatPercent, freshnessText, longDate, shortDate, sourceLabel } from "./format";
import { DemoBadge, Definition, ValueKind } from "./Provenance";
import { LoadingBlock, PageHeader } from "./QueryBoundary";
import { ScenarioCalculator } from "./ScenarioCalculator";
import { Segmented } from "@/components/ui/segmented";

export type Overview = FunctionReturnType<typeof api.analytics.overview>;
export type OverviewMetric = Overview["metrics"][number];

const PERIODS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
] as const;

/** Which connection fills which metric (used for "Connect X to see Y"). */
const METRIC_NEEDS: Record<string, string> = {
  visits: "Connect Google Analytics 4 to see website visits",
  signups: "Connect Google Analytics 4 to see sign-ups",
  paid_conversions: "Connect Stripe (read-only) or upload a revenue file to see paying customers",
  revenue: "Connect Stripe (read-only) or upload a revenue file to see revenue",
};

export function ResultsView({ slug }: { slug: string }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const data = useQuery(api.analytics.overview, { slug, days });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div>
        <PageHeader
          section="results"
          title="Results"
          intro="What happened in your business, where it came from, and what might come next. Every number says where it came from and how fresh it is."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/app/${slug}/results/week`} className="text-sm font-medium text-brand-800 underline-offset-2 hover:underline">
                Weekly report
              </Link>
              <Segmented label="Time period" options={[...PERIODS]} value={days} onChange={(v) => setDays(v)} />
            </div>
          }
        />
        {data ? (
          <p className="-mt-3 text-xs text-ink-3">
            {longDate(data.from)} – {longDate(data.to)} · Days in {data.timezone} · Money in {data.currency}
          </p>
        ) : null}
      </div>

      {data === undefined ? (
        <LoadingBlock label="Loading your results…" lines={4} />
      ) : (
        <>
          {data.isDemo ? (
            <Callout tone="info" title="You're looking at demo data">
              Every number on this page is synthetic, so you can see how Results works before connecting your own accounts.
            </Callout>
          ) : null}

          {data.historyLimited ? (
            <Callout tone="info" live="none" title="Showing the last 30 days">
              Full history and period-over-period comparisons come with a package. <Link href={`/app/${slug}/settings/billing`}>See packages</Link>
            </Callout>
          ) : null}

          {data.gaps.length > 0 ? <GapsSection slug={slug} gaps={data.gaps} /> : null}

          <OutcomeSection slug={slug} data={data} />
          <FunnelSection slug={slug} data={data} />
          <AttributionSection slug={slug} data={data} />
          <CohortsSection slug={slug} />
          <PlatformClaimsSection slug={slug} data={data} />
          <ForecastsSection slug={slug} data={data} />
          <ScenarioCalculator currency={data.currency} />
        </>
      )}
    </div>
  );
}

function GapsSection({ slug, gaps }: { slug: string; gaps: Overview["gaps"] }) {
  return (
    <section aria-labelledby="gaps-heading" className="flex flex-col gap-3">
      <h2 id="gaps-heading" className="heading-section">
        Missing data
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {gaps.map((g) => (
          <li key={g.metric} className="flex flex-col gap-2 rounded-xl border border-dashed border-line-strong bg-surface p-4">
            <p className="flex items-start gap-2 text-sm font-medium text-ink">
              <PlugZap aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-800" />
              <span>{g.fix}</span>
            </p>
            <p className="text-ui text-ink-3">{g.message}</p>
            <Link
              href={`/app/${slug}/connections`}
              className={buttonClasses({ variant: "link", className: "mt-auto self-start pt-1" })}
            >
              Go to Connections
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MetricMeta({ metric, showCurrency }: { metric: OverviewMetric; showCurrency?: boolean }) {
  return (
    <p className="text-xs text-ink-3">
      From {sourceLabel(metric.sourceName, metric.source)} · {freshnessText(metric.freshness)} · days in {metric.timezone}
      {showCurrency && metric.currency ? ` · ${metric.currency}` : ""}
    </p>
  );
}

function MetricCard({ slug, metric, span }: { slug: string; metric: OverviewMetric; span: number }) {
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="heading-card">{metric.label}</h3>
        <ValueKind kind="observed" />
        <DemoBadge show={metric.isFixture} />
      </div>
      {metric.hasData ? (
        <>
          <p className="metric">
            {formatMetric(metric.total, metric.unit, metric.currency)}
          </p>
          <p className="text-ui font-medium text-ink-2">{changeText(metric.total, metric.previousTotal, span)}</p>
          {metric.previousTotal !== null ? (
            <p className="text-xs text-ink-3">Previous {span} days: {formatMetric(metric.previousTotal, metric.unit, metric.currency)}</p>
          ) : null}
          <MetricMeta metric={metric} showCurrency />
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink-2">No data yet</p>
          <Link href={`/app/${slug}/connections`} className={buttonClasses({ variant: "link", className: "self-start whitespace-normal text-left" })}>
            {METRIC_NEEDS[metric.key] ?? "Connect a data source"}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      )}
      <Definition>
        <p>{metric.definition}</p>
        <p className="mt-1">Source system: {metric.source}.</p>
      </Definition>
    </article>
  );
}

function OutcomeSection({ slug, data }: { slug: string; data: Overview }) {
  const revenue = data.metrics.find((m) => m.key === "revenue");
  const paid = data.metrics.find((m) => m.key === "paid_conversions");
  return (
    <section aria-labelledby="outcome-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="outcome-heading" className="heading-section">
          Business outcome
        </h2>
        <p className="mt-0.5 text-sm text-ink-3">Money in and new customers, straight from your billing data.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {revenue ? <MetricCard slug={slug} metric={revenue} span={data.span} /> : null}
        {paid ? <MetricCard slug={slug} metric={paid} span={data.span} /> : null}
      </div>
      {revenue?.hasData && revenue.points.length > 1 ? (
        <LineChart
          title="Revenue per day (net of refunds)"
          description={`Observed daily revenue for the last ${data.span} days.`}
          source={`Source: ${sourceLabel(revenue.sourceName, revenue.source)} · ${freshnessText(revenue.freshness)} · ${data.currency} · days in ${data.timezone}`}
          points={revenue.points.map((p) => ({ x: shortDate(p.date), y: p.value }))}
          valueLabel="Revenue (net)"
          categoryLabel="Day"
          format={(n) => minorToDisplay(Math.round(n), data.currency)}
          headingLevel="h3"
        />
      ) : null}
    </section>
  );
}

function FunnelSection({ slug, data }: { slug: string; data: Overview }) {
  const get = (k: string) => data.metrics.find((m) => m.key === k);
  const visits = get("visits");
  const signups = get("signups");
  const paid = get("paid_conversions");
  const steps = [visits, signups, paid].filter((m): m is OverviewMetric => Boolean(m));
  const anyData = steps.some((s) => s.hasData);
  const maxVal = Math.max(1, ...steps.map((s) => (s.hasData ? s.total : 0)));

  const rate = (num?: OverviewMetric, den?: OverviewMetric) => {
    if (!num?.hasData || !den?.hasData) return null;
    if (den.total <= 0) return { text: "—", detail: `No ${den.label.toLowerCase()} to divide by` };
    return { text: formatPercent(num.total / den.total), detail: `${formatNumber(Math.round(num.total))} of ${formatNumber(Math.round(den.total))} ${den.label.toLowerCase()}` };
  };
  const rates = [null, rate(signups, visits), rate(paid, signups)];

  return (
    <section aria-labelledby="funnel-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="funnel-heading" className="heading-section">
          From visit to paying customer
        </h2>
        <p className="mt-0.5 text-sm text-ink-3">How many people moved through each step in the last {data.span} days.</p>
      </div>
      {!anyData ? (
        <Callout
          tone="info"
          title="No funnel data yet"
          action={
            <Button variant="secondary" asChild>
              <Link href={`/app/${slug}/connections`}>Go to Connections</Link>
            </Button>
          }
        >
          Connect Google Analytics 4 for visits and sign-ups, and your billing data for paying customers.
        </Callout>
      ) : (
        <div className="rounded-xl border border-line bg-surface p-5">
          <ol className="flex flex-col gap-5">
            {steps.map((s, i) => {
              const r = rates[i];
              return (
                <li key={s.key} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-900">
                        {i + 1}
                      </span>
                      {s.label}
                    </span>
                    <span className="metric">
                      {s.hasData ? formatNumber(Math.round(s.total)) : "No data"}
                    </span>
                  </div>
                  <div aria-hidden="true" className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-brand-700" style={{ width: `${s.hasData ? Math.max(1, (s.total / maxVal) * 100) : 0}%` }} />
                  </div>
                  <p className="text-xs text-ink-3">
                    {i > 0 ? (r ? <>Step rate {r.text} ({r.detail}) · </> : <>Step rate unavailable — needs data for both steps · </>) : null}
                    From {sourceLabel(s.sourceName, s.source)} · {freshnessText(s.freshness)}
                  </p>
                </li>
              );
            })}
          </ol>
          <p className="mt-5 border-t border-line pt-3 text-xs text-ink-3">
            All values are observed. Visits and sign-ups come from your analytics; paying customers come from billing. Because they are counted by different
            systems, step rates are approximate — not every paying customer is tracked back to a visit.
          </p>
        </div>
      )}
    </section>
  );
}
