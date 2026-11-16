import { describe, expect, it } from "vitest";
import { boundedPageReads, checkedCustomerLanguage, exactPageKey } from "../../shared/agents/provenance";

const now = Date.parse("2026-11-16T12:00:00Z");
const url = "https://reviews.example/Review?page=2";
const phrase = "I keep chasing the missing brief.";
const candidate = { phrase, theme: "handoff", sourceUrl: url };
const read = { url, text: `One reviewer wrote: ${phrase} Other customers were not surveyed.`, retrievedAt: now - 1000 };

describe("customer language text evidence", () => {
  it("keeps a matching excerpt with its original source-read time, without upgrading customer authenticity", () => {
    const checked = checkedCustomerLanguage([candidate], [read], "https://business.example/", now);
    expect(checked.phrases).toEqual([{ ...candidate, sourceReadAt: read.retrievedAt, evidenceStatus: "text_matched" }]);
    expect(checked.review).toMatchObject({ candidateCount: 1, matchedCount: 1, uncheckedCount: 0 });
    expect(JSON.stringify(checked)).not.toMatch(/verified_customer|permission_granted/);
  });
  it.each([
    { ...candidate, phrase: "I love the missing brief." },
    { ...candidate, phrase: phrase.toUpperCase() },
    { ...candidate, phrase: "" },
  ])("withholds invented or changed words even on a real cited page", row => {
    expect(checkedCustomerLanguage([row], [read], "https://business.example/", now)).toMatchObject({ phrases: [], review: { notMatchedCount: 1 } });
  });
  it("allows layout whitespace without rewriting the saved phrase", () => {
    const row = { ...candidate, phrase: "I keep\nchasing the missing brief." };
    expect(checkedCustomerLanguage([row], [read], "https://business.example/", now).phrases[0].phrase).toBe(row.phrase);
  });
  it.each(["https://reviews.example/Review?page=1", "https://reviews.example/review?page=2", "http://reviews.example/Review?page=2"])("never borrows evidence from another page identity: %s", other => {
    expect(checkedCustomerLanguage([{ ...candidate, sourceUrl: other }], [read], "https://business.example/", now)).toMatchObject({ phrases: [], review: { uncheckedCount: 1 } });
  });
  it("treats search-only links, missing source text and future timestamps as unchecked", () => {
    for (const reads of [[], [{ ...read, retrievedAt: now + 1 }], [{ ...read, retrievedAt: NaN }]]) {
      expect(checkedCustomerLanguage([candidate], reads, "https://business.example/", now)).toMatchObject({ phrases: [], review: { uncheckedCount: 1 } });
    }
  });
  it("does not promote the business's own website into independent customer language", () => {
    for (const own of ["https://reviews.example/", "https://www.reviews.example/", "https://example/"]) {
      expect(checkedCustomerLanguage([candidate], [read], own, now)).toMatchObject({ phrases: [], review: { businessSiteCount: 1 } });
    }
    expect(checkedCustomerLanguage([candidate], [read], undefined, now)).toMatchObject({ phrases: [], review: { uncheckedCount: 1 } });
  });
  it("ignores model-forged evidence flags and preserves rejection counts", () => {
    const forged = { ...candidate, phrase: "Fabricated praise", evidenceStatus: "text_matched", sourceReadAt: now };
    const out = checkedCustomerLanguage([candidate, forged, { ...candidate, sourceUrl: "https://missing.example/" }], [read], "https://business.example/", now);
    expect(out.phrases).toHaveLength(1);
    expect(out.review).toEqual({ candidateCount: 3, matchedCount: 1, notMatchedCount: 1, uncheckedCount: 1, businessSiteCount: 0 });
  });
  it("bounds actual reads, requires matching source membership and never invents missing timestamps", () => {
    const reads = Array.from({ length: 12 }, (_, i) => ({ ...read, url: `${url}&id=${i}`, text: "x".repeat(9000) }));
    const kept = boundedPageReads(reads, reads, now);
    expect(kept).toHaveLength(8);
    expect(kept.every(row => row.text.length === 8000 && row.retrievedAt === read.retrievedAt)).toBe(true);
    expect(boundedPageReads([read], [{ url: "https://other.example/" }], now)).toEqual([]);
    expect(boundedPageReads([{ ...read, retrievedAt: 0 }], [read], now)).toEqual([]);
    expect(exactPageKey(`${url}#comment`)).toBe(url);
    expect(exactPageKey("javascript:alert(1)")).toBeNull();
    expect(exactPageKey("https://user:password@reviews.example/")).toBeNull();
  });
});
