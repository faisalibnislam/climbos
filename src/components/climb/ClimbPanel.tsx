"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ArrowUp, CircleCheck, CircleX, ExternalLink, ListChecks, Loader2, MousePointerClick, RotateCcw, ShieldCheck, Sparkles, X } from "@/components/icons"
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, IconButton, Kbd, Popover, PopoverContent, PopoverTrigger, Progress, toast } from "@/components/ui";
import { errorInfo } from "@/components/app/errors";
import { cn } from "@/lib/utils";
import { screenEntities, screenSummary, useClimb, type ClimbEntity } from "./context";

type Msg = NonNullable<ReturnType<typeof useQuery<typeof api.climb.thread>>>[number];

/** Suggestions that fit the screen the owner is on. */
function suggestionsFor(path: string): string[] {
  if (path.includes("/plan")) return ["Which play should I start with this week?", "Explain the first play in plain words", "What would make this plan more ambitious?"];
  if (path.includes("/content")) return ["What's waiting for my approval?", "Make the newest draft shorter and punchier", "Draft 3 LinkedIn posts about our best feature"];
  if (path.includes("/autopilot")) return ["Why is this post waiting for me?", "Set autopilot to post on Instagram 3 times a week", "Plan next week now"];
  if (path.includes("/images")) return ["Capture my website", "Make 2 Instagram posts from my best screenshots", "Which images work best for ads?"];
  if (path.includes("/results")) return ["What changed this month and why?", "Which channel is working best?", "What should I stop doing?"];
  return ["What needs my attention today?", "Get me more customers this month", "Draft 3 posts for next week"];
}

/** Pick a human title for the screen from the page heading. */
function screenTitle(): string {
  if (typeof document === "undefined") return "ClimbOS";
  return (document.querySelector("main h1") as HTMLElement | null)?.innerText.trim().slice(0, 80) || document.title.replace(/ · ClimbOS.*$/, "");
}

export function ClimbPanel({ slug }: { slug: string }) {
  const climb = useClimb();
  const pathname = usePathname();
  const router = useRouter();
  const thread = useQuery(api.climb.thread, climb.open ? { slug } : "skip");
  const send = useMutation(api.climb.send);
  const respond = useAction(api.climb.respond);
  const confirm = useAction(api.climb.confirm);
  const cancel = useMutation(api.climb.cancelAction);
  const clear = useMutation(api.climb.clear);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const handledUi = useRef(new Set<string>());

  // Text queued from elsewhere ("Ask Climb AI about this").
  useEffect(() => {
    if (climb.draft) {
      queueMicrotask(() => {
        setText(climb.draft);
        climb.setDraft("");
        area.current?.focus();
      });
    }
  }, [climb]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.length, busy]);

  // Run screen commands from the agent once (open a page, point at something).
  useEffect(() => {
    if (!thread) return;
    const last = thread.at(-1);
    if (!last || last.role !== "assistant" || handledUi.current.has(last.id)) return;
    handledUi.current.add(last.id);
    if (Date.now() - last.createdAt > 60_000) return; // old history: don't replay
    for (const u of last.ui) {
      if (u.kind === "go_to") router.push(u.value);
      else climb.flash(u.value, u.note);
    }
  }, [thread, router, climb]);

  const submit = async (value?: string) => {
    const message = (value ?? text).trim();
    if (!message || busy) return;
    setBusy(true);
    setText("");
    const selection = climb.selection;
    climb.clearSelection();
    try {
      const { messageId, runId } = await send({ slug, text: message, screen: { path: pathname, title: screenTitle() }, selection });
      await respond({ slug, messageId, runId, screenSummary: screenSummary(), entities: screenEntities() });
    } catch (e) {
      toast({ tone: "danger", title: errorInfo(e).message });
      setText(message);
    } finally {
      setBusy(false);
    }
  };

  if (!climb.open) return null;
  const empty = thread !== undefined && thread.length === 0;

  return (
    <aside
      data-climb-panel
      aria-label="Climb AI"
      className="fixed bottom-0 right-0 top-12 z-40 flex w-full flex-col border-l border-line bg-surface sm:w-[400px]"
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3">
        <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-brand-800 text-white">
          <Sparkles className="size-4" />
        </span>
        <h2 className="heading-card">Climb AI</h2>
        <span className="ml-auto flex items-center gap-1">
          <IconButton size="sm" aria-label="New conversation" icon={<RotateCcw />} onClick={() => clear({ slug }).catch(() => undefined)} />
          <IconButton size="sm" aria-label="Close Climb AI" icon={<X />} onClick={() => climb.setOpen(false)} />
        </span>
      </header>

      <ol ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4" aria-live="polite">
        {thread === undefined ? (
          <li className="text-ui text-ink-3">Loading…</li>
        ) : empty ? (
          <li className="flex flex-col gap-3">
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="heading-card">Hi, I&apos;m Climb AI.</p>
              <p className="mt-1 text-ui text-ink-2">Ask about anything on this screen, or tell me what to do. I draft and prepare things straight away; I ask before anything goes live.</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
                <MousePointerClick aria-hidden className="size-3.5" /> Tip: press the pointer to pick something on the screen.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              {suggestionsFor(pathname).map((s) => (
                <button key={s} type="button" onClick={() => void submit(s)} className="rounded-lg border border-line px-3 py-2 text-left text-ui text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-ink">
                  {s}
                </button>
              ))}
            </div>
          </li>
        ) : (
          groupThread(thread).map((item) =>
            item.kind === "work" ? (
              <li key={item.key}>
                <WorkBlock steps={item.steps} startedAt={item.startedAt} answered={item.answered} />
              </li>
            ) : (
              <li key={item.m.id}>
                <Message m={item.m} onConfirm={async () => {
                  const r = await confirm({ slug, messageId: item.m.id as Id<"climbMessages"> });
                  if (!r.ok) toast({ tone: "danger", title: r.message });
                }} onCancel={() => cancel({ slug, messageId: item.m.id as Id<"climbMessages"> })} />
              </li>
            ),
          )
        )}
        {busy && thread?.at(-1)?.role === "user" ? (
          <li>
            <WorkBlock steps={[]} startedAt={thread.at(-1)!.createdAt} answered={false} />
          </li>
        ) : null}
      </ol>

      <form
        className="shrink-0 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {climb.selection.length ? (
          <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Pointed at">
            {climb.selection.map((s) => (
              <li key={s.id}>
                <SelectionChip s={s} onRemove={() => climb.removeSelection(s.id)} />
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex items-end gap-1.5 rounded-xl border border-control bg-surface p-1.5 focus-within:border-brand-800 focus-within:ring-2 focus-within:ring-brand-100">
          <IconButton
            size="sm"
            variant={climb.pointing ? "primary" : "ghost"}
            aria-label={climb.pointing ? "Stop pointing" : "Point at something on the screen"}
            tooltip={climb.pointing ? "Stop pointing (Esc)" : "Point at something on the screen (⌘⇧P)"}
            icon={<MousePointerClick />}
            onClick={() => climb.setPointing(!climb.pointing)}
            aria-pressed={climb.pointing}
          />
          <ScreenPicker />
          <label htmlFor="climb-input" className="sr-only">
            Message Climb AI
          </label>
          <textarea
            id="climb-input"
            ref={area}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={climb.selection.length ? "Ask about this, or say what to do…" : "Ask or tell Climb AI…"}
            className="min-h-8 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-ink outline-none placeholder:text-ink-3"
          />
          <IconButton size="sm" variant="primary" type="submit" aria-label="Send" icon={busy ? <Loader2 className="animate-spin" /> : <ArrowUp />} disabled={!text.trim() || busy} />
        </div>
        <p className="mt-1.5 flex items-center justify-between text-2xs text-ink-3">
          <span>Climb AI can make mistakes. It asks before anything goes live.</span>
          <span className="hidden items-center gap-0.5 sm:flex">
            <Kbd>⌘</Kbd>
            <Kbd>J</Kbd>
          </span>
        </p>
      </form>
    </aside>
  );
}

/** Keyboard alternative to pointing: everything Climb AI recognises on this screen, as a list. */
function ScreenPicker() {
  const climb = useClimb();
  const [items, setItems] = useState<ClimbEntity[]>([]);
  return (
    <Popover onOpenChange={(o) => o && setItems(screenEntities())}>
      <PopoverTrigger asChild>
        <IconButton size="sm" variant="ghost" aria-label="Pick from a list of what's on screen" icon={<ListChecks />} tooltip={false} />
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 p-1">
        <p className="px-2 pb-1 pt-1.5 text-overline">On this screen</p>
        {items.length === 0 ? (
          <p className="px-2 py-2 text-ui text-ink-3">Nothing to pick here. Use the pointer to select any part of the page.</p>
        ) : (
          <ul className="max-h-72 overflow-y-auto">
            {items.map((e) => {
              const on = climb.selection.some((s) => s.id === e.id);
              return (
                <li key={`${e.type}:${e.id}`}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => (on ? climb.removeSelection(e.id) : climb.addSelection(e))}
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-ui hover:bg-surface-2 focus-visible:bg-surface-2"
                  >
                    <span aria-hidden className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] border-[1.5px]", on ? "border-brand-800 bg-brand-800 text-white" : "border-control")}>
                      {on ? <CircleCheck className="size-3" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs text-ink-3">{e.type}</span>
                      <span className="line-clamp-2 text-ink">{e.label}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function SelectionChip({ s, onRemove }: { s: ClimbEntity; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-sun-soft py-0.5 pl-1.5 pr-0.5 text-xs text-ink">
      <MousePointerClick aria-hidden className="size-3 shrink-0 text-sun-strong" />
      <span className="truncate">{s.label || s.type}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${s.label}`} className="grid size-5 place-items-center rounded hover:bg-surface-3">
        <X aria-hidden className="size-3" />
      </button>
    </span>
  );
}

/** Light formatting for agent text: paragraphs, bullets and **bold**. */
function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s/.test(l))) {
          return (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-4 marker:text-ink-3">
              {lines.map((l, j) => (
                <li key={j}>{bold(l.replace(/^\s*([-*•]|\d+\.)\s/, ""))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{bold(b)}</p>;
      })}
    </div>
  );
}

function bold(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : part));
}

function Message({ m, onConfirm, onCancel }: { m: Msg; onConfirm: () => Promise<void>; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  if (m.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        {m.selection.length ? (
          <span className="flex flex-wrap justify-end gap-1">
            {m.selection.map((s) => (
              <span key={s.id} className="inline-flex max-w-60 items-center gap-1 rounded-md bg-sun-soft px-1.5 py-0.5 text-xs text-ink">
                <MousePointerClick aria-hidden className="size-3 shrink-0 text-sun-strong" />
                <span className="truncate">{s.label}</span>
              </span>
            ))}
          </span>
        ) : null}
        <p className="max-w-[88%] whitespace-pre-line rounded-xl rounded-br-md bg-brand-800 px-3 py-2 text-sm text-white">{m.text}</p>
      </div>
    );
  }
  if (m.role === "step") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-ink-3">
        {m.status === "working" ? <Loader2 aria-hidden className="size-3.5 animate-spin text-brand-800" /> : m.status === "failed" ? <CircleX aria-hidden className="size-3.5 text-red-800" /> : <CircleCheck aria-hidden className="size-3.5 text-brand-800" />}
        {m.text}
      </p>
    );
  }
  if (m.role === "action" && m.action) {
    const a = m.action;
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-100/50 p-3">
        <p className="flex items-center gap-1.5 text-ui font-semibold text-ink">
          <ShieldCheck aria-hidden className="size-4 text-amber-800" /> {a.title}
        </p>
        <p className="mt-1 text-ui text-ink-2">{a.summary}</p>
        {a.status === "pending" ? (
          <div className="mt-2.5 flex gap-2">
            <Button
              size="sm"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        ) : (
          <p className={cn("mt-2 flex items-center gap-1.5 text-xs font-medium", a.status === "done" ? "text-green-800" : a.status === "failed" ? "text-red-800" : "text-ink-3")}>
            {a.status === "done" ? <CircleCheck aria-hidden className="size-3.5" /> : a.status === "failed" ? <CircleX aria-hidden className="size-3.5" /> : null}
            {a.status === "done" ? "Done" : a.status === "failed" ? `Didn't work: ${a.result ?? ""}` : "Canceled"}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className={cn("text-sm text-ink-2", m.status === "failed" && "text-red-800")}>
        <Rich text={m.text} />
      </div>
      {m.links.length ? (
        <div className="flex flex-wrap gap-1.5">
          {m.links.map((l) => (
            <Button key={l.href} asChild size="sm" variant="secondary">
              <Link href={l.href}>
                {l.label} <ExternalLink aria-hidden />
              </Link>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}


type ThreadMsg = NonNullable<ReturnType<typeof useQuery<typeof api.climb.thread>>>[number];
type ThreadItem = { kind: "msg"; m: ThreadMsg } | { kind: "work"; key: string; steps: ThreadMsg[]; startedAt: number; answered: boolean };

/** Consecutive tool steps after a question become one work block for that turn. */
function groupThread(thread: ThreadMsg[]): ThreadItem[] {
  const out: ThreadItem[] = [];
  let lastUserAt = 0;
  for (const m of thread) {
    if (m.role === "user") lastUserAt = m.createdAt;
    if (m.role === "step") {
      const prev = out[out.length - 1];
      if (prev?.kind === "work") prev.steps.push(m);
      else out.push({ kind: "work", key: `work-${m.id}`, steps: [m], startedAt: lastUserAt || m.createdAt, answered: false });
      continue;
    }
    const prev = out[out.length - 1];
    if (prev?.kind === "work" && m.role === "assistant") prev.answered = true;
    out.push({ kind: "msg", m });
  }
  return out;
}

/** Re-render every second (null during the server render). */
function useNowTick(active: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    if (!active) return () => clearTimeout(first);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active]);
  return now;
}

const secs = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))}s` : `${Math.floor(ms / 60_000)}m ${String(Math.round((ms % 60_000) / 1000)).padStart(2, "0")}s`);

/** What Climb AI did for one question: progress, each step with what it found, and timings. */
function WorkBlock({ steps, startedAt, answered }: { steps: ThreadMsg[]; startedAt: number; answered: boolean }) {
  const now = useNowTick(!answered);
  const [open, setOpen] = useState(false);
  const done = steps.filter((x) => x.status !== "working").length;
  const end = answered ? Math.max(startedAt, ...steps.map((x) => x.finishedAt ?? x.createdAt)) : now ?? startedAt;
  const elapsed = end - startedAt;
  if (answered && !open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-expanded={false} className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink">
        <CircleCheck aria-hidden className="size-3.5 text-brand-800" />
        Worked for {secs(elapsed)} · {steps.length} step{steps.length === 1 ? "" : "s"}
        <span className="text-brand-800 underline-offset-2 hover:underline">Show</span>
      </button>
    );
  }
  // Steps are open-ended: count the answer as the last step so the bar never claims 100% early.
  const percent = answered ? 100 : Math.max(8, Math.round(((done + 0.5) / (steps.length + 1.5)) * 100));
  const current = steps.find((x) => x.status === "working");
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-2.5">
      <Progress value={percent} label="Climb AI progress" />
      <p className="mt-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-brand-800">{answered ? "Done" : current ? current.text : steps.length ? "Writing the answer" : "Understanding your question"}</span>
        <span className="tabular-nums text-ink-3">{secs(elapsed)}</span>
      </p>
      {steps.length ? (
        <ol className="mt-2 flex flex-col gap-1.5">
          {steps.map((x) => (
            <li key={x.id} className="text-xs">
              <span className="flex items-center gap-1.5">
                {x.status === "working" ? <Loader2 aria-hidden className="size-3.5 animate-spin text-brand-800" /> : x.status === "failed" ? <CircleX aria-hidden className="size-3.5 text-red-800" /> : <CircleCheck aria-hidden className="size-3.5 text-brand-800" />}
                <span className={x.status === "working" ? "font-medium text-ink" : "text-ink-2"}>{x.text}</span>
                {x.finishedAt ? <span className="ml-auto tabular-nums text-ink-3">{secs(x.finishedAt - x.createdAt)}</span> : null}
              </span>
              {x.detail ? <span className="ml-5 block text-ink-3">{x.detail}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {answered ? (
        <button type="button" onClick={() => setOpen(false)} className="mt-2 text-xs font-medium text-brand-800 hover:underline" aria-expanded>
          Hide steps
        </button>
      ) : null}
    </div>
  );
}
