/** The three governed knowledge layers shared by ClimbOS agents. */
export const KNOWLEDGE_LAYER_POLICY = `# Shared knowledge layers
ClimbOS keeps three different kinds of knowledge separate:
1. BUSINESS TRUTH: owner-confirmed decisions and source-backed business facts. Preserve each item's source, date, scope and confidence; unresolved conflicts stay unresolved.
2. BUSINESS PERFORMANCE: events, funnel measurements, campaigns, experiments and outcomes. Preserve the metric definition, population, denominator, period, coverage and attribution method. Observational association is not causal lift; sparse, immature or partial data stays uncertain.
3. GENERAL GUIDANCE: role playbooks, curated books, contextual benchmarks and platform rules. Use these to form options and questions, never as facts about this business or proof that a tactic works. Recheck volatile platform, API and legal requirements against current primary sources before execution.
Apply hard safety, legal, budget, capacity and channel-eligibility limits first. Then use relevant business truth and comparable performance evidence to choose among eligible options. Use general guidance only where it fits that context. If the layers conflict or a performance result is not comparable, surface the uncertainty and propose the smallest useful check. One tenant's result must not become a universal rule. None of these layers authorizes publishing, outreach, spending or account changes.`;

/** Label business-specific context without changing or upgrading its source claims. */
export function formatBusinessKnowledgeLayers(truth: readonly string[], performance: readonly string[]): string {
  const truthText = truth.filter(Boolean).join("\n\n") || "No business truth was supplied for this run.";
  const performanceText = performance.filter(Boolean).join("\n\n") || "No first-party performance outcomes were supplied for this run; leave performance unknown.";
  return [
    `BUSINESS TRUTH (Layer 1; retain the source labels on every claim):\n${truthText}`,
    `BUSINESS PERFORMANCE (Layer 2; observations are not automatically causal):\n${performanceText}`,
  ].join("\n\n");
}
