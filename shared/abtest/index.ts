/**
 * A/B decisions: a two-proportion z-test. A winner needs at least `minTrials`
 * per variant and 95% confidence; after `maxTrials` in total with no clear
 * winner the test ends and the current version (A) stays.
 */

export interface VariantStats {
  key: string;
  trials: number;
  wins: number;
}

export interface Decision {
  done: boolean;
  winner: string | null;
  /** Relative lift of B over A (e.g. 0.25 = +25%), null until both have data. */
  lift: number | null;
  confidence: number;
  note: string;
}

function normalCdf(z: number): number {
  // Abramowitz–Stegun approximation.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export function decide(stats: VariantStats[], minTrials: number, maxTrials: number): Decision {
  const a = stats.find((s) => s.key === "A");
  const b = stats.find((s) => s.key === "B");
  if (!a || !b) return { done: false, winner: null, lift: null, confidence: 0, note: "Waiting for data." };
  const pa = a.trials ? a.wins / a.trials : 0;
  const pb = b.trials ? b.wins / b.trials : 0;
  const lift = a.trials && b.trials && pa > 0 ? (pb - pa) / pa : null;
  const pooled = a.trials + b.trials ? (a.wins + b.wins) / (a.trials + b.trials) : 0;
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / Math.max(1, a.trials) + 1 / Math.max(1, b.trials)));
  const z = se > 0 ? (pb - pa) / se : 0;
  const confidence = Math.round((1 - 2 * (1 - normalCdf(Math.abs(z)))) * 1000) / 10;
  const enough = a.trials >= minTrials && b.trials >= minTrials;
  if (enough && confidence >= 95) {
    const winner = pb > pa ? "B" : "A";
    return { done: true, winner, lift, confidence, note: `${winner === "B" ? "The new version" : "The original"} wins with ${confidence}% confidence.` };
  }
  if (a.trials + b.trials >= maxTrials) return { done: true, winner: "A", lift, confidence, note: "No clear difference, so we kept the original." };
  return { done: false, winner: null, lift, confidence, note: enough ? `Leaning ${pb > pa ? "B" : "A"} (${confidence}% sure). Still collecting.` : `Collecting data (${Math.min(a.trials, b.trials)} of ${minTrials} per version).` };
}

/** Stable A/B split for a recipient id. */
export function variantFor(id: string): "A" | "B" {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 2 === 0 ? "A" : "B";
}
