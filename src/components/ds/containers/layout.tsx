"use client";

/*
 * Signal containers: plain frames, collapsible sections, accordion, panels,
 * resizable panes and a list/detail split view.
 */
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, X } from "@/components/icons";
import { IconButton } from "@/components/ui";
import { cn } from "@/lib/utils";

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

/* ------------------------------------------------------------------ */
/* Bordered / elevated container                                       */
/* ------------------------------------------------------------------ */

export interface ContainerProps {
  variant?: "bordered" | "elevated" | "inset";
  padding?: "none" | "sm" | "md";
  as?: "div" | "section" | "aside";
  className?: string;
  children: ReactNode;
}

/**
 * Generic frame. `bordered`: hairline, no shadow (inside panels). `elevated`:
 * white with the raised shadow (floats over the ground). `inset`: tinted well.
 */
export function Container({ variant = "bordered", padding = "md", as: Tag = "div", className, children }: ContainerProps) {
  return (
    <Tag
      className={cn(
        "rounded-[var(--radius-card)]",
        variant === "bordered" && "border border-line-strong bg-surface",
        variant === "elevated" && "bg-surface shadow-[var(--shadow-lg)]",
        variant === "inset" && "bg-surface-2",
        padding === "sm" && "p-3",
        padding === "md" && "p-[var(--card-p)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Collapsible section                                                 */
/* ------------------------------------------------------------------ */

/** Section heading that hides or shows its content. Count and actions sit on the heading row. */
export function CollapsibleSection({
  title,
  count,
  actions,
  defaultOpen = true,
  children,
  className,
}: {
  title: string;
  count?: number;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <h3 className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((o) => !o)}
            className={cn("-ml-1 inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-1 py-0.5 text-sm font-semibold hover:text-ink-2", focusRing)}
          >
            <ChevronDown aria-hidden="true" className={cn("size-4 text-ink-3 transition-transform motion-reduce:transition-none", !open && "-rotate-90")} />
            {title}
            {count !== undefined ? <span className="text-ui font-normal tabular-nums text-ink-3">{count}</span> : null}
          </button>
        </h3>
        {actions}
      </div>
      <div id={id} hidden={!open} className="pt-3">
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Accordion                                                           */
/* ------------------------------------------------------------------ */

export interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
}

/**
 * WAI-ARIA accordion. Headers are buttons inside headings with aria-expanded /
 * aria-controls; panels are regions. ↑ ↓ Home End move between headers.
 */
export function Accordion({
  items,
  multiple = false,
  defaultOpen = [],
  headingLevel = 3,
  className,
}: {
  items: AccordionItem[];
  multiple?: boolean;
  defaultOpen?: string[];
  headingLevel?: 2 | 3 | 4;
  className?: string;
}) {
  const [open, setOpen] = useState<string[]>(defaultOpen);
  const base = useId();
  const root = useRef<HTMLDivElement>(null);
  const H = `h${headingLevel}` as "h2" | "h3" | "h4";

  const toggle = (id: string) =>
    setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : multiple ? [...o, id] : [id]));

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const btns = [...(root.current?.querySelectorAll<HTMLButtonElement>("[data-acc-trigger]") ?? [])];
    const i = btns.indexOf(e.currentTarget);
    const next =
      e.key === "ArrowDown" ? btns[(i + 1) % btns.length] : e.key === "ArrowUp" ? btns[(i - 1 + btns.length) % btns.length] : e.key === "Home" ? btns[0] : e.key === "End" ? btns[btns.length - 1] : null;
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <div ref={root} className={cn("divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]", className)}>
      {items.map((it) => {
        const isOpen = open.includes(it.id);
        const tid = `${base}-${it.id}-t`;
        const pid = `${base}-${it.id}-p`;
        return (
          <div key={it.id}>
            <H className="m-0">
              <button
                id={tid}
                type="button"
                data-acc-trigger
                aria-expanded={isOpen}
                aria-controls={pid}
                onClick={() => toggle(it.id)}
                onKeyDown={onKey}
                className={cn("flex min-h-12 w-full items-center gap-3 px-[var(--card-p)] text-left text-sm font-medium hover:bg-surface-2", focusRing, "focus-visible:ring-inset")}
              >
                <span className="flex-1">{it.title}</span>
                <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-ink-3 transition-transform motion-reduce:transition-none", isOpen && "rotate-180")} />
              </button>
            </H>
            <div id={pid} role="region" aria-labelledby={tid} hidden={!isOpen} className="px-[var(--card-p)] pb-4 text-ui text-ink-2">
              {it.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inspector panel                                                     */
/* ------------------------------------------------------------------ */

/** Side / inspector panel: sticky header with title and close, scrolling sections, optional footer. */
export function InspectorPanel({
  title,
  sub,
  onClose,
  footer,
  children,
  className,
}: {
  title: string;
  sub?: string;
  onClose?: () => void;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside aria-label={title} className={cn("flex max-h-[420px] flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]", className)}>
      <div className="flex items-start gap-2 border-b border-line px-[var(--card-p)] py-3">
        <div className="min-w-0 flex-1">
          <h3 className="heading-card truncate">{title}</h3>
          {sub ? <p className="truncate text-xs text-ink-3">{sub}</p> : null}
        </div>
        {onClose ? <IconButton aria-label={`Close ${title}`} icon={<X />} size="sm" onClick={onClose} tooltip={false} /> : null}
      </div>
      <div className="flex-1 divide-y divide-line overflow-y-auto">{children}</div>
      {footer ? <div className="flex justify-end gap-2 border-t border-line bg-surface-2/60 px-[var(--card-p)] py-2.5">{footer}</div> : null}
    </aside>
  );
}

/** One titled block inside an InspectorPanel. */
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-[var(--card-p)] py-3.5">
      <p className="text-overline">{title}</p>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Resizable panels                                                    */
/* ------------------------------------------------------------------ */

/**
 * Two panes with a draggable divider (WAI-ARIA window splitter). Drag with a
 * pointer, or focus the divider and use ← → (Shift for bigger steps), Home, End.
 * `size` is the first pane's share in percent.
 */
export function ResizablePanels({
  first,
  second,
  defaultSize = 40,
  min = 20,
  max = 80,
  label = "Resize panels",
  className,
}: {
  first: ReactNode;
  second: ReactNode;
  defaultSize?: number;
  min?: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  const [size, setSize] = useState(defaultSize);
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const firstId = useId();
  const clamp = (v: number) => Math.round(Math.max(min, Math.min(max, v)));

  const fromPointer = (e: PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    setSize(clamp(((e.clientX - r.left) / r.width) * 100));
  };

  const onKey = (e: KeyboardEvent) => {
    const stepBy = e.shiftKey ? 10 : 2;
    let next: number | null = null;
    if (e.key === "ArrowLeft") next = size - stepBy;
    else if (e.key === "ArrowRight") next = size + stepBy;
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    else if (e.key === "Enter") next = size === min ? defaultSize : min;
    if (next !== null) {
      e.preventDefault();
      setSize(clamp(next));
    }
  };

  return (
    <div ref={box} className={cn("flex min-h-56 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]", dragging && "select-none", className)}>
      <div id={firstId} className="min-w-0 overflow-auto" style={{ flexBasis: `${size}%` }}>
        {first}
      </div>
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label={label}
        aria-controls={firstId}
        aria-valuenow={size}
        aria-valuemin={min}
        aria-valuemax={max}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (dragging) fromPointer(e);
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          setDragging(false);
        }}
        className={cn(
          "group relative w-3 shrink-0 cursor-col-resize touch-none bg-surface-2 outline-none",
          "focus-visible:bg-brand-100",
        )}
      >
        <span aria-hidden="true" className={cn("absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line-strong transition-colors group-hover:bg-brand-700 group-focus-visible:bg-brand-800", dragging && "bg-brand-800")} />
        <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-8 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line-strong bg-surface" />
      </div>
      <div className="min-w-0 flex-1 overflow-auto">{second}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Split view                                                          */
/* ------------------------------------------------------------------ */

export interface SplitItem {
  id: string;
  title: string;
  sub?: string;
  meta?: string;
  unread?: boolean;
}

/**
 * List on the left, detail on the right. Below `md` it shows one pane at a time
 * with a back button.
 */
export function SplitView({
  items,
  selected,
  onSelect,
  renderDetail,
  listLabel,
  className,
}: {
  items: SplitItem[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  renderDetail: (id: string) => ReactNode;
  listLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("grid h-80 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)] md:grid-cols-[260px_minmax(0,1fr)]", className)}>
      <ul aria-label={listLabel} className={cn("divide-y divide-line overflow-y-auto border-line md:border-r", selected && "hidden md:block")}>
        {items.map((it) => {
          const active = it.id === selected;
          return (
            <li key={it.id}>
              <button
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(it.id)}
                className={cn("flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-surface-2", focusRing, "focus-visible:ring-inset", active && "bg-surface-2 shadow-[inset_2px_0_0_var(--ink)]")}
              >
                <span className="flex items-center gap-2">
                  {it.unread ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-brand-800">
                      <span className="sr-only">Unread</span>
                    </span>
                  ) : null}
                  <span className={cn("min-w-0 flex-1 truncate text-ui", it.unread ? "font-semibold" : "font-medium")}>{it.title}</span>
                  {it.meta ? <span className="shrink-0 text-2xs text-ink-3">{it.meta}</span> : null}
                </span>
                {it.sub ? <span className="truncate text-xs text-ink-3">{it.sub}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <div className={cn("min-w-0 overflow-y-auto", !selected && "hidden md:block")}>
        {selected ? (
          <div className="flex flex-col">
            <div className="border-b border-line px-2 py-1.5 md:hidden">
              <button type="button" onClick={() => onSelect(null)} className={cn("inline-flex h-8 items-center gap-1 rounded-[var(--radius-control)] px-2 text-ui font-medium text-ink-2 hover:bg-surface-2", focusRing)}>
                <ChevronLeft aria-hidden="true" className="size-4" /> Back
              </button>
            </div>
            {renderDetail(selected)}
          </div>
        ) : (
          <div className="grid h-full place-items-center p-6 text-center text-ui text-ink-3">Pick an item to see it here.</div>
        )}
      </div>
    </div>
  );
}
