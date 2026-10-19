"use client";

import { useState, type ReactNode } from "react";
import {
  BarChart3,
  CircleDollarSign,
  ExternalLink,
  FileText,
  Lightbulb,
  Link2,
  ListChecks,
  Megaphone,
  Search,
  Sparkles,
  TriangleAlert,
  UserRound,
  Users,
  type LucideIcon,
} from "@/components/icons";
import { Highlight, KeyTakeaways, Prose, Scannable, StatBlocks, toBullets } from "@/components/ds/content";
import { cn } from "@/lib/utils";

/**
 * Renders any job's structured output (audits, analyses, plans) as scannable
 * content (docs/ContentDesign.md): the summary as key takeaways, short facts as
 * a definition list, numbers as stat blocks, long text as bullets, lists of
 * items as cards (first few, then "N more"). Internal bookkeeping keys are hidden.
 */

const HIDDEN = new Set(["factIndexes", "claimFactIds", "id", "_id", "priority", "confidence"]);
const TITLE_KEYS = ["title", "name", "headline", "fix", "step", "play", "channel", "metric", "risk", "issue", "subject", "objection"];
const SUMMARY_KEY = /^(summary|overview|verdict|tl_?dr|bottom_?line|key_?takeaways?|takeaways?)$/i;
const CARDS_SHOWN = 4;
const LIST_SHOWN = 5;

/** Section icons by what the key is about, so a long output scans by shape. */
const SECTION_ICONS: [RegExp, LucideIcon][] = [
  [/summary|overview|verdict|takeaway/i, Sparkles],
  [/risk|warning|issue|problem|weakness|threat|objection|gap|error/i, TriangleAlert],
  [/fix|recommend|action|next|todo|step|task|plan/i, ListChecks],
  [/opportunit|idea|strength|win|insight|finding/i, Lightbulb],
  [/metric|number|stat|score|kpi|benchmark|result/i, BarChart3],
  [/competitor|rival/i, Users],
  [/channel|campaign|ad|post|content/i, Megaphone],
  [/audience|customer|persona|segment|buyer/i, UserRound],
  [/keyword|seo|search|query/i, Search],
  [/page|url|link|source|site/i, Link2],
  [/cost|budget|price|revenue|spend|money/i, CircleDollarSign],
];

function sectionIcon(key: string): LucideIcon {
  return SECTION_ICONS.find(([re]) => re.test(key))?.[1] ?? FileText;
}

export function humanize(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function isUrl(s: string) {
  return /^https?:\/\/\S+$/.test(s.trim());
}

/** A short value that reads as a fact ("Budget: $500"), not prose. */
function isShort(v: unknown): boolean {
  if (typeof v === "number" || typeof v === "boolean" || v === null || v === "") return true;
  return typeof v === "string" && (isUrl(v) || (v.length <= 90 && toBullets(v).length <= 1));
}

/** AI text: one sentence stays a line; more becomes bullets with the first `max` shown. Not for use inside <p>. */
/** Kept for existing imports; the shared block handles one-liners and bullets. */
export { Prose };

function Text({ value }: { value: string }) {
  if (isUrl(value)) {
    let host = value;
    try {
      host = new URL(value).hostname.replace(/^www\./, "");
    } catch {
      // keep raw
    }
    return (
      <a href={value} target="_blank" rel="noreferrer noopener" className="text-link inline-flex items-center gap-1 break-all">
        {host} <ExternalLink aria-hidden="true" className="size-3.5" />
      </a>
    );
  }
  return <Prose text={value} tone="muted" />;
}

function titleOf(obj: Record<string, unknown>): { key: string; value: string } | null {
  for (const k of TITLE_KEYS) if (typeof obj[k] === "string" && obj[k]) return { key: k, value: obj[k] as string };
  return null;
}

function Scalar({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return <span className="text-ink-3">—</span>;
  if (typeof value === "boolean") return <>{value ? "Yes" : "No"}</>;
  if (typeof value === "number") return <span className="tabular-nums">{value.toLocaleString("en-US")}</span>;
  if (typeof value === "string") return isUrl(value) ? <Text value={value} /> : <Highlight text={value} />;
  return null;
}

/** Short labelled values as a definition list. */
function Facts({ entries }: { entries: [string, unknown][] }) {
  return (
    <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(7rem,max-content)_1fr]">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-medium text-ink">{humanize(k)}</dt>
          <dd className="-mt-1 min-w-0 text-ink-2 sm:mt-0">
            <Scalar value={v} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

const allNumbers = (entries: [string, unknown][]) => entries.length >= 2 && entries.length <= 8 && entries.every(([, v]) => typeof v === "number");

function MoreToggle({ open, hidden, onClick }: { open: boolean; hidden: number; onClick: () => void }) {
  return (
    <button type="button" aria-expanded={open} onClick={onClick} className="self-start text-xs font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline">
      {open ? "Less" : `${hidden} more`}
    </button>
  );
}

function PrimitiveList({ items }: { items: unknown[] }) {
  if (items.every((v) => typeof v === "number")) return <span className="tabular-nums">{items.map((v) => (v as number).toLocaleString("en-US")).join(", ")}</span>;
  const strings = items.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  if (strings.length === items.length && !strings.some(isUrl)) {
    const text = strings.length === 1 ? strings[0] : strings.map((s) => `- ${s.replace(/\s*\n+\s*/g, " ")}`).join("\n");
    return <Scannable text={text} max={LIST_SHOWN} tone="muted" />;
  }
  return (
    <ul className="list-disc space-y-1 pl-5 marker:text-ink-3">
      {items.map((v, i) => (
        <li key={i}>
          <Scalar value={v} />
        </li>
      ))}
    </ul>
  );
}

function CardList({ items, depth }: { items: unknown[]; depth: number }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, CARDS_SHOWN);
  return (
    <div className="flex flex-col gap-2">
      <ol className="grid gap-2">
        {shown.map((v, i) => (
          <li key={i} className="rounded-lg border border-line bg-surface-2/60 p-3">
            <Value value={v} depth={depth + 1} />
          </li>
        ))}
      </ol>
      {items.length > CARDS_SHOWN ? <MoreToggle open={open} hidden={items.length - CARDS_SHOWN} onClick={() => setOpen((o) => !o)} /> : null}
    </div>
  );
}

function ObjectView({ obj, depth }: { obj: Record<string, unknown>; depth: number }) {
  const title = depth > 0 ? titleOf(obj) : null;
  const entries = Object.entries(obj).filter(([k, v]) => !HIDDEN.has(k) && k !== title?.key && v !== undefined);
  const summary = depth === 0 ? entries.find(([k, v]) => SUMMARY_KEY.test(k) && typeof v === "string" && v.trim()) : undefined;
  const rest = entries.filter((e) => e !== summary);
  const facts = rest.filter(([, v]) => isShort(v));
  const blocks = rest.filter(([, v]) => !isShort(v));
  const Heading = depth === 0 ? "h2" : "h3";
  return (
    <div className={cn("flex min-w-0 flex-col", depth === 0 ? "gap-6" : "gap-2.5")}>
      {title ? <p className="heading-card">{title.value}</p> : null}
      {summary ? <KeyTakeaways title={humanize(summary[0])} items={toBullets(summary[1] as string).map((b, i) => <Highlight key={i} text={b} />)} /> : null}
      {facts.length ? (
        allNumbers(facts) && depth <= 1 ? (
          <StatBlocks stats={facts.map(([k, v]) => ({ label: humanize(k), value: (v as number).toLocaleString("en-US") }))} />
        ) : (
          <Facts entries={facts} />
        )
      ) : null}
      {blocks.map(([k, v]) => {
        const Icon = sectionIcon(k);
        return (
          <section key={k} className="flex min-w-0 flex-col gap-2">
            <Heading className={depth === 0 ? "heading-section flex items-center gap-2" : "text-overline"}>
              {depth === 0 ? <Icon aria-hidden className="size-4 shrink-0 text-brand-800" /> : null}
              {humanize(k)}
            </Heading>
            <div className="min-w-0 text-sm text-ink-2">
              <Value value={v} depth={depth + 1} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Value({ value, depth }: { value: unknown; depth: number }): ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-ink-3">—</span>;
  if (typeof value === "string") return <Text value={value} />;
  if (typeof value === "number" || typeof value === "boolean") return <Scalar value={value} />;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-ink-3">None</span>;
    if (value.every((v) => typeof v !== "object" || v === null)) return <PrimitiveList items={value} />;
    return <CardList items={value} depth={depth} />;
  }
  if (typeof value === "object") return <ObjectView obj={value as Record<string, unknown>} depth={depth} />;
  return null;
}

export function OutputView({ value }: { value: unknown }) {
  return <Value value={value} depth={0} />;
}
