"use client";

/*
 * AI settings and spend controls: model selector (Luna / Sol), automation toggle,
 * usage tracker, cost breakdown, memory controls and per-tool permissions.
 */
import { DropdownMenu as RMenu } from "radix-ui";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Crown, Plus, RotateCcw, Trash2 } from "@/components/icons";
import { Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger, Input, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import { AIPanel, CreditCost, MODELS, ModelGlyph, type ModelTier } from "./shared";

/* ------------------------------------------------------------------ */
/* Model selector                                                      */
/* ------------------------------------------------------------------ */

export interface AIModelSelectorProps {
  value: ModelTier;
  onChange: (m: ModelTier) => void;
  /** "cards" for settings, "compact" for a menu inside a prompt bar. */
  variant?: "cards" | "compact";
  /** Account can use Sol (paid plan). */
  canUseSol?: boolean;
  onUpgrade?: () => void;
  className?: string;
}

export function AIModelSelector({ value, onChange, variant = "cards", canUseSol = true, onUpgrade, className }: AIModelSelectorProps) {
  const name = useId();
  const models = [MODELS.luna, MODELS.sol];
  if (variant === "compact") {
    const cur = MODELS[value];
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`Model: ${cur.name}`} className={cn("inline-flex h-[var(--h-sm)] items-center gap-1.5 rounded-[var(--radius-control)] px-2 text-ui font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:outline-none", className)}>
            <ModelGlyph model={value} className="size-3.5" />
            {cur.name}
            <ChevronDown aria-hidden className="size-3.5 text-ink-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Model</DropdownMenuLabel>
          <RMenu.RadioGroup value={value} onValueChange={(v) => onChange(v as ModelTier)}>
            {models.map((m) => {
              const locked = m.paid && !canUseSol;
              return (
                <RMenu.RadioItem key={m.id} value={m.id} disabled={locked} className="flex cursor-pointer select-none items-start gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 data-[highlighted]:bg-surface-2">
                  <ModelGlyph model={m.id} className="mt-0.5 text-ink-2" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-ui font-medium text-ink">
                      {m.name} <span className="font-normal text-ink-3">· {m.tier}</span>
                      {locked ? <Badge tone="neutral" icon={<Crown />}>Pro</Badge> : null}
                    </span>
                    <span className="block text-xs text-ink-3">{m.blurb}</span>
                  </span>
                  <CreditCost credits={m.credits} prefix="~" />
                  {value === m.id ? <Check aria-hidden className="mt-0.5 size-4 text-ink" /> : <span className="size-4" />}
                </RMenu.RadioItem>
              );
            })}
          </RMenu.RadioGroup>
          <p className="px-2.5 pb-1.5 pt-1 text-2xs text-ink-3">Cost shown per draft. 1 credit = 1¢.</p>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return (
    <fieldset className={cn("grid gap-2 sm:grid-cols-2", className)}>
      <legend className="sr-only">Model</legend>
      {models.map((m) => {
        const locked = m.paid && !canUseSol;
        const checked = value === m.id;
        return (
          <label
            key={m.id}
            className={cn(
              "relative flex cursor-pointer flex-col gap-2 rounded-[var(--radius-card)] border bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)]",
              checked ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong",
              locked && "cursor-not-allowed bg-surface-2",
            )}
          >
            <input type="radio" name={name} value={m.id} checked={checked} disabled={locked} onChange={() => onChange(m.id)} className="sr-only" />
            <span className="flex items-center gap-2">
              <span className={cn("grid size-7 place-items-center rounded-[var(--radius-control)]", checked ? "bg-ink text-white" : "bg-surface-2 text-ink-2")}>
                <ModelGlyph model={m.id} />
              </span>
              <span className="text-sm font-semibold text-ink">{m.name}</span>
              <span className="text-xs text-ink-3">{m.tier}</span>
              <span className="ml-auto">{checked ? <Check aria-hidden className="size-4" /> : null}</span>
            </span>
            <span className="text-xs text-ink-2">{m.blurb}</span>
            <span className="flex items-center justify-between gap-2">
              <CreditCost credits={m.credits} prefix="~" />
              {locked ? (
                <button type="button" onClick={onUpgrade} className="text-xs font-medium text-brand-800 underline underline-offset-2">
                  Upgrade to Pro
                </button>
              ) : (
                <span className="text-2xs text-ink-3">{m.paid ? "Pro plan" : "All plans"}</span>
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Automation toggle                                                   */
/* ------------------------------------------------------------------ */

export type AutomationMode = "approve" | "auto";

export interface AIAutomationToggleProps {
  label: string;
  description?: string;
  on: boolean;
  onOnChange: (v: boolean) => void;
  mode: AutomationMode;
  onModeChange: (m: AutomationMode) => void;
  /** Daily credit cap while running. */
  dailyCap?: number;
  nextRun?: string;
  className?: string;
}

export function AIAutomationToggle({ label, description, on, onOnChange, mode, onModeChange, dailyCap, nextRun, className }: AIAutomationToggleProps) {
  const name = useId();
  return (
    <AIPanel className={cn("flex flex-col gap-3 p-[var(--card-p)]", className)}>
      <Switch label={label} description={description} checked={on} onCheckedChange={onOnChange} />
      {on ? (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-xs font-medium text-ink-2">When a draft is ready</legend>
            {(
              [
                ["approve", "Ask me first", "Drafts wait in Approvals."],
                ["auto", "Run on its own", "Publishes and logs every action. Undo for 24h."],
              ] as const
            ).map(([v, t, d]) => (
              <label key={v} className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-control)] px-1 py-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)]">
                <input type="radio" name={name} checked={mode === v} onChange={() => onModeChange(v)} className="mt-0.5 size-4 accent-[var(--ink)]" />
                <span>
                  <span className="block text-ui font-medium text-ink">{t}</span>
                  <span className="block text-xs text-ink-3">{d}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
            {nextRun ? <span>Next run {nextRun}</span> : null}
            {dailyCap ? <span>Stops at {dailyCap} credits a day</span> : null}
          </p>
        </div>
      ) : (
        <p className="text-xs text-ink-3">Off. Nothing runs until you turn it on.</p>
      )}
    </AIPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Usage tracker                                                       */
/* ------------------------------------------------------------------ */

export interface AIUsageTrackerProps {
  used: number;
  total: number;
  resetsOn: string;
  /** Credits per day, oldest first. */
  daily: number[];
  byAgent: { name: string; credits: number }[];
  className?: string;
}

export function AIUsageTracker({ used, total, resetsOn, daily, byAgent, className }: AIUsageTrackerProps) {
  const left = Math.max(0, total - used);
  const pct = Math.min(100, Math.round((used / total) * 100));
  const max = Math.max(...daily, 1);
  const top = Math.max(...byAgent.map((a) => a.credits), 1);
  const warn = pct >= 80;
  return (
    <AIPanel className={cn("flex flex-col gap-4 p-[var(--card-p)]", className)} aria-label="AI usage">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-ink-3">Credits left</p>
          <p className="text-kpi font-semibold leading-10 tracking-[-0.02em] tabular-nums">{left.toLocaleString("en-US")}</p>
          <p className="text-xs text-ink-3">
            of {total.toLocaleString("en-US")} · resets {resetsOn}
          </p>
        </div>
        <div className="flex h-12 items-end gap-[3px]" role="img" aria-label={`Daily credits, last ${daily.length} days, peak ${max}`}>
          {daily.map((d, i) => (
            <span key={i} className={cn("w-1.5 rounded-t-[1px]", i === daily.length - 1 ? "bg-ink" : "bg-chart-1/60")} style={{ height: `${Math.max(6, Math.round((d / max) * 100))}%` }} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div role="meter" aria-label="Credits used" aria-valuemin={0} aria-valuemax={total} aria-valuenow={used} aria-valuetext={`${used} of ${total} used (${pct}%)`} className="h-2 overflow-hidden rounded-full bg-surface-3">
          <div className={cn("h-full rounded-full", warn ? "bg-amber-800" : "bg-ink")} style={{ width: `${pct}%` }} />
        </div>
        <p className={cn("text-xs tabular-nums", warn ? "font-medium text-amber-800" : "text-ink-3")}>
          {used.toLocaleString("en-US")} used ({pct}%){warn ? " · running low" : ""}
        </p>
      </div>
      <ul className="flex flex-col gap-2 border-t border-line pt-3">
        {byAgent.map((a) => (
          <li key={a.name} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 text-xs">
            <span className="truncate text-ink-2">{a.name}</span>
            <span className="h-1.5 rounded-full bg-surface-2">
              <span className="block h-full rounded-full bg-chart-1" style={{ width: `${Math.round((a.credits / top) * 100)}%` }} />
            </span>
            <span className="tabular-nums text-ink">{a.credits}</span>
          </li>
        ))}
      </ul>
    </AIPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Cost breakdown                                                      */
/* ------------------------------------------------------------------ */

export interface CostLine {
  step: string;
  model: ModelTier;
  credits: number;
}

const COST_COLORS = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-chart-6"];

export function AICostBreakdown({ title = "Run cost", lines, budget, className }: { title?: string; lines: CostLine[]; budget?: number; className?: string }) {
  const total = lines.reduce((s, l) => s + l.credits, 0);
  const luna = lines.filter((l) => l.model === "luna").reduce((s, l) => s + l.credits, 0);
  return (
    <AIPanel className={cn("flex flex-col gap-3 p-[var(--card-p)]", className)} aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="heading-card">{title}</h3>
        <span className="text-sm font-semibold tabular-nums">
          {total} credits <span className="font-normal text-ink-3">· ${(total / 100).toFixed(2)}</span>
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`Split across ${lines.length} steps`}>
        {lines.map((l, i) => (
          <span key={l.step} className={cn("h-full border-r border-surface last:border-r-0", COST_COLORS[i % COST_COLORS.length])} style={{ width: `${(l.credits / total) * 100}%` }} />
        ))}
      </div>
      <table className="w-full text-ui">
        <caption className="sr-only">{title} by step</caption>
        <thead>
          <tr className="text-left text-2xs uppercase tracking-[0.06em] text-ink-3">
            <th scope="col" className="pb-1 font-semibold">Step</th>
            <th scope="col" className="pb-1 font-semibold">Model</th>
            <th scope="col" className="pb-1 text-right font-semibold">Credits</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.step} className="h-[calc(var(--cell-h)-12px)] border-t border-line">
              <td className="pr-2">
                <span className="flex items-center gap-2">
                  <span aria-hidden className={cn("size-2 shrink-0 rounded-full", COST_COLORS[i % COST_COLORS.length])} />
                  {l.step}
                </span>
              </td>
              <td className="text-ink-2">{MODELS[l.model].name}</td>
              <td className="text-right tabular-nums">{l.credits}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-ink-3">
        Luna {luna} · Sol {total - luna}
        {budget ? ` · ${Math.round((total / budget) * 100)}% of the ${budget}-credit run cap` : ""}
      </p>
    </AIPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Memory controls                                                     */
/* ------------------------------------------------------------------ */

export interface MemoryItem {
  id: string;
  text: string;
  source: string;
}

export function AIMemoryControls({ initial, className }: { initial: MemoryItem[]; className?: string }) {
  const [items, setItems] = useState(initial);
  const [enabled, setEnabled] = useState(true);
  const [draft, setDraft] = useState("");
  const [last, setLast] = useState<{ item: MemoryItem; index: number } | null>(null);
  const forget = (id: string) => {
    const index = items.findIndex((m) => m.id === id);
    if (index < 0) return;
    setLast({ item: items[index], index });
    setItems(items.filter((m) => m.id !== id));
  };
  const undo = () => {
    if (!last) return;
    const next = [...items];
    next.splice(last.index, 0, last.item);
    setItems(next);
    setLast(null);
  };
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    setItems([...items, { id: `m${items.length}-${t.length}-${t.slice(0, 4)}`, text: t, source: "Added by you" }]);
    setDraft("");
  };
  return (
    <AIPanel className={cn("flex flex-col gap-3 p-[var(--card-p)]", className)} aria-label="Memory">
      <Switch label="Use memory" description="ClimbOS remembers facts about your business between runs." checked={enabled} onCheckedChange={setEnabled} />
      <ul className={cn("flex flex-col divide-y divide-line border-y border-line", !enabled && "opacity-55")} aria-label="Saved memories">
        {items.map((m) => (
          <li key={m.id} className="flex min-h-[var(--cell-h)] items-center gap-3 py-1.5">
            <span className="min-w-0 flex-1">
              <span className="block text-ui text-ink">{m.text}</span>
              <span className="block text-2xs text-ink-3">{m.source}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => forget(m.id)} disabled={!enabled} aria-label={`Forget: ${m.text}`}>
              <Trash2 aria-hidden />
              Forget
            </Button>
          </li>
        ))}
        {items.length === 0 ? <li className="py-3 text-ui text-ink-3">Nothing saved.</li> : null}
      </ul>
      <div aria-live="polite" className="min-h-0">
        {last ? (
          <p className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] bg-surface-2 px-2.5 py-1.5 text-xs text-ink-2">
            Forgot “{last.item.text}”.
            <button type="button" onClick={undo} className="inline-flex items-center gap-1 font-medium text-ink underline underline-offset-2">
              <RotateCcw aria-hidden className="size-3.5" />
              Undo
            </button>
          </p>
        ) : null}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input size="sm" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a fact, e.g. We close at 3pm on Sundays" aria-label="New memory" disabled={!enabled} />
        <Button size="sm" variant="secondary" type="submit" disabled={!enabled || !draft.trim()}>
          <Plus aria-hidden />
          Add
        </Button>
      </form>
    </AIPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Tool permissions                                                    */
/* ------------------------------------------------------------------ */

export type Permission = "allow" | "ask" | "deny";
export interface ToolRow {
  id: string;
  name: string;
  detail: string;
  risk?: "low" | "spend" | "public";
}

const PERM_OPTS: { v: Permission; label: string }[] = [
  { v: "allow", label: "Allow" },
  { v: "ask", label: "Ask" },
  { v: "deny", label: "Deny" },
];

/** Three-way radiogroup (Allow / Ask / Deny) with arrow-key support. */
export function PermissionSwitch({ value, onChange, label }: { value: Permission; onChange: (p: Permission) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + PERM_OPTS.length) % PERM_OPTS.length;
    onChange(PERM_OPTS[n].v);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5 rounded-[calc(var(--radius-control)+2px)] bg-surface-2 p-0.5">
      {PERM_OPTS.map((o, i) => {
        const on = value === o.v;
        return (
          <button
            key={o.v}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.v)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "h-7 rounded-[var(--radius-control)] px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:outline-none",
              on ? (o.v === "deny" ? "bg-red-800 text-white" : o.v === "ask" ? "bg-surface text-ink shadow-[var(--btn-2-shadow)] ring-1 ring-ink" : "bg-ink text-white") : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function AIToolPermissions({ tools, initial, className }: { tools: ToolRow[]; initial: Record<string, Permission>; className?: string }) {
  const [perms, setPerms] = useState(initial);
  return (
    <AIPanel className={cn("overflow-hidden", className)} aria-label="Tool permissions">
      <ul className="divide-y divide-line">
        {tools.map((t) => (
          <li key={t.id} className="flex min-h-[var(--cell-h)] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-[var(--card-p)] py-2">
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-ui font-medium text-ink">
                {t.name}
                {t.risk === "spend" ? <Badge tone="amber">Spends money</Badge> : t.risk === "public" ? <Badge tone="blue">Public</Badge> : null}
              </span>
              <span className="block text-xs text-ink-3">{t.detail}</span>
            </span>
            <PermissionSwitch label={`${t.name} permission`} value={perms[t.id] ?? "ask"} onChange={(p) => setPerms({ ...perms, [t.id]: p })} />
          </li>
        ))}
      </ul>
    </AIPanel>
  );
}
