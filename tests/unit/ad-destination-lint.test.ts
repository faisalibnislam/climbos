import { describe, expect, it } from "vitest";
import { adsSpec } from "../../shared/agents/specs";
import type { AgentInput } from "../../shared/agents/types";

const base: AgentInput = {
  task: "Draft one Google search ad.",
  brief: "",
  facts: [],
  businessWebsite: "https://example.com",
};

function destinationIssues(finalUrl: string, input: AgentInput = base) {
  const output = {
    searchAds: [{ headlines: [], descriptions: [], keywords: [], finalUrl, paths: [], negativeKeywords: [], landingPageMatch: "" }],
    metaAds: [{ primaryText: "", headline: "", description: "", imageIdea: "", audience: "", concept: "", angle: "", format: "image", creativeBrief: "" }],
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

  it("allows an exact external URL supplied in the task", () => {
    const input = { ...base, task: "Send visitors to https://booking.example.net/consultation for booking." };
    expect(destinationIssues("https://booking.example.net/consultation", input)).toEqual([]);
  });

  it("requires a known destination when neither a URL nor website is supplied", () => {
    expect(destinationIssues("", { ...base, businessWebsite: undefined })).toMatchObject([{ rule: "ad_destination" }]);
    expect(destinationIssues("", base)).toEqual([]); // the artifact builder falls back to the business website
  });
});
