"use client";

/*
 * Credits and usage: UsageMeter (credits by feature this period, with pace),
 * CreditBalance, QuotaBar / WorkspaceCaps (per-workspace caps on the shared
 * account balance), OverageIndicator, AddOnSelector (top-up packs + auto
 * top-up) and SeatManagement.
 */
import { useState } from "react";
import { CircleAlert, Coins, Minus, Pencil, Plus, TriangleAlert, Zap } from "@/components/icons";
import { Badge, Button, Popover, PopoverContent, PopoverTrigger, Select, Switch } from "@/components/ui";
import { cn, formatNumber, formatUsd, plural } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Usage meter                                                         */
/* ------------------------------------------------------------------ */

export interface UsageSlice {
  label: string;
  credits: number;
}

const SLICE_BG = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

export interface UsageMeterProps {
  slices: UsageSlice[];
  /** Plan credits for the period. */
  limit: number;
  day: number;
  days: number;
}

/** Credits used this period by feature, with a "today" marker and the projected total. */
export function UsageMeter({ slices, limit, day, days }: UsageMeterProps) {
  const used = slices.reduce((a, s) => a + s.credits, 0);
  const projected = Math.round((used / day) * days);
  const over = projected > limit;
  const text = `${formatNumber(used)} of ${formatNumber(limit)} credits used`;
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="heading-card">Usage this period</h3>
        <p className="text-ui tabular-nums text-ink-2">{text}</p>
      </div>
      <div className="relative">
        <div role="meter" aria-label="Credits used" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} aria-valuetext={text} className="flex h-3 gap-px overflow-hidden rounded-[3px] bg-surface-3">
          {slices.map((s, i) => (
            <span key={s.label} className={cn("h-full", SLICE_BG[i % SLICE_BG.length])} style={{ width: `${(s.credits / limit) * 100}%` }} />
          ))}
        </div>
        <span aria-hidden className="absolute -top-1 h-5 w-0.5 rounded-full bg-ink" style={{ left: `${(day / days) * 100}%` }} />
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 rounded-[2px]", SLICE_BG[i % SLICE_BG.length])} />
            {s.label} <span className="tabular-nums text-ink-3">{formatNumber(s.credits)}</span>
          </li>
        ))}
      </ul>
      <p className={cn("flex items-center gap-1.5 text-ui", over ? "font-medium text-amber-800" : "text-ink-3")}>
        {over ? <TriangleAlert aria-hidden className="size-4" /> : null}
        Day {day} of {days}. On pace for {formatNumber(projected)} credits{over ? `, ${formatNumber(projected - limit)} over your plan.` : "."}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Credit balance                                                      */
/* ------------------------------------------------------------------ */

export interface CreditBalanceProps {
  plan: number;
  topUp: number;
  resetsOn: string;
  onTopUp?: () => void;
}

/** Shared account balance: plan credits (reset monthly) + top-up credits (never expire). */
export function CreditBalance({ plan, topUp, resetsOn, onTopUp }: CreditBalanceProps) {
  const total = plan + topUp;
  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-ui text-ink-2">
            <Coins aria-hidden className="size-4" /> Credits available
          </p>
          <p className="text-4xl font-semibold leading-[48px] tracking-[-0.02em] tabular-nums">{formatNumber(total)}</p>
          <p className="text-xs text-ink-3">Shared by every workspace on this account</p>
        </div>
        <Button size="sm" onClick={onTopUp}>
          <Plus /> Top up
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3">
        <div>
          <dt className="text-xs text-ink-3">Plan credits</dt>
          <dd className="text-sm font-semibold tabular-nums">{formatNumber(plan)}</dd>
          <dd className="text-xs text-ink-3">Reset {resetsOn}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Top-up credits</dt>
          <dd className="text-sm font-semibold tabular-nums">{formatNumber(topUp)}</dd>
          <dd className="text-xs text-ink-3">Never expire, used last</dd>
        </div>
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Quota bar + workspace caps                                          */
/* ------------------------------------------------------------------ */

export interface QuotaBarProps {
  label: string;
  used: number;
  cap: number;
  unit?: string;
  onCapChange?: (cap: number) => void;
}

/** Compact progress against a cap. Amber from 80%, red at the cap; the state is also written out. */
export function QuotaBar({ label, used, cap, unit = "credits", onCapChange }: QuotaBarProps) {
  const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const level = pct >= 100 ? "full" : pct >= 80 ? "near" : "ok";
  const [draft, setDraft] = useState(String(cap));
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-ui">
        <span className="font-medium text-ink">{label}</span>
        <span className="flex items-center gap-2 tabular-nums text-ink-2">
          {formatNumber(used)} / {formatNumber(cap)} {unit}
          {level === "full" ? <Badge tone="red">At cap</Badge> : level === "near" ? <Badge tone="amber">{pct}%</Badge> : null}
          {onCapChange ? (
            <Popover
              open={open}
              onOpenChange={(o) => {
                setOpen(o);
                if (o) setDraft(String(cap));
              }}
            >
              <PopoverTrigger aria-label={`Edit cap for ${label}`} className="grid size-7 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]">
                <Pencil aria-hidden className="size-3.5" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-60">
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = Math.max(0, Math.round(Number(draft)));
                    if (Number.isFinite(n)) onCapChange(n);
                    setOpen(false);
                  }}
                >
                  <label htmlFor={`cap-${label}`} className="text-ui font-medium">
                    Monthly cap for {label}
                  </label>
                  <input id={`cap-${label}`} type="number" min={0} step={50} value={draft} onChange={(e) => setDraft(e.target.value)} className="h-[var(--h-sm)] rounded-[var(--radius-field)] border border-control px-2.5 text-ui tabular-nums" />
                  <Button size="sm" type="submit">
                    Save cap
                  </Button>
                </form>
              </PopoverContent>
            </Popover>
          ) : null}
        </span>
      </div>
      <div role="progressbar" aria-label={`${label} credits`} aria-valuemin={0} aria-valuemax={cap} aria-valuenow={Math.min(used, cap)} className="h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className={cn("h-full rounded-full transition-[width]", level === "full" ? "bg-red-800" : level === "near" ? "bg-amber-500" : "bg-ink")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overage                                                             */
/* ------------------------------------------------------------------ */

export interface OverageIndicatorProps {
  /** near: ≥80% used; over: past the cap and paused; topup: drawing on top-up credits. */
  kind: "near" | "over" | "topup";
  scope: string;
  amount: number;
  onTopUp?: () => void;
  onRaise?: () => void;
}

/** What happens when credits run past a limit, in words, with the two fixes. */
export function OverageIndicator({ kind, scope, amount, onTopUp, onRaise }: OverageIndicatorProps) {
  const cfg = {
    near: { Icon: TriangleAlert, cls: "border-amber-500/40 bg-amber-100/50", ink: "text-amber-800", title: `${scope} is at ${amount}% of its cap`, body: "Autopilot keeps running until the cap, then pauses." },
    over: { Icon: CircleAlert, cls: "border-red-500/30 bg-red-100/50", ink: "text-red-800", title: `${scope} paused at its cap`, body: `${formatNumber(amount)} credits of queued work is waiting. Nothing more is spent until you act.` },
    topup: { Icon: Zap, cls: "border-line bg-surface-2", ink: "text-ink", title: "Using top-up credits", body: `Plan credits are used up. ${formatNumber(amount)} top-up credits left.` },
  }[kind];
  return (
    <div role={kind === "over" ? "alert" : "status"} className={cn("flex flex-wrap items-start gap-3 rounded-[var(--radius-card)] border px-4 py-3", cfg.cls)}>
      <cfg.Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", cfg.ink)} />
      <div className="min-w-0 flex-1 basis-56">
        <p className={cn("text-ui font-semibold", cfg.ink)}>{cfg.title}</p>
        <p className="text-ui text-ink-2">{cfg.body}</p>
      </div>
      <div className="flex gap-2">
        {onRaise && kind !== "topup" ? (
          <Button size="sm" variant="secondary" onClick={onRaise}>
            Raise cap
          </Button>
        ) : null}
        {onTopUp ? (
          <Button size="sm" onClick={onTopUp}>
            Top up
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add-ons: top-up packs                                               */
/* ------------------------------------------------------------------ */

export const TOP_UPS = [
  { id: "t10", price: 10, credits: 700 },
  { id: "t25", price: 25, credits: 1800, tag: "Popular" },
  { id: "t50", price: 50, credits: 4000, tag: "Best value" },
];

/** Pick a top-up pack (radio group), optionally turn on auto top-up, then buy. */
export function AddOnSelector({ onBuy }: { onBuy: (pack: (typeof TOP_UPS)[number], auto: boolean) => void }) {
  const [pick, setPick] = useState("t25");
  const [auto, setAuto] = useState(false);
  const [below, setBelow] = useState("200");
  const pack = TOP_UPS.find((t) => t.id === pick) ?? TOP_UPS[1];
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Top-up pack" className="grid gap-2 sm:grid-cols-3">
        {TOP_UPS.map((t) => {
          const on = t.id === pick;
          const per = (t.price / t.credits) * 100;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPick(t.id)}
              onKeyDown={(e) => {
                const i = TOP_UPS.findIndex((x) => x.id === pick);
                const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
                if (!d) return;
                e.preventDefault();
                const n = TOP_UPS[(i + d + TOP_UPS.length) % TOP_UPS.length];
                setPick(n.id);
                (e.currentTarget.parentElement?.querySelector(`[data-id="${n.id}"]`) as HTMLElement | null)?.focus();
              }}
              tabIndex={on ? 0 : -1}
              data-id={t.id}
              className={cn(
                "flex flex-col gap-1 rounded-[var(--radius-card)] border bg-surface p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]",
                on ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-lg font-semibold tabular-nums">{formatNumber(t.credits)}</span>
                {t.tag ? <Badge tone={t.tag === "Best value" ? "green" : "neutral"}>{t.tag}</Badge> : null}
              </span>
              <span className="text-ui text-ink-2">credits for {formatUsd(t.price)}</span>
              <span className="text-xs text-ink-3">{per.toFixed(2)}¢ per credit</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-2">
        <Switch label="Auto top-up" description="Buy this pack when credits run low, so autopilot never stops." checked={auto} onCheckedChange={setAuto} className="min-w-0 flex-1" />
        {auto ? (
          <span className="flex items-center gap-2 text-ui text-ink-2">
            when below
            <Select aria-label="Auto top-up threshold" value={below} onValueChange={setBelow} className="h-[var(--h-sm)] w-28" options={["100", "200", "500"].map((v) => ({ value: v, label: `${v} credits` }))} />
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ui text-ink-2">
          {formatUsd(pack.price)} today · +{formatNumber(pack.credits)} credits · Visa ending 4242
        </p>
        <Button onClick={() => onBuy(pack, auto)}>Buy {formatNumber(pack.credits)} credits</Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Seats                                                               */
/* ------------------------------------------------------------------ */

export interface SeatManagementProps {
  included: number;
  used: number;
  /** Price per extra seat per month. */
  seatPrice: number;
  max?: number;
}

/** Seats on the plan: who uses them, a stepper for extra seats and the price change before saving. */
export function SeatManagement({ included, used, seatPrice, max = 25 }: SeatManagementProps) {
  const [extra, setExtra] = useState(0);
  const [saved, setSaved] = useState(0);
  const total = included + extra;
  const delta = (extra - saved) * seatPrice;
  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="heading-card">Seats</h3>
        <p className="text-ui tabular-nums text-ink-2">
          {used} of {total} used
        </p>
      </div>
      <div aria-hidden className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("h-2 flex-1 rounded-[2px]", i < used ? "bg-ink" : i < included ? "bg-surface-3" : "bg-brand-200")} />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-ui font-medium text-ink">Extra seats</p>
          <p className="text-xs text-ink-3">
            {plural(included, "seat")} included · {formatUsd(seatPrice)} per extra seat / month
          </p>
        </div>
        <div role="group" aria-label="Extra seats" className="flex items-center rounded-[var(--radius-control)] border border-control">
          <button type="button" aria-label="Remove a seat" disabled={extra === 0 || total - 1 < used} onClick={() => setExtra(extra - 1)} className="grid h-[var(--h-md)] w-9 place-items-center text-ink-2 hover:bg-surface-2 disabled:opacity-40">
            <Minus aria-hidden className="size-4" />
          </button>
          <output aria-live="polite" className="w-10 text-center text-ui font-semibold tabular-nums">
            {extra}
          </output>
          <button type="button" aria-label="Add a seat" disabled={total >= max} onClick={() => setExtra(extra + 1)} className="grid h-[var(--h-md)] w-9 place-items-center text-ink-2 hover:bg-surface-2 disabled:opacity-40">
            <Plus aria-hidden className="size-4" />
          </button>
        </div>
      </div>
      {total - 1 < used && extra > 0 ? <p className="text-xs text-ink-3">Remove a member before dropping more seats.</p> : null}
      {delta !== 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <p className="text-ui text-ink-2">
            {delta > 0 ? `+${formatUsd(delta)}` : `−${formatUsd(-delta)}`} / month from next invoice
          </p>
          <span className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setExtra(saved)}>
              Reset
            </Button>
            <Button size="sm" onClick={() => setSaved(extra)}>
              Save seats
            </Button>
          </span>
        </div>
      ) : null}
    </section>
  );
}
