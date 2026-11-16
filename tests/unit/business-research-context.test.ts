import { describe, expect, it } from "vitest";
import { businessResearchContext } from "../../shared/ai/tasks";

function payload(text: string): Record<string, unknown> {
  return JSON.parse(text.match(/<untrusted_content source="business research">\s*([\s\S]*?)\s*<\/untrusted_content>/)![1]);
}

describe("business research context", () => {
  it("uses persisted expert fields, preserves provenance and never approves a research proposal", () => {
    const expert = { positioningStatement: "Proposed niche", confidenceNotes: "One source, uncertain fit", vocPhrases: [{ phrase: "Useful for my workflow", theme: "usefulness", sourceUrl: "https://source.example/review" }], objections: [{ objection: "Unknown migration effort", counter: "Proposed trial", sourceUrl: "https://source.example/review" }], siteAssessment: [{ evidenceQuote: "Prepare a brief", sourceUrl: "https://business.example/" }] };
    const nested = { positioning: "Category position", expert, generatedAt: 123456, unrelatedPrivateNote: "Do not copy this" };
    const context = businessResearchContext(nested);
    expect(payload(context)).toEqual({ ...expert, positioning: nested.positioning, generatedAt: 123456 });
    expect(context).not.toContain("Do not copy this");
    expect(context).toContain("not approved offer terms");
    expect(context).toContain("not verified testimonials");
    expect(context).toContain("not a source retrieval or verification date");
    expect(context).toContain("grants no permission to send, publish or spend");
    expect(payload(businessResearchContext({ ...expert, positioning: nested.positioning, generatedAt: 123456 }))).toEqual(payload(context));
  });

  it("honors explicit flat fields, including cleared arrays, without reviving nested candidates", () => {
    const result = payload(businessResearchContext({ positioningStatement: "Current proposal", vocPhrases: [], expert: { positioningStatement: "Old proposal", vocPhrases: [{ phrase: "Old phrase" }] } }));
    expect(result).toMatchObject({ positioningStatement: "Current proposal", vocPhrases: [], generatedAt: null });
    expect(JSON.stringify(result)).not.toContain("Old");
  });

  it.each([undefined, -1, NaN, Infinity, "2026-11-16"])("keeps invalid or absent generation time unknown: %s", generatedAt => {
    expect(payload(businessResearchContext({ positioning: "Proposed", generatedAt })).generatedAt).toBeNull();
  });

  it("bounds large context without clipping quotations, detaching sources, or mutating saved research", () => {
    const phrases = Array.from({ length: 40 }, (_, i) => ({ phrase: `${i}: ${"Complete reported phrase. ".repeat(15)}`, theme: "workflow", sourceUrl: `https://source.example/review/${i}` }));
    const insights = { positioning: "Test a clearer brief", expert: { vocPhrases: phrases, confidenceNotes: "Convenience sample, not representative" } };
    const before = JSON.stringify(insights);
    const text = businessResearchContext(insights);
    const result = payload(text);
    expect(text).toContain("CONTEXT LIMIT:");
    expect(text).toContain("unknown, not evidence of absence");
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(8000);
    expect((result.vocPhrases as unknown[]).length).toBeGreaterThan(0);
    for (const row of result.vocPhrases as unknown[]) expect(phrases).toContainEqual(row);
    expect(JSON.stringify(insights)).toBe(before);
  });

  it("omits oversized indivisible evidence instead of manufacturing a shortened quotation", () => {
    const result = businessResearchContext({ expert: { vocPhrases: [{ phrase: "Long phrase ".repeat(1000), sourceUrl: "https://source.example/review" }], confidenceNotes: "Only one source" } });
    expect(payload(result).vocPhrases).toEqual([]);
    expect(result).toContain("CONTEXT LIMIT:");
    expect(result).not.toContain("Long phrase");
  });

  it("ignores absent or malformed expert records", () => {
    for (const insights of [undefined, {}, { expert: "not research" }, { expert: [] }, { expert: null }]) expect(businessResearchContext(insights)).toBe("");
  });
});
