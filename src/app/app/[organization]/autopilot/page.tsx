"use client";

import { AiModePicker, useAiMode, type AiMode } from "@/components/app/AiModePicker";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CalendarClock, CircleCheck, Hand, Loader2, Minus, MoreHorizontal, Plus, RotateCcw, ShieldCheck, SkipForward, Sparkles, TriangleAlert, Upload } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  FilterChip,
  IconButton,
  ProgressRing,
  RadioCards,
  Segmented,
  SocialIcon,
  Switch,
  Textarea,
  Tooltip,
  networkName,
  toast,
  type Tone,
} from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { cn } from "@/lib/utils";
import { RunProgressCompact } from "@/components/app/content/RunProgress";
import { useNow } from "@/components/app/content/shared";
import { climbTarget } from "@/components/climb/context";

const CHANNELS = ["instagram", "facebook", "linkedin", "x", "tiktok", "youtube", "pinterest"] as const;
const HOURS = [
  { h: 8, label: "8 am" },
  { h: 10, label: "10 am" },
  { h: 12, label: "12 pm" },
  { h: 15, label: "3 pm" },
  { h: 18, label: "6 pm" },
  { h: 20, label: "8 pm" },
];

type Data = NonNullable<ReturnType<typeof useQuery<typeof api.autopilot.get>>>;
type Slot = Data["weeks"][number]["slots"][number];
type Mode = "always_ask" | "trust_ladder" | "auto";

const STATUS: Record<string, { label: string; tone: Tone; icon?: React.ReactNode }> = {
  planned: { label: "Planned", tone: "neutral" },
  drafting: { label: "Drafting", tone: "blue", icon: <Loader2 className="animate-spin" /> },
  needs_approval: { label: "Needs your OK", tone: "amber", icon: <Hand /> },
  scheduled: { label: "Scheduled", tone: "brand", icon: <CalendarClock /> },
  ready_to_post: { label: "Ready for you to post", tone: "violet", icon: <Upload /> },
  published: { label: "Posted", tone: "green", icon: <CircleCheck /> },
  failed: { label: "Didn't finish", tone: "red", icon: <TriangleAlert /> },
};

export default function AutopilotPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.autopilot.get, { slug });
  const [editing, setEditing] = useState(false);
  if (data === undefined) return <LoadingBlock label="Loading autopilot" lines={4} />;
  const on = Boolean(data.settings?.enabled);
  // A free preview week shows its plan (ideas only) even while autopilot is off.
  const previewing = !on && data.weeks.some((w) => w.slots.length > 0);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        eyebrow="Social media"
        title="Autopilot"
        intro="Your social media manager plans each week, writes and designs the posts, and publishes within the rules you set here."
        actions={on ? <HeaderActions slug={slug} onEdit={() => setEditing((v) => !v)} editing={editing} canManage={data.canApprove} /> : undefined}
      />
      {data.activeRuns?.length ? (
        <section aria-label="Your team is working" className="rounded-xl border border-brand-200 bg-surface p-4">
          <p className="text-overline">Your team is working</p>
          <ul className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {data.activeRuns.map((r) => (
              <li key={r.id} className="min-w-0">
                <p className="truncate text-ui font-medium text-ink">{r.title}</p>
                <RunProgressCompact slug={slug} runId={r.id as Id<"workflowRuns">} className="mt-1.5" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data.settings?.pausedReason ? <Callout tone="warning" title="Autopilot is waiting">{data.settings.pausedReason}</Callout> : null}
      {(!on || editing) && data.canApprove ? <SetupCard slug={slug} data={data} onDone={() => setEditing(false)} /> : null}
      {!on && !data.canApprove ? <Callout tone="info" title="Autopilot is off">Ask an owner, admin or reviewer to set it up.</Callout> : null}
      {on ? <TrustLadder data={data} /> : null}
      {previewing ? (
        <Callout tone="info" title="Preview week">
          Ideas only: nothing was drafted or posted. Choose a package to have your team write and post them.
        </Callout>
      ) : null}
      {on || previewing ? <WeekView slug={slug} data={data} /> : null}
    </div>
  );
}

function HeaderActions({ slug, onEdit, editing, canManage }: { slug: string; onEdit: () => void; editing: boolean; canManage: boolean }) {
  const planNow = useMutation(api.autopilot.planNow);
  const [busy, setBusy] = useState(false);
  if (!canManage) return null;
  return (
    <>
      <Button variant="secondary" onClick={onEdit}>
        {editing ? "Close settings" : "Settings"}
      </Button>
      <Button
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await planNow({ slug });
            toast({ tone: "success", title: "Planning the week", description: "Drafts appear here as they're written." });
          } catch (e) {
            toast({ tone: "danger", title: errorMessage(e) });
          } finally {
            setBusy(false);
          }
        }}
      >
        <Sparkles aria-hidden /> Plan now
      </Button>
    </>
  );
}

/* ---------------- Setup ---------------- */

function SetupCard({ slug, data, onDone }: { slug: string; data: Data; onDone: () => void }) {
  const save = useMutation(api.autopilot.save);
  const s = data.settings;
  const connected = new Set(data.connected);
  const direct = new Set(data.directChannels);
  const [mode, setMode] = useState<Mode>((s?.mode as Mode) ?? "trust_ladder");
  const [cadence, setCadence] = useState<Record<string, number>>(() => {
    if (s) return Object.fromEntries(s.channels.map((c) => [c.channel, c.postsPerWeek]));
    const base: Record<string, number> = {};
    for (const c of CHANNELS) if (connected.has(c)) base[c] = 3;
    if (Object.keys(base).length === 0) base.linkedin = 2;
    return base;
  });
  const [hours, setHours] = useState<number[]>(s?.postingHours ?? []);
  const [topics, setTopics] = useState((s?.alwaysAskTopics ?? []).join(", "));
  const [images, setImages] = useState(s?.imagesPerWeek ?? 1);
  const credits = useQuery(api.workspace.credits, { slug });
  const paid = credits === undefined ? true : credits.paid || credits.isDemo;
  const preview = useMutation(api.autopilot.previewWeek);
  const [enabled, setEnabled] = useState(s ? s.enabled : true);
  const ai = useAiMode(slug);
  const [planMode, setPlanMode] = useState<AiMode | null>((s?.aiMode as AiMode | null) ?? null);
  const effectiveMode: AiMode = ai.data?.expertUnlocked ? (planMode ?? ai.mode) : "basic";
  const [busy, setBusy] = useState(false);
  const total = Object.values(cadence).reduce((a, b) => a + b, 0);

  const submit = async () => {
    setBusy(true);
    try {
      await save({
        slug,
        enabled: paid && enabled,
        mode,
        channels: Object.entries(cadence).map(([channel, postsPerWeek]) => ({ channel, postsPerWeek })),
        postingHours: hours,
        alwaysAskTopics: topics
          .split(/[,\n]/)
          .map((t) => t.trim())
          .filter(Boolean),
        imagesPerWeek: images,
        aiMode: effectiveMode,
      });
      toast({ tone: "success", title: enabled ? (s?.enabled ? "Autopilot updated" : "Autopilot is on") : "Autopilot is off", description: enabled && !s?.enabled ? "Your team is planning the first week now." : undefined });
      onDone();
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{s ? "Autopilot settings" : "Set up autopilot"}</CardTitle>
        <CardDescription>Choose how much your team may do on its own. You can change this any time, and Pause stops everything at once.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <AiModePicker slug={slug} kind="social_calendar" value={effectiveMode} onChange={setPlanMode} label="Who plans each week?" />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-ui font-medium text-ink">How should posts go out?</legend>
          <RadioCards
            aria-label="Autopilot mode"
            value={mode}
            onValueChange={(v) => setMode(v as Mode)}
            columns={3}
            options={[
              { value: "always_ask", title: "Always ask me", description: "Every post waits for your OK. Approving one schedules it for its planned time." },
              { value: "trust_ladder", title: "Earn trust (recommended)", description: "Each channel asks first. After 5 posts you approve without edits, it posts on its own." },
              { value: "auto", title: "Fully automatic", description: "Posts go out on schedule. Prices, offers, sensitive claims and first posts still wait for you." },
            ]}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-ui font-medium text-ink">
            Channels and posts per week <span className="font-normal text-ink-3">({total} a week)</span>
          </legend>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CHANNELS.map((c) => {
              const n = cadence[c] ?? 0;
              return (
                <li key={c} className={cn("flex items-center gap-3 rounded-xl border p-3", n > 0 ? "border-brand-200 bg-brand-50/60" : "border-line bg-surface")}>
                  <SocialIcon network={c} variant="tile" size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-ui font-medium text-ink">{networkName(c)}</p>
                    <p className="truncate text-xs text-ink-3">{direct.has(c) ? (connected.has(c) ? "Posts for you" : "Connect to post for you") : "You post it from the export pack"}</p>
                  </div>
                  <div className="flex items-center gap-1" role="group" aria-label={`${networkName(c)} posts per week`}>
                    <IconButton size="sm" variant="secondary" aria-label={`Fewer ${networkName(c)} posts`} icon={<Minus />} disabled={n === 0} onClick={() => setCadence((x) => ({ ...x, [c]: Math.max(0, n - 1) }))} />
                    <span className="w-6 text-center text-ui font-semibold tabular-nums" aria-live="polite">
                      {n}
                    </span>
                    <IconButton size="sm" variant="secondary" aria-label={`More ${networkName(c)} posts`} icon={<Plus />} disabled={n >= 6} onClick={() => setCadence((x) => ({ ...x, [c]: Math.min(6, n + 1) }))} />
                  </div>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <div className="grid gap-6 lg:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-ui font-medium text-ink">
              Preferred posting times <span className="font-normal text-ink-3">(optional; otherwise each platform&apos;s best times)</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {HOURS.map(({ h, label }) => (
                <FilterChip key={h} pressed={hours.includes(h)} onPressedChange={(p) => setHours((x) => (p ? [...x, h].slice(-4) : x.filter((y) => y !== h)))}>
                  {label}
                </FilterChip>
              ))}
            </div>
            <p className="text-xs text-ink-3">Times are in your workspace time zone ({data.timezone}).</p>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-ui font-medium text-ink">Images per week</legend>
            <Segmented
              label="Images per week"
              value={images}
              onChange={setImages}
              options={[
                { value: 0, label: "None" },
                { value: 1, label: "1" },
                { value: 2, label: "2" },
              ]}
            />
            <p className="text-xs text-ink-3">Instagram can&apos;t post without an image, so it gets them first. You can also design posts in the studio.</p>
          </fieldset>
        </div>

        <Field label="Always ask me about" optional hint="Comma-separated topics. Any post that mentions them waits for you, even in fully automatic mode.">
          <Textarea value={topics} onChange={(e) => setTopics(e.target.value)} rows={2} placeholder="e.g. prices, new hires, our partners, health claims" />
        </Field>

        {s && paid ? <Switch label="Autopilot is on" description="Turning it off keeps scheduled posts as they are; nothing new is planned." checked={enabled} onCheckedChange={setEnabled} /> : null}
        {!paid ? (
          <Callout tone="info" live="none" title="Autopilot comes with a package">
            Save your settings and preview one week free: your team plans it, and you see exactly what would go out.{" "}
            <Link href={`/app/${slug}/settings/billing`} className="font-medium text-brand-800 hover:underline">
              See packages
            </Link>
            {s ? (
              <Button
                size="sm"
                variant="secondary"
                className="ml-2 mt-2"
                onClick={async () => {
                  try {
                    await preview({ slug });
                    toast({ tone: "success", title: "Planning your preview week" });
                  } catch (e) {
                    toast({ tone: "danger", title: errorMessage(e) });
                  }
                }}
              >
                Preview a week
              </Button>
            ) : null}
          </Callout>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
          <p className="mr-auto flex items-center gap-1.5 text-ui text-ink-3">
            <ShieldCheck aria-hidden className="size-4 text-brand-800" /> Every automatic post is checked against your confirmed facts first.
          </p>
          {s ? (
            <Button variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          ) : null}
          <Button loading={busy} disabled={total === 0 && enabled} onClick={submit}>
            {s ? "Save settings" : paid ? "Turn on autopilot" : "Save settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Trust ladder ---------------- */

function TrustLadder({ data }: { data: Data }) {
  const active = new Set(data.settings?.channels.map((c) => c.channel));
  const rows = data.trust.filter((t) => active.has(t.channel));
  if (data.settings?.mode !== "trust_ladder" || rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Trust ladder</CardTitle>
        <CardDescription>Approve {rows[0]?.threshold ?? 5} posts on a channel without edits and it starts posting on its own. A rejection or a problem sends it back to asking first.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((t) => (
          <div key={t.channel} className="flex items-center gap-3 rounded-xl border border-line p-3">
            <ProgressRing value={t.unlocked ? 1 : t.streak / t.threshold} label={`${networkName(t.channel)} trust`} color={t.unlocked ? "var(--chart-1)" : "var(--sun-strong)"}>
              {t.unlocked ? <CircleCheck aria-hidden className="size-4 text-brand-800" /> : `${t.streak}/${t.threshold}`}
            </ProgressRing>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-ui font-medium text-ink">
                <SocialIcon network={t.channel} size="sm" /> {networkName(t.channel)}
              </p>
              <p className="text-xs text-ink-3">{t.unlocked ? "Posts on its own" : `${t.threshold - t.streak} more to go`}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------------- Week view ---------------- */

function WeekView({ slug, data }: { slug: string; data: Data }) {
  const [week, setWeek] = useState(0);
  const now = useNow();
  const w = data.weeks[week];
  const days = useMemo(() => {
    const [y, m, d] = w.weekOf.split("-").map(Number);
    return Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(y, m - 1, d + i, 12)));
  }, [w.weekOf]);
  const tz = data.timezone;
  const dayKey = (t: number | Date) => new Date(t).toLocaleDateString("en-CA", { timeZone: tz });
  const byDay = new Map<string, Slot[]>();
  for (const s of w.slots) byDay.set(dayKey(s.slotAt), [...(byDay.get(dayKey(s.slotAt)) ?? []), s]);
  const counts = w.slots.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }), {});

  return (
    <section aria-labelledby="week-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="week-heading" className="heading-section">
            {week === 0 ? "This week" : "Next week"}
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">{w.plan ? w.plan.theme : week === 1 ? "Your team plans next week on Thursday morning." : "No plan for this week yet."}</p>
        </div>
        <Segmented
          label="Week"
          value={week}
          onChange={setWeek}
          options={[
            { value: 0, label: "This week" },
            { value: 1, label: "Next week" },
          ]}
        />
      </div>

      {w.slots.length > 0 ? <WeekSummary counts={counts} total={w.slots.length} /> : null}

      {w.plan ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardContent className="flex flex-col gap-2">
              <p className="text-overline">Content pillars</p>
              <ul className="flex flex-col gap-1.5">
                {w.plan.pillars.map((p) => (
                  <li key={p.name} className="text-ui">
                    <span className="font-medium text-ink">{p.name}</span> <span className="text-ink-3">· {p.why}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-2">
              <p className="text-overline">What we learned and changed</p>
              <ul className="flex list-disc flex-col gap-1.5 pl-4 text-ui text-ink-2 marker:text-ink-3">
                {w.plan.learnings.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {w.slots.length === 0 ? (
        <EmptyState icon={<CalendarClock />} title={week === 0 ? "Nothing planned this week" : "Next week isn't planned yet"} body="Press Plan now and your team plans and drafts the week in a few minutes." />
      ) : (
        <div className="grid gap-2 md:grid-cols-7">
          {days.map((d) => {
            const key = d.toISOString().slice(0, 10);
            const slots = (byDay.get(key) ?? []).sort((a, b) => a.slotAt - b.slotAt);
            const isToday = now !== null && dayKey(now) === key;
            return (
              <div key={key} className={cn("flex min-h-28 flex-col gap-2 rounded-xl border p-2", isToday ? "border-brand-200 bg-brand-50/50" : "border-line bg-surface")}>
                <p className={cn("px-1 text-xs font-medium", isToday ? "text-brand-900" : "text-ink-3")}>
                  {d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", timeZone: "UTC" })}
                  {isToday ? " · Today" : ""}
                </p>
                {slots.map((s) => (
                  <SlotCard key={s.id} slug={slug} slot={s} tz={tz} canAct={data.canApprove && Boolean(data.settings?.enabled)} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function WeekSummary({ counts, total }: { counts: Record<string, number>; total: number }) {
  const order = ["published", "scheduled", "ready_to_post", "needs_approval", "drafting", "planned", "failed"];
  const color: Record<string, string> = {
    published: "var(--chart-1)",
    scheduled: "var(--chart-3)",
    ready_to_post: "var(--chart-4)",
    needs_approval: "var(--chart-2)",
    drafting: "var(--blue-500)",
    planned: "var(--surface-3)",
    failed: "var(--red-500)",
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2" role="img" aria-label={order.filter((k) => counts[k]).map((k) => `${counts[k]} ${STATUS[k].label.toLowerCase()}`).join(", ")}>
        {order.map((k) => (counts[k] ? <span key={k} style={{ width: `${(counts[k] / total) * 100}%`, background: color[k] }} /> : null))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-ui text-ink-2">
        {order
          .filter((k) => counts[k])
          .map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full" style={{ background: color[k] }} />
              <span className="font-medium tabular-nums text-ink">{counts[k]}</span> {STATUS[k].label.toLowerCase()}
            </li>
          ))}
      </ul>
    </div>
  );
}

function SlotCard({ slug, slot, tz, canAct }: { slug: string; slot: Slot; tz: string; canAct: boolean }) {
  const skip = useMutation(api.autopilot.skipSlot);
  const report = useMutation(api.autopilot.reportProblem);
  const redraft = useMutation(api.autopilot.redraftSlot);
  const sending = slot.artifact ? ["publishing", "uncertain"].includes(slot.artifact.status) : false;
  const st = STATUS[slot.status] ?? STATUS.planned;
  const time = new Date(slot.slotAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  const reasons = slot.routing?.reasons ?? [];
  return (
    <article {...climbTarget("slot", slot.id, `${networkName(slot.channel)} post ${time}: ${slot.artifact?.title ?? slot.idea}`)} className="group flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-2 transition-colors hover:border-line-strong">
      <div className="flex items-center gap-1.5">
        <SocialIcon network={slot.channel} size="sm" labelled />
        <span className="text-xs tabular-nums text-ink-3">{time}</span>
        <span className="ml-auto">
          {slot.artifact || canAct ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton size="sm" variant="ghost" aria-label="Post options" icon={<MoreHorizontal />} tooltip={false} className="-my-1 size-6" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {slot.artifact ? (
                  <DropdownMenuItem asChild>
                    <Link href={`/app/${slug}/content/${slot.artifact.id}`}>Open the post</Link>
                  </DropdownMenuItem>
                ) : null}
                {canAct && slot.status === "failed" && !slot.artifact ? (
                  <DropdownMenuItem
                    icon={<RotateCcw />}
                    onSelect={() => redraft({ slug, slotId: slot.id as Id<"calendarSlots"> }).then(() => toast({ title: "Drafting it again." })).catch((e) => toast({ tone: "danger", title: errorMessage(e) }))}
                  >
                    Draft it again
                  </DropdownMenuItem>
                ) : null}
                {!canAct || sending ? null : slot.status !== "published" ? (
                  <DropdownMenuItem
                    icon={<SkipForward />}
                    onSelect={() => skip({ slug, slotId: slot.id as Id<"calendarSlots"> }).then(() => toast({ title: "Skipped. Nothing will post in this slot." })).catch((e) => toast({ tone: "danger", title: errorMessage(e) }))}
                  >
                    Skip this post
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    danger
                    icon={<TriangleAlert />}
                    onSelect={() => report({ slug, slotId: slot.id as Id<"calendarSlots"> }).then(() => toast({ title: "Thanks. This channel will ask you first from now on." })).catch((e) => toast({ tone: "danger", title: errorMessage(e) }))}
                  >
                    Report a problem
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </span>
      </div>
      {slot.artifact ? (
        <Link href={`/app/${slug}/content/${slot.artifact.id}`} className="line-clamp-3 text-ui text-ink hover:underline">
          {slot.artifact.title}
        </Link>
      ) : (
        <p className="line-clamp-3 text-ui text-ink-2">{slot.idea}</p>
      )}
      <Tooltip content={reasons.length ? reasons.join(" ") : `${slot.purpose} · ${slot.format.replace("_", " ")} · ${slot.pillar}`}>
        <span tabIndex={0} className="self-start rounded-md">
          <Badge tone={st.tone} icon={st.icon}>
            {st.label}
          </Badge>
        </span>
      </Tooltip>
    </article>
  );
}
