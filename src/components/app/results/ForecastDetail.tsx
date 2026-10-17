"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { BacktestResult, HorizonSummary } from "@shared/forecasting";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Callout, DataTable, LineChart, type DataTableColumn } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { formatDateTime } from "../money";
import { ForecastStatusBadge } from "./ForecastsSection";
import { FORECAST_METHOD_LABELS, formatMetric, formatPercent, longDate, shortDate } from "./format";
import { DemoBadge, Definition, ValueKind } from "./Provenance";
import { LoadingBlock } from "./QueryBoundary";

const HISTORY_DAYS_SHOWN = 60;

export function ForecastDetail({ slug, forecastId }: { slug: string; forecastId: string }) {
  const f = useQuery(api.analytics.getForecast, { slug, forecastId: forecastId as Id<"forecastRuns"> });

  const back = (
    <Link href={`/app/${slug}/results`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand-800 underline-offset-4 hover:underline">
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to Results
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

  const unitNote = f.metric.unit === "currency_minor" ? ` Amounts in ${f.currency}.` : "";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        {back}
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {f.metric.label}: next {f.horizonDays} days
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <ForecastStatusBadge status={f.status} />
          <ValueKind kind="projected" />
          <DemoBadge show={f.isFixture} />
        </div>
        <dl className="grid gap-x-6 gap-y-1 text-sm text-ink-2 sm:grid-cols-2">
          <div className="flex gap-1.5">
            <dt className="text-ink-3">Method:</dt>
            <dd>{FORECAST_METHOD_LABELS[f.method] ?? f.method}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-ink-3">Data through:</dt>
            <dd>{f.dataThrough ? longDate(f.dataThrough) : "—"}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-ink-3">History used:</dt>
            <dd>{formatNumber(f.historyDays)} days</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-ink-3">Created:</dt>
            <dd>{formatDateTime(f.createdAt)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-ink-3">Source:</dt>
            <dd>{f.metric.source}</dd>
          </div>
        </dl>
      </div>

      {f.isFixture ? (
        <Callout tone="info" title="Built from demo data">
          This forecast uses synthetic history, so the numbers don&apos;t describe a real business.
        </Callout>
      ) : null}

      {calibrated ? (
        <Callout tone="success" title="Calibrated forecast">
          We tested this method on your past data before showing ranges. The shaded band is the 80% likely range: in testing, real values landed inside ranges like
          this about {cal.heldOutCoverage80 !== null ? formatPercent(cal.heldOutCoverage80, 0) : "80%"} of the time.
        </Callout>
      ) : (
        <Callout tone="warning" title="Not enough evidence for a reliable forecast">
          {cal.reason ?? "There isn't enough history to test how accurate this would be."} The dashed line shows the method&apos;s best guess, but we&apos;re not
          showing a likely range because we can&apos;t back it up yet. More days of data will help.
        </Callout>
      )}

      <section aria-labelledby="chart-heading" className="flex flex-col gap-3">
        <h2 id="chart-heading" className="text-xl font-semibold text-ink">
          History and projection
        </h2>
        <LineChart
          title={`${f.metric.label} per day`}
          description={`Last ${history.length} days observed (solid), then ${f.horizonDays} days projected (dashed)${calibrated ? " with the 80% likely range shaded" : ""}.`}
          source={`Source: ${f.metric.source} · days through ${f.dataThrough ? longDate(f.dataThrough) : "—"}.${unitNote}`}
          points={points}
          valueLabel={f.metric.label}
          categoryLabel="Day"
          format={fmt}
          height={240}
          headingLevel="h3"
        />
        <Definition summary={calibrated ? "All projected values with 80% and 95% ranges" : "All projected values"}>
          <DataTable caption={`Projected ${f.metric.label.toLowerCase()} by day`} hideCaption columns={forecastColumns} rows={f.points} rowKey={(r) => r.date} />
        </Definition>
      </section>

      <section aria-labelledby="read-heading" className="flex flex-col gap-2">
        <h2 id="read-heading" className="text-xl font-semibold text-ink">
          How to read this
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-ink-2">
          <li>The solid line is what really happened (observed). The dashed line is a projection, not a promise.</li>
          {calibrated ? (
            <>
              <li>The 80% range means: if this method keeps behaving as it did on past data, about 8 in 10 future days should land inside it.</li>
              <li>The 95% range is wider and should catch about 19 in 20 days. Use it when being wrong would be costly.</li>
            </>
          ) : (
            <li>Without enough tested history, we don&apos;t show a range. Treat the line as a rough guide only.</li>
          )}
          <li>{f.metric.definition}</li>
          <li>The forecast uses only past numbers. It doesn&apos;t know about upcoming campaigns, holidays or price changes unless they repeat a past pattern.</li>
        </ul>
      </section>

      {f.assumptions.length > 0 || f.warnings.length > 0 ? (
        <section aria-labelledby="assumptions-heading" className="flex flex-col gap-3">
          <h2 id="assumptions-heading" className="text-xl font-semibold text-ink">
            Assumptions and warnings
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
            <ul className="list-disc space-y-1 pl-5 leading-relaxed text-ink-2">
              {f.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <BacktestSection backtest={backtest} fmt={fmt} />

      <section aria-labelledby="coverage-heading" className="flex flex-col gap-2">
        <h2 id="coverage-heading" className="text-xl font-semibold text-ink">
          Held-out check
        </h2>
        {cal.heldOutCount > 0 && (cal.heldOutCoverage80 !== null || cal.heldOutCoverage95 !== null) ? (
          <>
            <p className="leading-relaxed text-ink-2">
              We hid the most recent {formatNumber(cal.heldOutCount)} predictions from the calibration and checked how often the real value fell inside the range.
            </p>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--radius)] border border-line bg-surface p-4">
                <dt className="text-sm text-ink-2">80% range contained the actual value</dt>
                <dd className="tracking-tight text-2xl font-extrabold tabular-nums text-ink">
                  {cal.heldOutCoverage80 !== null ? formatPercent(cal.heldOutCoverage80) : "—"}
                </dd>
                <dd className="text-sm text-ink-3">Target: 80%</dd>
              </div>
              <div className="rounded-[var(--radius)] border border-line bg-surface p-4">
                <dt className="text-sm text-ink-2">95% range contained the actual value</dt>
                <dd className="tracking-tight text-2xl font-extrabold tabular-nums text-ink">
                  {cal.heldOutCoverage95 !== null ? formatPercent(cal.heldOutCoverage95) : "—"}
                </dd>
                <dd className="text-sm text-ink-3">Target: 95%</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="text-ink-2">{cal.reason ?? "Not enough history to hold any days back for checking yet."}</p>
        )}
        {cal.residualCounts.length > 0 ? (
          <Definition summary="Technical details">
            <p>Past errors available per forecast step bucket: {cal.residualCounts.map((c) => formatNumber(c)).join(", ")}.</p>
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
    { key: "origins", header: "Test runs", align: "right", cell: (r) => formatNumber(r.origins) },
    { key: "mae", header: "Avg. error (MAE)", align: "right", cell: (r) => (r.mae === null ? "—" : fmt(r.mae)) },
    { key: "wape", header: "Error % (WAPE)", align: "right", cell: (r) => wapeText(r.wape) },
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
              ? "Ties (same method)"
              : "No",
    },
  ];
  const reasons = backtest ? [...new Set(backtest.byHorizon.flatMap((h) => [h.wape.reason, h.baseline.wape.reason]).filter((r): r is string => Boolean(r)))] : [];
  return (
    <section aria-labelledby="backtest-heading" className="flex flex-col gap-3">
      <h2 id="backtest-heading" className="text-xl font-semibold text-ink">
        How accurate was this method on past data?
      </h2>
      {!backtest ? (
        <p className="text-ink-2">No backtest yet — there isn&apos;t enough history to test the method on past days.</p>
      ) : (
        <>
          <p className="leading-relaxed text-ink-2">
            We pretended to stand at {formatNumber(backtest.originDates.length)} past dates, forecast forward using only what was known then, and compared with what
            really happened. The baseline is &ldquo;same weekday last week&rdquo; (seasonal naive), scored on exactly the same days.
          </p>
          <DataTable caption="Backtest accuracy by forecast length, compared with the seasonal-naive baseline" columns={columns} rows={backtest.byHorizon} rowKey={(r) => String(r.horizon)} />
          {reasons.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-ink-3">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
          <Definition summary="What MAE and WAPE mean">
            <p>
              <strong>MAE</strong> (mean absolute error) is the average size of a daily miss, in the metric&apos;s own units. <strong>WAPE</strong> (weighted
              absolute percentage error) is total misses divided by the total actual value. Lower is better for both.
            </p>
          </Definition>
        </>
      )}
    </section>
  );
}
