export type ConversationFact = { id: string; category: string; statement: string; reviewState: string; provenance: string };
export type FactQuestion =
  | { kind: "check"; key: string; text: string; facts: ConversationFact[] }
  | { kind: "product" | "audience"; key: string; text: string; facts: [] }
  | { kind: "ready"; key: string; text: string; facts: [] };

export function factAnswerKey(fact: ConversationFact) { return `${fact.id}:${fact.statement}`; }

/** Uses saved research and explicit answers; never fills gaps with invented business facts. */
export function nextFactQuestion(facts: ConversationFact[], skipped: string[], name: string): FactQuestion {
  const pending = facts.filter(f => f.reviewState === "needs_review" && !skipped.includes(factAnswerKey(f)));
  if (pending.length) {
    const ownerSupplied = pending[0].provenance === "owner_supplied";
    const batch = pending.filter(f => (f.provenance === "owner_supplied") === ownerSupplied).slice(0, 3);
    return { kind: "check", key: batch.map(factAnswerKey).join("|"), text: ownerSupplied ? "Here’s what I understood from your message. Is this right?" : "I found this in the research. Does it sound right?", facts: batch };
  }
  for (const category of ["product", "audience"] as const) {
    // Don't ask for the same thing again when research already supplied an uncertain answer.
    if (facts.some(f => f.category === category && f.reviewState !== "rejected") || skipped.includes(category)) continue;
    return { kind: category, key: category, facts: [], text: category === "product" ? `What does ${name} offer? A short sentence is enough.` : "Who is it mainly for? If you’re not sure yet, we can leave this open." };
  }
  return { kind: "ready", key: "ready", facts: [], text: "That’s enough to get started. I’ll use the details you confirmed and keep anything uncertain separate." };
}
