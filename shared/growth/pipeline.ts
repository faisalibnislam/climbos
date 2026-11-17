import { fractionDigits, majorToMinor, minorToMajor } from "../economics/currency";

/**
 * The owner's own pipeline outcomes for planning: closed deals, win rate, and recorded loss reasons.
 * Owner-entered CRM stages are first-party reports, not verified sales records, and never causal evidence.
 */

export const LOSS_REASONS = ["price", "timing", "no_need", "chose_competitor", "no_response", "not_a_fit", "other"] as const;
export type LossReason = (typeof LOSS_REASONS)[number];

/** New explicit lists supersede legacy single-reason records; overlap is not additional customers. */
export function dealLossReasons(d: { lostReasons?: readonly LossReason[]; lostReason?: LossReason | null }): LossReason[] {
  const values = d.lostReasons ?? (d.lostReason ? [d.lostReason] : []);
  return LOSS_REASONS.filter(reason => values.includes(reason));
}

export const DEAL_VALUE_VERSION = "currency-minor-v1" as const;
type DealMoney = { valueMinor?: number; currency: string; valueVersion?: string };

/** Legacy writers assumed hundredths. Non-two-decimal amounts need owner review. */
export function dealValueNeedsReview(d: DealMoney): boolean {
  return d.valueMinor !== undefined && (!/^[A-Z]{3}$/.test(d.currency) || !Number.isSafeInteger(d.valueMinor) || d.valueMinor < 0 || (fractionDigits(d.currency) !== 2 && d.valueVersion !== DEAL_VALUE_VERSION));
}

export function dealValueMinor(value: number, currency: string): number {
  if (!Number.isFinite(value) || value < 0 || !/^[A-Z]{3}$/.test(currency)) throw new RangeError("Enter the value as a number greater than or equal to zero in the displayed currency.");
  const digits = fractionDigits(currency);
  const minor = majorToMinor(value, currency);
  if (!Number.isSafeInteger(minor)) throw new RangeError("This value is too large to record accurately.");
  if (Number(value.toFixed(digits)) !== value) throw new RangeError(`Use at most ${digits} decimal places for ${currency}; the value was not rounded.`);
  return minor;
}

export interface DealValueSummary {
  totalMinor: number | null;
  partial: boolean;
  byCurrency: { currency: string; recordedMinor: number | null; known: number; missing: number; needsReview: number }[];
}

/** Recorded subtotals only. No FX conversion, probabilities, or inferred missing values. */
export function summarizeDealValues(deals: readonly DealMoney[], currency: string, partial = false): DealValueSummary {
  const groups = new Map<string, DealValueSummary["byCurrency"][number]>();
  for (const d of deals) {
    const group = groups.get(d.currency) ?? { currency: d.currency, recordedMinor: null, known: 0, missing: 0, needsReview: 0 };
    if (d.valueMinor === undefined) group.missing++;
    else if (dealValueNeedsReview(d)) group.needsReview++;
    else {
      group.recordedMinor = (group.recordedMinor ?? 0) + d.valueMinor;
      group.known++;
    }
    groups.set(d.currency, group);
  }
  const byCurrency = [...groups.values()].sort((a, b) => a.currency.localeCompare(b.currency));
  for (const group of byCurrency) if (group.recordedMinor !== null && !Number.isSafeInteger(group.recordedMinor)) {
    group.recordedMinor = null;
    group.needsReview += group.known;
    group.known = 0;
  }
  const complete = !partial && byCurrency.every(g => !g.missing && !g.needsReview && g.currency === currency);
  return { totalMinor: complete ? byCurrency[0]?.recordedMinor ?? 0 : null, partial, byCurrency };
}

export function formatDealValue(minor: number | null, currency: string): string {
  if (minor === null || !Number.isSafeInteger(minor) || !/^[A-Z]{3}$/.test(currency)) return "Not available";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "code", minimumFractionDigits: 0, maximumFractionDigits: fractionDigits(currency) }).format(minorToMajor(minor, currency));
}

export function dealValueSummaryLabel(summary: DealValueSummary): string {
  if (!summary.byCurrency.length) return "No recorded values";
  return summary.byCurrency.map(group => {
    const amount = group.recordedMinor === null ? `${group.currency}: no confirmed amount` : formatDealValue(group.recordedMinor, group.currency);
    const gaps = [group.missing ? `${group.missing} not recorded` : "", group.needsReview ? `${group.needsReview} need review` : ""].filter(Boolean);
    return `${amount}${gaps.length ? ` (${gaps.join(", ")})` : ""}`;
  }).join("; ");
}

export const LOSS_REASON_LABEL: Record<LossReason, string> = {
  price: "Price or budget",
  timing: "Timing",
  no_need: "No real need",
  chose_competitor: "Chose another option",
  no_response: "Stopped responding",
  not_a_fit: "Not a fit",
  other: "Other",
};

/** Dates used by recorded deal context; unknown or non-representable values cannot become owner deadlines. */
export function isDealTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && Math.abs(value) <= 8.64e15;
}

export interface PipelineDeal {
  stage: "lead" | "talking" | "booked" | "won" | "lost";
  source: string;
  createdAt: number;
  updatedAt: number;
  wonAt?: number;
  lostAt?: number;
  lostReason?: LossReason;
  lostReasons?: LossReason[];
  lostReasonNote?: string;
}

export interface PipelineOutcomes {
  windowDays: number;
  won: number;
  lost: number;
  /** Dated won / dated closed; withheld when the read or close dates are incomplete. */
  winRate: number | null;
  lossReasons: { reason: LossReason; count: number }[];
  lossReasonNotRecorded: number;
  lossReasonDealCount: number;
  modelRiskLossDeals: number;
  /** Records omitted by a bounded query; totals below describe the loaded sample only. */
  partial: boolean;
  closedWithoutCloseTime: number;
  invalidCloseTime: number;
  open: { lead: number; talking: number; booked: number };
  bySource: { source: string; won: number; lost: number }[];
  /** Up to five recent owner notes on lost deals (untrusted text). */
  recentLossNotes: string[];
}

const DAY = 86_400_000;

export function pipelineOutcomes(deals: readonly PipelineDeal[], options: { nowMs: number; windowDays?: number; partial?: boolean }): PipelineOutcomes {
  const windowDays = options.windowDays ?? 365;
  if (!Number.isSafeInteger(options.nowMs) || Math.abs(options.nowMs) > 8.64e15 || !Number.isSafeInteger(windowDays) || windowDays <= 0) throw new RangeError("Pipeline outcomes need a valid capture time and observation window.");
  const from = options.nowMs - windowDays * DAY;
  if (!Number.isSafeInteger(windowDays * DAY) || !Number.isSafeInteger(from) || Math.abs(from) > 8.64e15) throw new RangeError("Pipeline observation window exceeds the supported date range.");
  // Record creation/update time is not the buyer's decision date, especially after imports or edits.
  const closedAt = (d: PipelineDeal) => d.stage === "won" ? d.wonAt : d.lostAt;
  const decisions = deals.filter(d => d.stage === "won" || d.stage === "lost");
  const closedWithoutCloseTime = decisions.filter(d => closedAt(d) === undefined).length;
  const validClose = (d: PipelineDeal) => Number.isSafeInteger(closedAt(d)) && Math.abs(closedAt(d)!) <= 8.64e15 && closedAt(d)! <= options.nowMs;
  const invalidCloseTime = decisions.filter(d => closedAt(d) !== undefined && !validClose(d)).length;
  const closed = decisions.filter(d => validClose(d) && closedAt(d)! >= from);
  const partial = options.partial === true;
  const won = closed.filter((d) => d.stage === "won");
  const lost = closed.filter((d) => d.stage === "lost");
  const counts = new Map<LossReason, number>();
  for (const d of lost) for (const reason of dealLossReasons(d)) counts.set(reason, (counts.get(reason) ?? 0) + 1);
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
    winRate: closed.length && !partial && !closedWithoutCloseTime && !invalidCloseTime ? won.length / closed.length : null,
    lossReasons: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count })),
    lossReasonNotRecorded: lost.filter(d => dealLossReasons(d).length === 0).length,
    lossReasonDealCount: lost.filter(d => dealLossReasons(d).length > 0).length,
    modelRiskLossDeals: lost.filter(d => dealLossReasons(d).some(r => r === "price" || r === "no_need" || r === "chose_competitor")).length,
    partial, closedWithoutCloseTime, invalidCloseTime,
    open,
    bySource: [...sources.entries()].map(([source, row]) => ({ source, ...row })),
    recentLossNotes: lost.filter((d) => d.lostReasonNote?.trim()).sort((a, b) => closedAt(b)! - closedAt(a)!).slice(0, 5).map((d) => d.lostReasonNote!.trim().slice(0, 240)),
  };
}

/** Planning context; empty when the owner has no pipeline. Loss notes are returned separately so callers can mark them untrusted. */
export function pipelineOutcomesBrief(p: PipelineOutcomes): string {
  if (!p.won && !p.lost && !p.open.lead && !p.open.talking && !p.open.booked && !p.partial && !p.closedWithoutCloseTime && !p.invalidCloseTime) return "";
  const closed = p.won + p.lost;
  const incomplete = p.partial || p.closedWithoutCloseTime > 0 || p.invalidCloseTime > 0;
  const gaps = [p.partial ? "bounded read: totals and proportions are partial" : "", p.closedWithoutCloseTime ? `close date not recorded for ${p.closedWithoutCloseTime}` : "", p.invalidCloseTime ? `invalid or future close date for ${p.invalidCloseTime}` : ""].filter(Boolean).join("; ");
  const rate = p.winRate === null ? (incomplete ? `win rate unknown (${p.won} won / ${p.lost} lost with valid close dates in the loaded window; ${gaps})` : "no dated closed deals in this window") : `win rate ${(p.winRate * 100).toFixed(0)}% (${p.won} won of ${closed} closed${closed < 20 ? "; small sample" : ""})`;
  const reasons = p.lost ? `loss reasons: ${[...p.lossReasons.map((r) => `${LOSS_REASON_LABEL[r.reason].toLowerCase()} ${r.count}`), p.lossReasonNotRecorded ? `not recorded ${p.lossReasonNotRecorded}` : ""].filter(Boolean).join(", ")}` : "";
  const sources = p.bySource.length ? `by source: ${p.bySource.map((s) => `${s.source} ${s.won} won / ${s.lost} lost`).join("; ")}` : "";
  return [
    `OWNER PIPELINE OUTCOMES (owner-entered CRM stages, last ${p.windowDays} days by recorded close date; counts describe loaded records): ${[rate, reasons, sources, `loaded open records: ${p.open.lead} lead, ${p.open.talking} talking, ${p.open.booked} booked`].filter(Boolean).join("; ")}.`,
    "Reasons can overlap; each reason counts distinct lost deals, not extra customers, and the category totals must not be summed as deal counts. Use recorded loss reasons as owner-reported evidence about offer, price, fit or follow-up problems; an unrecorded reason is unknown, not any particular reason. Record sources describe how deals entered the CRM, not verified acquisition attribution. Missing/invalid close dates cannot be replaced by edit dates. These records are not verified payments or a complete customer cohort and do not show what caused a win or loss.",
  ].join(" ");
}

/** Review prompts, not judgments: open deals with no stage change for this many days are surfaced to the owner. */
export const STALLED_AFTER_DAYS = { lead: 21, talking: 14, booked: 14 } as const;

/** Calendar dates are separate from appointment instants; never infer a browser timezone. */
export function isDealDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

export function dealTimezone(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0); return value; } catch { return null; }
}

export function dealLocalDate(ms: unknown, timezone: string | null | undefined): string | null {
  if (!isDealTimestamp(ms) || !dealTimezone(timezone)) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone!, year: "numeric", month: "2-digit", day: "2-digit", era: "short" }).formatToParts(ms);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  const date = `${part("year")?.padStart(4, "0")}-${part("month")}-${part("day")}`;
  return part("era") === "AD" && isDealDate(date) ? date : null;
}

type AttentionDeal = { stage: PipelineDeal["stage"]; nextStepAt?: number | null; nextStepDate?: string | null; stageChangedAt?: number | null };
export function dealDueDate(d: Pick<AttentionDeal, "nextStepAt" | "nextStepDate">, timezone: string | null | undefined): string | null {
  if (d.nextStepDate != null) return isDealDate(d.nextStepDate) && d.nextStepAt == null ? d.nextStepDate : null;
  return dealLocalDate(d.nextStepAt, timezone);
}

export interface DealAttention {
  /** The next step's calendar date has passed in the configured workspace timezone. */
  overdue: boolean;
  /** Elapsed 24-hour days since the recorded stage change; a review policy, not buyer intent. */
  stalledDays: number | null;
  stageAgeKnown: boolean;
  /** A date is recorded but cannot be assessed (invalid/conflicting dates, clock or timezone). */
  nextStepTimingUnknown: boolean;
}

export function dealAttention(d: AttentionDeal, nowMs: number, timezone?: string | null): DealAttention {
  if (d.stage === "won" || d.stage === "lost") return { overdue: false, stalledDays: null, stageAgeKnown: true, nextStepTimingUnknown: false };
  const today = dealLocalDate(nowMs, timezone);
  const due = dealDueDate(d, timezone);
  const nextStepTimingUnknown = (d.nextStepAt != null || d.nextStepDate != null) && (!today || !due);
  const overdue = Boolean(today && due && due < today);
  const stageAgeKnown = isDealTimestamp(nowMs) && isDealTimestamp(d.stageChangedAt) && d.stageChangedAt <= nowMs;
  const days = stageAgeKnown ? Math.floor((nowMs - d.stageChangedAt!) / DAY) : null;
  return { overdue, stalledDays: days !== null && days >= STALLED_AFTER_DAYS[d.stage] ? days : null, stageAgeKnown, nextStepTimingUnknown };
}

export function pipelineAttention(deals: readonly AttentionDeal[], nowMs: number, timezone?: string | null): { overdue: number; stalled: number; stageAgeUnknown: number; nextStepTimingUnknown: number } {
  const open = deals.filter(d => d.stage !== "won" && d.stage !== "lost").map(d => dealAttention(d, nowMs, timezone));
  return { overdue: open.filter(a => a.overdue).length, stalled: open.filter(a => a.stalledDays !== null).length, stageAgeUnknown: open.filter(a => !a.stageAgeKnown).length, nextStepTimingUnknown: open.filter(a => a.nextStepTimingUnknown).length };
}
