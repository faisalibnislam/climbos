import { lintMilestoneRanges } from "./goalTiming";

/** Execution cycles can repeat across years; the strategic direction is not a compressed forecast. */
export const CYCLE_LENGTHS = [14, 30, 90] as const;
export type CycleLength = typeof CYCLE_LENGTHS[number];
export function lintCycleMilestones(phases: { days: string; firstAction?: string; howToCheck?: string; decisionRule?: string }[], days: number, flexibleMilestones = false): import("./types").LintIssue[] {
  if (flexibleMilestones) return lintMilestoneRanges(phases, { minDays: days, maxDays: days });
  const windows = milestoneWindows(days);
  return !windows.length || phases.length !== windows.length || phases.some((phase, i) => phase.days.replace(/days?\s*/gi, "").replace(/[–—]/g, "-").replace(/\s/g, "") !== `${windows[i]?.start}-${windows[i]?.end}` || !phase.firstAction?.trim() || !phase.howToCheck?.trim() || !phase.decisionRule?.trim())
    ? [{ severity: "error", rule: "consistency", path: "phases", message: "Return one concrete milestone for each exact execution-cycle window, with firstAction, howToCheck and decisionRule. Keep longer-term ambition separate." }] : [];
}
export function milestoneWindows(days: number): { start: number; end: number }[] {
  if (!Number.isInteger(days) || days < 14 || days > 365) return [];
  const ends = days <= 30 ? [7, 14, 21, days].filter((end, i, list) => end <= days && list.indexOf(end) === i) : [14, 30, days];
  return ends.map((end, i) => ({ start: i ? ends[i - 1] + 1 : 1, end }));
}
export function cycleProgress(startedAt: number, days: number, now: number) {
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 86400000));
  return { day: Math.min(days, elapsed + 1), reviewDue: elapsed >= days, reviewAt: startedAt + days * 86400000 };
}
export function cycleMilestoneInstruction(days: number, flexibleMilestones = false): string {
  if (flexibleMilestones) return `EXECUTION CYCLE: ${days} days. This is a progress-review horizon, not proof of owner capacity or a deadline for customer outcomes. Use 2–4 milestones sized to the actual dependencies, with contiguous relative-day ranges from day 1 through day ${days}. Do not force all work into equal weekly blocks or wait for a later block to check a prerequisite. Every milestone includes firstAction, howToCheck and decisionRule. Review the prepared work first; verify any capability the test depends on next; make exposure conditional on verified behavior, actual access, capacity and exact approval. At the final review, record progress or not-run and carry incomplete observation forward. No automatic sending, publishing or spending; longer-term direction remains separate.`;
  const windows = milestoneWindows(days);
  return `EXECUTION CYCLE: ${days} days. Keep the longer-term direction separate; do not compress months of work or promise paid results inside a shorter cycle. Return phases as milestones for exactly these relative-day windows: ${windows.map((w) => `${w.start}–${w.end}`).join(", ")}. Every milestone names one concrete deliverable or observable change, a firstAction, howToCheck and decisionRule (continue/change/stop or carry measurement forward). Match scope to owner capacity. Unknown baselines stay unknown; propose collection instead of fabricated thresholds. If a sales cycle or measurement window is longer, say what this cycle can learn and what must wait. These are proposed milestones, not observed progress. No automatic publishing, sending or spending. The final milestone reviews results and decides the next cycle; keep strategic direction and learning available year over year.`;
}
