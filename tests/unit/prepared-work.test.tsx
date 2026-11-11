import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PreparedWorkSchema, lintPreparedWork } from "../../shared/agents/preparedWork";
import { PreparedWork } from "../../src/components/app/plan/PreparedWork";
import { requireLocalResearch } from "../../convex/localResearch";
import { lintEmbeddedUrls, lintPreparedDrafts } from "../../shared/agents/specs";

const draft = { title: "A useful page introduction", kind: "page_copy" as const, target: "https://business.example/", draft: "A complete proposed introduction built from the supplied product description. No customer results have been claimed.", evidenceRefs: ["https://business.example/"], checksBeforeUse: ["Check that the described workflow works before publishing."], status: "draft" as const };
describe("AI prepares concrete work with a plan", () => {
  it("permits retrieved research references in internal briefs without approving external marketing destinations", () => {
    const input = { task: "Plan a test", brief: "Public research", facts: [], businessWebsite: "https://business.example/", availableSourceUrls: ["https://educator.example/about"] };
    const text = [{ path: "draft", text: "Research reference: https://educator.example/about" }];
    expect(lintEmbeddedUrls(text, input, true)).toEqual([]);
    expect(lintEmbeddedUrls(text, input)).toContainEqual(expect.objectContaining({ rule: "copy_link", severity: "error" }));
    expect(lintEmbeddedUrls([{ path: "draft", text: "https://unread.example/" }], input, true)).toContainEqual(expect.objectContaining({ rule: "copy_link" }));
    expect(lintEmbeddedUrls([{ path: "draft", text: "http://127.0.0.1/admin" }], { ...input, availableSourceUrls: ["http://127.0.0.1/admin"] }, true)).toContainEqual(expect.objectContaining({ rule: "copy_link" }));
  });
  it("allows labelled test scope while blocking invented results in a public draft", () => {
    const input = { task: "Prepare", brief: "No customer metrics supplied", facts: [] };
    expect(lintPreparedDrafts([{ kind: "test_brief", draft: "Planned test scope: 50 visits, an assumption to validate, not an observed result." }], input).filter((issue) => issue.rule === "invented_fact")).toEqual([]);
    expect(lintPreparedDrafts([{ kind: "social_post", draft: "We helped 8500 customers save time." }], input)).toContainEqual(expect.objectContaining({ rule: "invented_fact", path: "preparedWork[0].draft" }));
  });
  it("requires actual bounded draft text and rejects absent evidence", () => {
    expect(PreparedWorkSchema.safeParse(draft).success).toBe(true);
    expect(PreparedWorkSchema.safeParse({ ...draft, draft: "AI will write this" }).success).toBe(false);
    const input = { task: "Prepare", brief: "Public evidence", facts: [], availableSourceUrls: [draft.target] };
    expect(lintPreparedWork([draft], input)).toEqual([]);
    expect(lintPreparedWork([{ ...draft, evidenceRefs: ["fact:0"] }], { ...input, facts: ["First supplied fact"] })).toEqual([]);
    expect(lintPreparedWork([{ ...draft, evidenceRefs: ["fact:1"] }], input)).toContainEqual(expect.objectContaining({ rule: "citation" }));
  });
  it("allows a complete how-to page without expanding short social or pitch drafts", () => {
    const input = { task: "Prepare", brief: "Public evidence", facts: [], availableSourceUrls: [draft.target] };
    const page = { ...draft, draft: "A source-backed instruction. ".repeat(140) };
    expect(PreparedWorkSchema.safeParse(page).success).toBe(true);
    expect(lintPreparedWork([page], input)).toEqual([]);
    expect(lintPreparedWork([{ ...page, kind: "social_post" }], input)).toContainEqual(expect.objectContaining({ rule: "word_cap", severity: "error" }));
    expect(PreparedWorkSchema.safeParse({ ...page, draft: "x".repeat(6001) }).success).toBe(false);
  });
  it("keeps drafts collapsed, clearly unsent, and old plans readable", () => {
    expect(renderToStaticMarkup(createElement(PreparedWork, { work: undefined }))).toBe("");
    const html = renderToStaticMarkup(createElement(PreparedWork, { work: [draft] }));
    expect(html).toContain("AI has prepared"); expect(html).toContain(draft.draft);
    expect(html).not.toContain("<details open"); expect(html).toContain("has not been sent");
    expect(html).not.toContain("<button");
  });
  it("refuses real-data imports on hosted, fixture and misconfigured instances", () => {
    expect(() => requireLocalResearch({ CLIMBOS_LOCAL_REAL_RESEARCH: "true", SITE_URL: "https://climbos.app" })).toThrow(/loopback/);
    expect(() => requireLocalResearch({ CLIMBOS_LOCAL_REAL_RESEARCH: "true", SITE_URL: "http://127.0.0.1:3430", CLIMBOS_FAKE_LLM: "ship" })).toThrow(/loopback/);
    expect(() => requireLocalResearch({ CLIMBOS_LOCAL_REAL_RESEARCH: "true", SITE_URL: "http://127.0.0.1:3430" })).not.toThrow();
  });
});

it("rejects unboxed placeholder paths in a plan's social copy", () => {
  const input = { task: "Plan a test", brief: "Public sources", facts: [], businessWebsite: "https://business.example/" };
  const issues = lintPreparedDrafts([{ kind: "social_post", draft: "Read our guide: https://business.example/GUIDE-ADDRESS?utm_source=reddit" }], input);
  expect(issues).toContainEqual(expect.objectContaining({ severity: "error", rule: "generic_action" }));
  expect(lintPreparedDrafts([{ kind: "social_post", draft: "Read the guide: GUIDE-URL?utm_source=social" }], input)).toContainEqual(expect.objectContaining({ severity: "error", rule: "generic_action" }));
});
