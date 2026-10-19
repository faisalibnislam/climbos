"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { BacktestResult, HorizonSummary } from "@shared/forecasting";
import { ArrowLeft } from "@/components/icons"
import Link from "next/link";
import { Callout, DataTable, LineChart, Stat, StatGroup, buttonClasses, type DataTableColumn } from "@/components/ui";
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
    <Link href={`/app/${slug}/results`} className={buttonClasses({ variant: "ghost", size: "sm", className: "-ml-2.5 self-start text-ink-2" })}>
      <ArrowLeft aria-hidden="true" />
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
        <h2 id="chart-heading" className="heading-section">
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

      <section aria-labelledby="read-heading" className="flex flex-col gap-3">
        <h2 id="read-heading" className="heading-section">
          How to read this
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
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
          <h2 id="assumptions-heading" className="heading-section">
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
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
              {f.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <BacktestSection backtest={backtest} fmt={fmt} />

      <section aria-labelledby="coverage-heading" className="flex flex-col gap-3">
        <h2 id="coverage-heading" className="heading-section">
          Held-out check
        </h2>
        {cal.heldOutCount > 0 && (cal.heldOutCoverage80 !== null || cal.heldOutCoverage95 !== null) ? (
          <>
            <p className="text-sm text-ink-2">
              We hid the most recent {formatNumber(cal.heldOutCount)} predictions from the calibration and checked how often the real value fell inside the range.
            </p>
            <StatGroup className="lg:grid-cols-2">
              <Stat
                label="80% range contained the actual value"
                value={cal.heldOutCoverage80 !== null ? formatPercent(cal.heldOutCoverage80) : "—"}
                sublabel="Target: 80%"
              />
              <Stat
                label="95% range contained the actual value"
                value={cal.heldOutCoverage95 !== null ? formatPercent(cal.heldOutCoverage95) : "—"}
                sublabel="Target: 95%"
              />
            </StatGroup>
          </>
        ) : (
          <p className="text-sm text-ink-2">{cal.reason ?? "Not enough history to hold any days back for checking yet."}</p>
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
      <h2 id="backtest-heading" className="heading-section">
        How accurate was this method on past data?
      </h2>
      {!backtest ? (
        <p className="text-sm text-ink-2">No backtest yet — there isn&apos;t enough history to test the method on past days.</p>
      ) : (
        <>
          <p className="text-sm text-ink-2">
            We pretended to stand at {formatNumber(backtest.originDates.length)} past dates, forecast forward using only what was known then, and compared with what
            really happened. The baseline is &ldquo;same weekday last week&rdquo; (seasonal naive), scored on exactly the same days.
          </p>
          <DataTable caption="Backtest accuracy by forecast length, compared with the seasonal-naive baseline" columns={columns} rows={backtest.byHorizon} rowKey={(r) => String(r.horizon)} />
          {reasons.length > 0 ? (
            <ul className="list-disc pl-5 text-xs text-ink-3">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
          <Definition summary="What MAE and WAPE mean">
            <p>
              <strong className="font-semibold">MAE</strong> (mean absolute error) is the average size of a daily miss, in the metric&apos;s own units. <strong className="font-semibold">WAPE</strong> (weighted
              absolute percentage error) is total misses divided by the total actual value. Lower is better for both.
            </p>
          </Definition>
        </>
      )}
    </section>
  );
}
