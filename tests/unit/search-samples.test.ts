import { describe, expect, it } from "vitest";
import { addSampleLinkFindings, type ReadinessPageSample } from "../../shared/seo/pageSample";
import { structuredDataParity } from "../../shared/seo/structuredDataParity";
import { createOrganizationWebsiteDraft } from "../../shared/seo/structuredData";
const now = Date.UTC(2026, 10, 9);
const sample = (url: string, links: string[] = []): ReadinessPageSample => ({ url, status: "read", checkedAt: now, visibleText: "Example Tools +1 (212) 555-0123", internalLinks: links, observedLinks: ["https://www.youtube.com/@example"], findings: [] });
describe("bounded search evidence", () => {
  it("checks the exact fresh page and observed external profiles without inventing visibility", () => {
    const draft = createOrganizationWebsiteDraft({ name: "Example Tools", website: "https://example.com/", visibleNameConfirmed: true, sameAsConfirmed: true, sameAs: ["https://www.youtube.com/@example"] })!;
    const result = structuredDataParity(draft, [sample("https://example.com/")], now);
    expect(result.checks.map((x) => x.state)).toEqual(["matched", "matched"]);
    expect(structuredDataParity(draft, [{ ...sample("https://example.com/"), visibleText: "Example Toolsmith" }], now).checks[0].state).toBe("not_found");
    expect(result.limitation).toContain("does not prove rendered visibility");
    expect(structuredDataParity(draft, [sample("https://example.com/about")], now).checks.every((x) => x.state === "unavailable")).toBe(true);
    expect(structuredDataParity(draft, [sample("https://example.com/")], now + 8 * 86400000).checks.every((x) => x.state === "unavailable")).toBe(true);
    expect(structuredDataParity(draft, [{ ...sample("https://example.com/"), observedLinks: undefined }], now).checks.at(-1)?.state).toBe("unavailable");
  });
  it("flags only absent incoming links in the sample, excluding blocked pages", () => {
    const pages = addSampleLinkFindings([sample("https://example.com/", ["https://example.com/pricing#plans"]), sample("https://example.com/pricing"), sample("https://example.com/about"), { ...sample("https://example.com/private"), status: "blocked_by_robots" }]);
    expect(pages.map((p) => p.findings.length)).toEqual([0, 0, 1, 0]);
    expect(pages[2].findings[0].evidence).toContain("elsewhere on the site are not known");
  });
});
