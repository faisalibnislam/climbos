import { z } from "zod";
import type { LintIssue } from "./types";

/** A strategic choice is distinct from a forecast or a list of channels. */
export const StrategicDirectionSchema = z.object({
  ambition: z.string().trim().min(8).max(500),
  customer: z.string().trim().min(8).max(400),
  unmetNeed: z.string().trim().min(8).max(500),
  winningApproach: z.string().trim().min(8).max(700),
  whyThisBusiness: z.string().trim().min(8).max(500),
  compoundingAdvantage: z.string().trim().min(8).max(500),
  horizon: z.string().trim().min(3).max(120),
  currentBet: z.string().trim().min(8).max(500),
  nextHorizon: z.string().trim().min(8).max(1000),
  notNow: z.array(z.string().trim().min(3).max(240)).min(1).max(4),
  assumptions: z.array(z.string().trim().min(3).max(300)).min(1).max(5),
  changeCourseIf: z.string().trim().min(8).max(500),
  evidenceRefs: z.array(z.string().trim().min(1).max(500)).max(8),
});
export type StrategicDirection = z.infer<typeof StrategicDirectionSchema>;

const CHANNEL_ONLY = /^(?:do\s+)?(?:seo|social media|email marketing|content marketing|product hunt|g2|run (?:targeted )?ads|post consistently|grow (?:the |our )?business)[.!]?$/i;

/** Narrow structural checks, not a claim to measure strategic originality. */
export function lintStrategicDirection(direction: StrategicDirection | undefined, facts: readonly string[], sourceUrls: readonly string[]): LintIssue[] {
  if (!direction) return [];
  const issues: LintIssue[] = [];
  for (const field of ["ambition", "winningApproach", "currentBet"] as const) {
    if (CHANNEL_ONLY.test(direction[field].trim())) issues.push({ severity: "error", rule: "generic_action", path: `strategicDirection.${field}`, message: "A channel name is not a strategic choice. Name the buyer, problem, distinctive mechanism and business effect." });
  }
  const urls = new Set(sourceUrls.map((url) => url.replace(/\/$/, "")));
  for (const ref of direction.evidenceRefs) {
    const fact = /^fact:(\d+)$/i.exec(ref);
    if (fact ? Number(fact[1]) >= facts.length : !urls.has(ref.replace(/\/$/, ""))) {
      issues.push({ severity: "error", rule: "citation", path: "strategicDirection.evidenceRefs", message: `The strategic direction cites evidence absent from this run: ${ref.slice(0, 120)}. Use a supplied fact or read page; otherwise label the reasoning as a hypothesis.` });
    }
  }
  return issues;
}

export const STRATEGIC_DIRECTION_POLICY = `DIRECTION BEFORE TACTICS: First choose a business-specific strategic direction, then derive channels and costed plays from it. Return strategicDirection: ambition (what this business could become known for over a longer horizon, not a revenue promise), customer (a precise buyer and buying situation), unmetNeed (their unresolved job or tension), winningApproach (the distinctive offer, product, service, business model or distribution mechanism), whyThisBusiness (its supplied assets or explicit missing prerequisites), compoundingAdvantage (how each cycle could make the next easier), horizon (an explicitly proposed planning horizon), currentBet (the smallest meaningful move inside this plan's horizon), nextHorizon (what becomes possible only if the current bet works), notNow (deliberate sacrifices), assumptions, changeCourseIf, and evidenceRefs (only supplied fact:N or pages read in this run; [] is valid). Name speculative reasoning in assumptions. Connect the grounded, adjacent and bold options to this direction or explain the alternative direction they test. Distinguish user from payer and explain what the payer gets beyond a free or existing alternative. If public evidence leaves paid value unclear, keep it unknown; do not invent an upgrade benefit. Ask one essential offer question while preparing work that does not depend on its answer. New paid models remain hypotheses. Think beyond a marketing calendar: new buying occasions, underserved segments, offer architecture, product/service changes, partnerships, distribution leverage and customer experience can lead. A bigger ad budget, more posts, a platform name or an invented growth number is not a grand vision. Do not anchor ideation on the channel scorecard: its editorial priors are candidate hypotheses, not evidence that buyers use a channel. Preserve a strong unconventional option even when its forecast is unknown or ClimbOS cannot execute it. Choose a small execution portfolio after exploration; justify channel selection by buyer behavior, intent, timing, economics and the proposed mechanism. Show what must be learned before scaling. Never promise market leadership or invent demand, resources, metrics or permissions.`;
