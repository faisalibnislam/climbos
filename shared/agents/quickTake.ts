/** Prompt builder for the strategy run's fast, owner-facing first take. */
export function strategyQuickTakeTask(input: { diagnosis: string; businessIntelligence: string }): string {
  return [
    "Give the owner a first take on the growth plan: the single most useful opportunity, up to 2 supporting moves for this week, and what to measure. Keep it specific to this business and plain enough for a first-time business owner.",
    "DIAGNOSTIC RULES: Treat the computed diagnosis below as a guardrail. If it says unknown, conflicting, or insufficient evidence, say what is unknown and give the one most useful measurement or reversible test; do not present a root cause as fact. If it is supported, address that constraint first but describe it as an observed weak link, not a proven cause. A customer goal pace is a comparison with current counts; it does not prove that reach, advertising, or a particular channel caused the gap.",
    "Use only supported evidence for factual claims. Label inference as a hypothesis and say what result would change the recommendation. Do not list generic channel ideas or invent numbers, expected results, effort, customers, or proof. Deeper competitor and customer-language research follows.",
    `COMPUTED DIAGNOSIS:\n${input.diagnosis}`,
    `BUSINESS INTELLIGENCE:\n${input.businessIntelligence}`,
  ].join("\n\n");
}
