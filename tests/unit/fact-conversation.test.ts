import { describe, expect, it } from "vitest";
import { factAnswerKey, nextFactQuestion, type ConversationFact } from "../../src/components/app/onboarding/factConversation";

const fact = (id: string, category = "product", provenance = "researched"): ConversationFact => ({ id, category, provenance, statement: `Detail ${id}`, reviewState: "needs_review" });

describe("conversational business check", () => {
  it("checks at most three visible details and keeps owner answers separate from research", () => {
    const facts = [fact("a", "brand", "owner_supplied"), fact("b"), fact("c", "other", "owner_supplied"), fact("d", "other", "owner_supplied"), fact("e", "other", "owner_supplied")];
    const q = nextFactQuestion(facts, [], "Test business");
    expect(q.kind).toBe("check");
    expect(q.facts.map(f => f.id)).toEqual(["a", "c", "d"]);
    expect(q.text).toContain("your message");
  });
  it("never repeats supplied product or audience information, even when left uncertain", () => {
    const facts = [fact("a"), fact("b", "audience")];
    expect(nextFactQuestion(facts, facts.map(factAnswerKey), "Test").kind).toBe("ready");
    expect(facts.every(f => f.reviewState === "needs_review")).toBe(true);
  });
  it("asks only for missing essentials, and permits an unknown answer", () => {
    expect(nextFactQuestion([], [], "Test")).toMatchObject({ kind: "product", text: "What does Test offer? A short sentence is enough." });
    expect(nextFactQuestion([], ["product"], "Test").kind).toBe("audience");
    expect(nextFactQuestion([], ["product", "audience"], "Test").kind).toBe("ready");
    const saved = [{ ...fact("a"), reviewState: "confirmed" }, { ...fact("b", "audience"), reviewState: "edited" }];
    expect(nextFactQuestion(saved, [], "Test").kind).toBe("ready");
  });
  it("rechecks changed wording even if the old statement was skipped", () => {
    const old = fact("a");
    expect(nextFactQuestion([{ ...old, statement: "A changed detail" }], [factAnswerKey(old)], "Test").kind).toBe("check");
  });
});
