"use client";

/*
 * Live collaboration: PresenceAvatars (who's here, in their cursor colour),
 * LiveEditingField (someone else is typing; field locks for you) and
 * ConflictIndicator (save state + resolve when two edits collide).
 */
import { useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Lock, RefreshCw } from "@/components/icons";
import { Button, Spinner, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";
import { UserAvatar } from "../accounts/avatar";

export interface Collaborator {
  id: string;
  name: string;
  /** Cursor / ring colour (use chart tokens). */
  color: string;
  /** What they're doing, e.g. "Editing caption". */
  activity?: string;
  idle?: boolean;
}

/** People on this page now, ringed in their cursor colour. Idle people fade. */
export function PresenceAvatars({ people, max = 4 }: { people: Collaborator[]; max?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center gap-3">
      <ul aria-label={`${people.length} people here now`} className="flex items-center">
        {shown.map((p, i) => (
          <li key={p.id} className={cn(i > 0 && "-ml-1.5", p.idle && "opacity-50", "motion-safe:animate-fade-in")}>
            <Tooltip content={`${p.name}${p.activity ? ` · ${p.activity}` : ""}${p.idle ? " · idle" : ""}`}>
              <button type="button" aria-label={`${p.name}${p.activity ? `, ${p.activity}` : ""}${p.idle ? ", idle" : ""}`} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]">
                <UserAvatar name={p.name} size="sm" ringColor={p.color} />
              </button>
            </Tooltip>
          </li>
        ))}
        {rest > 0 ? (
          <li className="-ml-1.5 grid size-6 place-items-center rounded-full bg-surface-2 text-2xs font-semibold text-ink-2 ring-2 ring-surface">+{rest}</li>
        ) : null}
      </ul>
      <span className="flex items-center gap-1.5 text-xs text-ink-3">
        <span aria-hidden className="size-1.5 rounded-full bg-green-500" />
        {people.filter((p) => !p.idle).length} active
      </span>
    </div>
  );
}

/** Animated "typing" dots; static under reduced motion. */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex items-center gap-0.5", className)}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1 rounded-full bg-current motion-safe:animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </span>
  );
}

export interface LiveEditingFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Someone else editing right now; locks the field for you. */
  editor?: Collaborator | null;
  multiline?: boolean;
}

/** Field that shows when a teammate is editing it: coloured outline, name tag, typing dots and a lock. */
export function LiveEditingField({ label, value, onChange, editor, multiline }: LiveEditingFieldProps) {
  const locked = Boolean(editor);
  const cls = cn(
    "w-full rounded-[var(--radius-field)] border bg-surface px-3 text-ui text-ink outline-none transition-shadow",
    multiline ? "min-h-20 resize-none py-2 leading-5" : "h-[var(--h-md)]",
    locked ? "cursor-not-allowed border-transparent bg-surface-2" : "border-control focus-visible:border-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600",
  );
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between gap-2 text-ui font-medium text-ink">
        {label}
        {editor ? (
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-badge)] px-1.5 py-0.5 text-2xs font-semibold text-white" style={{ background: editor.color }}>
            <Lock aria-hidden className="size-3" />
            {editor.name.split(" ")[0]} is editing
            <TypingDots />
          </span>
        ) : null}
      </span>
      <span className="relative block rounded-[var(--radius-field)]" style={editor ? { boxShadow: `0 0 0 2px ${editor.color}` } : undefined}>
        {multiline ? (
          <textarea value={value} onChange={(e) => onChange(e.target.value)} readOnly={locked} aria-readonly={locked} className={cls} />
        ) : (
          <input value={value} onChange={(e) => onChange(e.target.value)} readOnly={locked} aria-readonly={locked} className={cls} />
        )}
      </span>
      <span role="status" className="sr-only">
        {editor ? `${editor.name} is editing ${label}. Read-only for you until they finish.` : ""}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Conflict resolution                                                 */
/* ------------------------------------------------------------------ */

export type SyncState = "saved" | "saving" | "offline" | "conflict";

/** Compact save/sync state for a toolbar. */
export function SyncStatus({ state }: { state: SyncState }) {
  const map: Record<SyncState, { Icon?: typeof CircleCheck; text: string; cls: string }> = {
    saved: { Icon: CircleCheck, text: "All changes saved", cls: "text-ink-3" },
    saving: { text: "Saving…", cls: "text-ink-3" },
    offline: { Icon: RefreshCw, text: "Offline, will sync", cls: "text-amber-800" },
    conflict: { Icon: CircleAlert, text: "Edit conflict", cls: "font-medium text-red-800" },
  };
  const { Icon, text, cls } = map[state];
  return (
    <span role="status" className={cn("inline-flex items-center gap-1.5 text-xs", cls)}>
      {Icon ? <Icon aria-hidden className="size-3.5" /> : <Spinner className="text-sm" />}
      {text}
    </span>
  );
}

export interface ConflictIndicatorProps {
  mine: string;
  theirs: string;
  theirName: string;
  when: string;
  onResolve: (value: string, kept: "mine" | "theirs") => void;
  /** Optional heading of the field in conflict. */
  field?: ReactNode;
}

/** Shown when your unsaved edit collides with a newer save. Side-by-side compare, then pick one. */
export function ConflictIndicator({ mine, theirs, theirName, when, onResolve, field = "Caption" }: ConflictIndicatorProps) {
  const [pick, setPick] = useState<"mine" | "theirs">("theirs");
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-red-500/30 bg-red-100/40 p-[var(--card-p)]">
      <p className="flex items-start gap-2 text-sm text-ink">
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-red-800" />
        <span>
          <strong className="font-semibold">{theirName}</strong> saved {typeof field === "string" ? field.toLowerCase() : field} {when} while you were editing. Pick which version to keep.
        </span>
      </p>
      <div role="radiogroup" aria-label="Version to keep" className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["mine", "Your edit", mine],
            ["theirs", `${theirName}’s save`, theirs],
          ] as const
        ).map(([k, title, text]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={pick === k}
            onClick={() => setPick(k)}
            className={cn(
              "flex flex-col gap-1 rounded-[var(--radius-control)] border bg-surface p-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]",
              pick === k ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong",
            )}
          >
            <span className="text-overline">{title}</span>
            <span className="text-ui text-ink">{text}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onResolve(pick === "mine" ? mine : theirs, pick)}>
          Keep {pick === "mine" ? "mine" : `${theirName.split(" ")[0]}’s`}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onResolve(`${theirs}\n${mine}`, "mine")}>
          Keep both
        </Button>
      </div>
    </div>
  );
}
