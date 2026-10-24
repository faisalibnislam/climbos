import { describe, expect, it } from "vitest";
import library from "@shared/knowledge/growthLibrary.generated.json";
import { growthKnowledgeContext, retrieveGrowthKnowledge } from "@shared/knowledge/retrieve";

describe("growth intelligence retrieval", () => {
  it("indexes the committed books and reference playbooks with their source hashes", () => {
    expect(library.edition).toBe("October 2026");
    expect(library.records.filter((record) => record.kind === "playbook")).toHaveLength(28);
    expect(library.records.some((record) => record.kind === "chapter" && record.bookId === "14")).toBe(true);
    expect(library.records.every((record) => /^[a-f0-9]{64}$/u.test(record.sha256))).toBe(true);
  });

  it("retrieves relevant chapters for the actual task rather than attaching the full corpus", () => {
    const records = retrieveGrowthKnowledge("B2B SaaS activation onboarding retention cohort", { limit: 3, maxChars: 1800 });
    expect(records.length).toBeGreaterThan(0);
    expect(records.length).toBeLessThanOrEqual(3);
    expect(records.some((record) => /activation|retention|onboarding|cohort/iu.test(`${record.heading} ${record.content}`))).toBe(true);
    expect(records.map((record) => record.id)).toEqual([...records.map((record) => record.id)].sort((a, b) => {
      const left = records.find((record) => record.id === a)!;
      const right = records.find((record) => record.id === b)!;
      return right.score - left.score || a.localeCompare(b);
    }));
  });

  it("marks retrieved material as reference guidance and enforces a bounded context", () => {
    const context = growthKnowledgeContext("SaaS onboarding activation", { limit: 2, maxChars: 900 });
    expect(context).toContain("reference guidance");
    expect(context).toContain("docs/growth-intelligence/");
    expect(context.length).toBeLessThan(1800);
    expect(growthKnowledgeContext("", { maxChars: 500 })).toBe("");
  });
});
