"use client";

/*
 * Plans: PLANS data, CurrentPlanCard, PlanComparisonTable, UpgradeButton,
 * SubscriptionStatus, BillingCycleSelector, TrialCountdown and RenewalDate.
 * Credits pricing: Free 50 credits once, Starter $15 = 1,100/mo, Pro $40 = 3,000/mo (unlimited people and workspaces).
 */
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Check, CircleAlert, CircleCheck, Clock, CirclePause, Minus, Sparkles, X } from "@/components/icons";
import { Badge, Button, ConfirmDialog, Segmented, Switch, type Tone } from "@/components/ui";
import { cn, formatNumber, formatUsd } from "@/lib/utils";

export type PlanId = "free" | "starter" | "pro";
export type Cycle = "monthly" | "yearly";

export interface Plan {
  id: PlanId;
  name: string;
  monthly: number;
  credits: number;
  /** Free credits are a one-off grant, not monthly. */
  oneOff?: boolean;
  blurb: string;
}

export const PLANS: Plan[] = [
  { id: "free", name: "Free", monthly: 0, credits: 50, oneOff: true, blurb: "Try a growth plan and a few posts." },
  { id: "starter", name: "Starter", monthly: 15, credits: 1100, blurb: "One business posting every week." },
  { id: "pro", name: "Pro", monthly: 40, credits: 3000, blurb: "Autopilot, outbound and Expert drafts." },
];

/** Yearly billing = 10 months (2 free). Returns the per-month price shown. */
export const priceFor = (p: Plan, c: Cycle) => (c === "yearly" ? Math.round(((p.monthly * 10) / 12) * 100) / 100 : p.monthly);
export const planOf = (id: PlanId) => PLANS.find((p) => p.id === id) ?? PLANS[0];

function Price({ plan, cycle }: { plan: Plan; cycle: Cycle }) {
  const v = priceFor(plan, cycle);
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-3xl font-semibold leading-8 tracking-[-0.02em] tabular-nums">{formatUsd(v, { cents: v % 1 !== 0 })}</span>
      <span className="text-ui text-ink-3">{plan.monthly ? "/ month" : "forever"}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */

export interface CurrentPlanCardProps {
  plan: PlanId;
  cycle: Cycle;
  renews: string;
  creditsLeft: number;
  onChangePlan?: () => void;
  onManage?: () => void;
}

/** Your plan at a glance: price, credits, renewal and the two next actions. */
export function CurrentPlanCard({ plan, cycle, renews, creditsLeft, onChangePlan, onManage }: CurrentPlanCardProps) {
  const p = planOf(plan);
  const pct = Math.round((creditsLeft / p.credits) * 100);
  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-overline">Current plan</p>
          <h3 className="heading-section">{p.name}</h3>
          <p className="text-xs text-ink-3">{p.blurb}</p>
        </div>
        <SubscriptionStatus status="active" compact />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Price plan={p} cycle={cycle} />
          <p className="text-xs text-ink-3">{cycle === "yearly" ? `Billed ${formatUsd(p.monthly * 10)} yearly` : "Billed monthly"} · renews {renews}</p>
        </div>
        <div className="min-w-48 flex-1 sm:max-w-64">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-ink-2">Credits left</span>
            <span className="tabular-nums text-ink">
              {formatNumber(creditsLeft)} / {formatNumber(p.credits)}
            </span>
          </div>
          <div role="meter" aria-label="Plan credits left" aria-valuemin={0} aria-valuemax={p.credits} aria-valuenow={creditsLeft} className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button size="sm" onClick={onChangePlan}>
          Change plan
        </Button>
        <Button size="sm" variant="secondary" onClick={onManage}>
          Manage billing
        </Button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

type Cell = boolean | string;
const FEATURES: { label: string; values: Record<PlanId, Cell> }[] = [
  { label: "Credits", values: { free: "50 once", starter: "1,100 / mo", pro: "3,000 / mo" } },
  { label: "Workspaces", values: { free: "1", starter: "3", pro: "Unlimited" } },
  { label: "Team seats", values: { free: "1", starter: "3", pro: "Unlimited" } },
  { label: "Growth plan and posts", values: { free: true, starter: true, pro: true } },
  { label: "Weekly autopilot", values: { free: false, starter: true, pro: true } },
  { label: "Lead finder and cold email", values: { free: false, starter: false, pro: true } },
  { label: "Expert drafts (plans, ads, insights)", values: { free: false, starter: false, pro: true } },
  { label: "Agency client workspaces", values: { free: false, starter: false, pro: true } },
  { label: "Support", values: { free: "Help centre", starter: "Email", pro: "Priority" } },
];

export interface PlanComparisonTableProps {
  current: PlanId;
  cycle: Cycle;
  onSelect: (p: PlanId) => void;
  /** Plan to highlight as recommended. */
  recommended?: PlanId;
}

/** Plans side by side. Current plan is marked; the recommended one leads with the lime CTA. */
export function PlanComparisonTable({ current, cycle, onSelect, recommended = "pro" }: PlanComparisonTableProps) {
  const rank = (id: PlanId) => PLANS.findIndex((p) => p.id === id);
  return (
    <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-ui">
        <caption className="sr-only">Compare plans</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[34%] p-4 text-left align-bottom font-normal text-ink-3">
              Prices in USD. Credits reset each billing month.
            </th>
            {PLANS.map((p) => (
              <th key={p.id} scope="col" className={cn("p-4 text-left align-top font-normal", p.id === recommended && "bg-sun-soft/60")}>
                <span className="flex items-center gap-1.5">
                  <span className="heading-card">{p.name}</span>
                  {p.id === recommended ? <Badge tone="green">Popular</Badge> : null}
                </span>
                <Price plan={p} cycle={cycle} />
                <span className="mb-3 block text-xs text-ink-3">{p.blurb}</span>
                {p.id === current ? (
                  <Button size="sm" variant="secondary" disabled className="w-full">
                    Current plan
                  </Button>
                ) : rank(p.id) > rank(current) ? (
                  p.id === recommended ? (
                    <UpgradeButton to={p.name} onClick={() => onSelect(p.id)} className="w-full" />
                  ) : (
                    <Button size="sm" className="w-full" onClick={() => onSelect(p.id)}>
                      Choose {p.name}
                    </Button>
                  )
                ) : (
                  <Button size="sm" variant="ghost" className="w-full" onClick={() => onSelect(p.id)}>
                    Downgrade
                  </Button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURES.map((f) => (
            <tr key={f.label} className="border-t border-line">
              <th scope="row" className="h-[var(--cell-h)] px-4 text-left font-normal text-ink-2">
                {f.label}
              </th>
              {PLANS.map((p) => {
                const v = f.values[p.id];
                return (
                  <td key={p.id} className={cn("px-4 text-ink", p.id === recommended && "bg-sun-soft/60")}>
                    {v === true ? (
                      <>
                        <Check aria-hidden className="size-4 text-green-800" />
                        <span className="sr-only">Included</span>
                      </>
                    ) : v === false ? (
                      <>
                        <Minus aria-hidden className="size-4 text-ink-3" />
                        <span className="sr-only">Not included</span>
                      </>
                    ) : (
                      <span className="tabular-nums">{v}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** The lime CTA. Use once per screen. `size="pill"` is the compact nav version. */
export function UpgradeButton({ to = "Pro", onClick, size = "md", className, loading }: { to?: string; onClick?: () => void; size?: "md" | "pill"; className?: string; loading?: boolean }) {
  return (
    <Button
      variant="accent"
      onClick={onClick}
      loading={loading}
      loadingText="Upgrading…"
      className={cn(
        size === "pill" ? "h-7 rounded-[var(--radius-badge)] px-2.5 text-xs" : "rounded-[var(--radius-cta)]",
        className,
      )}
    >
      <Sparkles /> Upgrade{size === "pill" ? "" : ` to ${to}`}
      {size === "pill" ? null : <ArrowRight />}
    </Button>
  );
}

/** Upgrade with the prorated charge stated before confirming. */
export function UpgradeWithConfirm({ from, to, daysLeft, onDone }: { from: PlanId; to: PlanId; daysLeft: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const a = planOf(from);
  const b = planOf(to);
  const due = Math.round(((b.monthly - a.monthly) * daysLeft) / 30 * 100) / 100;
  return (
    <>
      <UpgradeButton to={b.name} onClick={() => setOpen(true)} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Upgrade to ${b.name}?`}
        description={`${formatUsd(due, { cents: true })} today for the ${daysLeft} days left, then ${formatUsd(b.monthly)}/month. You get ${formatNumber(b.credits - a.credits)} more credits now. Visa ending 4242.`}
        confirmLabel={`Pay ${formatUsd(due, { cents: true })} and upgrade`}
        onConfirm={() => new Promise<void>((r) => window.setTimeout(r, 900)).then(onDone)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

export type SubStatus = "active" | "trialing" | "past_due" | "paused" | "canceled";

const SUB: Record<SubStatus, { label: string; tone: Tone; Icon: typeof Check; line: string; action?: string }> = {
  active: { label: "Active", tone: "green", Icon: CircleCheck, line: "Paid through 1 Nov." },
  trialing: { label: "Trial", tone: "blue", Icon: Clock, line: "Pro trial ends 28 Oct. No card charged yet.", action: "Add payment method" },
  past_due: { label: "Payment failed", tone: "red", Icon: CircleAlert, line: "We couldn’t charge Visa ending 4242. Autopilot pauses on 22 Oct.", action: "Update card" },
  paused: { label: "Paused", tone: "amber", Icon: CirclePause, line: "Paused until 15 Nov. Nothing runs, nothing is charged.", action: "Resume now" },
  canceled: { label: "Cancels 1 Nov", tone: "neutral", Icon: X, line: "You keep Pro and your credits until then.", action: "Keep my plan" },
};

/** Subscription state: badge + one line of consequence + the fix. */
export function SubscriptionStatus({ status, compact, onAction }: { status: SubStatus; compact?: boolean; onAction?: () => void }) {
  const s = SUB[status];
  const badge = (
    <Badge tone={s.tone} icon={<s.Icon />}>
      {s.label}
    </Badge>
  );
  if (compact) return badge;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3">
      {badge}
      <span className="min-w-0 flex-1 basis-56 text-ui text-ink-2">{s.line}</span>
      {s.action ? (
        <Button size="sm" variant={status === "past_due" ? "primary" : "secondary"} onClick={onAction}>
          {s.action}
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Monthly / yearly. Yearly states the saving in words. */
export function BillingCycleSelector({ value, onChange }: { value: Cycle; onChange: (c: Cycle) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented
        label="Billing cycle"
        value={value}
        onChange={onChange}
        options={[
          { value: "monthly", label: "Monthly" },
          { value: "yearly", label: "Yearly" },
        ]}
      />
      <span className={cn("inline-flex h-6 items-center rounded-[var(--radius-badge)] px-2 text-xs font-medium", value === "yearly" ? "bg-lime text-ink" : "bg-surface-2 text-ink-2")}>2 months free on yearly</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");

/** Trial days left with a live clock in the final day, and the next step. */
export function TrialCountdown({ totalDays = 14, secondsLeft: start, onUpgrade }: { totalDays?: number; secondsLeft: number; onUpgrade?: () => void }) {
  const [left, setLeft] = useState(start);
  useEffect(() => {
    const t = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, []);
  const days = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const used = Math.min(1, 1 - left / (totalDays * 86400));
  const urgent = days < 3;
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-ui font-medium text-ink">Pro trial</p>
        <p className={cn("text-ui tabular-nums", urgent ? "font-semibold text-red-800" : "text-ink-2")} aria-live="off">
          {days > 0 ? `${days} ${days === 1 ? "day" : "days"} ` : ""}
          {pad(h)}:{pad(m)}:{pad(s)} left
        </p>
      </div>
      <div role="progressbar" aria-label="Trial used" aria-valuemin={0} aria-valuemax={totalDays} aria-valuenow={Math.round(used * totalDays)} className="flex h-2 gap-0.5">
        {Array.from({ length: totalDays }, (_, i) => (
          <span key={i} className={cn("flex-1 rounded-[1px]", i < Math.round(used * totalDays) ? (urgent ? "bg-red-500" : "bg-ink") : "bg-surface-3")} />
        ))}
      </div>
      <p className="text-xs text-ink-3">After the trial you move to Free (50 credits) unless you pick a plan. Nothing is charged automatically.</p>
      {onUpgrade ? (
        <Button size="sm" className="self-start" onClick={onUpgrade}>
          Pick a plan
        </Button>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */

/** Next renewal with auto-renew. Turning it off changes the line to "Ends on". */
export function RenewalDate({ date, amount }: { date: string; amount: number }) {
  const [auto, setAuto] = useState(true);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3">
      <span className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-surface-2 text-ink-2">
        <CalendarDays aria-hidden className="size-4" />
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-ui font-medium text-ink">{auto ? `Renews on ${date}` : `Ends on ${date}`}</p>
        <p className="text-xs text-ink-3">{auto ? `${formatUsd(amount)} to Visa ending 4242` : "You won’t be charged again. Credits stay until then."}</p>
      </div>
      <Switch label="Auto-renew" checked={auto} onCheckedChange={setAuto} />
    </div>
  );
}
