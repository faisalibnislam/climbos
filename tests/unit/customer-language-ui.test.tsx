import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn(() => vi.fn()) }));
const { CustomerLanguage } = await import("../../src/components/app/plan/PlanSections");
const base = { alternatives: [], objections: [], gaps: [], positioningStatement: "Proposal", confidenceNotes: "Unknown", vocPhrases: [] };

describe("owner customer-language evidence", () => {
  it("shows matched text, its exact source and original read date without claiming customer verification", () => {
    const html = renderToStaticMarkup(createElement(CustomerLanguage, { expert: { ...base, vocPhrases: [{ phrase: "I keep chasing the brief", theme: "handoff", sourceUrl: "https://reviews.example/item?page=2", sourceReadAt: Date.parse("2026-11-14T10:00:00Z"), evidenceStatus: "text_matched" }] } }));
    expect(html).toContain("Text matched");
    expect(html).toContain("Source read 2026-11-14");
    expect(html).toContain("https://reviews.example/item?page=2");
    expect(html).toContain("does not verify the writer is a customer");
    expect(html).toContain("permission to publish a testimonial");
  });
  it("keeps legacy phrases explicitly unchecked and omits unsafe links", () => {
    const html = renderToStaticMarkup(createElement(CustomerLanguage, { expert: { ...base, vocPhrases: [{ phrase: "Old phrase", theme: "workflow", sourceUrl: "javascript:alert(1)" }] } }));
    expect(html).toContain("Not checked");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("Text matched");
  });
  it("explains withheld candidates without equating counts to customers or a lack of demand", () => {
    const html = renderToStaticMarkup(createElement(CustomerLanguage, { expert: { ...base, vocReview: { candidateCount: 3, matchedCount: 0, notMatchedCount: 1, uncheckedCount: 1, businessSiteCount: 1 } } }));
    expect(html).toContain("not found in the read excerpt");
    expect(html).toContain("without enough source evidence");
    expect(html).toContain("These counts describe candidates, not customers");
    expect(html).toContain("No source-matched");
  });
  it("adds no empty panel when no language research exists", () => {
    expect(renderToStaticMarkup(createElement(CustomerLanguage, { expert: undefined }))).toBe("");
  });
});
