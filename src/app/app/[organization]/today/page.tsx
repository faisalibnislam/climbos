"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ArrowRight, CheckCircle2, Clock3, Send, ShieldCheck, Target } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Callout, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton, Textarea, toast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { PauseAllButton } from "@/components/app/AppShell";
import { errorInfo, errorMessage } from "@/components/app/errors";
import { microsToDisplay, relativeTime } from "@/components/app/money";
import { CHANNEL_LABELS, ROLE_META, roleTitle } from "@/components/app/roles";

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
  const workingRoles = new Set(data.recent.filter((r) => ["cost_reserved", "preparing", "executing"].includes(r.status)).flatMap((r) => r.roles));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-3">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-1 font-display text-3xl text-ink sm:text-4xl">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <div className="hidden md:block">
          <PauseAllButton slug={slug} paused={Boolean(data.emergencyStop)} variant="large" />
        </div>
      </header>

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

      {/* Goal */}
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-4 bg-gradient-to-br from-green-50 to-surface p-5 sm:flex-row sm:items-center sm:p-6">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-green-800 text-white">
            <Target className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-green-800">Your goal</p>
            {data.goal ? (
              <>
                <p className="mt-1 text-xl font-semibold leading-snug text-ink">{data.goal.statement}</p>
                <p className="mt-1 text-sm text-ink-2">
                  {data.goal.horizonDays} days ·{" "}
                  {data.goal.monthlyAdBudget > 0
                    ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: data.goal.currency, maximumFractionDigits: 0 }).format(data.goal.monthlyAdBudget)}/month ad budget, paid directly to ad platforms`
                    : "No paid ads"}
                </p>
              </>
            ) : (
              <p className="mt-1 text-lg text-ink">No goal yet. Tell your team what you'd like to achieve.</p>
            )}
          </div>
          <Button asChild variant="secondary">
            <Link href={data.goal ? `/app/${slug}/plan` : `/onboarding?workspace=${slug}`}>{data.goal ? "See the plan" : "Set a goal"}</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Next actions */}
      <section aria-labelledby="next-heading">
        <h2 id="next-heading" className="font-display text-2xl text-ink">Do these next</h2>
        {data.next.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<CheckCircle2 aria-hidden />}
            title="You're all caught up"
            body="Nothing needs you right now. Ask your team for something below, or check Results."
          />
        ) : (
          <ol className="mt-4 grid gap-4 md:grid-cols-3">
            {data.next.map((n, i) => (
              <li key={`${n.kind}-${i}`}>
                <Link
                  href={n.href}
                  className="group flex h-full flex-col rounded-[16px] border border-line bg-surface p-5 shadow-sm transition hover:border-green-700/40 hover:shadow-md"
                >
                  <span className="text-sm font-semibold text-green-800">
                    {i + 1}
                    <span className="sr-only"> of {data.next.length}</span>
                  </span>
                  <span className="mt-2 text-lg font-semibold leading-snug text-ink">{n.title}</span>
                  <span className="mt-1 flex-1 text-sm text-ink-2">{n.why}</span>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-green-800">
                    Open <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.45fr_1fr]">
        <ChatPanel slug={slug} data={data} />
        <div className="space-y-8">
          <ApprovalsPanel slug={slug} data={data} />
          <TeamPanel working={workingRoles} />
        </div>
      </div>

      <RecentWork data={data} />
      <div className="md:hidden">
        <PauseAllButton slug={slug} paused={Boolean(data.emergencyStop)} variant="large" />
      </div>
    </div>
  );
}

function ChatPanel({ slug, data }: { slug: string; data: Today }) {
  const send = useMutation(api.workspace.sendChat);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const thinking = data.chat.some((m) => m.status === "thinking");
  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [data.chat.length]);

  const suggestions = ["Get 3 Instagram posts ready for next week", "Write a welcome email sequence", "Why did sign-ups change?", "Draft a small Google search ad test"];

  return (
    <section aria-labelledby="chat-heading" className="flex flex-col">
      <h2 id="chat-heading" className="font-display text-2xl text-ink">What would you like to achieve?</h2>
      <p className="mt-1 text-sm text-ink-2">Ask in your own words. Your team turns it into clear actions you approve — nothing runs on its own.</p>
      <Card className="mt-4 flex flex-1 flex-col">
        <CardContent className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
          {data.chat.length === 0 ? (
            <div className="rounded-[12px] bg-surface-2 p-4 text-sm text-ink-2">
              Try one of these:
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => setText(s)} className="min-h-10 rounded-full border border-line bg-surface px-3 text-left text-sm text-ink hover:border-green-700/40">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol ref={listRef} className="flex max-h-[520px] flex-col gap-4 overflow-y-auto pr-1" aria-live="polite" aria-relevant="additions">
              {data.chat.map((m) => (
                <li key={m.id} className={cn("flex flex-col gap-2", m.author === "user" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[92%] rounded-[16px] px-4 py-3 text-[15px] leading-relaxed",
                      m.author === "user" ? "bg-green-800 text-white" : "border border-line bg-surface-2 text-ink",
                    )}
                  >
                    <span className="sr-only">{m.author === "user" ? "You said: " : "ClimbOS: "}</span>
                    {m.text}
                    {m.status === "thinking" && (
                      <span className="mt-2 block text-sm text-green-100/90">
                        <span className="animate-soft-pulse">Your team is thinking…</span>
                      </span>
                    )}
                  </div>
                  {m.cards.length > 0 && (
                    <div className="grid w-full gap-3">
                      {m.cards.map((c) => (
                        <ActionCard key={c.id} slug={slug} card={c} />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
          <form
            className="mt-auto flex items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!text.trim() || busy) return;
              setBusy(true);
              try {
                await send({ slug, text });
                setText("");
              } catch (err) {
                const info = errorInfo(err);
                toast({ tone: "danger", title: info.message });
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="chat-input" className="sr-only">
              Message your growth team
            </label>
            <Textarea
              id="chat-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              autosize
              maxRows={6}
              placeholder="e.g. Get posts ready for our launch next Tuesday"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                }
              }}
              className="flex-1"
            />
            <Button type="submit" loading={busy || thinking} aria-label="Send">
              <Send className="size-4" aria-hidden />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>
        </CardContent>
      </Card>
      {data.cards.filter((c) => !data.chat.some((m) => m.cards.some((x) => x.id === c.id))).length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-3">Suggested by your plan</h3>
          <div className="mt-3 grid gap-3">
            {data.cards
              .filter((c) => !data.chat.some((m) => m.cards.some((x) => x.id === c.id)))
              .map((c) => (
                <ActionCard key={c.id} slug={slug} card={c} />
              ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ActionCard({ slug, card }: { slug: string; card: CardView }) {
  const run = useMutation(api.workspace.runCard);
  const dismiss = useMutation(api.workspace.dismissCard);
  const [busy, setBusy] = useState(false);
  const status = card.status;
  return (
    <div id={`card-${card.id}`} className="rounded-[14px] border border-line bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold text-ink">{card.title}</p>
        {status === "running" && <Badge tone="blue" icon={<Clock3 />}>Working</Badge>}
        {status === "done" && <Badge tone="green" icon={<CheckCircle2 />}>Done</Badge>}
        {status === "failed" && <Badge tone="red">Didn't finish</Badge>}
        {status === "blocked" && <Badge tone="amber">Needs setup</Badge>}
      </div>
      <p className="mt-1 text-sm text-ink-2">{card.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {card.roles.map((r) => (
          <Badge key={r} tone="neutral">
            <span aria-hidden>{ROLE_META[r]?.emoji}</span> {ROLE_META[r]?.title ?? r}
          </Badge>
        ))}
      </div>
      <dl className="mt-3 grid gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-ink-3">What happens:</dt>
          <dd className="text-ink">{card.proposedEffect}</dd>
        </div>
        {card.costEstimateMicros > 0 && (
          <div className="flex gap-2">
            <dt className="text-ink-3">Most it can use:</dt>
            <dd className="text-ink">{microsToDisplay(card.costEstimateMicros)} of this month's AI capacity</dd>
          </div>
        )}
        {card.blockedReason && (
          <div className="flex gap-2">
            <dt className="text-ink-3">Why it's waiting:</dt>
            <dd className="text-ink">{card.blockedReason}</dd>
          </div>
        )}
      </dl>
      {status === "proposed" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await run({ slug, cardId: card.id as Id<"actionCards"> });
                toast({ tone: "info", title: "Started. You'll see the drafts in Content when they're ready." });
              } catch (e) {
                toast({ tone: "danger", title: errorMessage(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            <ShieldCheck className="size-4" aria-hidden /> {card.kind === "note" ? "Mark done" : "Do it"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => dismiss({ slug, cardId: card.id as Id<"actionCards"> }).catch((e) => toast({ tone: "danger", title: errorMessage(e) }))}>
            Not now
          </Button>
        </div>
      )}
      {status === "done" && (
        <Link href={`/app/${slug}/content?status=in_review`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-green-800">
          Review the drafts <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function ApprovalsPanel({ slug, data }: { slug: string; data: Today }) {
  return (
    <section aria-labelledby="approvals-heading">
      <div className="flex items-center justify-between">
        <h2 id="approvals-heading" className="font-display text-2xl text-ink">
          Waiting for you
        </h2>
        {data.approvalsCount > 0 && <Badge tone="amber">{data.approvalsCount} to review</Badge>}
      </div>
      <Card className="mt-4">
        <CardContent className="p-0">
          {data.strategy?.status === "needs_approval" && (
            <Link href={`/app/${slug}/plan`} className="flex items-center justify-between gap-3 border-b border-line p-4 hover:bg-surface-2">
              <span>
                <span className="block font-medium text-ink">Growth plan v{data.strategy.version}</span>
                <span className="block text-sm text-ink-3">{roleTitle("ceo")} · needs your approval</span>
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
                  <Link href={`/app/${slug}/content/${a.id}`} className="flex items-center justify-between gap-3 border-b border-line p-4 last:border-b-0 hover:bg-surface-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{a.title}</span>
                      <span className="block text-sm text-ink-3">
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

function TeamPanel({ working }: { working: Set<string> }) {
  return (
    <section aria-labelledby="team-heading">
      <h2 id="team-heading" className="font-display text-2xl text-ink">Your AI team</h2>
      <p className="mt-1 text-sm text-ink-2">Ten specialists sharing one brain about your business.</p>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {Object.entries(ROLE_META).map(([key, r]) => {
          const active = working.has(key);
          return (
            <li key={key} className={cn("flex items-center gap-2 rounded-[12px] border px-3 py-2.5 text-sm", active ? "border-green-700/30 bg-green-50" : "border-line bg-surface")}>
              <span aria-hidden className="text-lg">{r.emoji}</span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{r.title.replace("AI ", "")}</span>
                <span className={cn("block text-xs", active ? "text-green-800" : "text-ink-3")}>{active ? "Working now" : "Ready"}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RecentWork({ data }: { data: Today }) {
  return (
    <section aria-labelledby="recent-heading">
      <h2 id="recent-heading" className="font-display text-2xl text-ink">Latest work</h2>
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
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-b-0">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">{r.title}</span>
                      <span className="block text-sm text-ink-3">
                        {r.roles.map((x) => ROLE_META[x]?.emoji).join(" ")} {r.roles.map((x) => ROLE_META[x]?.short).join(", ")} · {relativeTime(r.createdAt)}
                        {r.isFixture ? " · demo" : ""}
                      </span>
                      {r.userMessage && r.status !== "verified" && <span className="mt-1 block text-sm text-ink-2">{r.userMessage}</span>}
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
