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

describe("LocalBusiness and profile links", () => {
  const base = { name: "Corner Bakery", website: "https://cornerbakery.example", visibleNameConfirmed: true };

  it("adds owner-confirmed address, phone and profiles, and keeps unconfirmed details out", () => {
    const draft = createOrganizationWebsiteDraft({
      ...base,
      localBusiness: { streetAddress: " 12  High Street ", addressLocality: "Leeds", postalCode: "LS1 1AA", addressCountry: "gb", telephone: "+44 113 496 0000", visibleDetailsConfirmed: true },
      sameAs: ["https://www.instagram.com/cornerbakery", "https://www.instagram.com/cornerbakery#x", "http://insecure.example/profile", "not a url"],
      sameAsConfirmed: true,
    })!;
    const org = JSON.parse(draft.jsonLd)["@graph"][0];
    expect(org).toMatchObject({ "@type": "LocalBusiness", telephone: "+44 113 496 0000", address: { "@type": "PostalAddress", streetAddress: "12 High Street", addressLocality: "Leeds", postalCode: "LS1 1AA", addressCountry: "GB" } });
    expect(org.sameAs).toEqual(["https://www.instagram.com/cornerbakery"]);
    expect(draft.checks.map((c) => c.id)).toEqual(expect.arrayContaining(["local-details-confirmed", "profiles-confirmed"]));
    expect(draft.jsonLd).not.toMatch(/rating|review|price|openingHours/i);

    const unconfirmed = JSON.parse(createOrganizationWebsiteDraft({ ...base, localBusiness: { streetAddress: "12 High Street", telephone: "+44 113 496 0000", visibleDetailsConfirmed: false }, sameAs: ["https://www.instagram.com/cornerbakery"], sameAsConfirmed: false })!.jsonLd)["@graph"][0];
    expect(unconfirmed).toEqual({ "@type": "Organization", "@id": "https://cornerbakery.example/#organization", name: "Corner Bakery", url: "https://cornerbakery.example" });
  });

  it("drops a malformed phone or country rather than guessing", () => {
    const org = JSON.parse(createOrganizationWebsiteDraft({ ...base, localBusiness: { addressLocality: "Leeds", addressCountry: "United Kingdom", telephone: "call us", visibleDetailsConfirmed: true } })!.jsonLd)["@graph"][0];
    expect(org.telephone).toBeUndefined();
    expect(org.address).toEqual({ "@type": "PostalAddress", addressLocality: "Leeds" });
  });
});
