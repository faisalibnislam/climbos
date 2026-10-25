import { describe, expect, it } from "vitest";
import { CREATIVE_PRECEDENTS, formatCreativePrecedents, retrieveCreativePrecedents } from "../../shared/knowledge/creativePrecedents";

describe("creative strategy precedent retrieval", () => {
  it("keeps the verified corpus honest and each case source-backed", () => {
    expect(CREATIVE_PRECEDENTS).toHaveLength(4);
    for (const precedent of CREATIVE_PRECEDENTS) {
      expect(precedent.sources.length).toBeGreaterThan(0);
      expect(precedent.sources.every((source) => /^https:\/\//.test(source.url) && source.supports.length > 10)).toBe(true);
      expect(precedent.causalLimit.length).toBeGreaterThan(30);
      expect(precedent.reversibleTest.length).toBeGreaterThan(20);
    }
  });

  it("retrieves a character-design mechanism across industries instead of matching industry names", () => {
    const matches = retrieveCreativePrecedents("small business distinctive mascot identity customer recall visual constraints");
    expect(matches[0]?.precedent.id).toBe("CP-004");
    expect(formatCreativePrecedents("small business distinctive mascot identity customer recall visual constraints")).toContain("Nintendo");
  });

  it("retrieves a product-prototyping mechanism from mechanism language", () => {
    expect(retrieveCreativePrecedents("prototype an unusual product feature with a small group of customers")[0]?.precedent.id).toBe("CP-003");
  });

  it("does not force a weak analogy when customer and constraint evidence are absent", () => {
    expect(retrieveCreativePrecedents("")).toEqual([]);
    expect(formatCreativePrecedents("")).toContain("No sufficiently relevant sourced creative precedent");
  });
});
