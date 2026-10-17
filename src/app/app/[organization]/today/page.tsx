"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Compass,
  FileCheck2,
  Hourglass,
  Lightbulb,
  Mail,
  Megaphone,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Callout, Card, CardContent, CardHeader, CardTitle, EmptyState, IconTile, Skeleton, Textarea, toast, type Tone } from "@/components/ui";
import { cn } from "@/lib/utils";
import { PauseAllButton } from "@/components/app/AppShell";
import { errorInfo, errorMessage } from "@/components/app/errors";
import { microsToDisplay, relativeTime } from "@/components/app/money";
import { CHANNEL_LABELS, ROLE_META, roleTitle } from "@/components/app/roles";
import { RoleAvatar, RoleStack } from "@/components/app/RoleAvatar";
import { useNow } from "@/components/app/content/shared";
import { ASK_KEY } from "@/components/app/CommandPalette";

const NEXT_VISUAL: Record<string, { icon: LucideIcon; tone: Tone }> = {
  plan: { icon: Compass, tone: "violet" },
  approvals: { icon: FileCheck2, tone: "amber" },
  uncertain: { icon: CircleHelp, tone: "orange" },
  card: { icon: Lightbulb, tone: "brand" },
  onboarding: { icon: Sparkles, tone: "pink" },
};

const SUGGESTIONS: { text: string; icon: LucideIcon; tone: Tone }[] = [
  { text: "Get 3 Instagram posts ready for next week", icon: Megaphone, tone: "pink" },
  { text: "Write a welcome email sequence", icon: Mail, tone: "blue" },
  { text: "Why did sign-ups change?", icon: BarChart3, tone: "teal" },
  { text: "Draft a small Google search ad test", icon: Target, tone: "red" },
];

function StatCard({ icon: Icon, tone, label, value, hint }: { icon: LucideIcon; tone: Tone; label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-ink-3">{label}</p>
        <IconTile icon={Icon} tone={tone} size="xs" />
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">{value}</p>
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

  const running = data.recent.filter((r) => ["cost_reserved", "preparing", "executing"].includes(r.status)).length;
  const doneThisWeek = now ? data.recent.filter((r) => r.status === "verified" && r.createdAt > now - 7 * 86_400_000).length : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] text-ink-3">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-1 text-[28px] leading-9 text-ink">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-[15px] text-ink-3">Here’s what your AI growth team is working on{data.org.name ? ` for ${data.org.name.replace(/ \(demo\)$/i, "")}` : ""}.</p>
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
      <section aria-label="Your goal" className="relative overflow-hidden rounded-xl border border-line bg-surface p-5 shadow-sm">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand-800" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <IconTile icon={Target} tone="brand" size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Your goal</p>
            {data.goal ? (
              <>
                <p className="mt-0.5 text-lg font-semibold leading-snug text-ink">{data.goal.statement}</p>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="neutral">{data.goal.horizonDays} days</Badge>
                  <Badge tone="neutral">
                    {data.goal.monthlyAdBudget > 0
                      ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: data.goal.currency, maximumFractionDigits: 0 }).format(data.goal.monthlyAdBudget)}/month ads, paid to the platforms`
                      : "No paid ads"}
                  </Badge>
                </p>
              </>
            ) : (
              <p className="mt-0.5 text-lg font-semibold text-ink">No goal yet. Tell your team what you’d like to achieve.</p>
            )}
          </div>
          <Button asChild variant="secondary" size="md">
            <Link href={data.goal ? `/app/${slug}/plan` : `/onboarding?workspace=${slug}`}>
              {data.goal ? "See the plan" : "Set a goal"} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>

      {/* At a glance */}
      <section aria-label="At a glance" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Hourglass} tone="amber" label="Needs your OK" value={data.approvalsCount + (data.strategy?.status === "needs_approval" ? 1 : 0)} hint="Nothing goes live without you" />
        <StatCard icon={Zap} tone="blue" label="Working now" value={running} hint={running ? "Jobs in progress" : "Your team is ready"} />
        <StatCard icon={CheckCircle2} tone="green" label="Done this week" value={doneThisWeek} hint="Finished jobs" />
        <StatCard icon={Users} tone="violet" label="Your AI team" value={10} hint="Specialists on your business" />
      </section>

      {/* Next actions: Apollo-style checklist card */}
      <section aria-labelledby="next-heading" className="rounded-xl border border-line bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
          <div>
            <h2 id="next-heading" className="flex items-center gap-2 text-xl text-ink">
              Do these next {data.next.length ? <Badge tone="brand">{data.next.length} to do</Badge> : null}
            </h2>
            <p className="mt-0.5 text-[15px] text-ink-3">Your team lines these up. Nothing goes live until you approve it.</p>
          </div>
        </div>
        {data.next.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<CheckCircle2 aria-hidden />} title="You're all caught up" body="Nothing needs you right now. Ask your team for something below, or check Results." />
          </div>
        ) : (
          <ol className="mt-3 divide-y divide-line border-t border-line">
            {data.next.map((n, i) => {
              const v = NEXT_VISUAL[n.kind] ?? NEXT_VISUAL.card;
              return (
                <li key={`${n.kind}-${i}`} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-md border border-line-strong" />
                  <IconTile icon={v.icon} tone={v.tone} size="sm" />
                  <p className="min-w-0 flex-1 text-[15px] leading-6 text-ink-3">
                    <span className="sr-only">Step {i + 1} of {data.next.length}: </span>
                    <span className="font-semibold text-ink">{n.title}</span> {n.why}
                  </p>
                  <Button asChild size="md" variant={i === 0 ? "primary" : "secondary"}>
                    <Link href={n.href}>Open</Link>
                  </Button>
                </li>
              );
            })}
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
    // A question asked from the ⌘K palette arrives ready to send.
    try {
      const asked = sessionStorage.getItem(ASK_KEY);
      if (asked) {
        sessionStorage.removeItem(ASK_KEY);
        queueMicrotask(() => {
          setText(asked);
          document.getElementById("chat-input")?.focus();
        });
      }
    } catch {
      // Storage unavailable.
    }
  }, []);
  useEffect(() => {
    // Scroll only the conversation, never the page.
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [data.chat.length]);

  return (
    <section aria-labelledby="chat-heading" className="flex flex-col">
      <div>
        <h2 id="chat-heading" className="flex items-center gap-2 text-xl text-ink">
          <Sparkles className="size-5 text-brand-800" aria-hidden="true" /> Ask your team
        </h2>
        <p className="mt-0.5 text-[15px] text-ink-3">Say what you want in your own words. You approve every action.</p>
      </div>
      <Card className="mt-4 flex flex-1 flex-col">
        <CardContent className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
          {data.chat.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface-2 p-3.5 text-sm text-ink-2">
              <p className="text-[13px] font-medium text-ink">Try one of these</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    onClick={() => setText(s.text)}
                    className="flex min-h-10 items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left text-[13px] text-ink transition hover:border-line-strong"
                  >
                    <IconTile icon={s.icon} tone={s.tone} size="xs" />
                    {s.text}
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
                      "max-w-[92%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
                      m.author === "user" ? "rounded-br-md bg-brand-800 text-white" : "rounded-bl-md border border-line bg-surface-2 text-ink",
                    )}
                  >
                    <span className="sr-only">{m.author === "user" ? "You said: " : "ClimbOS: "}</span>
                    {m.text}
                    {m.status === "thinking" && (
                      <span className="mt-2 block text-sm text-brand-100/90">
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
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-3">Suggested by your plan</h3>
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
    <div id={`card-${card.id}`} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-2.5 font-bold text-ink">
          <IconTile icon={Lightbulb} tone="brand" size="sm" />
          {card.title}
        </p>
        {status === "running" && <Badge tone="blue" icon={<Clock3 />}>Working</Badge>}
        {status === "done" && <Badge tone="green" icon={<CheckCircle2 />}>Done</Badge>}
        {status === "failed" && <Badge tone="red">Didn’t finish</Badge>}
        {status === "blocked" && <Badge tone="amber">Needs setup</Badge>}
      </div>
      <p className="mt-1 text-sm text-ink-2">{card.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {card.roles.map((r) => (
          <span key={r} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-0.5 pl-0.5 pr-2.5 text-[0.8125rem] font-semibold text-ink-2">
            <RoleAvatar role={r} size="xs" /> {ROLE_META[r]?.title ?? r}
          </span>
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
            <dd className="text-ink">{microsToDisplay(card.costEstimateMicros)} of this month’s AI capacity</dd>
          </div>
        )}
        {card.blockedReason && (
          <div className="flex gap-2">
            <dt className="text-ink-3">Why it’s waiting:</dt>
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
        <Link href={`/app/${slug}/content?status=in_review`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-800">
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
        <h2 id="approvals-heading" className="text-xl text-ink">Waiting for you</h2>
        {data.approvalsCount > 0 && <Badge tone="amber">{data.approvalsCount} to review</Badge>}
      </div>
      <Card className="mt-4">
        <CardContent className="p-0">
          {data.strategy?.status === "needs_approval" && (
            <Link href={`/app/${slug}/plan`} className="flex items-center gap-3 border-b border-line p-4 hover:bg-surface-2">
              <RoleAvatar role="ceo" size="md" />
              <span className="flex-1">
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
                  <Link href={`/app/${slug}/content/${a.id}`} className="flex items-center gap-3 border-b border-line p-4 last:border-b-0 hover:bg-surface-2">
                    <RoleAvatar role={a.createdByRole ?? "social_media_manager"} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{a.title}</span>
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
      <h2 id="team-heading" className="text-xl text-ink">Your AI team</h2>
      <p className="mt-0.5 text-[15px] text-ink-3">Ten specialists sharing one brain about your business.</p>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {Object.entries(ROLE_META).map(([key, r]) => {
          const active = working.has(key);
          return (
            <li key={key} className={cn("flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-sm", active ? "border-brand-200 bg-brand-50" : "border-line bg-surface")}>
              <RoleAvatar role={key} size="sm" />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{r.title.replace("AI ", "")}</span>
                <span className={cn("flex items-center gap-1 text-xs", active ? "font-semibold text-brand-800" : "text-ink-3")}>
                  <span aria-hidden="true" className={cn("size-1.5 rounded-full", active ? "animate-soft-pulse bg-brand-800" : "bg-green-500")} />
                  {active ? "Working now" : "Ready"}
                </span>
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
      <h2 id="recent-heading" className="text-xl text-ink">Latest work</h2>
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
                    <RoleStack roles={r.roles} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{r.title}</span>
                      <span className="block text-sm text-ink-3">
                        {r.roles.map((x) => ROLE_META[x]?.short).join(", ")} · {relativeTime(r.createdAt)}
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
