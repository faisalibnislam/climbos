"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { useState } from "react";
import { Button, Callout, ConfirmDialog, DatePicker, Field, Input, Skeleton, toast } from "@/components/ui";
import { minorToDisplay } from "../../money";
import { CampaignCard } from "../Campaigns";
import { ErrorCallout, FactList, PERMISSION_WHO, majorToDisplay } from "../shared";
import type { ArtifactView } from "./model";

function isoDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayCount(start: string, end: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return 0;
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
}

/**
 * Campaigns for an approved ad draft: prepare (inside ClimbOS only), then
 * approve creating it paused, then approve starting it.
 */
export function AdCampaignPanel({ slug, artifact, now }: { slug: string; artifact: ArtifactView; now: number }) {
  const ads = useQuery(api.ads.list, { slug });
  const prepare = useMutation(api.ads.prepareCampaign);
  const [daily, setDaily] = useState("10");
  const [targetCostPerConversion, setTargetCostPerConversion] = useState("");
  const [reviewAfterDays, setReviewAfterDays] = useState("7");
  const [start, setStart] = useState(() => isoDay(now + 86_400_000));
  const [end, setEnd] = useState(() => isoDay(now + 14 * 86_400_000));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (ads === undefined) return <Skeleton className="h-40 w-full" />;

  const ids = new Set<string>(artifact.campaignIds);
  const related = ads.campaigns.filter((c) => ids.has(c.id) || c.artifactId === artifact.id);
  const accountConnected = artifact.channel === "google_search_ad" ? ads.googleAdsConnected : ads.metaAdsConnected;
  const currency = ads.currency;
  const dailyNum = Number(daily);
  const targetCostNum = targetCostPerConversion.trim() ? Number(targetCostPerConversion) : undefined;
  const reviewDaysNum = Number(reviewAfterDays);
  const days = dayCount(start, end);
  const total = Number.isFinite(dailyNum) && dailyNum > 0 ? dailyNum * days : 0;
  const platform = artifact.channel === "google_search_ad" ? "Google Ads" : "Meta";
  const destination = artifact.current?.destinationUrl;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!(dailyNum > 0)) e.daily = "Enter a daily budget greater than 0.";
    if (targetCostNum !== undefined && (!(targetCostNum > 0) || !Number.isFinite(targetCostNum))) e.targetCostPerConversion = "Enter a positive target, or leave this blank to skip efficiency recommendations.";
    if (!Number.isInteger(reviewDaysNum) || reviewDaysNum < 1 || reviewDaysNum > 90) e.reviewAfterDays = "Choose between 1 and 90 days.";
    if (!start) e.start = "Pick a start date.";
    if (!end || end < start) e.end = "Pick an end date on or after the start date.";
    if (start && start < isoDay(Date.now())) e.start = "The start date can't be in the past.";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-2">Created paused. Spend is paid to {platform} directly.</p>

      {related.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {related.map((c) => (
            <li key={c.id}>
              <CampaignCard slug={slug} campaign={c} headingLevel="h3" isDemo={artifact.isDemo} />
            </li>
          ))}
        </ul>
      ) : null}

      {artifact.status === "approved" ? (
        artifact.canEdit ? (
          <form
            className="flex flex-col gap-4 rounded-lg border border-line bg-surface-2 p-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (validate()) setConfirming(true);
            }}
          >
            <h3 className="heading-card">{related.length ? "Another campaign" : "New campaign"}</h3>
            <p className="text-sm text-ink-2">
              Monthly cap: {ads.monthlyEnvelopeMinor > 0 ? minorToDisplay(ads.monthlyEnvelopeMinor, currency) : "not set (Settings → Policies)"}
            </p>
            <Field label={`Daily budget (${currency})`} error={fieldErrors.daily}>
              <Input type="number" inputMode="decimal" min={1} step="0.01" value={daily} onChange={(e) => setDaily(e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`Maximum cost per reported conversion (${currency}, optional)`} error={fieldErrors.targetCostPerConversion}>
                <Input type="number" inputMode="decimal" min={0} step="0.01" value={targetCostPerConversion} onChange={(e) => setTargetCostPerConversion(e.target.value)} placeholder="Set your target" />
              </Field>
              <Field label="First review after (days)" error={fieldErrors.reviewAfterDays}>
                <Input type="number" inputMode="numeric" min={1} max={90} step={1} value={reviewAfterDays} onChange={(e) => setReviewAfterDays(e.target.value)} />
              </Field>
            </div>
            <p className="text-xs text-ink-3">ClimbOS compares reported Google Ads cost per conversion only when you set a target. The first review is advice for you; it never pauses ads automatically.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date" error={fieldErrors.start}>
                <DatePicker value={start} min={isoDay(now)} onChange={setStart} />
              </Field>
              <Field label="End date" error={fieldErrors.end}>
                <DatePicker value={end} min={start || isoDay(now)} onChange={setEnd} />
              </Field>
            </div>
            <p className="text-sm text-ink-2" aria-live="polite">
              {days > 0 && total > 0 ? (
                <>
                  {days} day{days === 1 ? "" : "s"} × {majorToDisplay(dailyNum, currency)} = <strong className="font-semibold text-ink">up to {majorToDisplay(total, currency)}</strong> in total.
                </>
              ) : (
                "Enter budget and dates to see max spend."
              )}
            </p>
            {!destination ? (
              <Callout tone="warning" title="No link set">
                Add an https:// link to the ad first.
              </Callout>
            ) : (
              <p className="break-words text-sm text-ink-3">Link: {destination}</p>
            )}
            {!accountConnected ? (
              <Callout tone="warning" title={`${platform} not connected`}>
                Needed to launch. <Link href={`/app/${slug}/connections`}>Connect</Link>
              </Callout>
            ) : null}
            <Button type="submit" className="self-start">
              Prepare campaign
            </Button>
            {error ? <ErrorCallout error={error} /> : null}
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title="Prepare this campaign?"
              description={`Set up in ClimbOS only: nothing sent to ${platform} or spent yet.`}
              confirmLabel="Prepare campaign"
              onConfirm={async () => {
                setError(null);
                try {
                  await prepare({ slug, artifactId: artifact.id, dailyBudget: dailyNum, startDate: start, endDate: end, targetCostPerConversion: targetCostNum, reviewAfterDays: reviewDaysNum });
                  toast({ tone: "success", title: "Campaign prepared. Needs approval." });
                } catch (e) {
                  setError(e);
                }
              }}
            >
              <FactList
                items={[
                  { term: "Daily", detail: `${majorToDisplay(dailyNum || 0, currency)}/day` },
                  { term: "Dates", detail: `${start} to ${end}` },
                  { term: "Max spend", detail: majorToDisplay(total, currency) },
                  { term: "First review", detail: `${reviewDaysNum} days after it starts` },
                  { term: "Cost target", detail: targetCostNum ? `${majorToDisplay(targetCostNum, currency)} per reported conversion` : "Not set; no efficiency recommendation" },
                ]}
              />
            </ConfirmDialog>
          </form>
        ) : (
          <p className="text-sm text-ink-2">Needs {PERMISSION_WHO.edit}.</p>
        )
      ) : related.length === 0 ? (
        <p className="text-sm text-ink-3">Approve the ad text first.</p>
      ) : null}
    </div>
  );
}
