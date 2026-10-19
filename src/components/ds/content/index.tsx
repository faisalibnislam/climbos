"use client";

/*
 * Content blocks that turn flat text into scannable content (docs/ContentDesign.md):
 * - Scannable: AI prose → bullets / numbered steps / labelled facts, key numbers bold,
 *   first `max` items shown and the rest behind "N more".
 * - KeyTakeaways, StatBlocks, StepFlow: the common structured shapes.
 */
import { Fragment, useState, type ReactNode } from "react";
import { Check } from "@/components/icons";
import { cn } from "@/lib/utils";

const ABBREV = /\b(e\.g|i\.e|vs|etc|approx|incl|no|mr|mrs|dr|st|u\.s|est)\.$/i;
const LIST_LINE = /^([-*•]|\d+[.)])\s+/;

/** One idea per item: list lines keep their items; otherwise one sentence each (long semicolon chains split). */
export function toBullets(text: string): string[] {
  const t = (text ?? "").trim();
  if (!t) return [];
  const lines = t
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > 1 && lines.filter((l) => LIST_LINE.test(l)).length >= lines.length - 1) return lines.map((l) => l.replace(LIST_LINE, ""));
  const out: string[] = [];
  for (const line of lines) {
    let buf = "";
    for (const part of line.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/)) {
      buf = buf ? `${buf} ${part}` : part;
      if (!ABBREV.test(buf)) {
        out.push(buf);
        buf = "";
      }
    }
    if (buf) out.push(buf);
  }
  return out.flatMap((s) => (s.length > 140 && s.includes("; ") ? s.split(/;\s+/) : [s])).map((s) => s.replace(/[;.]\s*$/, "").trim()).filter(Boolean);
}

export type ScannableShape = "steps" | "facts" | "bullets";

const SEQUENCE = /^(first|then|next|after that|finally|lastly|step \d+|day \d+|week \d+|phase \d+)\b/i;
const LEAD = /^([^:]{2,40}):\s+(.+)$/s;

/** Pick the shape from the content: a sequence → steps; mostly "Label: …" → facts; else bullets. */
export function shapeOf(items: string[], text: string): ScannableShape {
  if (/^\s*\d+[.)]\s+/m.test(text) && items.length > 1) return "steps";
  if (items.filter((i) => SEQUENCE.test(i)).length >= Math.max(2, Math.ceil(items.length / 2))) return "steps";
  if (items.length > 1 && items.filter((i) => LEAD.test(i)).length >= Math.ceil(items.length * 0.75)) return "facts";
  return "bullets";
}

const NUM = /(\$\s?\d[\d,]*(?:\.\d+)?(?:\s?[kKmM])?(?:\s?\/\s?\w+)?|\d[\d,]*(?:\.\d+)?\s?(?:%|[kKmM]\b|x\b|hours?\b|hrs?\b|h\/week|days?\b|weeks?\b|months?\b|credits?\b|customers?\b|visits?\b|posts?\b))/g;

/** Key numbers (money, %, counts with units) in bold so the eye lands on them. */
export function Highlight({ text }: { text: string }) {
  const parts = text.split(NUM);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-ink tabular-nums">
            {p}
          </strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function Lead({ text }: { text: string }) {
  const m = LEAD.exec(text);
  if (!m) return <Highlight text={text} />;
  return (
    <>
      <span className="font-semibold text-ink">{m[1]}:</span> <Highlight text={m[2]} />
    </>
  );
}

export interface ScannableProps {
  text: string;
  /** Items shown before "N more". */
  max?: number;
  /** Force a shape; by default it's chosen from the content. */
  shape?: ScannableShape;
  tone?: "default" | "muted";
  /** Show every item (e.g. a card-level "Expand all"); the "N more" toggle hides. */
  expanded?: boolean;
  className?: string;
}

export function Scannable({ text, max = 3, shape, tone = "default", expanded, className }: ScannableProps) {
  const [openState, setOpen] = useState(false);
  const open = expanded || openState;
  const items = toBullets(text);
  if (!items.length) return null;
  // One idea stays a plain line (no lone bullet).
  if (items.length === 1 && !shape) {
    return (
      <p className={cn("max-w-[70ch] whitespace-pre-line text-sm leading-relaxed", tone === "muted" ? "text-ink-2" : "text-ink", className)}>
        <Lead text={text.trim()} />
      </p>
    );
  }
  const kind = shape ?? shapeOf(items, text);
  const shown = open ? items : items.slice(0, max);
  const color = tone === "muted" ? "text-ink-2" : "text-ink";
  const more =
    items.length > max && !expanded ? (
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="self-start text-xs font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline">
        {open ? "Less" : `${items.length - max} more`}
      </button>
    ) : null;

  if (kind === "facts") {
    return (
      <div className={cn("flex max-w-[70ch] flex-col gap-1.5", className)}>
        <dl className={cn("grid gap-x-4 gap-y-1.5 text-sm leading-relaxed sm:grid-cols-[minmax(7rem,max-content)_1fr]", color)}>
          {shown.map((b, i) => {
            const m = LEAD.exec(b);
            return m ? (
              <div key={i} className="contents">
                <dt className="font-semibold text-ink">{m[1]}</dt>
                <dd className="-mt-1 sm:mt-0">
                  <Highlight text={m[2]} />
                </dd>
              </div>
            ) : (
              <dd key={i} className="sm:col-span-2">
                <Highlight text={b} />
              </dd>
            );
          })}
        </dl>
        {more}
      </div>
    );
  }

  const Tag = kind === "steps" ? "ol" : "ul";
  return (
    <div className={cn("flex max-w-[70ch] flex-col gap-1.5", className)}>
      <Tag className={cn("flex flex-col gap-1.5 text-sm leading-relaxed", color)}>
        {shown.map((b, i) => (
          <li key={i} className="flex gap-2.5">
            {kind === "steps" ? (
              <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[var(--radius-badge)] bg-brand-100 text-2xs font-semibold tabular-nums text-brand-900">
                {i + 1}
              </span>
            ) : (
              <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 bg-brand-700" />
            )}
            <span className="min-w-0">
              <Lead text={b.replace(SEQUENCE, (w) => w.charAt(0).toUpperCase() + w.slice(1))} />
            </span>
          </li>
        ))}
      </Tag>
      {more}
    </div>
  );
}

/** Alias: any AI or long text, shaped by its content. */
export const Prose = Scannable;

/** The few points that matter most, at the top of a long section. */
export function KeyTakeaways({ items, title = "Key takeaways", className }: { items: ReactNode[]; title?: string; className?: string }) {
  if (!items.length) return null;
  return (
    <aside aria-label={title} className={cn("rounded-[var(--radius-card)] bg-cream p-[var(--card-p)]", className)}>
      <p className="text-overline mb-2 text-ink-2">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm text-ink">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-800" />
            <span className="min-w-0">{it}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export interface Stat {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
}

const STAT_TONE: Record<NonNullable<Stat["tone"]>, string> = {
  default: "bg-surface",
  good: "bg-green-100",
  warn: "bg-amber-100",
  bad: "bg-red-100",
};
const STAT_INK: Record<NonNullable<Stat["tone"]>, string> = {
  default: "text-ink",
  good: "text-green-800",
  warn: "text-amber-800",
  bad: "text-red-800",
};

/** Important numbers as prominent blocks (2–4 in a row). */
export function StatBlocks({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <dl className={cn("grid gap-2", stats.length >= 4 ? "grid-cols-2 md:grid-cols-4" : stats.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2", className)}>
      {stats.map((s) => {
        const tone = s.tone ?? "default";
        return (
          <div key={s.label} className={cn("flex flex-col gap-0.5 rounded-[var(--radius-card)] border border-line px-3 py-2.5", STAT_TONE[tone])}>
            <dt className="text-xs text-ink-3">{s.label}</dt>
            <dd className={cn("text-xl font-semibold leading-7 tabular-nums", STAT_INK[tone])}>{s.value}</dd>
            {s.hint ? <dd className="text-xs text-ink-3">{s.hint}</dd> : null}
          </div>
        );
      })}
    </dl>
  );
}

/** "01 — Connect": a short sequence with a title per step and an optional line. */
export function StepFlow({ steps, className }: { steps: { title: ReactNode; body?: ReactNode; done?: boolean }[]; className?: string }) {
  return (
    <ol className={cn("grid gap-3", steps.length > 3 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3", className)}>
      {steps.map((s, i) => (
        <li key={i} className="flex flex-col gap-1 border-t-2 border-ink pt-2">
          <span className={cn("text-xs font-semibold tabular-nums", s.done ? "text-green-800" : "text-ink-3")}>
            {s.done ? "✓ " : ""}
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="text-sm font-semibold text-ink">{s.title}</span>
          {s.body ? <span className="text-ui leading-relaxed text-ink-2">{s.body}</span> : null}
        </li>
      ))}
    </ol>
  );
}
