"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { CircleAlert, CircleCheck, CircleQuestionMark, Clock, Hourglass, Megaphone, Pause, Play, RefreshCw, type LucideIcon } from "@/components/icons"
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Callout, ConfirmDialog, EmptyState, Skeleton, Tooltip, toast, type Tone } from "@/components/ui";
import { minorToDisplay } from "../money";
import { KeyTakeaways, StatBlocks } from "@/components/ds/content";
import { ChannelTag, ErrorCallout, FactList, PERMISSION_WHO, useWorkspaceMember } from "./shared";
import { reviewCampaignPerformance } from "../../../../shared/acquisition/campaignPerformance";

export type AdsList = FunctionReturnType<typeof api.ads.list>;
export type Campaign = AdsList["campaigns"][number];

export const CAMPAIGN_STATUS: Record<string, { label: string; tone: Tone; help: string; Icon: LucideIcon }> = {
  draft: { label: "Not created", tone: "neutral", help: "Not sent to the ad platform.", Icon: Clock },
  needs_approval: { label: "Needs approval", tone: "amber", help: "Approve creating it (paused).", Icon: Hourglass },
  created_paused: { label: "Created, paused", tone: "blue", help: "Not running or spending.", Icon: Pause },
  active: { label: "Running", tone: "green", help: "May spend within budget.", Icon: Play },
  paused: { label: "Paused", tone: "neutral", help: "Late spend may still be reported.", Icon: Pause },
  ended: { label: "Ended", tone: "neutral", help: "Past its end date.", Icon: CircleCheck },
  uncertain: { label: "Outcome uncertain", tone: "amber", help: "Check the ad platform.", Icon: CircleQuestionMark },
};

function platformName(channel: string) {
  return channel === "google_search_ad" ? "Google Ads" : channel === "meta_ad" ? "Meta (Facebook & Instagram)" : "the ad platform";
}

function daysBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
}

function formatDay(d: string | null): string {
  if (!d) return "not set";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function CampaignStatusPill({ status }: { status: string }) {
  const meta = CAMPAIGN_STATUS[status] ?? { label: status, tone: "neutral" as Tone, help: "", Icon: CircleAlert };
  const badge = (
    <Badge tone={meta.tone} icon={<meta.Icon />}>
      {meta.label}
    </Badge>
  );
  return meta.help ? (
    <Tooltip content={meta.help}>
      <span tabIndex={0} className="inline-flex rounded-full">
        {badge}
        <span className="sr-only">: {meta.help}</span>
      </span>
    </Tooltip>
  ) : (
    badge
  );
}

/** One campaign with its facts and the next approval step (reviewer roles only). */
export function CampaignCard({ slug, campaign: c, headingLevel: H = "h3", isDemo }: { slug: string; campaign: Campaign; headingLevel?: "h2" | "h3" | "h4"; isDemo?: boolean }) {
  const member = useWorkspaceMember(slug);
  const decide = useMutation(api.ads.decide);
  const syncPerformance = useAction(api.adPerformance.syncPerformance);
  const [error, setError] = useState<unknown>(null);
  const [performanceError, setPerformanceError] = useState<unknown>(null);
  const [syncingPerformance, setSyncingPerformance] = useState(false);
  const canApprove = member?.role ? ["owner", "admin", "reviewer"].includes(member.role) : false;
  const days = daysBetween(c.startDate, c.endDate);
  const daily = minorToDisplay(c.dailyBudgetMinor, c.currency);
  const total = minorToDisplay(c.budgetEnvelopeMinor, c.currency);
  const platform = platformName(c.channel);
  const performance = c.performance?.status === "ready" ? c.performance : null;
  const review = performance && performance.spendMinor !== undefined && performance.conversions !== undefined && performance.endDate
    ? reviewCampaignPerformance({
        spendMinor: performance.spendMinor,
        conversions: performance.conversions,
        observedThrough: performance.endDate,
        campaignStartDate: performance.startDate,
        reviewAfterDays: c.reviewAfterDays ?? 7,
        targetCostPerConversionMinor: c.targetCostPerConversionMinor ?? undefined,
      })
    : null;

  const run = async (action: "create_paused" | "activate" | "reject", success: string) => {
    setError(null);
    try {
      await decide({ slug, campaignId: c.id, action });
      toast({ tone: "success", title: success });
    } catch (e) {
      setError(e);
    }
  };

  const refreshPerformance = async () => {
    setPerformanceError(null);
    setSyncingPerformance(true);
    try {
      await syncPerformance({ slug, campaignId: c.id });
      toast({ tone: "success", title: "Google Ads results refreshed." });
    } catch (e) {
      setPerformanceError(e);
    } finally {
      setSyncingPerformance(false);
    }
  };

  const facts = (
    <FactList
      items={[
        { term: "Daily budget", detail: daily },
        { term: "Dates", detail: `${formatDay(c.startDate)} to ${formatDay(c.endDate)}${days ? ` (${days} day${days === 1 ? "" : "s"})` : ""}` },
        { term: "Max total", detail: total },
        { term: "First results review", detail: `${c.reviewAfterDays ?? 7} days after start` },
        { term: "Cost / conversion target", detail: c.targetCostPerConversionMinor !== null ? `${minorToDisplay(c.targetCostPerConversionMinor, c.currency)} (owner set)` : "not set" },
        { term: "Link", detail: c.destinationUrl ?? "none" },
      ]}
    />
  );

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <ChannelTag channel={c.channel} />
        <CampaignStatusPill status={c.status} />
      </div>
      <H className="heading-card break-words">{c.name}</H>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-ink-3">Daily</dt>
          <dd className="font-medium text-ink">{daily}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Max total</dt>
          <dd className="font-medium text-ink">{total}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">First results review</dt>
          <dd className="font-medium text-ink">{c.reviewAfterDays ?? 7} days after start</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Cost / conversion target</dt>
          <dd className="font-medium text-ink">{c.targetCostPerConversionMinor !== null ? `${minorToDisplay(c.targetCostPerConversionMinor, c.currency)} (owner set)` : "Not set"}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Dates</dt>
          <dd className="font-medium text-ink">
            {formatDay(c.startDate)} – {formatDay(c.endDate)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-ink-3">Link</dt>
          <dd className="break-words font-medium text-ink">{c.destinationUrl ?? "None"}</dd>
        </div>
      </dl>
      {c.stopRules.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-ink">Auto-pauses if:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-ink-2">
            {c.stopRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {c.channel === "google_search_ad" && c.externalId && ["active", "paused", "ended"].includes(c.status) ? (
        <section aria-label="Campaign performance" className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-ink">Google Ads results</h4>
            <Button type="button" variant="secondary" size="sm" onClick={refreshPerformance} disabled={syncingPerformance}>
              <RefreshCw aria-hidden="true" className={syncingPerformance ? "animate-spin" : ""} />
              {syncingPerformance ? "Refreshing…" : "Refresh results"}
            </Button>
          </div>
          {performance ? (
            <>
              <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-ink-3">Reported spend</dt><dd className="font-medium text-ink">{minorToDisplay(performance.spendMinor ?? 0, performance.currency)}</dd></div>
                <div><dt className="text-xs text-ink-3">Reported conversions</dt><dd className="font-medium text-ink">{performance.conversions ?? 0}</dd></div>
                <div><dt className="text-xs text-ink-3">Clicks / impressions</dt><dd className="font-medium text-ink">{(performance.clicks ?? 0).toLocaleString()} / {(performance.impressions ?? 0).toLocaleString()}</dd></div>
                <div><dt className="text-xs text-ink-3">Report window</dt><dd className="font-medium text-ink">{performance.startDate} to {performance.endDate}</dd></div>
                {performance.conversions && performance.conversions > 0 ? (
                  <div><dt className="text-xs text-ink-3">Reported cost / conversion</dt><dd className="font-medium text-ink">{minorToDisplay(Math.round((performance.spendMinor ?? 0) / performance.conversions), performance.currency)}</dd></div>
                ) : null}
              </dl>
              {review ? (
                <Callout tone={review.status === "review" ? "warning" : review.status === "within_target" ? "success" : "info"} title={review.status === "review" ? "Review this campaign" : review.status === "within_target" ? "Within the owner-set target" : review.status === "target_needed" ? "Set a success target" : "Continue the agreed review window"}>
                  {review.message}
                </Callout>
              ) : null}
              <p className="text-xs text-ink-3">
                Source: Google Ads, synced {new Date(performance.syncedAt).toLocaleString()}. Platform reports can change and reflect its conversion settings; they do not establish incremental customers or profit. This recommendation never pauses or edits the campaign.
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-2">Refresh to read daily results from the connected account. ClimbOS compares results only with a cost target you set.</p>
          )}
          {performanceError ? <ErrorCallout error={performanceError} /> : null}
        </section>
      ) : c.channel === "meta_ad" && c.externalId ? (
        <Callout tone="info" title="Performance review requires owner input">
          Meta results are not currently synced into this view. Use Meta Ads Manager to review them; ClimbOS will not infer a pause recommendation without verified campaign data.
        </Callout>
      ) : null}
      {error ? <ErrorCallout error={error} /> : null}
      {!c.accountConnected && (c.status === "needs_approval" || c.status === "created_paused" || c.status === "paused") ? (
        <Callout tone="warning" title={`Connect ${platform}`}>
          Needed to launch. <Link href={`/app/${slug}/connections`}>Connections</Link>
        </Callout>
      ) : null}
      {c.status === "needs_approval" || c.status === "created_paused" || c.status === "paused" ? (
        canApprove ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {c.status === "needs_approval" ? (
              <>
                <ConfirmDialog
                  trigger={<Button disabled={!c.accountConnected}>Create paused</Button>}
                  title="Create this campaign, paused?"
                  description={`Created in ${platform}, switched off. Nothing spent until you press Start.`}
                  confirmLabel="Create paused"
                  onConfirm={() => run("create_paused", "Create request sent.")}
                >
                  {facts}
                  <p className="mt-3 text-sm text-ink-3">
                    Spend is billed by {platform}, not ClimbOS.
                    {isDemo ? " Demo: simulated." : ""}
                  </p>
                </ConfirmDialog>
                <ConfirmDialog
                  trigger={<Button variant="secondary">Don&apos;t create</Button>}
                  title="Don't create this campaign?"
                  description="Nothing is sent to the ad platform."
                  confirmLabel="Don't create"
                  onConfirm={() => run("reject", "Campaign won't be created.")}
                />
              </>
            ) : (
              <ConfirmDialog
                trigger={<Button disabled={!c.accountConnected}>Start</Button>}
                title="Start this campaign?"
                description={`Spends up to ${daily}/day, max ${total} total.`}
                confirmLabel={`Start at ${daily}/day`}
                onConfirm={() => run("activate", "Start request sent.")}
              >
                {facts}
                <p className="mt-3 text-sm text-ink-3">
                  Spend is billed by {platform}, not ClimbOS.
                  {isDemo ? " Demo: simulated, no money spent." : ""}
                </p>
              </ConfirmDialog>
            )}
          </div>
        ) : member ? (
          <p className="text-sm text-ink-2">Waiting for {PERMISSION_WHO.approve}.</p>
        ) : null
      ) : null}
    </article>
  );
}

/** The "Ads" tab: honest explanation + campaigns list. */
export function AdsPanel({ slug }: { slug: string }) {
  const data = useQuery(api.ads.list, { slug });
  const member = useWorkspaceMember(slug);
  return (
    <section aria-labelledby="ads-heading" className="flex flex-col gap-5">
      <h2 id="ads-heading" className="heading-section">
        Ad campaigns
      </h2>
      <KeyTakeaways
        title="How ads work"
        items={["Created paused; live only when you start them", "Spend paid to Google/Meta, never ClimbOS", "No auto budget raises"]}
      />
      {data === undefined ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <StatBlocks
              stats={[
                { label: "Google Ads", value: data.googleAdsConnected ? "Connected" : "Not connected", tone: data.googleAdsConnected ? "good" : "default" },
                { label: "Meta ads", value: data.metaAdsConnected ? "Connected" : "Not connected", tone: data.metaAdsConnected ? "good" : "default" },
                { label: "Monthly cap", value: data.monthlyEnvelopeMinor > 0 ? minorToDisplay(data.monthlyEnvelopeMinor, data.currency) : "Not set" },
              ]}
            />
            {!data.googleAdsConnected || !data.metaAdsConnected ? (
              <p className="text-sm text-ink-3">
                <Link href={`/app/${slug}/connections`}>Connect an ad account</Link>
              </p>
            ) : null}
          </div>
          {data.campaigns.length === 0 ? (
            <EmptyState
              icon={<Megaphone />}
              title="No ad campaigns yet"
              body="Approve an ad, then prepare one."
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {data.campaigns.map((c) => (
                <li key={c.id}>
                  <CampaignCard slug={slug} campaign={c} isDemo={member?.isDemo} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
