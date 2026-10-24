/**
 * A/B decisions, read once at a planned end (decision books, 2026-10-20:
 * Kohavi et al. Ch 2 and 21; Kochenderfer et al. Ch 15 explore-then-commit).
 * The engine used to test after every view, send, lead and reply and apply B
 * at the first 95% reading; with identical variants that picks B in roughly
 * 14–33% of tests. Now the test collects until `maxTrials` in total, checks
 * the split (sample-ratio mismatch), then decides once with the same exact
 * or z test the calculators use. Before the end there is no winner.
 */
import { compareRates, sampleRatio } from "../analysis/decisions";

export interface VariantStats {
  key: string;
  trials: number;
  wins: number;
}

export interface Decision {
  done: boolean;
  /** A completed experiment with a broken assignment split is invalid, not evidence for either variant. */
  validity: "collecting" | "valid" | "invalid";
  winner: string | null;
  /** Relative lift of B over A (e.g. 0.25 = +25%), null until both have data. */
  lift: number | null;
  /** 100 × (1 − p) at the planned end; 0 before it (a mid-test number invites peeking). Not a probability that B is better. */
  confidence: number;
  note: string;
}

export function decide(stats: VariantStats[], minTrials: number, maxTrials: number): Decision {
  const a = stats.find((s) => s.key === "A");
  const b = stats.find((s) => s.key === "B");
  if (!a || !b) return { done: false, validity: "collecting", winner: null, lift: null, confidence: 0, note: "Waiting for data." };
  const pa = a.trials ? a.wins / a.trials : 0;
  const pb = b.trials ? b.wins / b.trials : 0;
  const lift = a.trials && b.trials && pa > 0 ? (pb - pa) / pa : null;
  const total = a.trials + b.trials;
  if (total < maxTrials || a.trials < minTrials || b.trials < minTrials)
    return { done: false, validity: "collecting", winner: null, lift, confidence: 0, note: `Collecting: ${total} of ${maxTrials}. The result is read once at the end; an early lead is usually noise.` };
  // The split must match 50/50 before any result is read.
  const srm = sampleRatio({ planned: [50, 50], observed: [a.trials, b.trials] });
  if (srm.mismatch) return { done: true, validity: "invalid", winner: null, lift: null, confidence: 0, note: "Invalid test: the two versions weren't shown as planned, so neither version can be called a winner. The original remains active; check assignment, exposure and tracking before testing again." };
  const r = compareRates({ control: { visitors: a.trials, conversions: Math.min(a.wins, a.trials) }, treatment: { visitors: b.trials, conversions: Math.min(b.wins, b.trials) } });
  const confidence = Math.round((1 - r.pValue) * 1000) / 10;
  if (r.verdict === "difference_detected" && pb > pa) return { done: true, validity: "valid", winner: "B", lift, confidence, note: `The new version did better (p = ${Math.round(r.pValue * 1000) / 1000}).` };
  if (r.verdict === "difference_detected") return { done: true, validity: "valid", winner: "A", lift, confidence, note: `The original did better (p = ${Math.round(r.pValue * 1000) / 1000}).` };
  return { done: true, validity: "valid", winner: "A", lift, confidence, note: "No clear difference, so we kept the original." };
}

/** Stable A/B split for a recipient id. */
export function variantFor(id: string): "A" | "B" {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 2 === 0 ? "A" : "B";
}
