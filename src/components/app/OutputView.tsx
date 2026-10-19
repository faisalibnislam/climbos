import type { ReactNode } from "react";
import { ExternalLink } from "@/components/icons"
import { cn } from "@/lib/utils";

/**
 * Renders any job's structured output (audits, analyses, plans) with the
 * design system: objects become titled sections, lists become bullets or
 * small cards, links stay clickable. Internal bookkeeping keys are hidden.
 */

const HIDDEN = new Set(["factIndexes", "claimFactIds", "id", "_id", "priority", "confidence"]);
const TITLE_KEYS = ["title", "name", "headline", "fix", "step", "play", "channel", "metric", "risk", "issue", "subject", "objection"];

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

function Text({ value }: { value: string }) {
  if (isUrl(value)) {
    let host = value;
    try {
      host = new URL(value).hostname.replace(/^www\./, "");
    } catch {
      // keep raw
    }
    return (
      <a href={value} target="_blank" rel="noreferrer noopener" className="text-link inline-flex items-center gap-1">
        {host} <ExternalLink aria-hidden="true" className="size-3.5" />
      </a>
    );
  }
  return <span className="whitespace-pre-line">{value}</span>;
}

function titleOf(obj: Record<string, unknown>): { key: string; value: string } | null {
  for (const k of TITLE_KEYS) if (typeof obj[k] === "string" && obj[k]) return { key: k, value: obj[k] as string };
  return null;
}

function Value({ value, depth }: { value: unknown; depth: number }): ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-ink-3">—</span>;
  if (typeof value === "string") return <Text value={value} />;
  if (typeof value === "number" || typeof value === "boolean") return <span className="tabular-nums">{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-ink-3">None</span>;
    if (value.every((v) => typeof v !== "object" || v === null)) {
      return (
        <ul className="list-disc space-y-1 pl-5 marker:text-ink-3">
          {value.map((v, i) => (
            <li key={i}>
              <Value value={v} depth={depth + 1} />
            </li>
          ))}
        </ul>
      );
    }
    return (
      <ol className="grid gap-2">
        {value.map((v, i) => (
          <li key={i} className="rounded-lg border border-line bg-surface-2/60 p-3">
            <Value value={v} depth={depth + 1} />
          </li>
        ))}
      </ol>
    );
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const title = depth > 0 ? titleOf(obj) : null;
    const entries = Object.entries(obj).filter(([k, v]) => !HIDDEN.has(k) && k !== title?.key && v !== undefined);
    return (
      <div className={cn("flex flex-col", depth === 0 ? "gap-6" : "gap-2")}>
        {title ? <p className="heading-card">{title.value}</p> : null}
        {entries.map(([k, v]) => {
          const simple = typeof v !== "object" || v === null;
          if (depth > 0 && simple) {
            return (
              <p key={k} className="text-sm text-ink-2">
                <span className="font-medium text-ink">{humanize(k)}: </span>
                <Value value={v} depth={depth + 1} />
              </p>
            );
          }
          const Heading = depth === 0 ? "h2" : "h3";
          return (
            <section key={k} className="flex flex-col gap-2">
              <Heading className={depth === 0 ? "heading-section" : "text-overline"}>{humanize(k)}</Heading>
              <div className="text-sm text-ink-2">
                <Value value={v} depth={depth + 1} />
              </div>
            </section>
          );
        })}
      </div>
    );
  }
  return null;
}

export function OutputView({ value }: { value: unknown }) {
  return <Value value={value} depth={0} />;
}
