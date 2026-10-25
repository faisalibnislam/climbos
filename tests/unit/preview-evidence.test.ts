import { describe, expect, it } from "vitest";
import { PreviewSnapshotSchema } from "../../shared/ai/tasks";
import { isVerbatimPageQuote } from "../../shared/preview/evidence";

describe("source-quoted first-look observations", () => {
  it("accepts an exact page quote while tolerating extracted whitespace changes", () => {
    expect(isVerbatimPageQuote("A clear benefit for small teams.", "Headline\nA clear benefit   for small teams.\nMore details" )).toBe(true);
  });

  it("rejects invented, overly short, and overlong evidence quotes", () => {
    const page = "Headline A clear benefit for small teams. More details";
    expect(isVerbatimPageQuote("A clear benefit for busy teams.", page)).toBe(false);
    expect(isVerbatimPageQuote("small", page)).toBe(false);
    expect(isVerbatimPageQuote("A".repeat(301), `${"A".repeat(301)}`)).toBe(false);
  });

  it("requires the preview model schema to return either a complete finding or an explicit null", () => {
    const snapshot = {
      name: "Example",
      oneLineSummary: "A business described on its homepage.",
      businessType: "services" as const,
      audience: "Page visitors",
      category: "services",
      facts: [],
      brandVoice: "Clear",
      suggestedSuccessEvents: [],
    };
    expect(PreviewSnapshotSchema.safeParse({ ...snapshot, initialFinding: null }).success).toBe(true);
    expect(PreviewSnapshotSchema.safeParse({ ...snapshot, initialFinding: { observation: "A possible issue" } }).success).toBe(false);
  });
});
