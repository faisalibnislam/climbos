/**
 * Live job progress: percent and time left from expected phase durations
 * (measured on the live engine, 18 Oct 2026) and the actual elapsed time of
 * each step. Used wherever an owner waits on the team.
 */

export interface RunStep {
  label: string;
  status: string;
  startedAt?: number | null;
  finishedAt?: number | null;
}

export type Phase = "read" | "profile" | "research" | "draft" | "review" | "revise" | "other";

/** Typical seconds per phase (median-ish, live routes). */
export const EXPECTED_SECONDS: Record<Phase, number> = { read: 20, profile: 25, research: 150, draft: 200, review: 80, revise: 200, other: 30 };

export const PHASE_LABEL: Record<Phase, string> = {
  read: "Reading your website",
  profile: "Pulling out the facts",
  research: "Researching the web",
  draft: "Writing the analysis",
  review: "Expert review",
  revise: "Improving it",
  other: "Working",
};

export function phaseOf(label: string): Phase {
  const l = label.toLowerCase();
  if (/read your website/.test(l)) return "read";
  if (/understand the business/.test(l)) return "profile";
  if (/: research$/.test(l)) return "research";
  if (/: revision \d+$/.test(l)) return "revise";
  if (/: review \d+$/.test(l)) return "review";
  if (/: draft$/.test(l)) return "draft";
  return "other";
}

/** Phases still expected after the ones seen so far (a failed review adds a revision + review). */
export function remainingPlan(seen: Phase[], planned: Phase[]): Phase[] {
  const left = [...planned];
  for (const p of seen) {
    const i = left.indexOf(p);
    if (i >= 0) left.splice(i, 1);
  }
  return left;
}

export interface ProgressView {
  percent: number;
  /** Seconds left (rounded up to 10s), null when finished. */
  etaSeconds: number | null;
  elapsedSeconds: number;
  current: Phase | null;
}

/**
 * Progress for a run whose model/research steps are `steps` and whose full
 * plan is `planned` (e.g. read, profile, research, draft, review).
 */
export function progressOf(steps: RunStep[], planned: Phase[], now: number, finished: boolean): ProgressView {
  const work = steps.filter((s) => phaseOf(s.label) !== "other" && !/reserve/i.test(s.label));
  const started = work.map((s) => s.startedAt).filter((t): t is number => typeof t === "number");
  const t0 = started.length ? Math.min(...started) : now;
  const elapsedSeconds = Math.max(0, Math.round((now - t0) / 1000));
  if (finished) return { percent: 100, etaSeconds: null, elapsedSeconds, current: null };
  const seen = work.map((s) => phaseOf(s.label));
  let done = 0;
  let total = 0;
  let current: Phase | null = null;
  let currentLeft = 0;
  for (const s of work) {
    const ph = phaseOf(s.label);
    const expected = EXPECTED_SECONDS[ph];
    total += expected;
    if (s.status === "succeeded" || s.status === "skipped") done += expected;
    else if (s.status === "running") {
      current = ph;
      const ran = s.startedAt ? (now - s.startedAt) / 1000 : 0;
      // A slow step counts as at most 95% done, and is assumed to need a bit more.
      const credit = Math.min(ran, expected * 0.95);
      done += credit;
      currentLeft = Math.max(expected - ran, expected * 0.1);
    }
  }
  const future = remainingPlan(seen, planned).reduce((s, p) => s + EXPECTED_SECONDS[p], 0);
  total += future;
  const percent = total ? Math.max(2, Math.min(99, Math.round((done / total) * 100))) : 2;
  const eta = Math.ceil((currentLeft + future) / 10) * 10;
  return { percent, etaSeconds: eta, elapsedSeconds, current };
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s ? `${m}m ${String(s).padStart(2, "0")}s` : `${m}m`;
}

export function formatEta(seconds: number | null): string {
  if (seconds === null) return "Done";
  if (seconds < 60) return "Less than a minute left";
  const m = Math.round(seconds / 60);
  return `About ${m} minute${m === 1 ? "" : "s"} left`;
}
