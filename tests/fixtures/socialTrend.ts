import type { SocialPostsV2 } from "../../shared/agents/specs";

export function socialTrendFixture(): SocialPostsV2 {
  return {
    copyBrief: { reader: "Small studio operators", situation: "Reviewing a client brief", awarenessStage: "unknown", relationshipStage: "unknown", objective: "Explain the intake review", offerFactIndexes: [], problemJob: "Find missing details", trigger: "A new client request", centralIdea: "Inspect the brief before committing", objection: "Unclear scope", proofFactIndexes: [], prohibitedClaims: [], channel: "linkedin", format: "text", deliveryContext: "organic", brandVoice: "Plain and practical", approvedExamples: [], cta: "Review a brief", afterAction: "Record unresolved questions", trackingMetric: "Customer questions answered", trackingMethod: "Owner log", supportingFactIndexes: [], supportingSourceUrls: [], unknowns: ["Customer response"] },
    posts: [{ channel: "linkedin", title: "Before the project starts", body: "Review the actual client request before preparing a proposal. Identify what is known, what is missing and which decision needs the client's answer. This is a proposed process to test, not a claim about measured customer outcomes.", hashtags: [], altText: "", imageIdea: "An original diagram of the intake review", factIndexes: [], suggestedDay: 1, angle: "A clearer first conversation", format: "text", hook: "What is missing from the brief?", slides: [], videoScript: "", shotList: [], visualBrief: "Show an original diagram of a brief with unanswered questions, with no fabricated customer information.", firstComment: "" }],
  };
}

export function currentTrendResearch() {
  const retrievedAt = Date.now();
  const evidence = { sourceUrl: "https://research.example/process-format", observationDate: new Date(retrievedAt).toISOString().slice(0, 10), observation: "The creator shows a process before revealing its result." };
  return { evidence, research: { notes: `TREND SIGNAL 1\nPlatform: LinkedIn\nMarket: unknown\nSource URL: ${evidence.sourceUrl}\nObserved date: ${evidence.observationDate}\nObserved signal: ${evidence.observation}`, sources: [{ url: evidence.sourceUrl }], retrievedAt } };
}
