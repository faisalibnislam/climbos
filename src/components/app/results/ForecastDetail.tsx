"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { BacktestResult, HorizonSummary } from "@shared/forecasting";
import { ArrowLeft, ChartLine, ClipboardList, History, ShieldCheck } from "@/components/icons"
import Link from "next/link";
import { Callout, DataTable, LineChart, Stat, StatGroup, buttonClasses, type DataTableColumn } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { ForecastStatusBadge } from "./ForecastsSection";
import { FORECAST_METHOD_LABELS, formatMetric, formatPercent, longDate, shortDate } from "./format";
import { DemoBadge, Definition, ValueKind } from "./Provenance";
import { LoadingBlock } from "./QueryBoundary";
import { Scannable } from "@/components/ds/content";

const HISTORY_DAYS_SHOWN = 60;

/** Items as list lines, so Scannable keeps one bullet per item. */
const asList = (items: string[]) => (items.length === 1 ? items[0] : items.map((a) => `- ${a.replace(/\s*\n+\s*/g, " ")}`).join("\n"));

export function ForecastDetail({ slug, forecastId }: { slug: string; forecastId: string }) {
  const f = useQuery(api.analytics.getForecast, { slug, forecastId: forecastId as Id<"forecastRuns"> });

  const back = (
    <Link href={`/app/${slug}/results`} className={buttonClasses({ variant: "ghost", size: "sm", className: "-ml-2.5 self-start text-ink-2" })}>
      <ArrowLeft aria-hidden="true" />
      Results
    </Link>
  );

  if (f === undefined) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        {back}
        <LoadingBlock label="Loading forecast…" lines={4} className="mt-4" />
      </div>
    );
  }

  const calibrated = f.status === "calibrated";
  const fmt = (n: number) => formatMetric(n, f.metric.unit, f.currency);
  const history = f.history.slice(-HISTORY_DAYS_SHOWN);
  const points = [
    ...history.map((p) => ({ x: shortDate(p.date), y: p.value })),
    ...f.points.map((p) => ({
      x: shortDate(p.date),
      y: p.value,
      projected: true,
      ...(calibrated && p.lo80 !== undefined && p.hi80 !== undefined ? { low: p.lo80, high: p.hi80 } : {}),
    })),
  ];
  const backtest = f.backtest as BacktestResult | null;
  const cal = f.calibration;

  type Row = (typeof f.points)[number];
  const forecastColumns: DataTableColumn<Row>[] = [
    { key: "date", header: "Date", rowHeader: true, cell: (r) => longDate(r.date) },
    { key: "value", header: "Projected value", align: "right", cell: (r) => fmt(r.value) },
    ...(calibrated
      ? ([
          { key: "r80", header: "80% range", align: "right", cell: (r: Row) => (r.lo80 !== undefined && r.hi80 !== undefined ? `${fmt(r.lo80)} – ${fmt(r.hi80)}` : "—") },
          { key: "r95", header: "95% range", align: "right", cell: (r: Row) => (r.lo95 !== undefined && r.hi95 !== undefined ? `${fmt(r.lo95)} – ${fmt(r.hi95)}` : "—") },
        ] as DataTableColumn<Row>[])
      : []),
  ];

  const unitNote = f.metric.unit === "currency_minor" ? ` · ${f.currency}` : "";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        {back}
        <h1 className="heading-page">
          {f.metric.label}: next {f.horizonDays} days
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <ForecastStatusBadge status={f.status} />
          <ValueKind kind="projected" />
          <DemoBadge show={f.isFixture} />
        </div>
        <dl className="grid gap-x-6 gap-y-1 text-ui text-ink-2 sm:grid-cols-2">
          <div className="flex gap-1.5">
            <dt className="text-ink-3">Method:</dt>
            <dd>{FORECAST_METHOD_LABELS[f.method] ?? f.method}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-ink-3">Data through:</dt>
            <dd>{f.dataThrough ? longDate(f.dataThrough) : "—"}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-ink-3">History:</dt>
            <dd>{formatNumber(f.historyDays)} days</dd>
          </div>
        </dl>
      </div>

      {f.isFixture ? (
        <Callout tone="info" title="Built from demo data" />
      ) : null}

      {calibrated ? (
        <Callout tone="success" title="Calibrated forecast">
          In tests, {cal.heldOutCoverage80 !== null ? formatPercent(cal.heldOutCoverage80, 0) : "about 80%"} landed in the shaded 80% range.
        </Callout>
      ) : (
        <Callout tone="warning" title="Not enough evidence for a range">
          {cal.reason ?? "Too little history to test accuracy."} More data will help.
        </Callout>
      )}

      <section aria-labelledby="chart-heading" className="flex flex-col gap-3">
        <h2 id="chart-heading" className="heading-section flex items-center gap-2">
          <ChartLine aria-hidden="true" className="size-4 shrink-0 text-brand-800" /> History and projection
        </h2>
        <LineChart
          title={`${f.metric.label} per day`}
          description={`Solid: observed · dashed: projected${calibrated ? " · shaded: 80% range" : ""}`}
          source={`${f.metric.source}${unitNote}`}
          points={points}
          valueLabel={f.metric.label}
          categoryLabel="Day"
          format={fmt}
          height={240}
          headingLevel="h3"
        />
        <Definition summary="All projected values">
          <DataTable caption={`Projected ${f.metric.label.toLowerCase()} by day`} hideCaption columns={forecastColumns} rows={f.points} rowKey={(r) => r.date} />
        </Definition>
      </section>

      <Definition summary="How to read this">
        <ul className="list-disc space-y-1 pl-5">
          <li>Projection, not a promise.</li>
          {calibrated ? <li>80% range: ~8 in 10 days land inside. 95%: ~19 in 20.</li> : <li>No range: treat the line as a rough guide.</li>}
          <li>{f.metric.definition}</li>
          <li>Uses past numbers only: no upcoming campaigns, holidays or price changes.</li>
        </ul>
      </Definition>

      {f.assumptions.length > 0 || f.warnings.length > 0 ? (
        <section aria-labelledby="assumptions-heading" className="flex flex-col gap-3">
          <h2 id="assumptions-heading" className="heading-section flex items-center gap-2">
            <ClipboardList aria-hidden="true" className="size-4 shrink-0 text-brand-800" /> Assumptions
          </h2>
          {f.warnings.length > 0 ? (
            <Callout tone="warning" title="Warnings">
              <ul className="list-disc space-y-1 pl-5">
                {f.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Callout>
          ) : null}
          {f.assumptions.length > 0 ? (
            <Scannable text={asList(f.assumptions)} shape="bullets" max={5} tone="muted" />
          ) : null}
        </section>
      ) : null}

      <BacktestSection backtest={backtest} fmt={fmt} />

      <section aria-labelledby="coverage-heading" className="flex flex-col gap-3">
        <h2 id="coverage-heading" className="heading-section flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-brand-800" /> Held-out check
        </h2>
        {cal.heldOutCount > 0 && (cal.heldOutCoverage80 !== null || cal.heldOutCoverage95 !== null) ? (
          <>
            <p className="text-sm text-ink-2">Last {formatNumber(cal.heldOutCount)} predictions, held back from calibration.</p>
            <StatGroup className="lg:grid-cols-2">
              <Stat
                label="Inside 80% range"
                value={cal.heldOutCoverage80 !== null ? formatPercent(cal.heldOutCoverage80) : "—"}
                sublabel="Target 80%"
              />
              <Stat
                label="Inside 95% range"
                value={cal.heldOutCoverage95 !== null ? formatPercent(cal.heldOutCoverage95) : "—"}
                sublabel="Target 95%"
              />
            </StatGroup>
          </>
        ) : (
          <p className="text-sm text-ink-2">{cal.reason ?? "Not enough history yet."}</p>
        )}
        {cal.residualCounts.length > 0 ? (
          <Definition summary="Technical details">
            <p>Past errors per step bucket: {cal.residualCounts.map((c) => formatNumber(c)).join(", ")}</p>
          </Definition>
        ) : null}
      </section>
    </div>
  );
}

function wapeText(w: HorizonSummary["wape"]): string {
  return w.value === null ? "—" : formatPercent(w.value);
}

function BacktestSection({ backtest, fmt }: { backtest: BacktestResult | null; fmt: (n: number) => string }) {
  const columns: DataTableColumn<HorizonSummary>[] = [
    { key: "horizon", header: "Days ahead", rowHeader: true, cell: (r) => `${r.horizon} days` },
    { key: "origins", header: "Tests", align: "right", cell: (r) => formatNumber(r.origins) },
    { key: "mae", header: "MAE", align: "right", cell: (r) => (r.mae === null ? "—" : fmt(r.mae)) },
    { key: "wape", header: "WAPE", align: "right", cell: (r) => wapeText(r.wape) },
    { key: "bmae", header: "Baseline MAE", align: "right", cell: (r) => (r.baseline.mae === null ? "—" : fmt(r.baseline.mae)) },
    { key: "bwape", header: "Baseline WAPE", align: "right", cell: (r) => wapeText(r.baseline.wape) },
    {
      key: "beats",
      header: "Beats baseline?",
      cell: (r) =>
        r.beatsBaseline === null
          ? "Not tested"
          : r.beatsBaseline
            ? "Yes"
            : r.mae !== null && r.baseline.mae !== null && Math.abs(r.mae - r.baseline.mae) < 1e-9
              ? "Tie"
              : "No",
    },
  ];
  const reasons = backtest ? [...new Set(backtest.byHorizon.flatMap((h) => [h.wape.reason, h.baseline.wape.reason]).filter((r): r is string => Boolean(r)))] : [];
  return (
    <section aria-labelledby="backtest-heading" className="flex flex-col gap-3">
      <h2 id="backtest-heading" className="heading-section flex items-center gap-2">
        <History aria-hidden="true" className="size-4 shrink-0 text-brand-800" /> Backtest accuracy
      </h2>
      {!backtest ? (
        <p className="text-sm text-ink-2">No backtest yet: not enough history.</p>
      ) : (
        <>
          <p className="text-sm text-ink-2">
            {formatNumber(backtest.originDates.length)} past start dates. Baseline: same weekday last week.
          </p>
          <DataTable caption="Backtest accuracy by days ahead vs the seasonal-naive baseline" columns={columns} rows={backtest.byHorizon} rowKey={(r) => String(r.horizon)} />
          {reasons.length > 0 ? (
            <ul className="list-disc pl-5 text-xs text-ink-3">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
          <Definition summary="What MAE and WAPE mean">
            <p>
              <strong className="font-semibold">MAE</strong>: average daily miss, in the metric&apos;s units. <strong className="font-semibold">WAPE</strong>: total misses ÷ total actual. Lower is better.
            </p>
          </Definition>
        </>
      )}
    </section>
  );
}
