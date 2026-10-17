"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { ArrowRight, CircleCheck, CircleHelp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Badge, Button, Callout, Field, Select } from "@/components/ui";
import { errorMessage } from "../errors";
import { relativeTime } from "../money";
import { METRIC_LABELS } from "./format";
import { DemoBadge, ValueKind } from "./Provenance";
import type { Overview } from "./ResultsView";

type MetricKey = "visits" | "signups" | "paid_conversions" | "revenue";

export function ForecastStatusBadge({ status }: { status: string }) {
  return status === "calibrated" ? (
    <Badge tone="green" icon={<CircleCheck />}>
      Calibrated
    </Badge>
  ) : (
    <Badge tone="amber" icon={<CircleHelp />}>
      Not enough evidence
    </Badge>
  );
}

export function ForecastsSection({ slug, data }: { slug: string; data: Overview }) {
  const router = useRouter();
  const create = useMutation(api.analytics.createForecast);
  const [metricKey, setMetricKey] = useState<MetricKey>("revenue");
  const [horizon, setHorizon] = useState<"7" | "30" | "90">("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasData = (k: string) => data.metrics.find((m) => m.key === k)?.hasData ?? false;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = await create({ slug, metricKey, horizonDays: Number(horizon) });
      router.push(`/app/${slug}/results/forecasts/${id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="forecasts-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="forecasts-heading" className="flex flex-wrap items-center gap-2 text-xl font-semibold text-ink">
          Forecasts <ValueKind kind="projected" />
        </h2>
        <p className="mt-1 text-ink-2">
          Statistical projections from your own history. Every forecast is tested against past data first; if the test isn&apos;t convincing, we say so instead of
          showing a range.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-line bg-surface p-5" aria-describedby="new-forecast-hint">
        <h3 className="font-semibold text-ink">New forecast</h3>
        <p id="new-forecast-hint" className="-mt-2 text-sm text-ink-3">
          Uses all the daily history we have for that number. It takes a few seconds and costs nothing.
        </p>
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <Field label="What to forecast">
            <Select
              value={metricKey}
              onValueChange={(v) => setMetricKey(v as MetricKey)}
              options={(Object.keys(METRIC_LABELS) as MetricKey[]).map((k) => ({
                value: k,
                label: hasData(k) ? METRIC_LABELS[k] : `${METRIC_LABELS[k]} (no data yet)`,
              }))}
            />
          </Field>
          <Field label="How far ahead">
            <Select
              value={horizon}
              onValueChange={(v) => setHorizon(v as "7" | "30" | "90")}
              options={[
                { value: "7", label: "Next 7 days" },
                { value: "30", label: "Next 30 days" },
                { value: "90", label: "Next 90 days" },
              ]}
            />
          </Field>
          <Button type="submit" loading={busy} loadingText="Creating…">
            Create forecast
          </Button>
        </div>
        <div aria-live="polite">
          {error ? (
            <Callout tone="danger" live="none" title="We couldn't create that forecast">
              {error}{" "}
              {!hasData(metricKey) ? <Link href={`/app/${slug}/connections`}>Go to Connections</Link> : null}
            </Callout>
          ) : null}
        </div>
      </form>

      {data.forecasts.length === 0 ? (
        <p className="text-ink-2">No forecasts yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-surface">
          {data.forecasts.map((f) => (
            <li key={f.id}>
              <Link
                href={`/app/${slug}/results/forecasts/${f.id}`}
                className="flex min-h-16 flex-col gap-1.5 px-5 py-3 hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex flex-col">
                  <span className="font-medium text-ink">
                    {METRIC_LABELS[f.metricKey] ?? f.metricKey} · next {f.horizonDays} days
                  </span>
                  <span className="text-sm text-ink-3">Created {relativeTime(f.createdAt)}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <ForecastStatusBadge status={f.status} />
                  <DemoBadge show={f.isFixture} />
                  <ArrowRight aria-hidden="true" className="size-4 text-ink-3" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
