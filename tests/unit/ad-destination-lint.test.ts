import { describe, expect, it } from "vitest";
import { adsSpec, lintEmbeddedUrls } from "../../shared/agents/specs";
import type { AgentInput } from "../../shared/agents/types";

const base: AgentInput = {
  task: "Draft one Google search ad.",
  brief: "",
  facts: [],
  businessWebsite: "https://example.com",
};

function destinationIssues(finalUrl: string, input: AgentInput = base) {
  const output = {
    searchAds: [{ headlines: [], descriptions: [], keywords: [], finalUrl, angle: "Clear service booking", paths: [], negativeKeywords: [], landingPageMatch: "" }],
    metaAds: [{ primaryText: "", headline: "", description: "", imageIdea: "", audience: "", concept: "", angle: "Simple weekly service planning", format: "image", creativeBrief: "" }],
    budgetNote: "",
    factIndexes: [],
  };
  return adsSpec().lint!(output as never, input).filter((issue) => issue.rule === "ad_destination");
}

describe("ad destination validation", () => {
  it("allows the business site and its subdomains", () => {
    expect(destinationIssues("https://www.example.com/pricing")).toEqual([]);
    expect(destinationIssues("https://shop.example.com/products/item")).toEqual([]);
  });

  it("rejects unrelated or malformed destinations", () => {
    expect(destinationIssues("https://lookalike-example.com")).toMatchObject([{ path: "searchAds[0].finalUrl" }]);
    expect(destinationIssues("javascript:alert(1)")).toMatchObject([{ rule: "ad_destination" }]);
    expect(destinationIssues("https://user:pass@example.com")).toMatchObject([{ rule: "ad_destination" }]);
    expect(destinationIssues("http://example.com")).toMatchObject([{ rule: "ad_destination" }]);
  });

  it("allows an exact external URL supplied in the owner's request", () => {
    const input = { ...base, ownerSuppliedUrls: ["https://booking.example.net/consultation"] };
    expect(destinationIssues("https://booking.example.net/consultation", input)).toEqual([]);
  });

  it("requires a known destination when neither a URL nor website is supplied", () => {
    expect(destinationIssues("", { ...base, businessWebsite: undefined })).toMatchObject([{ rule: "ad_destination" }]);
    expect(destinationIssues("", base)).toEqual([]); // the artifact builder falls back to the business website
  });

  it("checks embedded campaign links and uses only owner-supplied external URLs as approval", () => {
    expect(lintEmbeddedUrls([{ path: "emails[0].body", text: "Book at https://example.com/book" }], base)).toEqual([]);
    expect(lintEmbeddedUrls([{ path: "emails[0].body", text: "Book at https://booking.example.net/consultation" }], base)).toMatchObject([{ rule: "copy_link" }]);
    expect(lintEmbeddedUrls([{ path: "emails[0].body", text: "Book at https://booking.example.net/consultation" }], { ...base, ownerSuppliedUrls: ["https://booking.example.net/consultation"] })).toEqual([]);
    expect(lintEmbeddedUrls([{ path: "emails[0].body", text: "Visit http://example.com/book" }], base)).toMatchObject([{ rule: "copy_link" }]);
  });
});
