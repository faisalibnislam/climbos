import { z } from "zod";
import type { LintIssue } from "./types";

const days = z.object({ minDays: z.number().int().min(1).max(3650), maxDays: z.number().int().min(1).max(3650) });
/** AI judgment, never a measured result, owner deadline, or publishing permission. */
export const GoalTimingSchema = z.object({
  preparation: days,
  firstReview: days,
  reason: z.string().min(20).max(600),
  assumptions: z.array(z.string().min(3).max(240)).min(1).max(4),
  reviewTrigger: z.string().min(15).max(500),
  outcomeLag: z.string().min(15).max(500),
});
export type GoalTiming = z.infer<typeof GoalTimingSchema>;

export function dayRange(range: { minDays: number; maxDays: number }) {
  return range.minDays === range.maxDays ? `about ${range.maxDays} ${range.maxDays === 1 ? "day" : "days"}` : `about ${range.minDays}–${range.maxDays} days`;
}

export function lintGoalTiming(timing: GoalTiming | undefined, phases: { days: string; firstAction?: string; howToCheck?: string; decisionRule?: string }[]): LintIssue[] {
  const issue = (message: string, path = "timing"): LintIssue => ({ severity: "error", rule: "consistency", path, message });
  if (!timing) return [issue("Choose and explain timing for this goal and approach. Return preparation and firstReview ranges, assumptions, reviewTrigger and outcomeLag; do not copy a fixed plan length.")];
  if (timing.preparation.minDays > timing.preparation.maxDays || timing.firstReview.minDays > timing.firstReview.maxDays || timing.firstReview.maxDays < timing.preparation.maxDays) return [issue("Timing ranges must be ordered, and the first review must allow the preparation to finish.")];
  if (phases.length < 2 || phases.length > 4) return [issue("Use 2–4 useful milestones sized for this approach, not preset calendar windows.", "phases")];
  let previousEnd = 0;
  for (const [i, phase] of phases.entries()) {
    const match = /^(?:days?\s*)?(\d+)\s*[-–—]\s*(\d+)$/i.exec(phase.days.trim());
    if (!match || Number(match[1]) !== previousEnd + 1 || Number(match[2]) < Number(match[1]) || Number(match[2]) > timing.firstReview.maxDays || !phase.firstAction?.trim() || !phase.howToCheck?.trim() || !phase.decisionRule?.trim()) return [issue("Milestones must have ordered, contiguous day ranges starting at day 1, stay within the estimated first-review window, and name the first action, check and decision rule.", `phases[${i}]`)];
    previousEnd = Number(match[2]);
  }
  return previousEnd < timing.firstReview.minDays ? [issue("The milestones end before the proposed first review. Include the learning and review step.", "phases")] : [];
}

export const GOAL_TIMING_INSTRUCTION = `Choose timing by judging THIS goal, starting point, chosen mechanism, actual work, dependencies, review availability, supplied capacity and any real deadline. Do not use 14/30/90-day packages or arbitrary weekly windows. Return timing.preparation and timing.firstReview as honest minDays/maxDays ranges, a reason, 1–4 explicit assumptions, a reviewTrigger and an outcomeLag explanation. Separate work time from time to observe useful evidence; never promise a customer, ranking or revenue result by a date. Use 2–4 concrete phases with your own contiguous relative-day ranges starting at day 1 and ending within the first-review range; each phase includes firstAction, howToCheck and decisionRule. If capacity or baseline is unknown, label it as an assumption, do not invent it. Ask only when the unknown would change the approach. Review on a meaningful signal with an elapsed-time fallback so silence is not indefinite. If a deadline cannot accommodate the work, say so and propose a smaller useful milestone. Continue useful work based on what is learned; no fixed recurring plan length or annual reset.`;
