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

/* ---------------- planned steps per job (for "what's next" and ETA) ---------------- */

/** The step labels a job is expected to run (engine v2 agent phases), before any revision. */
export function plannedSteps(kind: string, engine: string | null | undefined, opts: { website?: boolean } = {}): string[] {
  if (engine !== "v2") return [];
  const agent = (name: string, research: boolean, review = true) => [...(research ? [`${name}: research`] : []), `${name}: draft`, ...(review ? [`${name}: review 1`] : [])];
  switch (kind) {
    case "onboarding_research":
      return [...(opts.website !== false ? ["Read your website"] : []), "Understand the business", ...agent("Business insights", true)];
    case "strategy":
      return [...agent("Channel scoring", false, false), ...agent("Growth plays", true), ...agent("Growth plan", false)];
    case "outbound":
      return [...agent("Find customers", true), ...agent("Write the emails", false)];
    default:
      return [];
  }
}

/** Progress over planned labels plus whatever actually ran (revisions add steps). */
export function progressOfRun(steps: RunStep[], planned: string[], now: number, finished: boolean): ProgressView {
  const seen = new Set(steps.map((s) => s.label));
  const futurePhases = planned.filter((l) => !seen.has(l)).map(phaseOf);
  return progressOf(steps, [...steps.map((s) => phaseOf(s.label)), ...futurePhases], now, finished);
}

/* ---------------- findings: what each step found or decided ---------------- */

type Obj = Record<string, unknown>;
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
/** Plain text: no markdown emphasis, links or extra spaces; clipped to n characters. */
const clip = (raw: string, n = 140) => {
  const s = raw.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

/** One or two short lines describing a finished step's result, for the owner to follow along. */
export function findingsFor(label: string, output: unknown): string[] {
  if (!output || typeof output !== "object") return [];
  const o = output as Obj;
  const ph = phaseOf(label);
  if (ph === "research") {
    const sources = arr(o.sources);
    const domains = [...new Set(sources.map((s) => host(str(s.url))).filter(Boolean))];
    const first = str(o.notes)
      .split("\n")
      .map((l) => l.replace(/^[#\-*\s]+/, "").trim())
      .find((l) => l.length > 30 && !/^sources?/i.test(l));
    return [`Read ${sources.length} source${sources.length === 1 ? "" : "s"}${domains.length ? `: ${domains.slice(0, 5).join(", ")}${domains.length > 5 ? ` +${domains.length - 5} more` : ""}` : ""}`, ...(first ? [clip(first)] : [])];
  }
  if (ph === "review") {
    const fixes = arr(o.fixes).map(String).filter(Boolean);
    const strengths = arr(o.strengths).map(String).filter(Boolean);
    const failedGates = arr(o.gates).filter((g) => g.pass === false).length;
    if (!fixes.length && !failedGates) return [`Passed review${strengths[0] ? `: ${clip(strengths[0], 110)}` : ""}`];
    return [`Reviewer asked for ${fixes.length || failedGates} fix${(fixes.length || failedGates) === 1 ? "" : "es"}${fixes[0] ? `: ${clip(fixes[0], 120)}` : ""}`];
  }
  if (Array.isArray(o.plays)) {
    const names = arr(o.plays).map((p) => str(p.name)).filter(Boolean);
    return [`${names.length} growth play${names.length === 1 ? "" : "s"}: ${clip(names.join(" · "), 200)}`];
  }
  if (o.northStar && typeof o.northStar === "object") {
    const ns = o.northStar as Obj;
    return [`North Star: ${clip(`${str(ns.metric)} → ${str(ns.target)}`, 160)}`, ...(str(o.diagnosis) ? [clip(str(o.diagnosis))] : [])];
  }
  if (Array.isArray(o.types) && Array.isArray(o.channels)) {
    return [...arr(o.summary).map(String).slice(0, 2).map((s) => clip(s))];
  }
  if (Array.isArray(o.prospects)) return [`Found ${arr(o.prospects).length} companies${o.icp && typeof o.icp === "object" ? `: ${clip(str((o.icp as Obj).summary), 120)}` : ""}`];
  if (Array.isArray(o.sequence)) return [`Wrote a ${arr(o.sequence).length}-email sequence`];
  if (Array.isArray(o.posts)) return [`${arr(o.posts).length} post${arr(o.posts).length === 1 ? "" : "s"}: ${clip(arr(o.posts).map((p) => str(p.title)).filter(Boolean).join(" · "), 180)}`];
  if (str(o.positioningStatement) || Array.isArray(o.alternatives)) {
    const alts = arr(o.alternatives).map((a) => str(a.name)).filter(Boolean);
    return [...(alts.length ? [`Competitors and alternatives: ${clip(alts.join(", "), 160)}`] : []), ...(str(o.positioningStatement) ? [clip(str(o.positioningStatement))] : [])];
  }
  if (Array.isArray(o.findings)) return [`${arr(o.findings).length} findings on your site`];
  if (Array.isArray(o.facts)) return [`Found ${arr(o.facts).length} facts about your business`];
  if (Array.isArray(o)) return [`Read ${(o as unknown[]).length} pages`];
  return [];
}
