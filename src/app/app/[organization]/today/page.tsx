"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Compass,
  FileCheck2,
  Hourglass,
  Lightbulb,
  Sparkles,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Callout, Card, CardContent, CardHeader, CardTitle, EmptyState, IconTile, Skeleton, SocialIcon, Tooltip, buttonClasses, toast, type Tone } from "@/components/ui";
import { PauseAllButton } from "@/components/app/AppShell";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { CHANNEL_LABELS, ROLE_META, roleTitle } from "@/components/app/roles";
import { RoleAvatar, RoleStack } from "@/components/app/RoleAvatar";
import { useNow } from "@/components/app/content/shared";
import { ASK_KEY } from "@/components/app/CommandPalette";
import { PageHeader } from "@/components/app/results/QueryBoundary";
import { WishComposer, wishSuggestions, type WishComposerHandle } from "@/components/app/wish/WishComposer";
import { RunProgressCompact } from "@/components/app/content/RunProgress";
import { WishFeed } from "@/components/app/wish/WishFeed";
import { climbTarget } from "@/components/climb/context";

const NEXT_VISUAL: Record<string, { icon: LucideIcon; tone: Tone }> = {
  plan: { icon: Compass, tone: "violet" },
  approvals: { icon: FileCheck2, tone: "amber" },
  uncertain: { icon: CircleHelp, tone: "orange" },
  card: { icon: Lightbulb, tone: "brand" },
  onboarding: { icon: Sparkles, tone: "pink" },
};


function StatCard({ icon: Icon, tone, label, value, hint }: { icon: LucideIcon; tone: Tone; label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-ui font-medium text-ink-3">{label}</p>
        <IconTile icon={Icon} tone={tone} size="xs" />
      </div>
      <p className="metric mt-1">{value}</p>
      <p className="mt-0.5 text-xs text-ink-3">{hint}</p>
    </div>
  );
}

type Today = NonNullable<ReturnType<typeof useQuery<typeof api.workspace.today>>>;
type CardView = Today["cards"][number];

const RUN_STATUS: Record<string, { label: string; tone: "neutral" | "green" | "amber" | "red" | "blue" }> = {
  cost_reserved: { label: "Starting", tone: "blue" },
  preparing: { label: "Working", tone: "blue" },
  executing: { label: "Working", tone: "blue" },
  verified: { label: "Done", tone: "green" },
  failed: { label: "Didn't finish", tone: "red" },
  uncertain: { label: "Outcome uncertain", tone: "amber" },
  canceled: { label: "Canceled", tone: "neutral" },
  needs_approval: { label: "Needs approval", tone: "amber" },
};

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function TodayPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.workspace.today, { slug });
  const now = useNow();
  const composer = useRef<WishComposerHandle>(null);
  useEffect(() => {
    // A wish typed in the ⌘K palette before Today loaded arrives ready to send.
    try {
      const asked = sessionStorage.getItem(ASK_KEY);
      if (asked && data) {
        sessionStorage.removeItem(ASK_KEY);
        composer.current?.fill(asked);
      }
    } catch {
      // Storage unavailable.
    }
  }, [data]);

  if (data === undefined) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </div>
    );
  }

  const firstName = data.userName && !data.userName.includes("@") ? data.userName.split(" ")[0] : null;

  const suggested = data.cards.filter((c) => !data.chat.some((m) => m.cards.some((x) => x.id === c.id)));
  const running = data.recent.filter((r) => ["cost_reserved", "preparing", "executing"].includes(r.status)).length;
  const doneThisWeek = now ? data.recent.filter((r) => r.status === "verified" && r.createdAt > now - 7 * 86_400_000).length : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        section="today"
        eyebrow={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        title={
          <>
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </>
        }
        intro={<>Here’s what your AI growth team is working on{data.org.name ? ` for ${data.org.name.replace(/ \(demo\)$/i, "")}` : ""}.</>}
      />

      {!data.canRunAi && data.accessMessage && (
        <Callout
          tone={data.accessCode === "PAUSED" || data.accessCode === "FLEET_STOP" ? "warning" : "info"}
          title={data.accessCode === "PAYMENT_ISSUE" ? "Payment needs attention" : data.accessCode === "PAUSED" ? "Activity is paused" : "New AI work is on hold"}
          action={
            data.accessCode === "PAUSED" || data.accessCode === "FLEET_STOP" ? undefined : (
              <Button asChild size="sm">
                <Link href={`/app/${slug}/settings/billing`}>See plans and usage</Link>
              </Button>
            )
          }
        >
          {data.accessMessage}
        </Callout>
      )}

      {data.org.kind === "customer" && data.org.onboardingStep !== "done" && (
        <Callout tone="info" title="Finish setting up" action={<Button asChild size="sm"><Link href={`/onboarding?workspace=${slug}`}>Continue setup</Link></Button>}>
          A couple of steps are left before your team can plan properly.
        </Callout>
      )}

      <WishComposer
        ref={composer}
        slug={slug}
        suggestions={wishSuggestions(data.business?.type)}
        disabled={!data.canRunAi}
        disabledReason={!data.canRunAi ? (data.accessMessage ?? null) : null}
      />
      <WishFeed slug={slug} chat={data.chat} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.45fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Next actions */}
          <section aria-labelledby="next-heading" className="rounded-xl border border-line bg-surface">
            <div className="px-5 pt-5">
              <h2 id="next-heading" className="heading-section flex items-center gap-2">
                Do these next {data.next.length ? <Badge tone="brand">{data.next.length} to do</Badge> : null}
              </h2>
              <p className="mt-0.5 text-sm text-ink-3">Your team lines these up. Nothing goes live until you approve it.</p>
            </div>
            {data.next.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={<CheckCircle2 aria-hidden />} title="You're all caught up" body="Nothing needs you right now. Make a wish above, or check Results." />
              </div>
            ) : (
              <ol className="mt-3 divide-y divide-line border-t border-line">
                {data.next.map((n, i) => {
                  const v = NEXT_VISUAL[n.kind] ?? NEXT_VISUAL.card;
                  return (
                    <li key={`${n.kind}-${i}`}>
                      <Link href={n.href} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2">
                        <IconTile icon={v.icon} tone={v.tone} size="sm" />
                        <p className="min-w-0 flex-1 text-sm text-ink-3">
                          <span className="sr-only">Step {i + 1} of {data.next.length}: </span>
                          <span className="font-medium text-ink">{n.title}</span> {n.why}
                        </p>
                        <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-3" />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
          {suggested.length > 0 && (
            <section aria-labelledby="suggested-heading" className="rounded-xl border border-line bg-surface">
              <h2 id="suggested-heading" className="heading-section px-5 pt-4">
                Ideas from your plan
              </h2>
              <ul className="mt-2 divide-y divide-line border-t border-line">
                {suggested.map((c) => (
                  <li key={c.id}>
                    <ActionCard slug={slug} card={c} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <ApprovalsPanel slug={slug} data={data} />
          {/* Goal */}
          <section aria-label="Your goal" className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-start gap-3">
              <IconTile icon={Target} tone="brand" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-overline">Your goal</p>
                <p className="heading-card mt-0.5">{data.goal ? data.goal.statement : "No goal yet. Tell your team what you'd like to achieve."}</p>
                {data.goal ? (
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="neutral">{data.goal.horizonDays} days</Badge>
                    <Badge tone="neutral">
                      {data.goal.monthlyAdBudget > 0
                        ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: data.goal.currency, maximumFractionDigits: 0 }).format(data.goal.monthlyAdBudget)}/month ads`
                        : "No paid ads"}
                    </Badge>
                  </p>
                ) : null}
                <Link href={data.goal ? `/app/${slug}/plan` : `/onboarding?workspace=${slug}`} className={buttonClasses({ variant: "link", className: "mt-3" })}>
                  {data.goal ? "See the plan" : "Set a goal"} <ArrowRight aria-hidden />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* At a glance */}
      <section aria-label="At a glance" className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Hourglass} tone="amber" label="Needs your OK" value={data.approvalsCount + (data.strategy?.status === "needs_approval" ? 1 : 0)} hint="Nothing goes live without you" />
        <StatCard icon={Zap} tone="blue" label="Working now" value={running} hint={running ? "Jobs in progress" : "Your team is ready"} />
        <StatCard icon={CheckCircle2} tone="green" label="Done this week" value={doneThisWeek} hint="Finished jobs" />
      </section>
      <AttentionStrip slug={slug} />

      <RecentWork slug={slug} data={data} />
      <div className="md:hidden">
        <PauseAllButton slug={slug} paused={Boolean(data.emergencyStop)} variant="large" />
      </div>
    </div>
  );
}

function ActionCard({ slug, card }: { slug: string; card: CardView }) {
  const run = useMutation(api.workspace.runCard);
  const dismiss = useMutation(api.workspace.dismissCard);
  const [busy, setBusy] = useState(false);
  const status = card.status;
  return (
    <div id={`card-${card.id}`} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{card.title}</p>
        {status === "running" && card.runId ? (
          <RunProgressCompact slug={slug} runId={card.runId as Id<"workflowRuns">} className="mt-1.5" />
        ) : (
          <Tooltip content={card.proposedEffect}>
            <p tabIndex={0} className="truncate text-xs text-ink-3">
              {card.description}
            </p>
          </Tooltip>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {status === "running" ? (
          <Badge tone="blue" icon={<Clock3 />}>
            Working
          </Badge>
        ) : status === "done" ? (
          card.runId ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={`/app/${slug}/work/${card.runId}`}>See result</Link>
            </Button>
          ) : (
            <Badge tone="green" icon={<CheckCircle2 />}>
              Done
            </Badge>
          )
        ) : status === "failed" ? (
          <Badge tone="red">Didn’t finish</Badge>
        ) : status === "blocked" ? (
          <Badge tone="amber">Needs setup</Badge>
        ) : (
          <>
            <Button
              size="sm"
              variant="secondary"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await run({ slug, cardId: card.id as Id<"actionCards"> });
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              {card.kind === "note" ? "Got it" : "Do it"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => dismiss({ slug, cardId: card.id as Id<"actionCards"> }).catch((e) => toast({ tone: "danger", title: errorMessage(e) }))}>
              Not now
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ApprovalsPanel({ slug, data }: { slug: string; data: Today }) {
  return (
    <section aria-labelledby="approvals-heading">
      <div className="flex items-center justify-between">
        <h2 id="approvals-heading" className="heading-section">Waiting for you</h2>
        {data.approvalsCount > 0 && <Badge tone="amber">{data.approvalsCount} to review</Badge>}
      </div>
      <Card className="mt-4">
        <CardContent className="p-0">
          {data.strategy?.status === "needs_approval" && (
            <Link href={`/app/${slug}/plan`} className="flex items-center gap-3 border-b border-line p-4 transition-colors hover:bg-surface-2">
              <RoleAvatar role="ceo" size="md" />
              <span className="flex-1">
                <span className="block text-sm font-medium text-ink">Growth plan v{data.strategy.version}</span>
                <span className="block text-xs text-ink-3">{roleTitle("ceo")} · needs your approval</span>
              </span>
              <ArrowRight className="size-4 text-ink-3" aria-hidden />
            </Link>
          )}
          {data.approvals.length === 0 && data.strategy?.status !== "needs_approval" ? (
            <p className="p-5 text-sm text-ink-2">Nothing waiting. New drafts will show up here before anything goes live.</p>
          ) : (
            <ul>
              {data.approvals.map((a) => (
                <li key={a.id}>
                  <Link {...climbTarget("draft", a.id, `${a.channel} draft waiting for approval: ${a.title}`)} href={`/app/${slug}/content/${a.id}`} className="flex items-center gap-3 border-b border-line p-4 transition-colors last:border-b-0 hover:bg-surface-2">
                    <RoleAvatar role={a.createdByRole ?? "social_media_manager"} size="md" />
                    <span className="min-w-0 flex-1">
                      <Tooltip content={a.title}>
                        <span className="block truncate text-sm font-medium text-ink">{a.title}</span>
                      </Tooltip>
                      <span className="flex flex-wrap items-center gap-x-1 text-xs text-ink-3">
                        <SocialIcon network={a.channel} size="xs" />
                        {CHANNEL_LABELS[a.channel] ?? a.channel} · {roleTitle(a.createdByRole)} · {relativeTime(a.updatedAt)}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-ink-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function RecentWork({ slug, data }: { slug: string; data: Today }) {
  return (
    <section aria-labelledby="recent-heading">
      <h2 id="recent-heading" className="heading-section">Latest work</h2>
      {data.recent.length === 0 ? (
        <p className="mt-3 text-sm text-ink-2">No work yet. Ask for something above to get started.</p>
      ) : (
        <Card className="mt-4">
          <CardHeader className="sr-only">
            <CardTitle>Recent jobs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul>
              {data.recent.map((r) => {
                const s = RUN_STATUS[r.status] ?? { label: r.status, tone: "neutral" as const };
                return (
                  <li key={r.id} className="relative flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-2">
                    <RoleStack roles={r.roles} size="sm" />
                    <span className="min-w-0 flex-1">
                      <Link href={r.kind === "strategy" ? `/app/${slug}/plan` : `/app/${slug}/work/${r.id}`} className="block text-sm font-medium text-ink after:absolute after:inset-0">
                        {r.title}
                      </Link>
                      <span className="block text-xs text-ink-3">
                        {r.roles.map((x) => ROLE_META[x]?.short).join(", ")} · {relativeTime(r.createdAt)}
                        {r.isFixture ? " · demo" : ""}
                      </span>
                      {r.userMessage && r.status !== "verified" && <span className="mt-1 block text-ui text-ink-2">{r.userMessage}</span>}
                    </span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

/** Customers waiting on you: unanswered messages, the next call and open deals. Hidden when there's nothing. */
function AttentionStrip({ slug }: { slug: string }) {
  const a = useQuery(api.inbox.attention, { slug });
  if (!a || (!a.inboxOpen && !a.nextCall && !a.openDeals)) return null;
  const money = (minor: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: a.currency, maximumFractionDigits: 0 }).format(minor / 100);
  return (
    <section aria-label="Customers waiting" className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
      {a.inboxOpen ? (
        <Link href={`/app/${slug}/inbox`} className="font-medium text-brand-800 underline-offset-2 hover:underline">
          {a.inboxOpen} message{a.inboxOpen === 1 ? "" : "s"} to answer{a.inboxUnread ? ` (${a.inboxUnread} new)` : ""}
        </Link>
      ) : null}
      {a.nextCall ? (
        <span className="text-ink-2">
          Next call: <span className="font-medium text-ink">{a.nextCall.name}</span>, {new Date(a.nextCall.startAt).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}
        </span>
      ) : null}
      {a.openDeals ? (
        <Link href={`/app/${slug}/pipeline`} className="text-ink-2 underline-offset-2 hover:underline">
          {a.openDeals} open deal{a.openDeals === 1 ? "" : "s"}{a.pipelineValue ? ` · ${money(a.pipelineValue)} in play` : ""}
        </Link>
      ) : null}
    </section>
  );
}
