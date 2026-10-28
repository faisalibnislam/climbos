"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { ArrowRight } from "@/components/icons";
import { Badge, buttonClasses } from "@/components/ui";
import { cn } from "@/lib/utils";
import { OwnerGoalTarget } from "./OwnerGoalTarget";

type Today = FunctionReturnType<typeof api.workspace.today>;
type Snapshot = FunctionReturnType<typeof api.analytics.homeSnapshot>;

const card = "flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-5";

/** Everything waiting on the owner, one row and one button each: plans, drafts, stopped jobs, replies, to-dos. */
export function NeedsYouCard({ slug, data }: { slug: string; data: Today }) {
  const attention = useQuery(api.inbox.attention, { slug });
  const items: { key: string; title: string; href: string; action: string }[] = [];
  if (data.strategy?.status === "needs_approval") items.push({ key: "plan", title: `Approve plan v${data.strategy.version}`, href: `/app/${slug}/plan`, action: "Review" });
  if (attention?.inboxOpen) items.push({ key: "inbox", title: `${attention.inboxOpen} message${attention.inboxOpen === 1 ? "" : "s"} to answer`, href: `/app/${slug}/inbox`, action: "Reply" });
  for (const r of data.recent) if (r.status === "failed" && !r.replaced) items.push({ key: `run-${r.id}`, title: `Didn't finish: ${r.title}`, href: `/app/${slug}/work/${r.id}`, action: "Fix" });
  for (const n of data.next) if (n.kind !== "plan" || data.strategy?.status !== "needs_approval") items.push({ key: `next-${n.href}-${n.title}`, title: n.title, href: n.href, action: n.kind === "approvals" ? "Review" : "Open" });
  const shown = items.slice(0, 4);
  return (
    <section id="review" tabIndex={-1} aria-labelledby="needs-you-heading" className={cn(card, "scroll-mt-20")}>
      <h2 id="needs-you-heading" className="flex items-center gap-2 text-base font-semibold text-ink">
        Needs you {items.length ? <Badge tone="amber">{items.length}</Badge> : null}
      </h2>
      {shown.length === 0 ? (
        <p className="text-ui text-ink-3">All caught up.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {shown.map((i) => (
            <li key={i.key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="line-clamp-2 min-w-0 flex-1 text-ui text-ink">{i.title}</span>
              <Link href={i.href} className={buttonClasses({ size: "sm", variant: i.action === "Review" ? "primary" : "secondary" })}>
                {i.action}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The goal, its target and the plan's top channels. */
export function PlanCard({ slug, data }: { slug: string; data: Today }) {
  const goal = data.goal;
  return (
    <section aria-labelledby="plan-card-heading" className={card}>
      <h2 id="plan-card-heading" className="text-base font-semibold text-ink">Your plan</h2>
      {goal ? (
        <>
          <p className="line-clamp-3 font-[family-name:var(--font-display-serif)] text-xl leading-snug text-ink">{goal.statement}</p>
          <OwnerGoalTarget target={goal.target} currency={goal.currency} horizonDays={goal.horizonDays} />
          {data.strategy?.channels?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {data.strategy.channels.map((c) => (
                <Badge key={c} tone="brand">{c}</Badge>
              ))}
            </div>
          ) : null}
          <Link href={`/app/${slug}/plan`} className={cn(buttonClasses({ variant: "link" }), "mt-auto self-start")}>
            {data.strategy ? "Open plan" : "Build my plan"} <ArrowRight aria-hidden />
          </Link>
        </>
      ) : (
        <>
          <p className="text-ui text-ink-3">No goal yet.</p>
          <Link href={`/app/${slug}/settings/business`} className={cn(buttonClasses({ size: "sm" }), "self-start")}>Set a goal</Link>
        </>
      )}
    </section>
  );
}

/** Recorded numbers for the last 30 days plus what the team is doing now. Unknown shows as a dash, never zero. */
export function ThisWeekCard({ slug, data, snapshot }: { slug: string; data: Today; snapshot: Snapshot | null | undefined }) {
  const metrics = snapshot?.metrics ?? [];
  const followers = useQuery(api.followers.summary, { slug });
  const numbers = [
    ...(followers?.total !== null && followers?.total !== undefined
      ? [{ label: followers.weekChange ? `Followers (${followers.weekChange > 0 ? "+" : ""}${new Intl.NumberFormat("en-US").format(followers.weekChange)} this week)` : "Followers", value: new Intl.NumberFormat("en-US").format(followers.total) }]
      : []),
    ...metrics.slice(0, 2).map((m) => ({ label: m.label, value: m.hasData ? new Intl.NumberFormat("en-US").format(m.total) : "—" })),
    { label: "Done this week", value: String(data.counts.doneThisWeek) },
  ];
  return (
    <section aria-labelledby="this-week-heading" className={card}>
      <h2 id="this-week-heading" className="text-base font-semibold text-ink">Last 30 days</h2>
      <dl className="flex flex-col divide-y divide-line">
        {numbers.map((n) => (
          <div key={n.label} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <dt className="min-w-0 text-ui text-ink-2">{n.label}</dt>
            <dd className="font-[family-name:var(--font-display-serif)] text-2xl tabular-nums text-ink">{n.value}</dd>
          </div>
        ))}
      </dl>
      {data.counts.workingNow > 0 ? (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-ui text-ink">
          {data.counts.workingNow} job{data.counts.workingNow === 1 ? "" : "s"} working now
        </p>
      ) : null}
      {metrics.length && !metrics.some((m) => m.hasData) ? (
        <Link href={`/app/${slug}/connections`} className={cn(buttonClasses({ variant: "link" }), "mt-auto self-start")}>
          Connect analytics <ArrowRight aria-hidden />
        </Link>
      ) : (
        <Link href={`/app/${slug}/results`} className={cn(buttonClasses({ variant: "link" }), "mt-auto self-start")}>
          See results <ArrowRight aria-hidden />
        </Link>
      )}
    </section>
  );
}
