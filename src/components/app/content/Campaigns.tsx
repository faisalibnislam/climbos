"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { CircleAlert, CircleCheck, CircleQuestionMark, Clock, Hourglass, Megaphone, Pause, Play, type LucideIcon } from "@/components/icons"
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Callout, ConfirmDialog, EmptyState, Skeleton, SocialIcon, toast, type Tone } from "@/components/ui";
import { minorToDisplay } from "../money";
import { ChannelTag, ErrorCallout, PERMISSION_WHO, useWorkspaceMember } from "./shared";

export type AdsList = FunctionReturnType<typeof api.ads.list>;
export type Campaign = AdsList["campaigns"][number];

export const CAMPAIGN_STATUS: Record<string, { label: string; tone: Tone; help: string; Icon: LucideIcon }> = {
  draft: { label: "Not created", tone: "neutral", help: "Not sent to the ad platform.", Icon: Clock },
  needs_approval: { label: "Needs your approval", tone: "amber", help: "Approve creating it (paused) in the ad platform.", Icon: Hourglass },
  created_paused: { label: "Created, paused", tone: "blue", help: "It exists in the ad platform but isn't running or spending.", Icon: Pause },
  active: { label: "Running", tone: "green", help: "Live in the ad platform and may be spending within your budget.", Icon: Play },
  paused: { label: "Paused", tone: "neutral", help: "Not running. Platforms may still report a little spend from before the pause.", Icon: Pause },
  ended: { label: "Ended", tone: "neutral", help: "Past its end date.", Icon: CircleCheck },
  uncertain: { label: "Outcome uncertain", tone: "amber", help: "We couldn't confirm the last change. Check the ad platform directly.", Icon: CircleQuestionMark },
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
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Badge tone={meta.tone} icon={<meta.Icon />}>
        {meta.label}
      </Badge>
      {meta.help ? <span className="text-xs text-ink-3">{meta.help}</span> : null}
    </span>
  );
}

/** One campaign with its facts and the next approval step (reviewer roles only). */
export function CampaignCard({ slug, campaign: c, headingLevel: H = "h3", isDemo }: { slug: string; campaign: Campaign; headingLevel?: "h2" | "h3" | "h4"; isDemo?: boolean }) {
  const member = useWorkspaceMember(slug);
  const decide = useMutation(api.ads.decide);
  const [error, setError] = useState<unknown>(null);
  const canApprove = member?.role ? ["owner", "admin", "reviewer"].includes(member.role) : false;
  const days = daysBetween(c.startDate, c.endDate);
  const daily = minorToDisplay(c.dailyBudgetMinor, c.currency);
  const total = minorToDisplay(c.budgetEnvelopeMinor, c.currency);
  const platform = platformName(c.channel);

  const run = async (action: "create_paused" | "activate" | "reject", success: string) => {
    setError(null);
    try {
      await decide({ slug, campaignId: c.id, action });
      toast({ tone: "success", title: success });
    } catch (e) {
      setError(e);
    }
  };

  const facts = (
    <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-2">
      <li>
        <strong className="font-semibold text-ink">Daily budget:</strong> {daily}
      </li>
      <li>
        <strong className="font-semibold text-ink">Dates:</strong> {formatDay(c.startDate)} to {formatDay(c.endDate)}
        {days ? ` (${days} day${days === 1 ? "" : "s"})` : ""}
      </li>
      <li>
        <strong className="font-semibold text-ink">Most it can spend in total:</strong> {total}
      </li>
      <li className="break-words">
        <strong className="font-semibold text-ink">Sends people to:</strong> {c.destinationUrl ?? "no link set"}
      </li>
    </ul>
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
          <dt className="text-xs text-ink-3">Daily budget</dt>
          <dd className="font-medium text-ink">{daily} a day</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Most it can spend</dt>
          <dd className="font-medium text-ink">{total} in total</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Dates</dt>
          <dd className="font-medium text-ink">
            {formatDay(c.startDate)} – {formatDay(c.endDate)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-ink-3">Sends people to</dt>
          <dd className="break-words font-medium text-ink">{c.destinationUrl ?? "No link set"}</dd>
        </div>
      </dl>
      {c.stopRules.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-ink">ClimbOS pauses it automatically if:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-ink-2">
            {c.stopRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <ErrorCallout error={error} /> : null}
      {!c.accountConnected && (c.status === "needs_approval" || c.status === "created_paused" || c.status === "paused") ? (
        <Callout tone="warning" title="Connect your ad account first">
          ClimbOS can&apos;t create or start this campaign until your {platform} account is connected.{" "}
          <Link href={`/app/${slug}/connections`}>Go to Connections</Link>
        </Callout>
      ) : null}
      {c.status === "needs_approval" || c.status === "created_paused" || c.status === "paused" ? (
        canApprove ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {c.status === "needs_approval" ? (
              <>
                <ConfirmDialog
                  trigger={<Button disabled={!c.accountConnected}>Create campaign (paused)</Button>}
                  title="Create this campaign, paused?"
                  description={`ClimbOS will create the campaign in ${platform} switched OFF. Nothing runs and nothing is spent until you press Start.`}
                  confirmLabel="Create paused campaign"
                  onConfirm={() => run("create_paused", "Create request sent. Watch the status for the platform's confirmation.")}
                >
                  {facts}
                  <p className="mt-3 text-sm text-ink-3">
                    Ad spend is paid directly to {platform} from your own ad account, not to ClimbOS.
                    {isDemo ? " Demo workspace: this is simulated and no real campaign is created." : ""}
                  </p>
                </ConfirmDialog>
                <ConfirmDialog
                  trigger={<Button variant="secondary">Don&apos;t create</Button>}
                  title="Don't create this campaign?"
                  description="Nothing is sent to the ad platform. You can prepare a new campaign from the approved ad later."
                  confirmLabel="Don't create it"
                  onConfirm={() => run("reject", "Campaign won't be created.")}
                />
              </>
            ) : (
              <ConfirmDialog
                trigger={<Button disabled={!c.accountConnected}>Start campaign</Button>}
                title="Start this campaign?"
                description={`${platform} can start showing your ads and spending up to ${daily} a day between the dates below — up to ${total} in total.`}
                confirmLabel={`Start campaign at ${daily} a day`}
                onConfirm={() => run("activate", "Start request sent. Watch the status for the platform's confirmation.")}
              >
                {facts}
                <p className="mt-3 text-sm text-ink-3">
                  Ad spend is billed by {platform} directly to your ad account, not by ClimbOS. If you pause later, platforms may still report a little spend from
                  before the pause.
                  {isDemo ? " Demo workspace: this is simulated and no money is spent." : ""}
                </p>
              </ConfirmDialog>
            )}
          </div>
        ) : member ? (
          <p className="text-sm text-ink-2">Waiting for {PERMISSION_WHO.approve} to approve the next step.</p>
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
      <Callout tone="info" title="How ads work in ClimbOS">
        <ul className="mt-1 list-disc pl-5">
          <li>Campaigns are always created paused. They go live only when you explicitly approve starting them.</li>
          <li>Ad spend is paid directly to Google or Meta from your own ad account — never to ClimbOS.</li>
          <li>ClimbOS never raises a budget on its own and pauses campaigns under the stop rules you see on each one.</li>
          <li>After a pause, platforms may still report a little spend from before it took effect.</li>
        </ul>
      </Callout>
      {data === undefined ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2 text-sm text-ink-2">
            <li className="flex items-center gap-2">
              <SocialIcon network="google_search_ad" size="sm" />
              <span>
                Google Ads: <strong className="font-semibold text-ink">{data.googleAdsConnected ? "Connected" : "Not connected"}</strong>
              </span>
            </li>
            <li className="flex items-center gap-2">
              <SocialIcon network="meta_ad" size="sm" />
              <span>
                Meta (Facebook &amp; Instagram) ads: <strong className="font-semibold text-ink">{data.metaAdsConnected ? "Connected" : "Not connected"}</strong>
              </span>
            </li>
          </ul>
          {!data.googleAdsConnected || !data.metaAdsConnected ? (
            <p className="text-sm text-ink-3">
              Connect an ad account in <Link href={`/app/${slug}/connections`}>Connections</Link> before ClimbOS can create campaigns there.
            </p>
          ) : null}
          <p className="text-sm text-ink-2">
            Your approved monthly ad budget:{" "}
            <strong className="font-semibold text-ink">{data.monthlyEnvelopeMinor > 0 ? minorToDisplay(data.monthlyEnvelopeMinor, data.currency) : "not set"}</strong>. Campaigns
            can&apos;t be planned above it.
          </p>
          {data.campaigns.length === 0 ? (
            <EmptyState
              icon={<Megaphone />}
              title="No ad campaigns yet"
              body="Create ad drafts with “Create content” → Ads. After you approve an ad, open it to prepare a campaign — it stays paused until you start it."
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
