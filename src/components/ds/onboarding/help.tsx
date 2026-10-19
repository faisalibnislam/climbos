"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, CircleCheck, CircleHelp, ExternalLink, Headset, Lightbulb, Search, Send, Sparkles, Star, X } from "@/components/icons";
import { Avatar, Button, Dialog, DialogContent, Kbd, Popover, PopoverContent, PopoverTrigger, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Contextual help                                                     */
/* ------------------------------------------------------------------ */

export interface ContextualHelpProps {
  /** What the help is about, used in the button's name: "Help: Lead score". */
  topic: string;
  children: ReactNode;
  learnMoreHref?: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

/** Small "?" next to a label that opens a short explanation. */
export function ContextualHelp({ topic, children, learnMoreHref, side = "bottom", className }: ContextualHelpProps) {
  return (
    <Popover>
      <PopoverTrigger aria-label={`Help: ${topic}`} className={cn("inline-grid size-5 place-items-center rounded-full text-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]", className)}>
        <CircleHelp aria-hidden="true" className="size-4" />
      </PopoverTrigger>
      <PopoverContent side={side} className="w-72 p-3.5">
        <p className="text-ui font-semibold text-ink">{topic}</p>
        <div className="mt-1 text-ui text-ink-2">{children}</div>
        {learnMoreHref ? (
          <a href={learnMoreHref} className="mt-2 inline-flex items-center gap-1 text-ui font-medium text-ink underline underline-offset-2 hover:no-underline">
            Learn more <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** Dismissible tip box for a page: "Tips for Leads". */
export function HelpTip({ title, children, onDismiss, className }: { title: ReactNode; children: ReactNode; onDismiss?: () => void; className?: string }) {
  return (
    <aside className={cn("flex gap-3 rounded-[var(--radius-card)] bg-cream p-3.5", className)}>
      <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink" />
      <div className="min-w-0 flex-1 text-ui">
        <p className="font-semibold text-ink">{title}</p>
        <div className="mt-0.5 text-ink-2">{children}</div>
      </div>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Dismiss tip" className="-m-1 grid size-7 shrink-0 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-black/5 hover:text-ink">
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Keyboard shortcut guide                                             */
/* ------------------------------------------------------------------ */

export interface ShortcutGroup {
  title: string;
  items: { keys: string[]; label: string }[];
}

/** Opens on "?" (Shift + /) unless typing in a field. */
export function useShortcutGuideKey(open: () => void) {
  const cb = useRef(open);
  useEffect(() => {
    cb.current = open;
  });
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      cb.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function ShortcutList({ groups, query = "", className }: { groups: ShortcutGroup[]; query?: string; className?: string }) {
  const q = query.trim().toLowerCase();
  const shown = groups.map((g) => ({ ...g, items: g.items.filter((i) => !q || i.label.toLowerCase().includes(q) || i.keys.join(" ").toLowerCase().includes(q)) })).filter((g) => g.items.length);
  if (!shown.length) return <p className="py-6 text-center text-ui text-ink-3">No shortcuts match &ldquo;{query}&rdquo;.</p>;
  return (
    <div className={cn("grid gap-x-8 gap-y-5 sm:grid-cols-2", className)}>
      {shown.map((g) => (
        <section key={g.title}>
          <h4 className="text-overline mb-1.5">{g.title}</h4>
          <dl className="flex flex-col divide-y divide-line">
            {g.items.map((i) => (
              <div key={i.label} className="flex items-center justify-between gap-3 py-1.5">
                <dt className="text-ui text-ink-2">{i.label}</dt>
                <dd className="flex shrink-0 items-center gap-1">
                  {i.keys.map((k, n) => (
                    <span key={`${k}-${n}`} className="inline-flex items-center gap-1">
                      {n > 0 ? <span className="text-2xs text-ink-3">then</span> : null}
                      <Kbd>{k}</Kbd>
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

/** Dialog listing every shortcut, searchable. */
export function ShortcutGuide({ groups, open, onOpenChange }: { groups: ShortcutGroup[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQ("");
      }}
    >
      <DialogContent title="Keyboard shortcuts" description="Press ? anywhere to open this." className="max-w-2xl">
        <div className="relative mb-4">
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            aria-label="Search shortcuts"
            placeholder="Search shortcuts"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-[var(--h-md)] w-full rounded-[var(--radius-field)] border border-control bg-surface pl-8 pr-3 text-ui text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
          />
        </div>
        <ShortcutList groups={groups} query={q} />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* What's new + announcement                                           */
/* ------------------------------------------------------------------ */

export interface ChangelogEntry {
  id: string;
  /** Display date, e.g. "18 Oct". */
  date: string;
  kind: "new" | "improved" | "fixed";
  title: string;
  body: ReactNode;
  unread?: boolean;
  href?: string;
}

const kindCls = { new: "bg-lime text-ink", improved: "bg-surface-3 text-ink", fixed: "bg-surface-2 text-ink-2" };
const kindText = { new: "New", improved: "Improved", fixed: "Fixed" };

/** Changelog feed with unread markers and "Mark all read". */
export function WhatsNewPanel({ entries, onMarkAllRead, onOpenEntry, className }: { entries: ChangelogEntry[]; onMarkAllRead?: () => void; onOpenEntry?: (id: string) => void; className?: string }) {
  const unread = entries.filter((e) => e.unread).length;
  return (
    <section aria-label="What's new" className={cn("flex flex-col rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden="true" className="size-4 text-ink" />
          <h3 className="heading-card">What&apos;s new</h3>
          {unread ? <span className="rounded-[var(--radius-badge)] bg-ink px-1.5 text-2xs font-semibold leading-4 text-white">{unread} new</span> : null}
        </div>
        {onMarkAllRead && unread ? (
          <button type="button" onClick={onMarkAllRead} className="text-xs font-medium text-ink-3 hover:text-ink">
            Mark all read
          </button>
        ) : null}
      </div>
      <ol className="flex flex-col divide-y divide-line">
        {entries.map((e) => (
          <li key={e.id} className="relative">
            <button type="button" onClick={() => onOpenEntry?.(e.id)} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2">
              <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", e.unread ? "bg-ink" : "bg-transparent")} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-[var(--radius-badge)] px-1.5 text-2xs font-semibold uppercase leading-4 tracking-wide", kindCls[e.kind])}>{kindText[e.kind]}</span>
                  <span className="text-xs text-ink-3">{e.date}</span>
                  {e.unread ? <span className="sr-only">Unread</span> : null}
                </span>
                <span className={cn("mt-1 block text-ui text-ink", e.unread && "font-semibold")}>{e.title}</span>
                <span className="mt-0.5 block text-ui text-ink-2">{e.body}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export interface FeatureAnnouncementProps {
  title: string;
  body: ReactNode;
  /** Illustration or screenshot area. */
  media?: ReactNode;
  ctaLabel: string;
  onCta: () => void;
  onDismiss: () => void;
  className?: string;
}

/** Inline launch card: cream panel, "New" tag, one CTA and a dismiss. */
export function FeatureAnnouncement({ title, body, media, ctaLabel, onCta, onDismiss, className }: FeatureAnnouncementProps) {
  return (
    <section aria-label={`New: ${title}`} className={cn("relative grid overflow-hidden rounded-[var(--radius-card)] border border-line bg-cream sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]", className)}>
      <div className="flex flex-col gap-2 p-5">
        <span className="w-fit rounded-[var(--radius-badge)] bg-lime px-1.5 text-2xs font-semibold uppercase leading-5 tracking-wide text-ink">New</span>
        <h3 className="heading-section">{title}</h3>
        <div className="text-sm text-ink-2">{body}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={onCta}>
            {ctaLabel} <ArrowRight aria-hidden="true" />
          </Button>
          <Button variant="ghost" onClick={onDismiss}>
            Maybe later
          </Button>
        </div>
      </div>
      {media ? <div className="min-h-36 border-t border-line bg-surface/60 p-4 sm:border-l sm:border-t-0">{media}</div> : null}
      <button type="button" onClick={onDismiss} aria-label="Dismiss announcement" className="absolute right-2 top-2 grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-black/5 hover:text-ink">
        <X aria-hidden="true" className="size-4" />
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback widget                                                     */
/* ------------------------------------------------------------------ */

const RATING_WORDS = ["Very poor", "Poor", "Okay", "Good", "Great"];

export interface FeedbackWidgetProps {
  question?: string;
  onSubmit: (rating: number, comment: string) => void | Promise<void>;
  className?: string;
}

/** 1–5 rating (radio group, arrow keys) with an optional comment, then a thank-you. */
export function FeedbackWidget({ question = "How was setting up your first play?", onSubmit, className }: FeedbackWidgetProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const qid = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = Math.min(5, Math.max(1, (rating || i + 1) + (rating ? d : 0)));
    setRating(n);
    refs.current[n - 1]?.focus();
  };

  if (state === "sent") {
    return (
      <div role="status" className={cn("flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]", className)}>
        <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-green-800" />
        <div className="min-w-0 flex-1">
          <p className="heading-card">Thanks, that helps.</p>
          <p className="text-ui text-ink-3">The team reads every note.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => { setRating(0); setComment(""); setState("idle"); }}>
          Send another
        </Button>
      </div>
    );
  }
  const shown = hover || rating;
  return (
    <form
      className={cn("flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]", className)}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!rating) return;
        setState("sending");
        await onSubmit(rating, comment.trim());
        setState("sent");
      }}
    >
      <p id={qid} className="text-ui font-medium text-ink">
        {question}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-labelledby={qid} className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {RATING_WORDS.map((w, i) => {
            const n = i + 1;
            const on = n <= shown;
            return (
              <button
                key={w}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} of 5, ${w}`}
                tabIndex={rating ? (rating === n ? 0 : -1) : i === 0 ? 0 : -1}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onKeyDown={(e) => onKey(e, i)}
                className="grid size-9 place-items-center rounded-[var(--radius-control)] hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
              >
                <Star aria-hidden="true" className={cn("size-6 transition-colors", on ? "fill-ink text-ink" : "text-line-strong")} />
              </button>
            );
          })}
        </div>
        <span className="text-ui text-ink-2" aria-hidden="true">
          {shown ? RATING_WORDS[shown - 1] : "Pick a rating"}
        </span>
      </div>
      {rating ? (
        <>
          <Textarea aria-label="Anything to add? (optional)" placeholder={rating <= 3 ? "What got in the way?" : "What did you like?"} value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={state === "sending"} loadingText="Sending…">
              Send feedback
            </Button>
          </div>
        </>
      ) : null}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Support chat                                                        */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  id: string;
  from: "agent" | "me";
  text: string;
  /** Display time, e.g. "10:42". */
  time?: string;
}

export interface SupportChatProps {
  agentName: string;
  /** e.g. "Usually replies in 2 min" */
  status?: string;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  typing?: boolean;
  quickReplies?: string[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unread?: number;
  /** "inline" pins to the nearest positioned parent (previews); "fixed" pins to the viewport. */
  position?: "inline" | "fixed";
  className?: string;
}

/** Launcher button + chat panel: agent header, messages, typing, quick replies, composer. */
export function SupportChat({ agentName, status = "Usually replies in 2 min", messages, onSend, typing, quickReplies, open, onOpenChange, unread = 0, position = "fixed", className }: SupportChatProps) {
  const [text, setText] = useState("");
  const list = useRef<HTMLOListElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const pos = position === "fixed" ? "fixed bottom-4 right-4" : "absolute bottom-4 right-4";

  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const id = requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
    return () => cancelAnimationFrame(id);
  }, [messages.length, typing, open]);

  const send = (t: string) => {
    if (!t.trim()) return;
    onSend(t.trim());
    setText("");
    input.current?.focus();
  };

  return (
    <div className={cn(pos, "z-30 flex flex-col items-end gap-3", className)}>
      {open ? (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          onKeyDown={(e) => e.key === "Escape" && onOpenChange(false)}
          className="flex h-[min(460px,calc(100dvh-7rem))] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[8px] border border-line bg-surface shadow-[var(--shadow-lg)] animate-fade-up"
        >
          <header className="flex items-center gap-3 bg-ink px-4 py-3 text-white">
            <span className="relative">
              <Avatar name={agentName} />
              <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-lime ring-2 ring-ink" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 id={titleId} className="text-sm font-semibold">
                {agentName} · ClimbOS support
              </h3>
              <p className="text-xs text-white/70">{status}</p>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} aria-label="Close chat" className="grid size-8 place-items-center rounded-[var(--radius-control)] text-white/80 hover:bg-white/10 hover:text-white">
              <X aria-hidden="true" className="size-4" />
            </button>
          </header>
          <ol ref={list} aria-live="polite" className="flex flex-1 flex-col gap-2 overflow-y-auto bg-surface-2 px-3 py-3">
            {messages.map((m) => (
              <li key={m.id} className={cn("flex max-w-[85%] flex-col gap-0.5", m.from === "me" ? "self-end items-end" : "self-start items-start")}>
                <span className="sr-only">{m.from === "me" ? "You:" : `${agentName}:`}</span>
                <p className={cn("rounded-[var(--radius-card)] px-3 py-2 text-ui", m.from === "me" ? "bg-ink text-white" : "border border-line bg-surface text-ink")}>{m.text}</p>
                {m.time ? <span className="px-1 text-2xs text-ink-3">{m.time}</span> : null}
              </li>
            ))}
            {typing ? (
              <li className="self-start rounded-[var(--radius-card)] border border-line bg-surface px-3 py-2.5" aria-label={`${agentName} is typing`}>
                <span aria-hidden="true" className="flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="size-1.5 rounded-full bg-ink-3 motion-safe:animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />
                  ))}
                </span>
              </li>
            ) : null}
          </ol>
          {quickReplies?.length ? (
            <div className="relative flex gap-1.5 overflow-x-auto border-t border-line px-3 py-2">
              {quickReplies.map((q) => (
                <button key={q} type="button" onClick={() => send(q)} className="h-7 shrink-0 rounded-[var(--radius-badge)] border border-line-strong bg-surface px-2.5 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
                  {q}
                </button>
              ))}
            </div>
          ) : null}
          <form
            className="flex items-end gap-2 border-t border-line p-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <textarea
              ref={input}
              aria-label="Message"
              rows={1}
              value={text}
              placeholder="Write a message…"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(text);
                }
              }}
              className="max-h-24 min-h-9 flex-1 resize-none rounded-[var(--radius-field)] border border-control bg-surface px-3 py-2 text-ui text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
            />
            <Button type="submit" size="md" className="w-9 px-0" aria-label="Send" disabled={!text.trim()}>
              <Send aria-hidden="true" />
            </Button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={open ? "Close support chat" : unread ? `Open support chat, ${unread} unread` : "Open support chat"}
        className="relative grid size-12 place-items-center rounded-full bg-ink text-white shadow-[var(--shadow-lg)] hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      >
        {open ? <X aria-hidden="true" className="size-5" /> : <Headset aria-hidden="true" className="size-5" />}
        {!open && unread ? (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-lime px-1 text-2xs font-semibold text-ink ring-2 ring-surface">
            {unread}
          </span>
        ) : null}
      </button>
    </div>
  );
}
