/** An explicit personal communication preference, not a judgment about the owner's expertise. */
export const EXPLANATION_DEPTHS = ["concise", "guided", "detailed"] as const;
export type ExplanationDepth = (typeof EXPLANATION_DEPTHS)[number];
export function explanationDepth(value: unknown): ExplanationDepth {
  return EXPLANATION_DEPTHS.includes(value as ExplanationDepth) ? value as ExplanationDepth : "concise";
}

const STYLE: Record<ExplanationDepth, string> = {
  concise: "Concise: answer first and keep routine replies to the essentials. Include the next useful step and any decision-changing uncertainty. Expand when the question requires it.",
  guided: "Guided: answer first, then briefly explain why it matters and how to take the next step in plain language. Define unfamiliar terms when needed and use one relevant example if it helps. Do not assume or label the owner's competence.",
  detailed: "Detailed: answer first, then explain the relevant evidence, alternatives, tradeoffs, assumptions, calculations and next decision. Give an inspectable decision rationale rather than an unexplained conclusion. Match depth to the task; a simple fact still needs only a short answer.",
};

export function explanationGuidance(value: unknown): string {
  return `PERSONAL EXPLANATION PREFERENCE (saved when this request began): ${STYLE[explanationDepth(value)]}
This preference is the owner's request for explanation depth and may override the routine reply-length default. An explicit request in the current message takes priority. It applies to explanations to this person, not the brand voice, audience, length or format of public content they ask you to draft.
All modes retain material evidence, source labels, uncertainties, costs and required approval choices. For a relevant strategy exploration, retain distinct grounded, adjacent and bold options; brevity must not suppress a bold idea or hide its risk/test. Do not invent missing facts or simplify a calculation into a misleading claim. This setting changes no tools, permissions, approval rules, model route, budget or execution scope.`;
}
