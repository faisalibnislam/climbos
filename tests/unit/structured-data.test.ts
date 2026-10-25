import { describe, expect, it } from "vitest";
import { createOrganizationWebsiteDraft } from "@shared/seo/structuredData";

describe("owner-confirmed structured-data drafts", () => {
  it("creates minimal Organization and WebSite JSON-LD from confirmed visible facts", () => {
    const draft = createOrganizationWebsiteDraft({ name: "ClimbOS", website: "https://example.com/?campaign=x#top", visibleNameConfirmed: true });
    expect(draft).not.toBeNull();
    expect(draft?.canonicalUrl).toBe("https://example.com");
    const parsed = JSON.parse(draft!.jsonLd);
    expect(parsed["@graph"]).toEqual([
      { "@type": "Organization", "@id": "https://example.com/#organization", name: "ClimbOS", url: "https://example.com" },
      { "@type": "WebSite", "@id": "https://example.com/#website", url: "https://example.com", name: "ClimbOS", publisher: { "@id": "https://example.com/#organization" } },
    ]);
    expect(draft?.checks.every((check) => check.passed)).toBe(true);
  });

  it("requires visible-name confirmation and rejects unsafe or malformed URLs", () => {
    expect(createOrganizationWebsiteDraft({ name: "Example", website: "https://example.com", visibleNameConfirmed: false })).toBeNull();
    expect(createOrganizationWebsiteDraft({ name: "Example", website: "javascript:alert(1)", visibleNameConfirmed: true })).toBeNull();
    expect(createOrganizationWebsiteDraft({ name: "Example", website: "https://user:secret@example.com", visibleNameConfirmed: true })).toBeNull();
  });

  it("escapes script-breaking characters and does not add unsupported commercial claims", () => {
    const draft = createOrganizationWebsiteDraft({ name: "Example </script><img src=x>", website: "https://example.com", visibleNameConfirmed: true });
    expect(draft?.scriptTag).not.toContain("</script><img");
    expect(draft?.scriptTag).toContain("\\u003c/script>");
    expect(draft?.jsonLd).not.toMatch(/rating|review|price|address|revenue/i);
  });

  it("rejects empty and oversized organization names", () => {
    expect(createOrganizationWebsiteDraft({ name: "  ", website: "https://example.com", visibleNameConfirmed: true })).toBeNull();
    expect(createOrganizationWebsiteDraft({ name: "x".repeat(161), website: "https://example.com", visibleNameConfirmed: true })).toBeNull();
  });
});
