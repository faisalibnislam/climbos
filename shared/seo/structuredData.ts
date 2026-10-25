export type OrganizationWebsiteInput = {
  name: string;
  website: string;
  visibleNameConfirmed: boolean;
};

export type OrganizationWebsiteDraft = {
  jsonLd: string;
  scriptTag: string;
  canonicalUrl: string;
  checks: { id: string; passed: boolean; message: string }[];
};

/**
 * Build a deliberately small, owner-confirmed JSON-LD draft. It contains no
 * ratings, reviews, prices, locations, or other facts not supplied here.
 * This function does not publish markup or determine search feature eligibility.
 */
export function createOrganizationWebsiteDraft(input: OrganizationWebsiteInput): OrganizationWebsiteDraft | null {
  const name = input.name.trim();
  if (!name || name.length > 160 || !input.visibleNameConfirmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(input.website.trim());
  } catch {
    return null;
  }
  if (!(["http:", "https:"].includes(parsed.protocol)) || parsed.username || parsed.password) return null;
  parsed.search = "";
  parsed.hash = "";
  const canonicalUrl = parsed.toString().replace(/\/$/, "") || `${parsed.protocol}//${parsed.host}`;

  const organizationId = `${canonicalUrl}/#organization`;
  const websiteId = `${canonicalUrl}/#website`;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": organizationId, name, url: canonicalUrl },
      { "@type": "WebSite", "@id": websiteId, url: canonicalUrl, name, publisher: { "@id": organizationId } },
    ],
  };
  const jsonLd = JSON.stringify(graph, null, 2);
  const scriptTag = `<script type="application/ld+json">\n${jsonLd.replace(/</g, "\\u003c")}\n</script>`;
  return {
    jsonLd,
    scriptTag,
    canonicalUrl,
    checks: [
      { id: "name-confirmed", passed: true, message: "The owner confirmed this name is visible on the page." },
      { id: "url-http", passed: true, message: "The URL uses HTTP or HTTPS and contains no embedded credentials." },
      { id: "no-unsupported-claims", passed: true, message: "The draft contains no review, rating, price, address, or performance claims." },
    ],
  };
}
