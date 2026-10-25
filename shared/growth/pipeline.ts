/**
 * The owner's own pipeline outcomes for planning: closed deals, win rate, and recorded loss reasons.
 * Owner-entered CRM stages are first-party reports, not verified sales records, and never causal evidence.
 */

export const LOSS_REASONS = ["price", "timing", "no_need", "chose_competitor", "no_response", "not_a_fit", "other"] as const;
export type LossReason = (typeof LOSS_REASONS)[number];

export const LOSS_REASON_LABEL: Record<LossReason, string> = {
  price: "Price or budget",
  timing: "Timing",
  no_need: "No real need",
  chose_competitor: "Chose another option",
  no_response: "Stopped responding",
  not_a_fit: "Not a fit",
  other: "Other",
};

export interface PipelineDeal {
  stage: "lead" | "talking" | "booked" | "won" | "lost";
  source: string;
  createdAt: number;
  updatedAt: number;
  wonAt?: number;
  lostAt?: number;
  lostReason?: LossReason;
  lostReasonNote?: string;
}

export interface PipelineOutcomes {
  windowDays: number;
  won: number;
  lost: number;
  /** won / (won + lost); null with no closed deals. */
  winRate: number | null;
  lossReasons: { reason: LossReason; count: number }[];
  lossReasonNotRecorded: number;
  /** Lost deals with no recorded close time (older records); counted by last update. */
  lostWithoutCloseTime: number;
  open: { lead: number; talking: number; booked: number };
  bySource: { source: string; won: number; lost: number }[];
  /** Up to five recent owner notes on lost deals (untrusted text). */
  recentLossNotes: string[];
}

const DAY = 86_400_000;

export function pipelineOutcomes(deals: readonly PipelineDeal[], options: { nowMs: number; windowDays?: number }): PipelineOutcomes {
  const windowDays = options.windowDays ?? 365;
  const from = options.nowMs - windowDays * DAY;
  const closedAt = (d: PipelineDeal) => (d.stage === "won" ? d.wonAt ?? d.updatedAt : d.lostAt ?? d.updatedAt);
  const closed = deals.filter((d) => (d.stage === "won" || d.stage === "lost") && closedAt(d) >= from);
  const won = closed.filter((d) => d.stage === "won");
  const lost = closed.filter((d) => d.stage === "lost");
  const counts = new Map<LossReason, number>();
  for (const d of lost) if (d.lostReason) counts.set(d.lostReason, (counts.get(d.lostReason) ?? 0) + 1);
  const sources = new Map<string, { won: number; lost: number }>();
  for (const d of closed) {
    const row = sources.get(d.source) ?? { won: 0, lost: 0 };
    if (d.stage === "won") row.won++;
    else row.lost++;
    sources.set(d.source, row);
  }
  const open = { lead: 0, talking: 0, booked: 0 };
  for (const d of deals) if (d.stage === "lead" || d.stage === "talking" || d.stage === "booked") open[d.stage]++;
  return {
    windowDays,
    won: won.length,
    lost: lost.length,
    winRate: closed.length ? won.length / closed.length : null,
    lossReasons: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count })),
    lossReasonNotRecorded: lost.filter((d) => !d.lostReason).length,
    lostWithoutCloseTime: lost.filter((d) => d.lostAt === undefined).length,
    open,
    bySource: [...sources.entries()].map(([source, row]) => ({ source, ...row })),
    recentLossNotes: lost.filter((d) => d.lostReasonNote?.trim()).sort((a, b) => closedAt(b) - closedAt(a)).slice(0, 5).map((d) => d.lostReasonNote!.trim().slice(0, 240)),
  };
}

/** Planning context; empty when the owner has no pipeline. Loss notes are returned separately so callers can mark them untrusted. */
export function pipelineOutcomesBrief(p: PipelineOutcomes): string {
  if (!p.won && !p.lost && !p.open.lead && !p.open.talking && !p.open.booked) return "";
  const closed = p.won + p.lost;
  const rate = p.winRate === null ? "no closed deals yet" : `win rate ${(p.winRate * 100).toFixed(0)}% (${p.won} won of ${closed} closed${closed < 20 ? "; small sample" : ""})`;
  const reasons = p.lost ? `loss reasons: ${[...p.lossReasons.map((r) => `${LOSS_REASON_LABEL[r.reason].toLowerCase()} ${r.count}`), p.lossReasonNotRecorded ? `not recorded ${p.lossReasonNotRecorded}` : ""].filter(Boolean).join(", ")}` : "";
  const sources = p.bySource.length ? `by source: ${p.bySource.map((s) => `${s.source} ${s.won} won / ${s.lost} lost`).join("; ")}` : "";
  return [
    `OWNER PIPELINE OUTCOMES (owner-entered CRM stages, last ${p.windowDays} days by close date${p.lostWithoutCloseTime ? `; ${p.lostWithoutCloseTime} older lost deals dated by last update` : ""}): ${[rate, reasons, sources, `open now: ${p.open.lead} lead, ${p.open.talking} talking, ${p.open.booked} booked`].filter(Boolean).join("; ")}.`,
    "Use recorded loss reasons as owner-reported evidence about offer, price, fit or follow-up problems; an unrecorded reason is unknown, not any particular reason. These records are not verified sales data and do not show what caused a win or loss.",
  ].join(" ");
}

/** Review prompts, not judgments: open deals with no stage change for this many days are surfaced to the owner. */
export const STALLED_AFTER_DAYS = { lead: 21, talking: 14, booked: 14 } as const;

export interface DealAttention {
  /** The next step's date has fully passed. */
  overdue: boolean;
  /** Days since the last stage change when it passed the review threshold; null when not stalled or unknown. */
  stalledDays: number | null;
  /** Older deals have no stage-change time, so their stage age is unknown (never assumed stalled). */
  stageAgeKnown: boolean;
}

export function dealAttention(d: { stage: PipelineDeal["stage"]; nextStepAt?: number | null; stageChangedAt?: number | null }, nowMs: number): DealAttention {
  if (d.stage === "won" || d.stage === "lost") return { overdue: false, stalledDays: null, stageAgeKnown: true };
  const overdue = typeof d.nextStepAt === "number" && d.nextStepAt + DAY < nowMs;
  if (typeof d.stageChangedAt !== "number") return { overdue, stalledDays: null, stageAgeKnown: false };
  const days = Math.floor((nowMs - d.stageChangedAt) / DAY);
  return { overdue, stalledDays: days >= STALLED_AFTER_DAYS[d.stage] ? days : null, stageAgeKnown: true };
}

export function pipelineAttention(deals: readonly { stage: PipelineDeal["stage"]; nextStepAt?: number | null; stageChangedAt?: number | null }[], nowMs: number): { overdue: number; stalled: number; stageAgeUnknown: number } {
  const rows = deals.map((d) => dealAttention(d, nowMs));
  const open = deals.map((d, i) => ({ d, a: rows[i] })).filter(({ d }) => d.stage !== "won" && d.stage !== "lost");
  return { overdue: open.filter(({ a }) => a.overdue).length, stalled: open.filter(({ a }) => a.stalledDays !== null).length, stageAgeUnknown: open.filter(({ a }) => !a.stageAgeKnown).length };
}
