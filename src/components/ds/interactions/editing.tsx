"use client";

/*
 * Editing patterns: inline edit, undo/redo history, debounced auto-save,
 * optimistic list updates with rollback, and copy-to-clipboard feedback.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, CircleAlert, Copy, Loader2, Pencil } from "@/components/icons";
import { Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Inline edit                                                         */
/* ------------------------------------------------------------------ */

/** Text that turns into an input on click. Enter or blur saves, Esc cancels. Optional validation. */
export function InlineEdit({
  value,
  onSave,
  label,
  validate,
  placeholder = "Empty",
  className,
  textClassName,
}: {
  value: string;
  onSave: (v: string) => void;
  /** Accessible name, e.g. "Campaign name". */
  label: string;
  validate?: (v: string) => string | null;
  placeholder?: string;
  className?: string;
  textClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);
  const start = () => {
    closing.current = false;
    setDraft(value);
    setError(null);
    setEditing(true);
  };
  const finish = (commit: boolean) => {
    if (closing.current) return;
    if (commit) {
      const v = draft.trim();
      const err = validate?.(v) ?? null;
      if (err) {
        setError(err);
        return;
      }
      if (v !== value) onSave(v);
    }
    closing.current = true;
    setEditing(false);
    setError(null);
    requestAnimationFrame(() => button.current?.focus());
  };
  if (editing)
    return (
      <span className={cn("inline-flex min-w-0 flex-col gap-1", className)}>
        <input
          autoFocus
          aria-label={label}
          aria-invalid={error ? true : undefined}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === "Enter") {
              e.preventDefault();
              finish(true);
            } else if (e.key === "Escape") {
              e.preventDefault();
              finish(false);
            }
          }}
          onBlur={() => finish(true)}
          onFocus={(e) => e.currentTarget.select()}
          className={cn("-mx-1.5 h-[var(--h-sm)] min-w-0 rounded-[var(--radius-control)] border border-brand-700 bg-surface px-1.5 text-ink outline-2 outline-brand-600", error && "border-red-800 outline-red-800", textClassName)}
        />
        {error ? (
          <span role="alert" className="flex items-center gap-1 text-xs font-medium text-red-800">
            <CircleAlert aria-hidden className="size-3.5" /> {error}
          </span>
        ) : (
          <span className="text-2xs text-ink-3">Enter to save · Esc to cancel</span>
        )}
      </span>
    );
  return (
    <button
      ref={button}
      type="button"
      onClick={start}
      aria-label={`${label}: ${value || placeholder}. Edit`}
      className={cn("group/ie -mx-1.5 inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-[var(--radius-control)] px-1.5 text-left outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", className)}
    >
      <span className={cn("truncate", !value && "text-ink-3", textClassName)}>{value || placeholder}</span>
      <Pencil aria-hidden className="size-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover/ie:opacity-100 group-focus-visible/ie:opacity-100" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Undo / redo                                                         */
/* ------------------------------------------------------------------ */

export interface History<T> {
  value: T;
  set: (next: T | ((v: T) => T), label?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Label of the change Undo would revert, e.g. "Delete post". */
  undoLabel?: string;
  redoLabel?: string;
}

/** Value with a bounded undo/redo stack. Each `set` can carry a label for the buttons. */
export function useHistory<T>(initial: T, limit = 50): History<T> {
  const [state, setState] = useState<{ past: { v: T; l?: string }[]; present: T; label?: string; future: { v: T; l?: string }[] }>({ past: [], present: initial, future: [] });
  const set = useCallback(
    (next: T | ((v: T) => T), label?: string) =>
      setState((s) => {
        const v = typeof next === "function" ? (next as (v: T) => T)(s.present) : next;
        return { past: [...s.past, { v: s.present, l: s.label }].slice(-limit), present: v, label, future: [] };
      }),
    [limit],
  );
  const undo = useCallback(
    () =>
      setState((s) => {
        const prev = s.past[s.past.length - 1];
        if (!prev) return s;
        return { past: s.past.slice(0, -1), present: prev.v, label: prev.l, future: [{ v: s.present, l: s.label }, ...s.future] };
      }),
    [],
  );
  const redo = useCallback(
    () =>
      setState((s) => {
        const nxt = s.future[0];
        if (!nxt) return s;
        return { past: [...s.past, { v: s.present, l: s.label }], present: nxt.v, label: nxt.l, future: s.future.slice(1) };
      }),
    [],
  );
  return { value: state.present, set, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0, undoLabel: state.label, redoLabel: state.future[0]?.l };
}

/** ⌘Z / ⇧⌘Z (and Ctrl+Y) inside `scope` while focus is not in a text field. */
export function useUndoShortcuts(undo: () => void, redo: () => void, scope: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redo();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [undo, redo, scope]);
}

/* ------------------------------------------------------------------ */
/* Auto-save                                                           */
/* ------------------------------------------------------------------ */

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

/**
 * Debounced save. Status is derived: unsaved while the value differs from the last
 * saved one, saving while the request runs, error until the next attempt.
 */
export function useAutoSave<T>(value: T, save: (v: T) => Promise<void>, delay = 800) {
  const [saved, setSaved] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(async () => {
      setSaving(true);
      setError(false);
      try {
        await saveRef.current(value);
        setSaved(value);
        setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      } catch {
        setError(true);
      } finally {
        setSaving(false);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [value, dirty, delay, attempt]);
  const status: SaveStatus = saving ? "saving" : error ? "error" : dirty ? "unsaved" : "saved";
  return { status, savedAt, retry: () => setAttempt((a) => a + 1) };
}

/** Small status line for auto-save. Text carries the state; the icon supports it. */
export function AutoSaveStatus({ status, savedAt, onRetry, className }: { status: SaveStatus; savedAt?: string | null; onRetry?: () => void; className?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-1.5 text-xs", status === "error" ? "text-red-800" : "text-ink-3", className)}>
      {status === "saving" ? (
        <>
          <Loader2 aria-hidden className="size-3.5 animate-spin" /> Saving…
        </>
      ) : status === "unsaved" ? (
        <>
          <span aria-hidden className="size-1.5 rounded-full bg-amber-500" /> Unsaved changes
        </>
      ) : status === "error" ? (
        <>
          <CircleAlert aria-hidden className="size-3.5" /> Couldn&apos;t save.
          {onRetry ? (
            <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
              Retry
            </button>
          ) : null}
        </>
      ) : (
        <>
          <Check aria-hidden className="size-3.5 text-green-800" /> {savedAt ? `Saved at ${savedAt}` : "All changes saved"}
        </>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Optimistic updates                                                  */
/* ------------------------------------------------------------------ */

/**
 * List state with optimistic patches. The patch shows at once; if `commit` rejects,
 * only the patched fields roll back and `onError` fires.
 */
export function useOptimisticList<T extends { id: string }>(initial: T[], onError?: (item: T, err: unknown) => void) {
  const [items, setItems] = useState(initial);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const ref = useRef(items);
  useEffect(() => {
    ref.current = items;
  }, [items]);
  const mutate = async (id: string, patch: Partial<T>, commit: () => Promise<void>) => {
    const before = ref.current.find((i) => i.id === id);
    if (!before) return;
    const prevFields = Object.fromEntries(Object.keys(patch).map((k) => [k, before[k as keyof T]])) as Partial<T>;
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setPending((p) => new Set(p).add(id));
    try {
      await commit();
    } catch (err) {
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...prevFields } : x)));
      onError?.(before, err);
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
    }
  };
  return { items, setItems, mutate, isPending: (id: string) => pending.has(id) };
}

/* ------------------------------------------------------------------ */
/* Copy to clipboard                                                   */
/* ------------------------------------------------------------------ */

/** Copies text and flips `copied` for `ms`. Falls back to a hidden textarea. */
export function useCopy(ms = 1600) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setFailed(false);
      setCopied(true);
    } catch {
      setFailed(true);
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, ms);
  };
  return { copy, copied, failed };
}

/** Icon or labelled copy button with a "Copied" state that is announced. */
export function CopyButton({ text, label = "Copy", iconOnly, className }: { text: string; label?: string; iconOnly?: boolean; className?: string }) {
  const { copy, copied, failed } = useCopy();
  const state = copied ? "Copied" : failed ? "Copy failed" : label;
  const btn = (
    <button
      type="button"
      onClick={() => copy(text)}
      aria-label={iconOnly ? label : undefined}
      className={cn(
        "inline-flex h-[var(--h-sm)] items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--btn-2-border)] bg-[var(--btn-2-bg)] px-2.5 text-ui font-medium text-ink shadow-[var(--btn-2-shadow)] outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
        iconOnly && "w-[var(--h-sm)] px-0",
        copied && "text-green-800",
        className,
      )}
    >
      {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      {iconOnly ? null : <span>{state}</span>}
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : failed ? "Copy failed" : ""}
      </span>
    </button>
  );
  return iconOnly ? <Tooltip content={state}>{btn}</Tooltip> : btn;
}

/** Read-only value with a copy button (links, IDs, keys). */
export function CopyField({ value, label, mono, children }: { value: string; label: string; mono?: boolean; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-ui font-medium text-ink">{label}</span>
      <div className="flex items-center gap-2 rounded-[var(--radius-field)] border border-line bg-surface-2 py-1 pl-3 pr-1">
        <span className={cn("min-w-0 flex-1 truncate text-ui text-ink-2", mono && "font-mono text-xs")}>{value}</span>
        <CopyButton text={value} label={`Copy ${label.toLowerCase()}`} iconOnly />
      </div>
      {children}
    </div>
  );
}
