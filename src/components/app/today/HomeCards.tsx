"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { ArrowRight } from "@/components/icons";
import { errorMessage } from "../errors";
import { Badge, Button, Dialog, DialogContent, DialogTrigger, toast, buttonClasses } from "@/components/ui";
import { cn } from "@/lib/utils";
import { OwnerGoalTarget } from "./OwnerGoalTarget";

type Today = FunctionReturnType<typeof api.workspace.today>;
type Snapshot = FunctionReturnType<typeof api.analytics.homeSnapshot>;

const card = "flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-5";
const SavedStepWork = dynamic(() => import("../plan/StepWork").then(module => module.StepWork), { loading: () => <p role="status">Opening saved work…</p> });

/** Returning owners see one actual item to pick up, rather than a dashboard of competing priorities. */
export function HomeNextAction({ slug, data }: { slug: string; data: Today }) {
  const stepWork = useQuery(api.stepWork.home, { slug });
  const [review, setReview] = useState<NonNullable<FunctionReturnType<typeof api.stepWork.home>> | null>(null);
  const strategy = data.strategy;
  const ready = Boolean(strategy?.preparedTitles?.length);
  const draft = data.approvals[0];
  const failed = data.recent.find(r => r.status === "failed" && !r.replaced);
  const shownWork = review ?? stepWork;
  if (shownWork) return <Dialog open={review !== null} onOpenChange={open => setReview(open ? shownWork : null)}>
    <section aria-labelledby="pick-up-heading" className={cn(card, "home-next-action")}><p className="text-overline">{shownWork.needsAnswer ? "AI has work ready · one answer needed" : "AI has prepared this for you"}</p><h2 id="pick-up-heading" className="heading-section">{shownWork.title}</h2><p className="text-sm text-ink-2">{shownWork.summary}</p><div className="flex flex-wrap items-center gap-3"><DialogTrigger asChild><Button className="step-primary-action">Review prepared work<ArrowRight aria-hidden /></Button></DialogTrigger><span className="text-xs text-ink-3">From: {shownWork.stepTitle}</span></div></section>
    <DialogContent title={`Prepared work: ${shownWork.stepTitle}`} description="Review the saved work you opened. Viewing it does not run AI or share anything." className="max-w-2xl">
      {review ? <SavedStepWork key={review.workId} slug={slug} strategyId={review.strategyId} stepKey={review.stepKey} initialWorkId={review.workId} canEdit={["owner", "admin", "editor"].includes(data.role)} /> : null}
    </DialogContent>
  </Dialog>;
  if (!strategy && !draft && !failed) return null;
  const title = draft ? draft.title : ready ? strategy!.preparedTitles[0] : failed ? failed.title : strategy?.focusedMove?.title ?? strategy?.summary;
  const href = draft ? `/app/${slug}/content/${draft.id}` : ready ? `/app/${slug}/plan#prepared-work` : failed ? `/app/${slug}/work/${failed.id}` : `/app/${slug}/plan`;
  return <section aria-labelledby="pick-up-heading" className={cn(card, "home-next-action")}>
    <p className="text-overline">{failed && !draft && !ready ? "Needs a look" : ready || draft ? "Ready for you" : "Your next useful step"}</p>
    <h2 id="pick-up-heading" className="heading-section">{title}</h2>
    <p className="text-sm text-ink-2">{ready || draft ? "AI has prepared this for you. Take a look and make it yours." : failed ? "This work didn’t finish. What was saved and how to continue are available below." : "Your next step is ready. Open your plan to put AI to work."}</p>
    <div className="flex flex-wrap gap-2"><Link href={href} className={buttonClasses({ variant: "primary" })}>{ready || draft ? "Review the draft" : failed ? "See what happened" : "See the recommendation"}<ArrowRight aria-hidden /></Link>{ready || draft ? <Link href={`/app/${slug}/plan`} className={buttonClasses({ variant: "link" })}>See your plan</Link> : null}</div>
    {data.counts.workingNow ? <p className="text-xs text-ink-3">{data.counts.workingNow} task{data.counts.workingNow === 1 ? " is" : "s are"} running. You can leave and find the work under Your work.</p> : null}
  </section>;
}

/** Lead with saved advice; the explicit preparation button uses the existing scoped request flow. */
export function RecommendationCard({ slug, data }: { slug: string; data: Today }) {
  const start = useMutation(api.workspace.startPlay);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const plan = data.strategy;
  if (!plan) return <PlanCard slug={slug} data={data} />;
  return (
    <section aria-labelledby="recommendation-heading" className={cn(card, "border-brand-200 bg-brand-50")}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="recommendation-heading" className="text-overline">Your next step</h2>
        {plan.status === "needs_approval" ? <Badge tone="amber">For you to review</Badge> : <Badge>Your plan</Badge>}
      </div>
      <p className="heading-section">{plan.focusedMove?.title ?? plan.direction?.winningApproach ?? plan.summary}</p>
      {plan.focusedMove ? <p className="text-ui text-ink-2">{plan.focusedMove.why}</p> : plan.direction ? <p className="text-ui text-ink-2"><span className="font-medium text-ink">Start here: </span>{plan.direction.currentBet}</p> : null}
      <div className="flex flex-wrap gap-2">{plan.status === "approved" && (plan.focusedMove || plan.opportunities[0]?.id) && ["owner", "admin", "editor"].includes(data.role) ? <Button size="sm" disabled={!data.canRunAi} loading={busy} onClick={async () => { setBusy(true); try { await start({ slug, strategyId: plan.id, playId: plan.focusedMove ? "focused" : plan.opportunities[0].id! }); router.push(plan.focusedMove ? `/app/${encodeURIComponent(slug)}/plan#prepared-work` : `/app/${encodeURIComponent(slug)}/work`); } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); } finally { setBusy(false); } }}>{plan.focusedMove ? "Review prepared drafts" : "Make it happen"}</Button> : null}
      <Link href={`/app/${encodeURIComponent(slug)}/plan`} className={cn(buttonClasses({ variant: "primary", size: "sm" }), "self-start")}>
        {plan.status === "needs_approval" ? "See your plan" : "See the plan and next steps"}<ArrowRight aria-hidden />
      </Link></div>
      <p className="text-xs text-ink-3">AI prepares the next step. It brings important choices and approvals back to you.</p>
    </section>
  );
}

/** Everything waiting on the owner, one row and one button each: plans, drafts, stopped jobs, replies, to-dos. */
export function NeedsYouCard({ slug, data }: { slug: string; data: Today }) {
  const attention = useQuery(api.inbox.attention, { slug });
  const items: { key: string; title: string; href: string; action: string }[] = [];
  if (data.strategy?.status === "needs_approval") items.push({ key: "plan", title: "Review your new plan", href: `/app/${slug}/plan`, action: "Review" });
  if (attention?.inboxOpen) items.push({ key: "inbox", title: `${attention.inboxOpen} message${attention.inboxOpen === 1 ? "" : "s"} to answer`, href: `/app/${slug}/inbox`, action: "Reply" });
  if (attention && (attention.overdueDeals || attention.stalledDeals)) items.push({ key: "customer-progress", title: [attention.overdueDeals ? `${attention.dealAttentionPartial ? "At least " : ""}${attention.overdueDeals} next step${attention.overdueDeals === 1 ? "" : "s"} overdue` : "", attention.stalledDeals ? `${attention.dealAttentionPartial ? "At least " : ""}${attention.stalledDeals} customer record${attention.stalledDeals === 1 ? "" : "s"} to review for stage age` : ""].filter(Boolean).join("; "), href: `/app/${slug}/pipeline`, action: "Review" });
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
  const numbers: { label: string; value: string; note?: string | null }[] = [
    ...(followers?.total !== null && followers?.total !== undefined
      ? [{ label: followers.weekChange ? `Followers (${followers.weekChange > 0 ? "+" : ""}${new Intl.NumberFormat("en-US").format(followers.weekChange)} this week)` : "Followers", value: new Intl.NumberFormat("en-US").format(followers.total) }]
      : []),
    ...metrics.slice(0, 2).map((m) => ({ label: m.label, value: m.total !== null ? new Intl.NumberFormat("en-US").format(m.total) : "—", note: m.partialReason })),
    { label: "Done this week", value: String(data.counts.doneThisWeek) },
  ];
  return (
    <section aria-labelledby="this-week-heading" className={card}>
      <h2 id="this-week-heading" className="text-base font-semibold text-ink">Last 30 days</h2>
      <dl className="flex flex-col divide-y divide-line">
        {numbers.map((n) => (
          <div key={n.label} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <dt className="min-w-0 text-ui text-ink-2">{n.label}{n.note ? <span className="mt-1 block text-xs text-ink-3">{n.note}</span> : null}</dt>
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
