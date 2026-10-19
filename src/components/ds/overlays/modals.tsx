"use client";

/*
 * Modal surfaces built on Radix Dialog (focus trap, Esc, return focus):
 * full-screen modal, action sheet, quick preview and lightbox.
 */
import { Dialog as RDialog } from "radix-ui";
import { type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "@/components/icons";
import { cn } from "@/lib/utils";

const overlay = "fixed inset-0 z-50 bg-[rgb(26_29_27/0.42)] animate-fade-in";
const iconBtn =
  "grid size-9 place-items-center rounded-[var(--radius-control)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-40";

interface ControlledProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/* ------------------------------------------------------------------ */
/* Full-screen modal                                                   */
/* ------------------------------------------------------------------ */

/** Takes the whole viewport for focused work (editor, review). Header with close + actions, scrolling body. */
export function FullScreenModal({
  open,
  onOpenChange,
  title,
  description,
  actions,
  children,
  aside,
}: ControlledProps & { title: string; description?: string; actions?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Content {...(description ? {} : { "aria-describedby": undefined })} className="fixed inset-0 z-50 flex flex-col bg-bg outline-none animate-fade-in">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-5">
            <RDialog.Close aria-label="Close" className={cn(iconBtn, "text-ink-2 hover:bg-surface-2 hover:text-ink")}>
              <X aria-hidden className="size-[18px]" />
            </RDialog.Close>
            <div className="min-w-0 flex-1">
              <RDialog.Title className="truncate text-sm font-semibold text-ink">{title}</RDialog.Title>
              {description ? <RDialog.Description className="truncate text-xs text-ink-3">{description}</RDialog.Description> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          </header>
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
            {aside ? <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-line bg-surface lg:block">{aside}</aside> : null}
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/* ------------------------------------------------------------------ */
/* Action sheet                                                        */
/* ------------------------------------------------------------------ */

export interface SheetAction {
  id: string;
  label: string;
  icon?: ReactNode;
  description?: string;
  danger?: boolean;
  disabled?: boolean;
}

/** Bottom list of actions for touch screens, with a separate Cancel. Centred card on wider screens. */
export function ActionSheet({ open, onOpenChange, title, description, actions, onAction, cancelLabel = "Cancel" }: ControlledProps & { title: string; description?: string; actions: SheetAction[]; onAction: (id: string) => void; cancelLabel?: string }) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className={overlay} />
        <RDialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-md flex-col gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] outline-none animate-fade-up sm:bottom-6"
        >
          <div className="overflow-hidden rounded-[8px] bg-surface shadow-lg">
            <div className="border-b border-line px-4 py-3 text-center">
              <RDialog.Title className="text-ui font-semibold text-ink">{title}</RDialog.Title>
              {description ? <RDialog.Description className="mt-0.5 text-xs text-ink-3">{description}</RDialog.Description> : null}
            </div>
            <ul className="flex flex-col divide-y divide-line">
              {actions.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    disabled={a.disabled}
                    onClick={() => {
                      onOpenChange(false);
                      onAction(a.id);
                    }}
                    className={cn(
                      "flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-sm outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] disabled:opacity-50 [&_svg]:size-[18px]",
                      a.danger ? "text-red-800" : "text-ink",
                    )}
                  >
                    {a.icon ? <span aria-hidden className={cn("inline-flex", a.danger ? "text-red-800" : "text-ink-3")}>{a.icon}</span> : null}
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{a.label}</span>
                      {a.description ? <span className="block text-xs text-ink-3">{a.description}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <RDialog.Close className="min-h-12 rounded-[8px] bg-surface text-sm font-semibold text-ink shadow-lg outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">{cancelLabel}</RDialog.Close>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/* ------------------------------------------------------------------ */
/* Pager shared by quick preview and lightbox                          */
/* ------------------------------------------------------------------ */

function usePager(count: number, index: number | null, onIndexChange: (i: number | null) => void) {
  const i = index ?? 0;
  const prev = () => i > 0 && onIndexChange(i - 1);
  const next = () => i < count - 1 && onIndexChange(i + 1);
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    }
  };
  return { i, prev, next, onKeyDown, hasPrev: i > 0, hasNext: i < count - 1 };
}

/* ------------------------------------------------------------------ */
/* Quick preview                                                       */
/* ------------------------------------------------------------------ */

/** Peek at a record without leaving the list. ← → step through items; Esc returns to the row. */
export function QuickPreview<T>({
  items,
  index,
  onIndexChange,
  title,
  meta,
  render,
  footer,
}: {
  items: T[];
  index: number | null;
  onIndexChange: (i: number | null) => void;
  title: (item: T) => string;
  meta?: (item: T) => ReactNode;
  render: (item: T) => ReactNode;
  footer?: (item: T) => ReactNode;
}) {
  const p = usePager(items.length, index, onIndexChange);
  const item = index === null ? null : items[index];
  return (
    <RDialog.Root open={item !== null} onOpenChange={(v) => !v && onIndexChange(null)}>
      <RDialog.Portal>
        <RDialog.Overlay className={overlay} />
        <RDialog.Content
          aria-describedby={undefined}
          onKeyDown={p.onKeyDown}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[8px] border border-line bg-surface shadow-lg outline-none animate-fade-up"
        >
          {item !== null ? (
            <>
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <RDialog.Title className="truncate text-sm font-semibold">{title(item)}</RDialog.Title>
                  {meta ? <div className="truncate text-xs text-ink-3">{meta(item)}</div> : null}
                </div>
                <span className="text-xs tabular-nums text-ink-3" aria-live="polite">
                  {p.i + 1} of {items.length}
                </span>
                <button type="button" aria-label="Previous" disabled={!p.hasPrev} onClick={p.prev} className={cn(iconBtn, "size-8 text-ink-2 hover:bg-surface-2")}>
                  <ChevronLeft aria-hidden className="size-4" />
                </button>
                <button type="button" aria-label="Next" disabled={!p.hasNext} onClick={p.next} className={cn(iconBtn, "size-8 text-ink-2 hover:bg-surface-2")}>
                  <ChevronRight aria-hidden className="size-4" />
                </button>
                <RDialog.Close aria-label="Close preview" className={cn(iconBtn, "size-8 text-ink-2 hover:bg-surface-2")}>
                  <X aria-hidden className="size-4" />
                </RDialog.Close>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">{render(item)}</div>
              {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2/50 px-4 py-3">{footer(item)}</div> : null}
            </>
          ) : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/* ------------------------------------------------------------------ */
/* Lightbox                                                            */
/* ------------------------------------------------------------------ */

export interface LightboxItem {
  id: string;
  /** Image URL, or pass `content` for a rendered preview. */
  src?: string;
  content?: ReactNode;
  /** Small rendered thumbnail when there is no `src`. */
  thumb?: ReactNode;
  alt: string;
  caption?: string;
}

/** Dark full-screen media viewer: arrows, counter, caption and a thumbnail strip. */
export function Lightbox({ items, index, onIndexChange }: { items: LightboxItem[]; index: number | null; onIndexChange: (i: number | null) => void }) {
  const p = usePager(items.length, index, onIndexChange);
  const item = index === null ? null : items[index];
  const media = (it: LightboxItem, thumb?: boolean) =>
    it.src ? (
      // eslint-disable-next-line @next/next/no-img-element -- user media from any host
      <img src={it.src} alt={thumb ? "" : it.alt} className="max-h-full max-w-full object-contain" />
    ) : (
      it.content
    );
  return (
    <RDialog.Root open={item !== null} onOpenChange={(v) => !v && onIndexChange(null)}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-ink/95 animate-fade-in" />
        <RDialog.Content aria-describedby={undefined} onKeyDown={p.onKeyDown} className="fixed inset-0 z-50 flex flex-col text-white outline-none">
          {item ? (
            <>
              <div className="flex h-14 shrink-0 items-center gap-3 px-4">
                <RDialog.Title className="min-w-0 flex-1 truncate text-sm font-medium">{item.alt}</RDialog.Title>
                <span className="text-xs tabular-nums text-white/80" aria-live="polite">
                  {p.i + 1} / {items.length}
                </span>
                <RDialog.Close aria-label="Close" className={cn(iconBtn, "text-white hover:bg-white/10")}>
                  <X aria-hidden className="size-5" />
                </RDialog.Close>
              </div>
              <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 sm:px-20">
                <button type="button" aria-label="Previous" disabled={!p.hasPrev} onClick={p.prev} className={cn(iconBtn, "absolute left-2 size-11 text-white hover:bg-white/10 sm:left-5")}>
                  <ChevronLeft aria-hidden className="size-6" />
                </button>
                <figure key={item.id} role="group" aria-roledescription="slide" aria-label={item.alt} className="flex h-full max-h-[70vh] w-full max-w-3xl flex-col items-center justify-center gap-3 animate-fade-in">
                  <div className="flex min-h-0 w-full flex-1 items-center justify-center">{media(item)}</div>
                  {item.caption ? <figcaption className="text-center text-ui text-white/85">{item.caption}</figcaption> : null}
                </figure>
                <button type="button" aria-label="Next" disabled={!p.hasNext} onClick={p.next} className={cn(iconBtn, "absolute right-2 size-11 text-white hover:bg-white/10 sm:right-5")}>
                  <ChevronRight aria-hidden className="size-6" />
                </button>
              </div>
              <ul className="relative flex shrink-0 justify-center gap-2 overflow-x-auto p-4" aria-label="All media">
                {items.map((it, j) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      aria-label={`Show ${it.alt}`}
                      aria-current={j === p.i || undefined}
                      onClick={() => onIndexChange(j)}
                      className={cn("grid size-14 place-items-center overflow-hidden rounded-[var(--radius-control)] outline-none ring-offset-2 ring-offset-ink transition-opacity focus-visible:ring-2 focus-visible:ring-white", j === p.i ? "ring-2 ring-lime" : "opacity-60 hover:opacity-100")}
                    >
                      <span aria-hidden className="pointer-events-none flex size-14 items-center justify-center">{it.src ? media(it, true) : it.thumb}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
