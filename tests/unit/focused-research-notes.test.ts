import { afterEach, expect, it, vi } from "vitest";
import { focusedResearchNotes } from "../../convex/lib/focusedResearch";

afterEach(() => vi.restoreAllMocks());

it("preserves conflicting page and summary claims with separate dates and source classes", () => {
  const notes = focusedResearchNotes([{ url: "https://business.example/help", excerpt: "Published new rule: automation excluded.", fetchedAt: Date.parse("2026-11-18T01:00:00Z") }], [{ notes: "Older inferred rule: automation may be included.", retrievedAt: Date.parse("2026-11-17T01:00:00Z") }]);
  expect(notes).toContain("Published new rule: automation excluded.");
  expect(notes).toContain("Older inferred rule: automation may be included.");
  expect(notes).toContain("2026-11-18T01:00:00.000Z");
  expect(notes).toContain("2026-11-17T01:00:00.000Z");
  expect(notes).toContain("Keep conflicting records distinguishable");
  expect(notes).toContain("not a publication date");
  expect(notes).toContain("not a fresh page read");
});

it("retains the 30000-character ceiling with visible omission markers and room for both source classes", () => {
  const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const notes = focusedResearchNotes([{ url: "https://business.example/", excerpt: "Page claim. ".repeat(3000), fetchedAt: 0 }], [{ notes: "Cached claim. ".repeat(4000) }]);
  expect(notes.length).toBeLessThanOrEqual(30000);
  expect(notes).toContain("Page claim.");
  expect(notes).toContain("Cached claim.");
  expect(notes.match(/more characters not shown/g)).toHaveLength(2);
  expect(log).toHaveBeenCalledTimes(2);
});

it("never invents missing text or a retrieval date, and leaves input records untouched", () => {
  const pages = [{ url: "https://business.example/", fetchedAt: NaN }], cached = [{ notes: "Existing summary" }];
  const notes = focusedResearchNotes(pages, cached);
  expect(notes.match(/Retrieved unknown/g)).toHaveLength(2);
  expect(notes).toContain("No page text retained");
  expect(pages).toEqual([{ url: "https://business.example/", fetchedAt: NaN }]);
  expect(cached).toEqual([{ notes: "Existing summary" }]);
  expect(focusedResearchNotes([], cached)).toContain("Existing summary");
});
