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
  MessageCircle,
  Sparkles,
  Target,
  Zap,
  ExternalLink,
  type LucideIcon,
} from "@/components/icons"
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Callout, Card, CardContent, CardHeader, CardTitle, EmptyState, IconTile, Segmented, Skeleton, SocialIcon, Tooltip, buttonClasses, toast, type Tone } from "@/components/ui";
import { PauseAllButton } from "@/components/app/AppShell";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { CHANNEL_LABELS } from "@/components/app/roles";
import { RoleAvatar, RoleStack } from "@/components/app/RoleAvatar";
import { askDraftKey } from "@/components/app/CommandPalette";
import { WordHelp } from "@/components/ui/word-help";
import { PageHeader } from "@/components/app/results/QueryBoundary";
import { WishComposer, wishSuggestions, type WishComposerHandle } from "@/components/app/wish/WishComposer";
import { RetryRunIfPossible, RunProgressCompact } from "@/components/app/content/RunProgress";
import { WishFeed } from "@/components/app/wish/WishFeed";
import { IdeaDeck } from "@/components/app/today/IdeaDeck";
import { Prose } from "@/components/ds/content";
import { climbTarget } from "@/components/climb/context";

const NEXT_VISUAL: Record<string, { icon: LucideIcon; tone: Tone }> = {
  plan: { icon: Compass, tone: "violet" },
  approvals: { icon: FileCheck2, tone: "amber" },
  uncertain: { icon: CircleHelp, tone: "orange" },
  card: { icon: Lightbulb, tone: "brand" },
  onboarding: { icon: Sparkles, tone: "pink" },
};


function StatCard({ icon: Icon, tone, label, value }: { icon: LucideIcon; tone: Tone; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-ui font-medium text-ink-3">{label}</p>
        <IconTile icon={Icon} tone={tone} size="xs" />
      </div>
      <p className="metric mt-1">{value}</p>
    </div>
  );
}

type Today = NonNullable<ReturnType<typeof useQuery<typeof api.workspace.today>>>;
type CardView = Today["cards"][number];
type GrowthOpportunity = NonNullable<Today["strategy"]>["opportunities"][number];

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
  const composer = useRef<WishComposerHandle>(null);
  const me = useQuery(api.orgs.me);
  useEffect(() => {
    if (!me || !data) return;
    const loadDraft = () => {
      try {
        const key = askDraftKey(slug, me.userId);
        const draft = sessionStorage.getItem(key);
        if (draft) { sessionStorage.removeItem(key); composer.current?.fill(draft); }
      } catch { /* Storage may be unavailable. */ }
    };
    loadDraft();
    window.addEventListener("climbos:compose", loadDraft);
    return () => window.removeEventListener("climbos:compose", loadDraft);
  }, [data, me, slug]);

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
  const running = data.counts.workingNow;
  const doneThisWeek = data.counts.doneThisWeek;

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
        intro="Tell us what you need. We’ll help you take it one step at a time."
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

      {data.org.kind === "customer" && data.org.onboardingStep !== "done" && (data.role === "owner" || data.role === "admin") && (
        <Callout tone="info" title="Finish setting up" action={<Button asChild size="sm"><Link href={`/onboarding?workspace=${slug}`}>Continue setup</Link></Button>}>
          A few steps left.
        </Callout>
      )}

      <WishComposer
        key={slug}
        ref={composer}
        slug={slug}
        suggestions={wishSuggestions(data.business?.type)}
        disabled={!data.canRunAi}
        disabledReason={!data.canRunAi ? (data.accessMessage ?? null) : null}
      />
      <WishFeed slug={slug} chat={data.chat} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.45fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          {data.strategy?.opportunities?.length ? <GrowthOpportunities slug={slug} strategyId={data.strategy.id} status={data.strategy.status} opportunities={data.strategy.opportunities} /> : null}
          {/* Next actions */}
          <section aria-labelledby="next-heading" className="rounded-xl border border-line bg-surface">
            <div className="px-5 pt-5">
              <h2 id="next-heading" className="heading-section flex items-center gap-2">
                Do these next {data.next.length ? <Badge tone="brand">{data.next.length}</Badge> : null}
              </h2>
            </div>
            {data.next.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={<CheckCircle2 aria-hidden />} title="No next step waiting" body="Ask a question above, or open Your plan to choose what to work on." />
              </div>
            ) : (
              <ol className="mt-3 divide-y divide-line border-t border-line">
                {data.next.map((n, i) => {
                  const v = NEXT_VISUAL[n.kind] ?? NEXT_VISUAL.card;
                  return (
                    <li key={`${n.kind}-${i}`}>
                      <Link href={n.href} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2">
                        <IconTile icon={v.icon} tone={v.tone} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink"><span className="sr-only">Step {i + 1} of {data.next.length}: </span>{n.title}</span>
                          <span className="mt-1 block text-sm text-ink-3">{n.why}</span>
                        </span>
                        <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-3" />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
          {suggested.length > 0 && (
            <section aria-labelledby="suggested-heading" className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id="suggested-heading" className="heading-section">
                  Ideas
                </h2>
                <span className="text-xs text-ink-3">Swipe or use ← →</span>
              </div>
              <IdeaDeck slug={slug} cards={suggested.filter((c) => c.status === "proposed" || c.status === "blocked")} />
              {suggested.some((c) => c.status !== "proposed" && c.status !== "blocked") ? (
                <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]">
                  {suggested
                    .filter((c) => c.status !== "proposed" && c.status !== "blocked")
                    .map((c) => (
                      <li key={c.id}>
                        <ActionCard slug={slug} card={c} />
                      </li>
                    ))}
                </ul>
              ) : null}
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
                <p className="heading-card mt-0.5">{data.goal ? data.goal.statement : "No goal yet"}</p>
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
                <span className="mt-3 flex flex-wrap gap-x-4">
                  <Link href={data.goal ? `/app/${slug}/plan` : `/app/${slug}/settings/business`} className={buttonClasses({ variant: "link" })}>
                    {data.goal ? "See the plan" : "Set a goal"} <ArrowRight aria-hidden />
                  </Link>
                  {data.goal ? (
                    <Link href={`/app/${slug}/settings/business`} className={buttonClasses({ variant: "link" })}>
                      Change goal
                    </Link>
                  ) : null}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* At a glance */}
      <section aria-label="At a glance" className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Hourglass} tone="amber" label="Needs your OK" value={data.approvalsCount + (data.strategy?.status === "needs_approval" ? 1 : 0)} />
        <StatCard icon={Zap} tone="blue" label="Working now" value={running} />
        <StatCard icon={CheckCircle2} tone="green" label="Done this week" value={doneThisWeek} />
      </section>
      <AttentionStrip slug={slug} />

      <RecentWork slug={slug} data={data} />
      <WordHelp />
      <div className="md:hidden">
        <PauseAllButton slug={slug} paused={Boolean(data.emergencyStop)} variant="large" />
      </div>
    </div>
  );
}

function GrowthOpportunities({ slug, strategyId, status, opportunities }: { slug: string; strategyId: Id<"strategies">; status: NonNullable<Today["strategy"]>["status"]; opportunities: GrowthOpportunity[] }) {
  const askAbout = useMutation(api.workspace.askAboutOpportunity);
  const [asking, setAsking] = useState<string | null>(null);
  const [detail, setDetail] = useState<"simple" | "detailed" | "expert">("simple");
  const planStatus = status === "needs_approval" ? "Plan needs your OK" : status === "approved" ? "From your approved plan" : status === "draft" ? "Draft plan" : "Plan update";
  const tone = status === "needs_approval" ? "amber" : status === "approved" ? "green" : "neutral";
  const visibleOpportunities = opportunities.slice(0, 3);
  async function ask(opportunity: GrowthOpportunity) {
    if (!opportunity.id) return;
    setAsking(opportunity.id);
    try {
      await askAbout({ slug, strategyId, opportunityId: opportunity.id, question: "Explain why this may fit my business, what evidence supports it, and what I should verify before acting." });
      toast({ tone: "success", title: "Question sent to ClimbOS", description: "The reply will appear in your Today conversation." });
    } catch (error) {
      toast({ tone: "danger", title: errorMessage(error) });
    } finally {
      setAsking(null);
    }
  }

  return (
    <section aria-labelledby="opportunities-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="opportunities-heading" className="heading-section">Here’s where I’d start</h2>
          <p className="mt-1 text-sm text-ink-3">A short list from your growth plan, in the order it recommends.</p>
        </div>
        <span className="flex flex-wrap items-center gap-2"><Badge tone={tone}>{planStatus}</Badge><Segmented label="Opportunity explanation level" value={detail} onChange={setDetail} options={[{ value: "simple", label: "Simple" }, { value: "detailed", label: "Detailed" }, { value: "expert", label: "Expert" }]} /></span>
      </div>
      <ol className="grid gap-3">
        {visibleOpportunities.map((opportunity, index) => (
          <li key={opportunity.id ?? `${opportunity.title}-${index}`}>
            <article className={`flex flex-col gap-3 rounded-xl border bg-surface p-4 ${index === 0 ? "border-brand/40 shadow-[var(--card-shadow)]" : "border-line"}`}>
              <div>
                <p className="text-overline">{index === 0 ? "First recommendation" : `Also worth exploring · ${index + 1}`}</p>
                <h3 className="heading-card mt-0.5">{opportunity.title}</h3>
                {opportunity.why ? <p className="mt-1 text-sm text-ink-2">{opportunity.why}</p> : null}
              </div>
              {opportunity.nextStep ? (
                <div className="rounded-lg bg-surface-2 px-3 py-2">
                  <p className="text-xs font-medium text-ink-3">First step</p>
                  <p className="mt-0.5 text-sm text-ink">{opportunity.nextStep}</p>
                </div>
              ) : null}
              {detail !== "simple" && opportunity.ownerHoursPerWeek !== null ? <p className="text-xs text-ink-3">Planned owner time: {opportunity.ownerHoursPerWeek} {opportunity.ownerHoursPerWeek === 1 ? "hour" : "hours"}/week</p> : null}
              {detail === "expert" && opportunity.forecast ? (
                <div className="rounded-lg border border-line px-3 py-2">
                  <p className="text-xs font-medium text-ink-3">Modelled scenario · {opportunity.forecast.days} days</p>
                  <p className="mt-0.5 text-sm text-ink-2">{opportunity.forecast.low}–{opportunity.forecast.high} {opportunity.forecast.unit} · midpoint {opportunity.forecast.likely}</p>
                  <p className="mt-1 text-xs text-ink-3">A simulated estimate from the plan’s stated inputs, not a measured result or guarantee.</p>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={`/app/${slug}/plan#plays`} className={buttonClasses({ variant: "link" })}>
                    Open plan <ArrowRight aria-hidden />
                  </Link>
                  {opportunity.id ? <Button size="sm" variant="secondary" loading={asking === opportunity.id} disabled={asking !== null} onClick={() => void ask(opportunity)}><MessageCircle aria-hidden /> Ask about this</Button> : null}
                </span>
              </div>
              {detail !== "simple" && opportunity.sources.length ? (
                <div className="border-t border-line pt-2">
                  <p className="text-xs font-medium text-ink-2">Evidence basis</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {opportunity.sources.map((source, sourceIndex) => (
                      <li key={`${source.label}-${source.url ?? source.detail ?? sourceIndex}`} className="text-xs text-ink-2">
                        {source.url ? (
                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline decoration-line underline-offset-2">
                            {source.label} <ExternalLink aria-hidden className="size-3" />
                          </a>
                        ) : <span className="font-medium">{source.label}{source.detail ? ` · ${source.detail}` : ""}</span>}
                        {source.quote ? <p className="mt-1 text-ink-3">“{source.quote}”</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : detail !== "simple" ? <p className="border-t border-line pt-2 text-xs text-ink-3">No linked source was saved for this play.</p> : null}
            </article>
          </li>
        ))}
      </ol>
    </section>
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
        <Tooltip content={card.description || card.proposedEffect}>
          <p tabIndex={0} className="text-sm font-medium text-ink">{card.title}</p>
        </Tooltip>
        {status === "running" && card.runId ? (
          <RunProgressCompact slug={slug} runId={card.runId as Id<"workflowRuns">} className="mt-1.5" />
        ) : (
          card.blockedReason && (status === "proposed" || status === "blocked") ? <p className="truncate text-xs text-ink-3">{card.blockedReason}</p> : null
        )}
        {status === "failed" && card.runId ? <RetryRunIfPossible slug={slug} runId={card.runId as Id<"workflowRuns">} className="mt-1.5" /> : null}
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
          card.runId ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={`/app/${slug}/work/${card.runId}`}>See why</Link>
            </Button>
          ) : (
            <Badge tone="red">Didn’t finish</Badge>
          )
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
    <section id="review" aria-labelledby="approvals-heading" className="scroll-mt-20">
      <div className="flex items-center justify-between">
        <h2 id="approvals-heading" className="heading-section">Review before it goes ahead</h2>
        {data.approvalsCount > 0 && <Badge tone="amber">{data.approvalsCount}</Badge>}
      </div>
      <Card className="mt-4">
        <CardContent className="p-0">
          {data.strategy?.status === "needs_approval" && (
            <Link href={`/app/${slug}/plan`} className="flex items-center gap-3 border-b border-line p-4 transition-colors hover:bg-surface-2">
              <RoleAvatar role="ceo" size="md" />
              <span className="flex-1">
                <span className="block text-sm font-medium text-ink">Growth plan v{data.strategy.version}</span>
                <span className="block text-xs text-ink-3">Needs approval</span>
              </span>
              <ArrowRight className="size-4 text-ink-3" aria-hidden />
            </Link>
          )}
          {data.approvals.length === 0 && data.strategy?.status !== "needs_approval" ? (
            <p className="p-5 text-sm text-ink-3">Nothing needs your review right now.</p>
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
                        {CHANNEL_LABELS[a.channel] ?? a.channel} · {relativeTime(a.updatedAt)}
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
        <p className="mt-3 text-sm text-ink-3">No work yet.</p>
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
                    <div className="min-w-0 flex-1">
                      <Link href={`/app/${slug}/work/${r.id}`} className="block text-sm font-medium text-ink after:absolute after:inset-0">
                        {r.title}
                      </Link>
                      <span className="block text-xs text-ink-3">
                        {relativeTime(r.createdAt)}
                        {r.isFixture ? " · demo" : ""}
                      </span>
                      {r.userMessage && r.status !== "verified" ? <Prose text={r.userMessage} max={1} tone="muted" className="relative z-10 mt-1 text-ui" /> : null}
                    </div>
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
