"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { ArrowRight, CircleAlert, CircleDollarSign, Filter, PlugZap } from "@/components/icons"
import Link from "next/link";
import { useState } from "react";
import { Button, Callout, LineChart, buttonClasses } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { minorToDisplay } from "../money";
import { AttributionSection, PlatformClaimsSection } from "./AttributionSection";
import { WordHelp } from "@/components/ui/word-help";
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
  visits: "Connect Google Analytics 4",
  signups: "Connect Google Analytics 4",
  paid_conversions: "Connect Stripe or upload revenue",
  revenue: "Connect Stripe or upload revenue",
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
            {longDate(data.from)} – {longDate(data.to)} · {data.currency}
          </p>
        ) : null}
      </div>

      {data === undefined ? (
        <LoadingBlock label="Loading your results…" lines={4} />
      ) : (
        <>
          {data.isDemo ? (
            <Callout tone="info" title="Demo data">
              Synthetic numbers. Connect accounts for yours.
            </Callout>
          ) : null}

          {data.historyLimited ? (
            <Callout tone="info" live="none" title="Last 30 days only">
              Full history needs a package. <Link href={`/app/${slug}/settings/billing`}>See packages</Link>
            </Callout>
          ) : null}

          {data.healthAlerts.length > 0 ? <HealthAlertsSection alerts={data.healthAlerts} /> : null}
          {data.gaps.length > 0 ? <GapsSection slug={slug} gaps={data.gaps} /> : null}

          <OutcomeSection slug={slug} data={data} />
          <FunnelSection slug={slug} data={data} />
          <AttributionSection slug={slug} data={data} />
          <AiReferralsSection data={data} />
          <CohortsSection slug={slug} />
          <PlatformClaimsSection slug={slug} data={data} />
          <ForecastsSection slug={slug} data={data} />
          <ScenarioCalculator currency={data.currency} />
          <WordHelp />
        </>
      )}
    </div>
  );
}

function AiReferralsSection({ data }: { data: Overview }) {
  const referrals = data.aiReferrals;
  return (
    <section aria-labelledby="ai-referrals-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="ai-referrals-heading" className="heading-section">AI assistant referrals</h2>
        <ValueKind kind="observed" />
      </div>
      <p className="text-sm text-ink-2">Visits GA4 attributes to recognized AI assistant websites, with the key events configured in your GA4 property.</p>
      {referrals.providers.length ? (
        <>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-surface-2 p-3"><dt className="text-xs text-ink-3">Sessions</dt><dd className="metric mt-1">{formatNumber(referrals.sessions)}</dd></div>
            <div className="rounded-lg bg-surface-2 p-3"><dt className="text-xs text-ink-3">GA4 key events</dt><dd className="metric mt-1">{formatNumber(referrals.keyEvents)}</dd></div>
          </dl>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-sm"><thead><tr className="border-b border-line text-left text-xs text-ink-3"><th className="px-3 py-2 font-medium">Source</th><th className="px-3 py-2 text-right font-medium">Sessions</th><th className="px-3 py-2 text-right font-medium">Key events</th></tr></thead>
              <tbody>{referrals.providers.map((provider) => <tr key={provider.provider} className="border-b border-line last:border-0"><th scope="row" className="px-3 py-2 text-left font-medium text-ink">{provider.provider}</th><td className="px-3 py-2 text-right tabular-nums">{formatNumber(provider.sessions)}</td><td className="px-3 py-2 text-right tabular-nums">{formatNumber(provider.keyEvents)}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      ) : <p className="rounded-lg bg-surface-2 p-3 text-sm text-ink-2">No sessions from recognized AI assistant source websites were recorded in this period. That does not rule out visits that GA4 labels under another source.</p>}
      <p className="text-xs text-ink-3">{referrals.note}</p>
    </section>
  );
}

/** Possible tracking breaks or unusual days in connected metrics: prompts to check the source, not explanations. */
export function HealthAlertsSection({ alerts }: { alerts: { metric: string; kind: string; date: string; message: string }[] }) {
  return (
    <section aria-labelledby="health-heading" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-amber-300 bg-amber-50 p-4">
      <h2 id="health-heading" className="heading-section text-amber-950">Worth checking before you read these numbers</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-amber-950">
        {alerts.map((a) => <li key={`${a.metric}-${a.kind}-${a.date}`}>{a.message}</li>)}
      </ul>
      <p className="text-xs text-amber-900">Found by comparing each metric with its own recent history. These flags don&apos;t say what caused a change.</p>
    </section>
  );
}

function GapsSection({ slug, gaps }: { slug: string; gaps: Overview["gaps"] }) {
  return (
    <section aria-labelledby="gaps-heading" className="flex flex-col gap-3">
      <h2 id="gaps-heading" className="heading-section flex items-center gap-2">
        <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-brand-800" /> Missing data
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {gaps.map((g) => (
          <li key={g.metric} className="rounded-xl border border-dashed border-line-strong bg-surface p-4">
            <Link
              href={`/app/${slug}/connections`}
              className="flex items-start gap-2 text-sm font-medium text-ink hover:underline"
            >
              <PlugZap aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-800" />
              <span className="flex-1">{g.fix}</span>
              <ArrowRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MetricMeta({ metric }: { metric: OverviewMetric }) {
  return (
    <p className="text-xs text-ink-3">
      {sourceLabel(metric.sourceName, metric.source)} · {freshnessText(metric.freshness)}
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
          <MetricMeta metric={metric} />
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
      <Definition>{metric.definition}</Definition>
    </article>
  );
}

function OutcomeSection({ slug, data }: { slug: string; data: Overview }) {
  const revenue = data.metrics.find((m) => m.key === "revenue");
  const paid = data.metrics.find((m) => m.key === "paid_conversions");
  return (
    <section aria-labelledby="outcome-heading" className="flex flex-col gap-4">
      <h2 id="outcome-heading" className="heading-section flex items-center gap-2">
        <CircleDollarSign aria-hidden="true" className="size-4 shrink-0 text-brand-800" /> Sales and paying customers
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {revenue ? <MetricCard slug={slug} metric={revenue} span={data.span} /> : null}
        {paid ? <MetricCard slug={slug} metric={paid} span={data.span} /> : null}
      </div>
      {revenue?.hasData && revenue.points.length > 1 ? (
        <LineChart
          title="Revenue per day (net)"
          source={`${sourceLabel(revenue.sourceName, revenue.source)} · ${freshnessText(revenue.freshness)} · ${data.currency}`}
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
    if (den.total <= 0) return "—";
    return formatPercent(num.total / den.total);
  };
  const rates = [null, rate(signups, visits), rate(paid, signups)];

  return (
    <section aria-labelledby="funnel-heading" className="flex flex-col gap-4">
      <h2 id="funnel-heading" className="heading-section flex items-center gap-2">
        <Filter aria-hidden="true" className="size-4 shrink-0 text-brand-800" /> From visits to customers
      </h2>
      {!anyData ? (
        <Callout
          tone="info"
          title="No customer-step data yet"
          action={
            <Button variant="secondary" asChild>
              <Link href={`/app/${slug}/connections`}>Connect</Link>
            </Button>
          }
        >
          Needs Google Analytics 4 and billing data.
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
                    {i > 0 ? <>{r ?? "—"} from step {i} · </> : null}
                    {sourceLabel(s.sourceName, s.source)}
                  </p>
                </li>
              );
            })}
          </ol>
          <p className="mt-5 border-t border-line pt-3 text-xs text-ink-3">Rates are approximate: steps come from different systems.</p>
        </div>
      )}
    </section>
  );
}
