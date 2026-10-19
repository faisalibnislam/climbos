"use client";

/*
 * AI output the owner reviews: suggestion cards, insights, before/after previews,
 * approval requests, content previews, regenerate, prompt templates, citations,
 * feedback and anomaly alerts.
 */
import { Fragment, useId, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  MessageCircle,
  Pencil,
  RefreshCw,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  X,
} from "@/components/icons";
import { Badge, Button, IconButton, Segmented, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { AIMark, AIPanel, CreditCost } from "./shared";
import { AIConfidence } from "./run";

/* ------------------------------------------------------------------ */
/* Suggestion card                                                     */
/* ------------------------------------------------------------------ */

export interface AISuggestionCardProps {
  title: string;
  why: string;
  impact: string;
  confidence: number;
  credits: number;
  onAccept?: () => void;
  className?: string;
}

export function AISuggestionCard({ title, why, impact, confidence, credits, onAccept, className }: AISuggestionCardProps) {
  const [state, setState] = useState<"open" | "accepted" | "dismissed">("open");
  if (state === "dismissed")
    return (
      <p className={cn("flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong px-4 py-3 text-ui text-ink-3", className)} aria-live="polite">
        Suggestion hidden.
        <button type="button" onClick={() => setState("open")} className="font-medium text-ink underline underline-offset-2">
          Undo
        </button>
      </p>
    );
  return (
    <AIPanel as="article" className={cn("flex flex-col gap-3 p-[var(--card-p)]", className)}>
      <div className="flex items-start gap-2.5">
        <AIMark size="sm" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-overline">Suggested play</p>
          <h3 className="heading-card">{title}</h3>
        </div>
        <IconButton size="sm" aria-label="Hide suggestion" icon={<X className="size-4" />} onClick={() => setState("dismissed")} />
      </div>
      <p className="text-voice">{why}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="inline-flex items-center gap-1 font-medium text-green-800">
          <TrendingUp aria-hidden className="size-3.5" />
          {impact}
        </span>
        <AIConfidence value={confidence} variant="inline" />
        <CreditCost credits={credits} />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3" aria-live="polite">
        {state === "accepted" ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-ui font-medium text-green-800">
              <Check aria-hidden className="size-4" /> Added to this week’s plan
            </span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setState("open")}>
              Undo
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              onClick={() => {
                setState("accepted");
                onAccept?.();
              }}
            >
              Add to plan
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setState("dismissed")}>
              Not now
            </Button>
          </>
        )}
      </div>
    </AIPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Insights                                                            */
/* ------------------------------------------------------------------ */

export interface Insight {
  id: string;
  metric: string;
  delta: string;
  good: boolean;
  body: string;
  action?: string;
}

export function AIInsights({ insights, updated, className }: { insights: Insight[]; updated: string; className?: string }) {
  return (
    <AIPanel className={cn("flex flex-col p-[var(--card-p)]", className)} aria-label="Insights">
      <div className="mb-2 flex items-center gap-2.5">
        <AIMark size="sm" />
        <h3 className="heading-card">What ClimbOS noticed</h3>
        <span className="ml-auto text-2xs text-ink-3">Updated {updated}</span>
      </div>
      <ul className="divide-y divide-line">
        {insights.map((i) => (
          <li key={i.id} className="flex flex-col gap-1.5 py-3 last:pb-0">
            <p className="flex items-center gap-2 text-xs">
              <span className="font-medium text-ink">{i.metric}</span>
              <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", i.good ? "text-green-800" : "text-red-800")}>
                {i.good ? <TrendingUp aria-hidden className="size-3.5" /> : <TrendingDown aria-hidden className="size-3.5" />}
                {i.delta}
              </span>
            </p>
            <p className="text-voice">{i.body}</p>
            {i.action ? (
              <button type="button" className="inline-flex w-fit items-center gap-1 text-ui font-medium text-ink underline-offset-2 hover:underline">
                {i.action}
                <ArrowRight aria-hidden className="size-3.5" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </AIPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Action preview (before / after)                                     */
/* ------------------------------------------------------------------ */

type DiffPart = { t: string; k: "same" | "add" | "del" };

/** Word-level diff (LCS). Fine for short copy. */
export function wordDiff(a: string, b: string): DiffPart[] {
  const x = a.split(/(\s+)/);
  const y = b.split(/(\s+)/);
  const dp = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) {
      out.push({ t: x[i], k: "same" });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ t: x[i++], k: "del" });
    else out.push({ t: y[j++], k: "add" });
  }
  while (i < x.length) out.push({ t: x[i++], k: "del" });
  while (j < y.length) out.push({ t: y[j++], k: "add" });
  return out;
}

export function AIActionPreview({ title, target, before, after, className }: { title: string; target: string; before: string; after: string; className?: string }) {
  const [view, setView] = useState<"side" | "changes">("side");
  const diff = useMemo(() => wordDiff(before, after), [before, after]);
  return (
    <AIPanel className={cn("flex flex-col gap-3 p-[var(--card-p)]", className)} aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="heading-card">{title}</h3>
          <p className="text-xs text-ink-3">{target}</p>
        </div>
        <Segmented
          label="Preview mode"
          value={view}
          onChange={setView}
          options={[
            { value: "side", label: "Before / after" },
            { value: "changes", label: "Changes" },
          ]}
        />
      </div>
      {view === "side" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-[var(--radius-control)] bg-surface-2 p-3">
            <p className="text-overline mb-1">Before</p>
            <p className="text-ui text-ink-2">{before}</p>
          </div>
          <div className="rounded-[var(--radius-control)] border border-ink p-3">
            <p className="text-overline mb-1 !text-ink">After</p>
            <p className="text-ui text-ink">{after}</p>
          </div>
        </div>
      ) : (
        <p className="rounded-[var(--radius-control)] bg-surface-2 p-3 text-ui leading-6 text-ink">
          {diff.map((d, i) =>
            d.k === "same" ? (
              <Fragment key={i}>{d.t}</Fragment>
            ) : d.k === "add" ? (
              <ins key={i} className="rounded-[2px] bg-green-100 text-green-800 no-underline">
                {d.t}
              </ins>
            ) : (
              <del key={i} className="rounded-[2px] bg-red-100 text-red-800">
                {d.t}
              </del>
            ),
          )}
        </p>
      )}
    </AIPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Approval request                                                    */
/* ------------------------------------------------------------------ */

const REJECT_REASONS = ["Off-brand", "Wrong facts", "Bad timing", "Not this channel"];

export interface AIApprovalRequestProps {
  agent: string;
  action: string;
  channel: string;
  when: string;
  credits: number;
  draft: string;
  note?: string;
  className?: string;
}

export function AIApprovalRequest({ agent, action, channel, when, credits, draft, note, className }: AIApprovalRequestProps) {
  const [state, setState] = useState<"pending" | "editing" | "rejecting" | "approved" | "rejected">("pending");
  const [text, setText] = useState(draft);
  const [reason, setReason] = useState<string | null>(null);
  const headingId = useId();
  return (
    <AIPanel as="article" className={cn("flex flex-col gap-3 p-[var(--card-p)]", className)} aria-labelledby={headingId}>
      <div className="flex flex-wrap items-start gap-2.5">
        <AIMark size="sm" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="heading-card">
            {action}
          </h3>
          <p className="text-xs text-ink-3">
            {agent} · {channel} · {when}
          </p>
        </div>
        {state === "approved" ? <Badge tone="green">Approved</Badge> : state === "rejected" ? <Badge tone="red">Rejected</Badge> : <Badge tone="amber">Needs approval</Badge>}
      </div>
      {state === "editing" ? (
        <Textarea aria-label="Edit draft" value={text} onChange={(e) => setText(e.target.value)} autosize rows={3} />
      ) : (
        <blockquote className="rounded-[var(--radius-control)] bg-surface-2 p-3 text-ui text-ink">{text}</blockquote>
      )}
      {note ? (
        <p className="flex items-start gap-1.5 text-xs text-ink-2">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0 text-amber-800" />
          {note}
        </p>
      ) : null}
      {state === "rejecting" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-medium text-ink-2">Why? This trains the next draft.</legend>
          <div className="flex flex-wrap gap-1.5">
            {REJECT_REASONS.map((r) => (
              <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)} className={cn("h-7 rounded-[var(--radius-badge)] border px-2.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:outline-none", reason === r ? "border-ink bg-ink text-white" : "border-line-strong text-ink-2 hover:text-ink")}>
                {r}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3" aria-live="polite">
        {state === "pending" ? (
          <>
            <Button size="sm" onClick={() => setState("approved")}>
              <Check aria-hidden /> Approve
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setState("editing")}>
              <Pencil aria-hidden /> Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setState("rejecting")}>
              Reject
            </Button>
            <CreditCost credits={credits} className="ml-auto" />
          </>
        ) : state === "editing" ? (
          <>
            <Button size="sm" onClick={() => setState("approved")}>
              Save and approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setText(draft);
                setState("pending");
              }}
            >
              Cancel
            </Button>
          </>
        ) : state === "rejecting" ? (
          <>
            <Button size="sm" variant="danger" disabled={!reason} onClick={() => setState("rejected")}>
              Reject draft
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setState("pending")}>
              Back
            </Button>
          </>
        ) : (
          <>
            <span className="text-ui text-ink-2">{state === "approved" ? `Scheduled for ${when}.` : `Rejected${reason ? `: ${reason.toLowerCase()}` : ""}. A new draft is on the way.`}</span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => {
                setReason(null);
                setState("pending");
              }}
            >
              <RotateCcw aria-hidden /> Undo
            </Button>
          </>
        )}
      </div>
    </AIPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Content preview                                                     */
/* ------------------------------------------------------------------ */

export interface ContentVariant {
  channel: string;
  limit: number;
  body: string;
  tags?: string;
  subject?: string;
}

export function AIContentPreview({ business, variants, className }: { business: string; variants: ContentVariant[]; className?: string }) {
  const [ch, setCh] = useState(variants[0]?.channel ?? "");
  const v = variants.find((x) => x.channel === ch) ?? variants[0];
  const len = v.body.length + (v.tags ? v.tags.length + 1 : 0);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Segmented label="Channel" value={ch} onChange={setCh} options={variants.map((x) => ({ value: x.channel, label: x.channel }))} />
      <AIPanel as="article" className="max-w-sm overflow-hidden" aria-label={`${v.channel} preview`}>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span aria-hidden className="grid size-7 place-items-center rounded-full bg-lime text-2xs font-semibold text-ink">
            {business.slice(0, 1)}
          </span>
          <span className="text-ui font-medium">{business}</span>
          <span className="ml-auto text-2xs text-ink-3">Draft</span>
        </div>
        {v.subject ? (
          <p className="border-y border-line px-3 py-2 text-ui">
            <span className="text-ink-3">Subject: </span>
            {v.subject}
          </p>
        ) : (
          <div className="grid aspect-[4/3] place-items-center bg-surface-3 text-ink-3">
            <span className="flex flex-col items-center gap-1 text-xs">
              <ImageIcon aria-hidden className="size-6" />
              Photo: fresh sourdough on the counter
            </span>
          </div>
        )}
        <div className="flex flex-col gap-1 px-3 py-3">
          <p className="whitespace-pre-line text-ui text-ink">{v.body}</p>
          {v.tags ? <p className="text-ui text-brand-800">{v.tags}</p> : null}
        </div>
        <div className="flex items-center justify-between border-t border-line px-3 py-2 text-2xs text-ink-3">
          <span className="inline-flex items-center gap-1">
            <MessageCircle aria-hidden className="size-3.5" />
            Written in your voice
          </span>
          <span className={cn("tabular-nums", len > v.limit && "font-medium text-red-800")}>
            {len} / {v.limit}
          </span>
        </div>
      </AIPanel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Regenerate                                                          */
/* ------------------------------------------------------------------ */

const TONES = ["Shorter", "Friendlier", "More direct"];

export function AIRegenerateButton({ versions: pool, credits = 2, className }: { versions: string[]; credits?: number; className?: string }) {
  const [versions, setVersions] = useState([pool[0]]);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tone, setTone] = useState<string | null>(null);
  const regenerate = () => {
    setBusy(true);
    window.setTimeout(() => {
      const next = [...versions, pool[versions.length % pool.length]];
      setVersions(next);
      setIdx(next.length - 1);
      setBusy(false);
    }, 900);
  };
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className={cn("rounded-[var(--radius-control)] bg-surface p-3 text-ui text-ink ring-1 ring-line transition-opacity", busy && "opacity-50")} aria-live="polite" aria-busy={busy}>
        {versions[idx]}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={regenerate} loading={busy} loadingText="Writing…">
          <RefreshCw aria-hidden />
          Regenerate{tone ? ` · ${tone.toLowerCase()}` : ""}
        </Button>
        <div role="group" aria-label="Tone for the next version" className="flex flex-wrap gap-1">
          {TONES.map((t) => (
            <button key={t} type="button" aria-pressed={tone === t} onClick={() => setTone(tone === t ? null : t)} className={cn("h-7 rounded-[var(--radius-badge)] px-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:outline-none", tone === t ? "bg-ink text-white" : "bg-surface-2 text-ink-2 hover:text-ink")}>
              {t}
            </button>
          ))}
        </div>
        <span className="ml-auto flex items-center gap-1 text-xs text-ink-3">
          <IconButton size="sm" aria-label="Previous version" icon={<ChevronLeft className="size-4" />} disabled={idx === 0} onClick={() => setIdx(idx - 1)} />
          <span className="tabular-nums" aria-live="polite">
            {idx + 1} of {versions.length}
          </span>
          <IconButton size="sm" aria-label="Next version" icon={<ChevronRight className="size-4" />} disabled={idx === versions.length - 1} onClick={() => setIdx(idx + 1)} />
        </span>
      </div>
      <p className="text-2xs text-ink-3">Each new version costs {credits} credits.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Prompt templates                                                    */
/* ------------------------------------------------------------------ */

export interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
  category: string;
  credits: number;
  icon?: ReactNode;
}

export function AIPromptTemplates({ templates, onUse, className }: { templates: PromptTemplate[]; onUse?: (t: PromptTemplate) => void; className?: string }) {
  const cats = ["All", ...Array.from(new Set(templates.map((t) => t.category)))];
  const [cat, setCat] = useState("All");
  const shown = cat === "All" ? templates : templates.filter((t) => t.category === cat);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Segmented label="Template category" value={cat} onChange={setCat} options={cats.map((c) => ({ value: c, label: c }))} />
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => onUse?.(t)} className="group flex h-full w-full flex-col gap-1.5 rounded-[var(--radius-card)] border border-line bg-surface p-3 text-left shadow-[var(--card-shadow)] transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:outline-none">
              <span className="flex items-center gap-2">
                {t.icon ? <span aria-hidden className="text-ink-2 [&_svg]:size-4">{t.icon}</span> : null}
                <span className="text-ui font-medium text-ink">{t.title}</span>
                <ArrowRight aria-hidden className="ml-auto size-3.5 text-ink-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </span>
              <span className="line-clamp-2 text-xs text-ink-3">{t.prompt}</span>
              <span className="mt-auto flex items-center gap-2 pt-1">
                <Badge tone="neutral">{t.category}</Badge>
                <CreditCost credits={t.credits} prefix="~" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Source citations                                                    */
/* ------------------------------------------------------------------ */

export interface Source {
  id: number;
  title: string;
  domain: string;
  date: string;
}

/** Text with numbered refs written as [1], [2]; refs link to the source list below. */
export function AISourceCitations({ text, sources, className }: { text: string; sources: Source[]; className?: string }) {
  const [hi, setHi] = useState<number | null>(null);
  const uid = useId();
  const parts = text.split(/(\[\d+\])/);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="text-voice">
        {parts.map((p, i) => {
          const m = p.match(/^\[(\d+)\]$/);
          if (!m) return <Fragment key={i}>{p}</Fragment>;
          const n = Number(m[1]);
          return (
            <a
              key={i}
              href={`#${uid}-src-${n}`}
              aria-label={`Source ${n}`}
              onMouseEnter={() => setHi(n)}
              onMouseLeave={() => setHi(null)}
              onFocus={() => setHi(n)}
              onBlur={() => setHi(null)}
              className={cn("mx-0.5 inline-grid h-4 min-w-4 -translate-y-1 place-items-center rounded-[3px] px-1 align-baseline font-sans text-2xs font-semibold not-italic leading-none transition-colors", hi === n ? "bg-ink text-white" : "bg-surface-3 text-ink-2")}
            >
              {n}
            </a>
          );
        })}
      </p>
      <ol className="flex flex-col gap-1 border-t border-line pt-3" aria-label="Sources">
        {sources.map((s) => (
          <li key={s.id} id={`${uid}-src-${s.id}`} className={cn("flex items-center gap-2.5 rounded-[var(--radius-control)] px-1.5 py-1 transition-colors", hi === s.id && "bg-surface-2")}>
            <span className="w-4 text-right text-2xs font-semibold tabular-nums text-ink-3">{s.id}</span>
            <span aria-hidden className="grid size-5 place-items-center rounded-[3px] bg-surface-3 text-2xs font-semibold uppercase text-ink-2">
              {s.domain.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1 truncate text-ui text-ink">{s.title}</span>
            <span className="hidden text-2xs text-ink-3 sm:inline">
              {s.domain} · {s.date}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback controls                                                   */
/* ------------------------------------------------------------------ */

const DOWN_REASONS = ["Wrong facts", "Off-brand", "Too long", "Not relevant", "Other"];

export function AIFeedbackControls({ className }: { className?: string }) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const toggle = (r: string) => setReasons(reasons.includes(r) ? reasons.filter((x) => x !== r) : [...reasons, r]);
  if (sent)
    return (
      <p className={cn("flex items-center gap-2 text-ui text-ink-2", className)} role="status">
        <Check aria-hidden className="size-4 text-green-800" />
        Thanks. The next draft will use this.
        <button type="button" className="ml-2 text-xs font-medium text-ink underline underline-offset-2" onClick={() => { setSent(false); setVote(null); setReasons([]); setNote(""); }}>
          Change
        </button>
      </p>
    );
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div role="group" aria-label="Rate this answer" className="flex items-center gap-1">
        <span className="mr-2 text-xs text-ink-3">Was this useful?</span>
        <Button size="sm" variant={vote === "up" ? "primary" : "secondary"} aria-pressed={vote === "up"} onClick={() => { setVote("up"); setSent(true); }}>
          <ThumbsUp aria-hidden /> Yes
        </Button>
        <Button size="sm" variant={vote === "down" ? "primary" : "secondary"} aria-pressed={vote === "down"} onClick={() => setVote(vote === "down" ? null : "down")}>
          <ThumbsDown aria-hidden /> No
        </Button>
      </div>
      {vote === "down" ? (
        <form
          className="flex max-w-md flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-ink-2">What was wrong?</legend>
            <div className="flex flex-wrap gap-1.5">
              {DOWN_REASONS.map((r) => (
                <button key={r} type="button" aria-pressed={reasons.includes(r)} onClick={() => toggle(r)} className={cn("h-7 rounded-[var(--radius-badge)] border px-2.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:outline-none", reasons.includes(r) ? "border-ink bg-ink text-white" : "border-line-strong text-ink-2 hover:text-ink")}>
                  {r}
                </button>
              ))}
            </div>
          </fieldset>
          <Textarea aria-label="Tell us more (optional)" placeholder="Tell us more (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={reasons.length === 0 && !note.trim()}>
              Send feedback
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setVote(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Anomaly alert                                                       */
/* ------------------------------------------------------------------ */

export interface AIAnomalyAlertProps {
  title: string;
  explanation: string;
  /** Daily values; the last one is today. */
  series: number[];
  expected: [number, number];
  unit: string;
  className?: string;
}

export function AIAnomalyAlert({ title, explanation, series, expected, unit, className }: AIAnomalyAlertProps) {
  const [state, setState] = useState<"open" | "paused" | "dismissed">("open");
  const max = Math.max(...series, expected[1]) * 1.1;
  const W = 280;
  const H = 72;
  const x = (i: number) => Math.round((4 + (i / (series.length - 1)) * (W - 8)) * 100) / 100;
  const y = (v: number) => Math.round((H - 4 - (v / max) * (H - 8)) * 100) / 100;
  const pts = series.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const today = series[series.length - 1];
  if (state === "dismissed")
    return (
      <p className={cn("text-ui text-ink-3", className)} role="status">
        Alert dismissed.{" "}
        <button type="button" className="font-medium text-ink underline underline-offset-2" onClick={() => setState("open")}>
          Undo
        </button>
      </p>
    );
  return (
    <AIPanel as="article" className={cn("flex flex-col gap-3 border-l-[3px] border-l-red-800 p-[var(--card-p)]", className)} aria-label={title}>
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-control)] bg-red-100 text-red-800">
          <TriangleAlert className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="heading-card">{title}</h3>
            <Badge tone="red">Unusual</Badge>
          </div>
          <p className="text-xs text-ink-3">
            Today {unit}
            {today} · normal {unit}
            {expected[0]}–{unit}
            {expected[1]}
          </p>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Last ${series.length} days. Normal range ${unit}${expected[0]} to ${unit}${expected[1]}. Today ${unit}${today}.`}>
        <rect x={0} y={y(expected[1])} width={W} height={Math.round((y(expected[0]) - y(expected[1])) * 100) / 100} fill="var(--chart-1)" opacity={0.1} />
        <polyline points={pts} fill="none" stroke="var(--chart-2)" strokeWidth={1.5} />
        <circle cx={x(series.length - 1)} cy={y(today)} r={3.5} fill="var(--red-800)" />
      </svg>
      <p className="text-voice">{explanation}</p>
      <div className="flex flex-wrap gap-2" aria-live="polite">
        {state === "paused" ? (
          <>
            <span className="text-ui font-medium text-green-800">Ads paused. Nothing more is spent today.</span>
            <Button size="sm" variant="ghost" onClick={() => setState("open")}>
              Undo
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={() => setState("paused")}>
              Pause ads
            </Button>
            <Button size="sm" variant="secondary">
              See what changed
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setState("dismissed")}>
              Dismiss
            </Button>
          </>
        )}
      </div>
    </AIPanel>
  );
}
