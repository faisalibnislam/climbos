import { describe, expect, it } from "vitest";
import library from "@shared/knowledge/growthLibrary.generated.json";
import { formatGrowthKnowledge, growthKnowledgeContext, knowledgeReferenceSet, retrieveGrowthKnowledge } from "@shared/knowledge/retrieve";
import { sourceFreshness } from "@shared/knowledge/freshness";

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

  it("exports hash-addressed references without copying knowledge text or relevance scores", () => {
    const records = retrieveGrowthKnowledge("SaaS onboarding activation", { limit: 2, maxChars: 900 });
    const references = knowledgeReferenceSet(records);
    expect(references.edition).toBe(library.edition);
    expect(references.researchCutoff).toBe(library.researchCutoff);
    expect(references.records).toHaveLength(records.length);
    expect(references.records[0]).toMatchObject({ id: records[0].id, sha256: records[0].sha256, path: records[0].path });
    expect(references.records[0]).not.toHaveProperty("content");
    expect(references.records[0]).not.toHaveProperty("score");
    expect(formatGrowthKnowledge(records)).toContain("reference guidance, not business evidence");
  });

  it("carries dated source-registry citations with retrieved guidance and plan references", () => {
    const records = retrieveGrowthKnowledge("distinctive activities strategic fit trade-offs", { limit: 3, maxChars: 3_500 });
    const cited = records.find((record) => record.sources.length > 0);
    expect(cited?.sources[0]).toMatchObject({ registryId: expect.stringMatching(/^SRC-/u), retrievedAt: "2026-10-19" });
    expect(cited?.sources[0].claims[0]).toMatchObject({ sourceId: expect.stringMatching(/^B01-/u), scope: expect.any(String), verificationStatus: expect.any(String) });
    const context = formatGrowthKnowledge(records);
    expect(context).toContain("Sources (general guidance only)");
    expect(context).toContain("A registry retrieval date records a check");
    const references = knowledgeReferenceSet(records);
    expect(references.records.find((record) => record.sources.length > 0)?.sources[0]).toMatchObject({
      registryId: expect.stringMatching(/^SRC-/u),
      freshness: { status: expect.any(String), checkedAt: "2026-10-19T00:00:00.000Z" },
    });
  });

  it("marks weekly official sources for recheck and search-index-only sources for direct review", () => {
    const checkedRecently = sourceFreshness({ url: "https://docs.convex.dev/functions/actions", retrieved_at: "2026-10-19", records: [{ verification_status: "verified_primary_page" }] }, Date.parse("2026-10-24T00:00:00Z"));
    expect(checkedRecently).toMatchObject({ status: "checked_recently", cadenceDays: 7, directPageRead: true, nextCheckAt: "2026-10-26T00:00:00.000Z" });
    const due = sourceFreshness({ url: "https://docs.convex.dev/functions/actions", retrieved_at: "2026-10-19", records: [{ verification_status: "verified_primary_page" }] }, Date.parse("2026-10-27T00:00:00Z"));
    expect(due.status).toBe("recheck_due");
    const searchOnly = sourceFreshness({ url: "https://developers.facebook.com/documentation/pages-api.md/", retrieved_at: "2026-10-19", records: [{ verification_status: "primary_search_index_only" }] }, Date.parse("2026-10-20T00:00:00Z"));
    expect(searchOnly).toMatchObject({ status: "direct_check_required", nextCheckAt: null, directPageRead: false });
    const stable = sourceFreshness({ url: "https://www.isc.hbs.edu/strategy/creating-a-successful-strategy/Pages/default.aspx", retrieved_at: "2026-10-19", records: [{ verification_status: "verified_primary_page" }] }, Date.parse("2026-10-27T00:00:00Z"));
    expect(stable.status).toBe("not_scheduled");
  });
});
