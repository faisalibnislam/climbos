"use client";

/*
 * Comments: MentionInput (@ autocomplete combobox), CommentComposer,
 * ReactionBar, CommentItem, CommentList and CommentThread (replies + resolve).
 * Mentions are stored as "@Full Name" and highlighted against the people list.
 */
import { Fragment, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AtSign, Check, ChevronDown, ChevronRight, CircleCheck, Link2, MessageSquareReply, MoreHorizontal, RotateCcw, Send, Smile, Trash2 } from "@/components/icons";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Kbd,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  toast,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { UserAvatar, type Person } from "../accounts/avatar";

export interface Reaction {
  emoji: string;
  label: string;
  /** Person ids who reacted. */
  by: string[];
}

export interface CommentData {
  id: string;
  authorId: string;
  body: string;
  time: string;
  reactions: Reaction[];
  replies?: CommentData[];
  resolved?: boolean;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Render "@Full Name" tokens as mention chips. */
export function MentionText({ body, people }: { body: string; people: Person[] }) {
  if (!people.length) return <>{body}</>;
  const re = new RegExp(`(@(?:${people.map((p) => escape(p.name)).join("|")}))`, "g");
  return (
    <>
      {body.split(re).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="rounded-[3px] bg-brand-50 px-0.5 font-medium text-brand-900">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Mention input                                                       */
/* ------------------------------------------------------------------ */

export interface MentionInputProps {
  value: string;
  onChange: (v: string) => void;
  people: Person[];
  onSubmit?: () => void;
  placeholder?: string;
  "aria-label": string;
  autoFocus?: boolean;
  rows?: number;
}

/** Textarea with an @ autocomplete listbox. ↑ ↓ to move, Enter or Tab to insert, Esc to close. ⌘Enter submits. */
export function MentionInput({ value, onChange, people, onSubmit, placeholder, autoFocus, rows = 2, "aria-label": ariaLabel }: MentionInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();
  const matches = query === null ? [] : people.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  const open = query !== null && matches.length > 0;

  const detect = (text: string, caret: number) => {
    const m = /(^|\s)@([\w’'-]*)$/.exec(text.slice(0, caret));
    setQuery(m ? m[2] : null);
    setActive(0);
  };
  const insert = (p: Person) => {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@([\w’'-]*)$/, `@${p.name} `);
    const next = before + value.slice(caret);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(before.length, before.length);
    });
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insert(matches[active]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${matches[active]?.id}` : undefined}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={onKey}
        onBlur={() => window.setTimeout(() => setQuery(null), 120)}
        className="block w-full resize-none rounded-[var(--radius-field)] border border-control bg-surface px-3 py-2 text-ui leading-5 text-ink placeholder:text-ink-3 hover:border-control-hover focus-visible:border-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600"
      />
      {open ? (
        <ul id={listId} role="listbox" aria-label="People to mention" className="absolute left-0 top-full z-30 mt-1 w-64 rounded-[var(--radius-card)] border border-line bg-surface p-1 shadow-lg">
          {matches.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${p.id}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                insert(p);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-2 py-1.5 text-ui", i === active && "bg-surface-2")}
            >
              <UserAvatar name={p.name} size="sm" presence={p.presence} />
              <span className="flex-1 truncate">{p.name}</span>
              {p.role ? <span className="text-xs text-ink-3">{p.role}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Mention input + send row. Sends on ⌘Enter too. */
export function CommentComposer({ me, people, onSend, placeholder = "Add a comment… type @ to mention", autoFocus, onCancel, sendLabel = "Comment" }: { me: Person; people: Person[]; onSend: (body: string) => void; placeholder?: string; autoFocus?: boolean; onCancel?: () => void; sendLabel?: string }) {
  const [v, setV] = useState("");
  const send = () => {
    if (!v.trim()) return;
    onSend(v.trim());
    setV("");
  };
  return (
    <div className="flex gap-2.5">
      <UserAvatar name={me.name} size="sm" className="mt-1.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <MentionInput value={v} onChange={setV} people={people} onSubmit={send} placeholder={placeholder} aria-label="Comment" autoFocus={autoFocus} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-2xs text-ink-3">
            <AtSign aria-hidden className="size-3" /> to mention · <Kbd>⌘</Kbd>
            <Kbd>Enter</Kbd> to send
          </span>
          <span className="flex gap-1.5">
            {onCancel ? (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
            <Button size="sm" onClick={send} disabled={!v.trim()}>
              <Send /> {sendLabel}
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reactions                                                           */
/* ------------------------------------------------------------------ */

export const REACTION_SET: { emoji: string; label: string }[] = [
  { emoji: "👍", label: "Thumbs up" },
  { emoji: "🎉", label: "Party" },
  { emoji: "❤️", label: "Heart" },
  { emoji: "👀", label: "Eyes" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "✅", label: "Done" },
];

export interface ReactionBarProps {
  reactions: Reaction[];
  onChange: (r: Reaction[]) => void;
  meId: string;
  people: Person[];
}

/** Reaction pills (aria-pressed when you reacted) plus a picker. Tooltip names who reacted. */
export function ReactionBar({ reactions, onChange, meId, people }: ReactionBarProps) {
  const [open, setOpen] = useState(false);
  const nameOf = (id: string) => (id === meId ? "You" : (people.find((p) => p.id === id)?.name.split(" ")[0] ?? "Someone"));
  const toggle = (emoji: string, label: string) => {
    const has = reactions.find((r) => r.emoji === emoji);
    if (!has) onChange([...reactions, { emoji, label, by: [meId] }]);
    else {
      const by = has.by.includes(meId) ? has.by.filter((x) => x !== meId) : [...has.by, meId];
      onChange(by.length ? reactions.map((r) => (r.emoji === emoji ? { ...r, by } : r)) : reactions.filter((r) => r.emoji !== emoji));
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      {reactions.map((r) => {
        const mine = r.by.includes(meId);
        return (
          <Tooltip key={r.emoji} content={`${r.by.map(nameOf).join(", ")} reacted with ${r.label.toLowerCase()}`}>
            <button
              type="button"
              aria-pressed={mine}
              aria-label={`${r.label}, ${r.by.length}`}
              onClick={() => toggle(r.emoji, r.label)}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-[var(--radius-badge)] border px-1.5 text-xs tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]",
                mine ? "border-brand-700 bg-brand-50 font-semibold text-brand-900" : "border-line bg-surface text-ink-2 hover:bg-surface-2",
              )}
            >
              <span aria-hidden>{r.emoji}</span>
              {r.by.length}
            </button>
          </Tooltip>
        );
      })}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger aria-label="Add reaction" className="grid h-6 w-7 place-items-center rounded-[var(--radius-badge)] border border-dashed border-line-strong text-ink-3 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]">
          <Smile aria-hidden className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent className="flex w-auto gap-0.5 p-1">
          {REACTION_SET.map((r) => (
            <button
              key={r.emoji}
              type="button"
              aria-label={r.label}
              onClick={() => {
                toggle(r.emoji, r.label);
                setOpen(false);
              }}
              className="grid size-8 place-items-center rounded-[var(--radius-control)] text-base hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
            >
              <span aria-hidden>{r.emoji}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Comment, list and thread                                            */
/* ------------------------------------------------------------------ */

export interface CommentItemProps {
  comment: CommentData;
  people: Person[];
  meId: string;
  onChange: (c: CommentData) => void;
  onDelete?: () => void;
  onReply?: () => void;
  children?: ReactNode;
}

/** One comment: avatar, name, time, body with mentions, reactions and actions. */
export function CommentItem({ comment, people, meId, onChange, onDelete, onReply, children }: CommentItemProps) {
  const author = people.find((p) => p.id === comment.authorId) ?? { id: "?", name: "Unknown" };
  const mine = comment.authorId === meId;
  return (
    <article className="group/comment flex gap-2.5" aria-label={`Comment from ${author.name}`}>
      <UserAvatar name={author.name} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-ui font-semibold text-ink">{mine ? "You" : author.name}</span>
          <time className="text-xs text-ink-3">{comment.time}</time>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Comment actions" className="ml-auto grid size-6 place-items-center rounded-[var(--radius-control)] text-ink-3 opacity-0 hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 group-hover/comment:opacity-100 data-[state=open]:opacity-100">
              <MoreHorizontal aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem icon={<Link2 />} onSelect={() => toast({ title: "Link to comment copied", tone: "success" })}>
                Copy link
              </DropdownMenuItem>
              {mine && onDelete ? (
                <DropdownMenuItem danger icon={<Trash2 />} onSelect={onDelete}>
                  Delete comment
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
          <MentionText body={comment.body} people={people} />
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <ReactionBar reactions={comment.reactions} onChange={(reactions) => onChange({ ...comment, reactions })} meId={meId} people={people} />
          {onReply ? (
            <button type="button" onClick={onReply} className="inline-flex h-6 items-center gap-1 rounded-[var(--radius-control)] px-1.5 text-xs font-medium text-ink-3 hover:bg-surface-2 hover:text-ink">
              <MessageSquareReply aria-hidden className="size-3.5" /> Reply
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </article>
  );
}

let seq = 100;
const nextId = () => `c${++seq}`;

/** Flat comment list with a composer. Newest at the bottom. */
export function CommentList({ comments, onChange, people, me }: { comments: CommentData[]; onChange: (c: CommentData[]) => void; people: Person[]; me: Person }) {
  return (
    <section aria-label="Comments" className="flex flex-col gap-4">
      <h3 className="text-overline">{comments.length} comments</h3>
      {comments.map((c) => (
        <CommentItem key={c.id} comment={c} people={people} meId={me.id} onChange={(n) => onChange(comments.map((x) => (x.id === c.id ? n : x)))} onDelete={() => onChange(comments.filter((x) => x.id !== c.id))} />
      ))}
      <div className="border-t border-line pt-4">
        <CommentComposer me={me} people={people} onSend={(body) => onChange([...comments, { id: nextId(), authorId: me.id, body, time: "Just now", reactions: [] }])} />
      </div>
    </section>
  );
}

/** A root comment with nested replies. Resolve collapses it; replies fold after two. */
export function CommentThread({ thread, onChange, people, me }: { thread: CommentData; onChange: (t: CommentData) => void; people: Person[]; me: Person }) {
  const [replying, setReplying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const replies = thread.replies ?? [];
  const hidden = expanded ? 0 : Math.max(0, replies.length - 2);
  const shown = replies.slice(hidden);
  const setReplies = (r: CommentData[]) => onChange({ ...thread, replies: r });

  if (thread.resolved) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-line bg-surface-2 px-3 py-2.5 text-ui text-ink-2">
        <CircleCheck aria-hidden className="size-4 text-green-800" />
        <span className="min-w-0 flex-1 truncate">
          Resolved: “<MentionText body={thread.body} people={people} />”
        </span>
        <span className="text-xs text-ink-3">{replies.length + 1} comments</span>
        <Button size="sm" variant="ghost" onClick={() => onChange({ ...thread, resolved: false })}>
          <RotateCcw /> Reopen
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-overline">Thread · {replies.length + 1} comments</span>
        <Button size="sm" variant="secondary" onClick={() => onChange({ ...thread, resolved: true })}>
          <Check /> Resolve
        </Button>
      </div>
      <CommentItem comment={thread} people={people} meId={me.id} onChange={(c) => onChange({ ...c, replies })} onReply={() => setReplying(true)}>
        <div className="mt-3 flex flex-col gap-3 border-l-2 border-line pl-3">
          {hidden ? (
            <button type="button" onClick={() => setExpanded(true)} className="inline-flex items-center gap-1 self-start text-xs font-medium text-brand-800 hover:underline" aria-expanded={false}>
              <ChevronRight aria-hidden className="size-3.5" /> Show {hidden} earlier {hidden === 1 ? "reply" : "replies"}
            </button>
          ) : replies.length > 2 ? (
            <button type="button" onClick={() => setExpanded(false)} className="inline-flex items-center gap-1 self-start text-xs font-medium text-brand-800 hover:underline" aria-expanded>
              <ChevronDown aria-hidden className="size-3.5" /> Fold replies
            </button>
          ) : null}
          {shown.map((r) => (
            <CommentItem key={r.id} comment={r} people={people} meId={me.id} onChange={(n) => setReplies(replies.map((x) => (x.id === r.id ? n : x)))} onDelete={() => setReplies(replies.filter((x) => x.id !== r.id))} onReply={() => setReplying(true)} />
          ))}
          {replying ? (
            <CommentComposer
              me={me}
              people={people}
              autoFocus
              sendLabel="Reply"
              placeholder="Reply… type @ to mention"
              onCancel={() => setReplying(false)}
              onSend={(body) => {
                setReplies([...replies, { id: nextId(), authorId: me.id, body, time: "Just now", reactions: [] }]);
                setReplying(false);
              }}
            />
          ) : null}
        </div>
      </CommentItem>
    </div>
  );
}
