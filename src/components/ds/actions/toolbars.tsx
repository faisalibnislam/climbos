"use client";

import { useCallback, useReducer, type ReactNode } from "react";
import { MoreHorizontal, Redo2, Undo2 } from "@/components/icons";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, IconButton, type ButtonSize } from "@/components/ui";
import { cn } from "@/lib/utils";
import { MenuActions, type MenuAction } from "./buttons";
import { KeyCombo } from "./shortcuts";

/* ------------------------------------------------------------------ */
/* Save / cancel                                                       */
/* ------------------------------------------------------------------ */

export interface FormActionsProps {
  onSave: () => void;
  onCancel?: () => void;
  /** Enables Save and shows the "Unsaved changes" note. */
  dirty: boolean;
  saving?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  /** Replaces the left-hand note, e.g. "Saved 2 min ago". */
  status?: ReactNode;
  /** Sticks to the bottom of the scroll area with a top border. */
  sticky?: boolean;
  size?: ButtonSize;
  className?: string;
}

/** Cancel + Save for forms and settings. Save is the only black button in the bar. */
export function FormActions({ onSave, onCancel, dirty, saving, saveLabel = "Save changes", cancelLabel = "Cancel", status, sticky, size = "md", className }: FormActionsProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2",
        sticky && "sticky bottom-0 -mx-[var(--card-p)] border-t border-line bg-surface/90 px-[var(--card-p)] py-3 backdrop-blur",
        className,
      )}
    >
      <p className="mr-auto flex items-center gap-1.5 text-xs text-ink-3" aria-live="polite">
        {status ?? (dirty ? (
          <>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-500" />
            Unsaved changes
          </>
        ) : null)}
      </p>
      {onCancel ? (
        <Button variant="ghost" size={size} onClick={onCancel} disabled={saving}>
          {cancelLabel}
        </Button>
      ) : null}
      <Button size={size} onClick={onSave} disabled={!dirty} loading={saving} loadingText="Saving…">
        {saveLabel}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Undo / redo                                                         */
/* ------------------------------------------------------------------ */

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}
type HistoryAction<T> = { type: "set"; value: T } | { type: "undo" } | { type: "redo" } | { type: "reset"; value: T };

function historyReducer<T>(s: History<T>, a: HistoryAction<T>): History<T> {
  switch (a.type) {
    case "set":
      return Object.is(a.value, s.present) ? s : { past: [...s.past, s.present].slice(-50), present: a.value, future: [] };
    case "undo":
      return s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s;
    case "redo":
      return s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s;
    case "reset":
      return { past: [], present: a.value, future: [] };
  }
}

/** Undo history for any value (keeps the last 50 steps). */
export function useHistory<T>(initial: T) {
  const [s, dispatch] = useReducer(historyReducer<T>, { past: [], present: initial, future: [] });
  const set = useCallback((value: T) => dispatch({ type: "set", value }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const reset = useCallback((value: T) => dispatch({ type: "reset", value }), []);
  return { value: s.present, set, undo, redo, reset, canUndo: s.past.length > 0, canRedo: s.future.length > 0 };
}

export interface UndoRedoProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  size?: ButtonSize;
}

/** Undo and redo icon buttons. Tooltips show the shortcuts (⌘Z, ⇧⌘Z). */
export function UndoRedo({ onUndo, onRedo, canUndo, canRedo, size = "sm" }: UndoRedoProps) {
  return (
    <div role="group" aria-label="History" className="inline-flex gap-0.5">
      <IconButton
        aria-label="Undo"
        tooltip={
          <span className="inline-flex items-center gap-2">
            Undo <KeyCombo keys={["mod", "Z"]} tone="dark" />
          </span>
        }
        icon={<Undo2 />}
        size={size}
        onClick={onUndo}
        disabled={!canUndo}
      />
      <IconButton
        aria-label="Redo"
        tooltip={
          <span className="inline-flex items-center gap-2">
            Redo <KeyCombo keys={["mod", "shift", "Z"]} tone="dark" />
          </span>
        }
        icon={<Redo2 />}
        size={size}
        onClick={onRedo}
        disabled={!canRedo}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bulk action toolbar                                                 */
/* ------------------------------------------------------------------ */

export interface BulkActionBarProps {
  count: number;
  total?: number;
  /** Noun for the count, e.g. "leads". */
  noun?: string;
  onClear: () => void;
  onSelectAll?: () => void;
  /** Use BulkAction buttons. */
  children: ReactNode;
  className?: string;
}

/** Ink toolbar shown while rows are selected. Hidden at zero. */
export function BulkActionBar({ count, total, noun = "selected", onClear, onSelectAll, children, className }: BulkActionBarProps) {
  return (
    <>
      <span className="sr-only" aria-live="polite">
        {count ? `${count} ${noun} selected` : ""}
      </span>
      {count > 0 ? (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className={cn("flex flex-wrap items-center gap-1 rounded-[var(--radius-card)] bg-ink py-1.5 pl-3 pr-1.5 text-white shadow-lg", className)}
        >
          <p className="mr-2 text-ui font-medium tabular-nums">
            {count} {noun}
          </p>
          {onSelectAll && total && count < total ? (
            <button type="button" onClick={onSelectAll} className="mr-1 text-ui text-white/70 underline underline-offset-4 hover:text-white">
              Select all {total}
            </button>
          ) : null}
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/15" />
          <div className="flex flex-wrap items-center gap-0.5">{children}</div>
          <button type="button" onClick={onClear} className="ml-auto h-[var(--h-sm)] rounded-[var(--radius-control)] px-2.5 text-ui text-white/70 hover:bg-white/10 hover:text-white">
            Clear
          </button>
        </div>
      ) : null}
    </>
  );
}

/** A button styled for the ink bulk bar. */
export function BulkAction({ icon, children, onClick, danger }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-[var(--h-sm)] items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 text-ui font-medium transition-colors [&_svg]:size-4",
        danger ? "text-red-100 hover:bg-red-800" : "text-white hover:bg-white/10",
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Contextual (row) actions                                            */
/* ------------------------------------------------------------------ */

export interface RowActionsProps {
  /** What the actions apply to, e.g. the lead's name. */
  itemLabel: string;
  /** Up to two quick actions, revealed on row hover or focus (always shown on touch). */
  quick?: (MenuAction & { icon: ReactNode })[];
  /** Everything else, in the "More" menu. */
  menu: MenuAction[];
  size?: ButtonSize;
}

/**
 * Actions for one row or card. Put `group/row` on the row so quick actions
 * appear on hover and focus; the More button is always visible.
 */
export function RowActions({ itemLabel, quick = [], menu, size = "sm" }: RowActionsProps) {
  return (
    <div className="flex items-center gap-0.5">
      {quick.map((a) => (
        <IconButton
          key={a.label}
          aria-label={`${a.label}: ${itemLabel}`}
          tooltip={a.label}
          icon={a.icon}
          size={size}
          onClick={a.onSelect}
          className="opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100 [@media(hover:none)]:opacity-100"
        />
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton aria-label={`More actions: ${itemLabel}`} tooltip={false} icon={<MoreHorizontal />} size={size} className="data-[state=open]:bg-surface-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <MenuActions actions={menu} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Button group                                                        */
/* ------------------------------------------------------------------ */

export interface ButtonGroupProps {
  /** Accessible group name. */
  label: string;
  /** `attached` joins the buttons into one shape; `spaced` keeps an 8px gap. */
  appearance?: "attached" | "spaced";
  children: ReactNode;
  className?: string;
}

/** Related buttons as one unit. Use secondary buttons when attached. */
export function ButtonGroup({ label, appearance = "attached", children, className }: ButtonGroupProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex",
        appearance === "attached"
          ? "[&>*]:rounded-none [&>*]:shadow-none [&>*:first-child]:rounded-l-[var(--radius-control)] [&>*:last-child]:rounded-r-[var(--radius-control)] [&>*+*]:-ml-px [&>*]:border-line-strong [&>*:focus-visible]:z-10 shadow-[var(--btn-2-shadow)] rounded-[var(--radius-control)]"
          : "flex-wrap gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
