"use client";

/*
 * Signal read-only data displays: description list, key-value pairs,
 * comparison, JSON, code, diff, audit log and activity feed.
 */
import { Fragment, useState, type ReactNode } from "react";
import { Check, ChevronRight, Copy } from "@/components/icons";
import { Avatar, Badge, Button, type Tone } from "@/components/ui";
import { cn } from "@/lib/utils";

const ring = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

/** Small copy-to-clipboard button with a 1.5s "Copied" state. */
export function CopyButton({ value, label, className, tone = "light" }: { value: string; label: string; className?: string; tone?: "light" | "dark" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {},
        );
      }}
      aria-label={copied ? "Copied" : label}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-[var(--radius-control)] px-1.5 text-xs font-medium transition-colors",
        tone === "dark" ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
        ring,
        className,
      )}
    >
      {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
      <span aria-hidden="true">{copied ? "Copied" : "Copy"}</span>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Description list                                                    */
/* ------------------------------------------------------------------ */

/** Labelled details (term above or beside its value). `columns={2}` on wide screens. */
export function DescriptionList({ items, columns = 1, layout = "side", className }: { items: { term: string; detail: ReactNode }[]; columns?: 1 | 2; layout?: "side" | "stacked"; className?: string }) {
  return (
    <dl className={cn("grid gap-x-8", columns === 2 && "md:grid-cols-2", className)}>
      {items.map((it) => (
        <div key={it.term} className={cn("border-b border-line py-3 last:border-b-0", layout === "side" ? "grid gap-1 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4" : "flex flex-col gap-1")}>
          <dt className="text-ui text-ink-3">{it.term}</dt>
          <dd className="min-w-0 text-ui text-ink">{it.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* Key-value pairs                                                     */
/* ------------------------------------------------------------------ */

export interface KeyValue {
  k: string;
  v: string;
  /** Show a copy button (IDs, keys, URLs). */
  copy?: boolean;
  mono?: boolean;
}

/** Dense key → value rows, optionally copyable. `inline` renders wrapping chips. */
export function KeyValueList({ items, variant = "rows", className }: { items: KeyValue[]; variant?: "rows" | "inline"; className?: string }) {
  if (variant === "inline") {
    return (
      <dl className={cn("flex flex-wrap gap-1.5", className)}>
        {items.map((it) => (
          <div key={it.k} className="inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-badge)] bg-surface-2 px-2 text-xs">
            <dt className="text-ink-3">{it.k}</dt>
            <dd className={cn("font-medium text-ink", it.mono && "font-mono")}>{it.v}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className={cn("divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface", className)}>
      {items.map((it) => (
        <div key={it.k} className="flex min-h-10 items-center gap-3 px-3 py-1.5">
          <dt className="w-32 shrink-0 text-xs text-ink-3">{it.k}</dt>
          <dd className={cn("min-w-0 flex-1 truncate text-ui", it.mono && "font-mono text-xs")}>{it.v}</dd>
          {it.copy ? <CopyButton value={it.v} label={`Copy ${it.k}`} /> : null}
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* Data comparison                                                     */
/* ------------------------------------------------------------------ */

export interface ComparisonRow {
  label: string;
  a: number;
  b: number;
  format?: (n: number) => string;
  /** Default true. False for costs, bounce rates… */
  higherIsBetter?: boolean;
}

/** Two periods (or two options) side by side with the change and a paired bar. */
export function DataComparison({ labels, rows, className }: { labels: [string, string]; rows: ComparisonRow[]; className?: string }) {
  return (
    <div className={cn("relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]", className)}>
      <table className="w-full min-w-[560px] border-collapse text-left text-ui">
        <thead className="bg-surface-2">
          <tr className="border-b border-line">
            <th scope="col" className="h-9 px-4 text-xs font-medium text-ink-3">
              Metric
            </th>
            <th scope="col" className="h-9 px-4 text-right text-xs font-medium text-ink-3">
              <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-[1px] bg-chart-6" />{labels[0]}</span>
            </th>
            <th scope="col" className="h-9 px-4 text-right text-xs font-medium text-ink-3">
              <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-[1px] bg-ink" />{labels[1]}</span>
            </th>
            <th scope="col" className="h-9 px-4 text-right text-xs font-medium text-ink-3">
              Change
            </th>
            <th scope="col" className="h-9 w-40 px-4 text-xs font-medium text-ink-3">
              <span className="sr-only">Visual comparison</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const f = r.format ?? ((n: number) => n.toLocaleString("en-US"));
            const diff = r.a === 0 ? 0 : (r.b - r.a) / Math.abs(r.a);
            const up = diff >= 0;
            const good = (r.higherIsBetter ?? true) ? up : !up;
            const tone: Tone = Math.abs(diff) < 0.005 ? "neutral" : good ? "green" : "red";
            const max = Math.max(r.a, r.b) || 1;
            return (
              <tr key={r.label} className="border-b border-line last:border-b-0">
                <th scope="row" className="h-[var(--cell-h)] px-4 font-medium">
                  {r.label}
                </th>
                <td className="px-4 text-right tabular-nums text-ink-2">{f(r.a)}</td>
                <td className="px-4 text-right font-semibold tabular-nums">{f(r.b)}</td>
                <td className="px-4 text-right">
                  <Badge tone={tone}>
                    {up ? "↑" : "↓"} {Math.abs(Math.round(diff * 1000) / 10)}%<span className="sr-only">{up ? " up" : " down"}</span>
                  </Badge>
                </td>
                <td className="px-4" aria-hidden="true">
                  <span className="flex flex-col gap-0.5">
                    <span className="h-1.5 rounded-[1px] bg-chart-6" style={{ width: `${Math.round((r.a / max) * 100)}%` }} />
                    <span className="h-1.5 rounded-[1px] bg-ink" style={{ width: `${Math.round((r.b / max) * 100)}%` }} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* JSON viewer                                                         */
/* ------------------------------------------------------------------ */

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function JsonValue({ v }: { v: Json }) {
  if (v === null) return <span className="text-ink-3">null</span>;
  if (typeof v === "string") return <span className="text-brand-800">&quot;{v}&quot;</span>;
  if (typeof v === "number") return <span className="text-chart-3">{v}</span>;
  if (typeof v === "boolean") return <span className="text-chart-4">{String(v)}</span>;
  return null;
}

/** Collapsible JSON tree. Objects deeper than `depth` start closed. */
export function JsonViewer({ data, depth = 1, label = "JSON", className }: { data: Json; depth?: number; label?: string; className?: string }) {
  const initial = () => {
    const s = new Set<string>();
    const walk = (v: Json, path: string, d: number) => {
      if (v && typeof v === "object") {
        if (d >= depth) s.add(path);
        Object.entries(v).forEach(([k, c]) => walk(c as Json, `${path}.${k}`, d + 1));
      }
    };
    walk(data, "$", 0);
    return s;
  };
  const [closed, setClosed] = useState<Set<string>>(initial);
  const toggle = (p: string) =>
    setClosed((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });
  const allPaths = () => {
    const s = new Set<string>();
    const walk = (v: Json, path: string) => {
      if (v && typeof v === "object") {
        s.add(path);
        Object.entries(v).forEach(([k, c]) => walk(c as Json, `${path}.${k}`));
      }
    };
    walk(data, "$");
    return s;
  };

  const node = (key: string | null, v: Json, path: string, last: boolean): ReactNode => {
    const comma = last ? "" : ",";
    const k = key !== null ? (
      <>
        <span className="text-ink">&quot;{key}&quot;</span>
        <span className="text-ink-3">: </span>
      </>
    ) : null;
    if (v === null || typeof v !== "object") {
      return (
        <div className="pl-5">
          {k}
          <JsonValue v={v} />
          <span className="text-ink-3">{comma}</span>
        </div>
      );
    }
    const isArr = Array.isArray(v);
    const entries = Object.entries(v) as [string, Json][];
    const isClosed = closed.has(path);
    const [o, c] = isArr ? ["[", "]"] : ["{", "}"];
    return (
      <div>
        <button
          type="button"
          aria-expanded={!isClosed}
          onClick={() => toggle(path)}
          className={cn("inline-flex items-center rounded-[2px] text-left hover:bg-surface-2", ring)}
        >
          <ChevronRight aria-hidden="true" className={cn("mr-1 size-4 text-ink-3 transition-transform motion-reduce:transition-none", !isClosed && "rotate-90")} />
          {k}
          <span className="text-ink-3">{o}</span>
          {isClosed ? (
            <span className="text-ink-3">
              {" "}
              {entries.length} {isArr ? (entries.length === 1 ? "item" : "items") : entries.length === 1 ? "key" : "keys"} {c}
              {comma}
            </span>
          ) : null}
        </button>
        {!isClosed ? (
          <>
            <div className="ml-2 border-l border-line pl-2">
              {entries.map(([ck, cv], i) => (
                <Fragment key={ck}>{node(isArr ? null : ck, cv, `${path}.${ck}`, i === entries.length - 1)}</Fragment>
              ))}
            </div>
            <div className="pl-5 text-ink-3">
              {c}
              {comma}
            </div>
          </>
        ) : null}
      </div>
    );
  };

  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]", className)}>
      <div className="flex items-center gap-1 border-b border-line bg-surface-2 px-3 py-1">
        <span className="flex-1 text-xs font-medium text-ink-3">{label}</span>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setClosed(new Set())}>
          Expand all
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setClosed(allPaths())}>
          Collapse all
        </Button>
        <CopyButton value={JSON.stringify(data, null, 2)} label="Copy JSON" />
      </div>
      <div className="max-h-80 overflow-auto p-3 font-mono text-xs leading-6">{node(null, data, "$", true)}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Code viewer                                                         */
/* ------------------------------------------------------------------ */

const KEYWORDS = new Set(["const", "let", "var", "function", "return", "if", "else", "for", "await", "async", "import", "from", "export", "new", "true", "false", "null", "type", "interface"]);
const TOKEN = /(\/\/.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b)/g;

function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const t = m[0];
    const cls = t.startsWith("//") ? "text-ink-3 italic" : /^["'`]/.test(t) ? "text-brand-800" : /^\d/.test(t) ? "text-chart-3" : KEYWORDS.has(t) ? "text-chart-4 font-medium" : null;
    out.push(cls ? (
      <span key={m.index} className={cls}>
        {t}
      </span>
    ) : (
      t
    ));
    last = m.index + t.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

/** Read-only code with line numbers, light highlighting, highlighted lines and copy. */
export function CodeViewer({ code, filename, language, highlightLines = [], wrap = false, className }: { code: string; filename?: string; language?: string; highlightLines?: number[]; wrap?: boolean; className?: string }) {
  const lines = code.replace(/\n$/, "").split("\n");
  const hl = new Set(highlightLines);
  return (
    <figure className={cn("overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]", className)}>
      <figcaption className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-1">
        <span className="flex-1 truncate font-mono text-xs text-ink-2">{filename ?? "Snippet"}</span>
        {language ? <Badge>{language}</Badge> : null}
        <CopyButton value={code} label={`Copy ${filename ?? "code"}`} />
      </figcaption>
      <div className="max-h-80 overflow-auto">
        <pre className="py-2 font-mono text-xs leading-6" tabIndex={0} aria-label={filename ?? "Code"}>
          <code className={cn("block", !wrap && "min-w-max")}>
            {lines.map((l, i) => (
              <span key={i} className={cn("flex", hl.has(i + 1) && "bg-sun-soft")}>
                <span aria-hidden="true" className={cn("w-10 shrink-0 select-none pr-3 text-right tabular-nums text-ink-3", hl.has(i + 1) && "shadow-[inset_2px_0_0_var(--sun-strong)]")}>
                  {i + 1}
                </span>
                <span className={cn("pr-4", wrap ? "whitespace-pre-wrap break-all" : "whitespace-pre")}>{l ? highlight(l) : " "}</span>
              </span>
            ))}
          </code>
        </pre>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Diff viewer                                                         */
/* ------------------------------------------------------------------ */

type DiffLine = { kind: "hunk" | "add" | "del" | "ctx"; text: string; old?: number; new?: number };

/** Parse a unified diff body (lines starting with @@, +, -, space). */
export function parseUnifiedDiff(diff: string): DiffLine[] {
  const out: DiffLine[] = [];
  let o = 0;
  let n = 0;
  for (const raw of diff.replace(/\n$/, "").split("\n")) {
    if (raw.startsWith("@@")) {
      const m = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      o = m ? Number(m[1]) : o;
      n = m ? Number(m[2]) : n;
      out.push({ kind: "hunk", text: raw });
    } else if (raw.startsWith("+")) out.push({ kind: "add", text: raw.slice(1), new: n++ });
    else if (raw.startsWith("-")) out.push({ kind: "del", text: raw.slice(1), old: o++ });
    else out.push({ kind: "ctx", text: raw.slice(1), old: o++, new: n++ });
  }
  return out;
}

/** Unified diff: old / new line numbers, +/− gutter, added lines green, removed red. */
export function DiffViewer({ diff, filename, className }: { diff: string; filename?: string; className?: string }) {
  const lines = parseUnifiedDiff(diff);
  const adds = lines.filter((l) => l.kind === "add").length;
  const dels = lines.filter((l) => l.kind === "del").length;
  return (
    <figure className={cn("overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]", className)}>
      <figcaption className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-3 py-1.5">
        <span className="flex-1 truncate font-mono text-xs text-ink-2">{filename ?? "Changes"}</span>
        <span className="text-xs font-medium tabular-nums text-green-800">+{adds}</span>
        <span className="text-xs font-medium tabular-nums text-red-800">−{dels}</span>
        <span className="sr-only">
          {adds} lines added, {dels} lines removed
        </span>
      </figcaption>
      <div className="max-h-80 overflow-auto">
        <table className="w-full border-collapse font-mono text-xs leading-6">
          <tbody>
            {lines.map((l, i) =>
              l.kind === "hunk" ? (
                <tr key={i} className="bg-blue-100/60 text-blue-800">
                  <td colSpan={4} className="px-3">
                    {l.text}
                  </td>
                </tr>
              ) : (
                <tr key={i} className={cn(l.kind === "add" && "bg-green-100/70", l.kind === "del" && "bg-red-100/70")}>
                  <td className="w-10 select-none border-r border-line px-2 text-right tabular-nums text-ink-3">{l.old ?? ""}</td>
                  <td className="w-10 select-none border-r border-line px-2 text-right tabular-nums text-ink-3">{l.new ?? ""}</td>
                  <td className={cn("w-6 select-none text-center font-semibold", l.kind === "add" ? "text-green-800" : l.kind === "del" ? "text-red-800" : "text-ink-3")}>
                    <span aria-hidden="true">{l.kind === "add" ? "+" : l.kind === "del" ? "−" : ""}</span>
                    <span className="sr-only">{l.kind === "add" ? "Added" : l.kind === "del" ? "Removed" : ""}</span>
                  </td>
                  <td className="whitespace-pre pr-4">{l.text || " "}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

export interface AuditEntry {
  id: string;
  time: string;
  actor: string;
  actorKind: "person" | "autopilot" | "system";
  action: string;
  target: string;
  source?: string;
  changes?: { field: string; from: string; to: string }[];
}

const ACTOR_TONE: Record<AuditEntry["actorKind"], Tone> = { person: "neutral", autopilot: "brand", system: "blue" };

/** Who did what, when. Rows with field changes open to show before → after. */
export function AuditLog({ entries, className }: { entries: AuditEntry[]; className?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className={cn("relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]", className)}>
      <table className="w-full min-w-[680px] border-collapse whitespace-nowrap text-left text-ui">
        <thead className="bg-surface-2">
          <tr className="border-b border-line">
            {["Time", "Actor", "Action", "Target", "Source"].map((h) => (
              <th key={h} scope="col" className="h-9 px-4 text-xs font-medium text-ink-3">
                {h}
              </th>
            ))}
            <th scope="col" className="h-9 w-24 px-4">
              <span className="sr-only">Changes</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const isOpen = open === e.id;
            return (
              <Fragment key={e.id}>
                <tr className="border-b border-line">
                  <td className="h-[var(--cell-h)] whitespace-nowrap px-4 font-mono text-xs tabular-nums text-ink-3">{e.time}</td>
                  <td className="px-4">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{e.actor}</span>
                      {e.actorKind !== "person" ? <Badge tone={ACTOR_TONE[e.actorKind]}>{e.actorKind === "autopilot" ? "Autopilot" : "System"}</Badge> : null}
                    </span>
                  </td>
                  <td className="px-4 text-ink-2">{e.action}</td>
                  <td className="px-4 font-medium">{e.target}</td>
                  <td className="px-4 text-xs text-ink-3">{e.source ?? "App"}</td>
                  <td className="px-4 text-right">
                    {e.changes?.length ? (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : e.id)}
                        className={cn("inline-flex h-7 items-center gap-1 rounded-[var(--radius-control)] px-2 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink", ring)}
                      >
                        {e.changes.length} {e.changes.length === 1 ? "change" : "changes"}
                        <ChevronRight aria-hidden="true" className={cn("size-3.5 transition-transform motion-reduce:transition-none", isOpen && "rotate-90")} />
                      </button>
                    ) : null}
                  </td>
                </tr>
                {isOpen && e.changes ? (
                  <tr className="border-b border-line bg-surface-2/60">
                    <td colSpan={6} className="px-4 py-2.5">
                      <ul className="flex flex-col gap-1 text-xs">
                        {e.changes.map((c) => (
                          <li key={c.field} className="flex flex-wrap items-center gap-2">
                            <span className="w-28 text-ink-3">{c.field}</span>
                            <span className="rounded-[3px] bg-red-100 px-1.5 py-0.5 text-red-800 line-through decoration-red-800/50">
                              <span className="sr-only">From </span>
                              {c.from}
                            </span>
                            <span aria-hidden="true" className="text-ink-3">→</span>
                            <span className="rounded-[3px] bg-green-100 px-1.5 py-0.5 text-green-800">
                              <span className="sr-only">to </span>
                              {c.to}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Activity feed                                                       */
/* ------------------------------------------------------------------ */

export interface FeedItem {
  id: string;
  day: string;
  time: string;
  actor: string;
  /** Use an icon instead of an avatar (Autopilot, integrations). */
  icon?: ReactNode;
  text: ReactNode;
  /** Quoted content (a reply, a post caption). */
  quote?: string;
  kind: string;
}

/** Grouped by day, newest first, with an optional quote under an entry. */
export function ActivityFeed({ items, className }: { items: FeedItem[]; className?: string }) {
  const days = [...new Set(items.map((i) => i.day))];
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {days.map((d) => (
        <section key={d} aria-label={d}>
          <h3 className="text-overline mb-2">{d}</h3>
          <ol className="flex flex-col">
            {items
              .filter((i) => i.day === d)
              .map((it, idx, arr) => (
                <li key={it.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {idx < arr.length - 1 ? <span aria-hidden="true" className="absolute left-4 top-9 bottom-1 w-px bg-line-strong" /> : null}
                  {it.icon ? (
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-ink-2 ring-1 ring-line [&_svg]:size-4">
                      {it.icon}
                    </span>
                  ) : (
                    <Avatar name={it.actor} />
                  )}
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="text-ui text-ink-2">
                      <span className="font-medium text-ink">{it.actor}</span> {it.text}
                      <span className="text-ink-3"> · {it.time}</span>
                    </p>
                    {it.quote ? <blockquote className="mt-2 rounded-[var(--radius-card)] border border-line bg-surface px-3 py-2 text-ui text-ink-2 shadow-[var(--card-shadow)]">{it.quote}</blockquote> : null}
                  </div>
                </li>
              ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
