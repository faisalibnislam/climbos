"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { useState } from "react";
import { Button, Callout, ConfirmDialog, DatePicker, Field, Input, Skeleton, toast } from "@/components/ui";
import { minorToDisplay } from "../../money";
import { CampaignCard } from "../Campaigns";
import { ErrorCallout, PERMISSION_WHO, majorToDisplay } from "../shared";
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
  const days = dayCount(start, end);
  const total = Number.isFinite(dailyNum) && dailyNum > 0 ? dailyNum * days : 0;
  const platform = artifact.channel === "google_search_ad" ? "Google Ads" : "Meta";
  const destination = artifact.current?.destinationUrl;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!(dailyNum > 0)) e.daily = "Enter a daily budget greater than 0.";
    if (!start) e.start = "Pick a start date.";
    if (!end || end < start) e.end = "Pick an end date on or after the start date.";
    if (start && start < isoDay(Date.now())) e.start = "The start date can't be in the past.";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-2">
        Campaigns are created paused and only go live when you approve starting them. Ad spend is paid directly to {platform} from your own ad account, not to
        ClimbOS. After a pause, platforms may report a little spend from before it took effect.
      </p>

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
            <h3 className="heading-card">{related.length ? "Prepare another campaign" : "Prepare a campaign"}</h3>
            <p className="text-sm text-ink-2">
              Your approved monthly ad budget is {ads.monthlyEnvelopeMinor > 0 ? minorToDisplay(ads.monthlyEnvelopeMinor, currency) : "not set yet (set it in Settings → Policies)"}.
              Planned spend can&apos;t go above it.
            </p>
            <Field label={`Daily budget (${currency})`} error={fieldErrors.daily}>
              <Input type="number" inputMode="decimal" min={1} step="0.01" value={daily} onChange={(e) => setDaily(e.target.value)} />
            </Field>
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
                "Enter a budget and dates to see the most this campaign can spend."
              )}
            </p>
            {!destination ? (
              <Callout tone="warning" title="No link set">
                Add a link (starting with https://) to the ad before preparing a campaign, so people know where they&apos;ll land.
              </Callout>
            ) : (
              <p className="break-words text-sm text-ink-3">Sends people to: {destination}</p>
            )}
            {!accountConnected ? (
              <Callout tone="warning" title="Connect your ad account first">
                You can prepare the campaign now, but ClimbOS can&apos;t create or start it until your {platform} account is connected.{" "}
                <Link href={`/app/${slug}/connections`}>Go to Connections</Link>
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
              description={`This only sets the campaign up inside ClimbOS: ${majorToDisplay(dailyNum || 0, currency)} a day from ${start} to ${end}, up to ${majorToDisplay(total, currency)} in total. Nothing is sent to ${platform} and nothing is spent. Next, someone with approval rights approves creating it (paused), then starting it.`}
              confirmLabel="Prepare campaign"
              onConfirm={async () => {
                setError(null);
                try {
                  await prepare({ slug, artifactId: artifact.id, dailyBudget: dailyNum, startDate: start, endDate: end });
                  toast({ tone: "success", title: "Campaign prepared.", description: "It now needs approval to be created (paused)." });
                } catch (e) {
                  setError(e);
                }
              }}
            />
          </form>
        ) : (
          <p className="text-sm text-ink-2">Preparing a campaign needs {PERMISSION_WHO.edit}.</p>
        )
      ) : related.length === 0 ? (
        <p className="text-sm text-ink-3">Approve the ad text first. Then you can prepare a campaign here.</p>
      ) : null}
    </div>
  );
}
