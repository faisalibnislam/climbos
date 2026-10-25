import { wilson90 } from "./learnedMetrics";

/**
 * Do the prospect fit and timing scores (0–100) predict outreach outcomes? Compares prospects scored 70+ with
 * those below 70 on reply and booking rates over mature first contacts. A difference is only called when the
 * 90% Wilson intervals don't overlap and each band has at least 20 contacts; otherwise it says "not clear yet".
 * Association, not cause.
 */

export interface LeadScoreRow { fit: number; timing: number; replied: boolean; booked: boolean }
export interface ScoreBand { contacted: number; replied: number; booked: number }
export interface ScoreComparison { score: "fit" | "timing"; high: ScoreBand; lower: ScoreBand; reply: "high_better" | "lower_better" | "no_clear_difference" | "too_few"; booking: "high_better" | "lower_better" | "no_clear_difference" | "too_few" }

const THRESHOLD = 70;
const MIN_PER_BAND = 20;

function band(rows: LeadScoreRow[]): ScoreBand {
  return { contacted: rows.length, replied: rows.filter((r) => r.replied).length, booked: rows.filter((r) => r.booked).length };
}

function verdict(high: ScoreBand, lower: ScoreBand, key: "replied" | "booked"): ScoreComparison["reply"] {
  if (high.contacted < MIN_PER_BAND || lower.contacted < MIN_PER_BAND) return "too_few";
  const a = wilson90(high[key], high.contacted);
  const b = wilson90(lower[key], lower.contacted);
  if (!a || !b) return "too_few";
  if (a.low > b.high) return "high_better";
  if (b.low > a.high) return "lower_better";
  return "no_clear_difference";
}

export function leadScoreCheck(rows: readonly LeadScoreRow[]): ScoreComparison[] {
  const valid = rows.filter((r) => Number.isFinite(r.fit) && Number.isFinite(r.timing));
  return (["fit", "timing"] as const).map((score) => {
    const high = band(valid.filter((r) => r[score] >= THRESHOLD));
    const lower = band(valid.filter((r) => r[score] < THRESHOLD));
    return { score, high, lower, reply: verdict(high, lower, "replied"), booking: verdict(high, lower, "booked") };
  });
}

const VERDICT_TEXT: Record<ScoreComparison["reply"], string> = {
  high_better: "higher-scored prospects did better",
  lower_better: "lower-scored prospects did better (the score may not be predicting this outcome)",
  no_clear_difference: "no clear difference yet",
  too_few: "too few contacts to compare (20+ per band needed)",
};

const rate = (n: number, d: number) => (d ? `${n}/${d} (${Math.round((n / d) * 100)}%)` : "0/0");

export function leadScoreLines(comparisons: readonly ScoreComparison[]): string[] {
  return comparisons.filter((c) => c.high.contacted + c.lower.contacted > 0).map((c) => `${c.score} score 70+ vs below 70: replies ${rate(c.high.replied, c.high.contacted)} vs ${rate(c.lower.replied, c.lower.contacted)}, ${VERDICT_TEXT[c.reply]}; bookings ${rate(c.high.booked, c.high.contacted)} vs ${rate(c.lower.booked, c.lower.contacted)}, ${VERDICT_TEXT[c.booking]}`);
}

export function leadScoreBrief(comparisons: readonly ScoreComparison[]): string {
  const lines = leadScoreLines(comparisons);
  return lines.length ? `PROSPECT SCORE CHECK (this workspace's mature first contacts; association, not cause; 90% Wilson intervals): ${lines.join("; ")}. If a score isn't separating outcomes, don't lean on it when choosing whom to contact.` : "";
}
