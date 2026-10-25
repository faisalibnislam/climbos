export type LocalBusinessInput = {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  /** ISO 3166-1 alpha-2 country code. */
  addressCountry?: string;
  telephone?: string;
  /** The owner checked that the address and phone above are visible on the page. */
  visibleDetailsConfirmed: boolean;
};

export type OrganizationWebsiteInput = {
  name: string;
  website: string;
  visibleNameConfirmed: boolean;
  /** Optional: mark the organization up as a LocalBusiness with owner-typed, page-visible contact details. */
  localBusiness?: LocalBusinessInput;
  /** Optional: the business's own public profiles (HTTPS), which the owner confirmed belong to it. */
  sameAs?: string[];
  sameAsConfirmed?: boolean;
};

export type OrganizationWebsiteDraft = {
  jsonLd: string;
  scriptTag: string;
  canonicalUrl: string;
  checks: { id: string; passed: boolean; message: string }[];
};

const clean = (s: string | undefined, max: number) => {
  const v = (s ?? "").trim().replace(/\s+/g, " ");
  return v && v.length <= max ? v : "";
};

function httpsProfile(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Build a deliberately small, owner-confirmed JSON-LD draft. It contains no ratings, reviews, prices, opening
 * hours, or other facts not supplied here; address, phone and profiles appear only with their own confirmation.
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

  const lb = input.localBusiness;
  const local = lb?.visibleDetailsConfirmed ? (() => {
    const country = clean(lb.addressCountry, 2).toUpperCase();
    const telephone = clean(lb.telephone, 32);
    const address = {
      ...(clean(lb.streetAddress, 160) ? { streetAddress: clean(lb.streetAddress, 160) } : {}),
      ...(clean(lb.addressLocality, 80) ? { addressLocality: clean(lb.addressLocality, 80) } : {}),
      ...(clean(lb.addressRegion, 80) ? { addressRegion: clean(lb.addressRegion, 80) } : {}),
      ...(clean(lb.postalCode, 20) ? { postalCode: clean(lb.postalCode, 20) } : {}),
      ...(/^[A-Z]{2}$/.test(country) ? { addressCountry: country } : {}),
    };
    return {
      ...(Object.keys(address).length ? { address: { "@type": "PostalAddress", ...address } } : {}),
      ...(/^\+?[0-9 ().-]{6,32}$/.test(telephone) ? { telephone } : {}),
    };
  })() : null;
  const sameAs = input.sameAsConfirmed ? [...new Set((input.sameAs ?? []).map(httpsProfile).filter((u): u is string => Boolean(u)))].slice(0, 10) : [];

  const organizationId = `${canonicalUrl}/#organization`;
  const websiteId = `${canonicalUrl}/#website`;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": local ? "LocalBusiness" : "Organization", "@id": organizationId, name, url: canonicalUrl, ...(local ?? {}), ...(sameAs.length ? { sameAs } : {}) },
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
      ...(local ? [{ id: "local-details-confirmed", passed: true, message: "The owner confirmed the address and phone are visible on the page." }] : []),
      ...(sameAs.length ? [{ id: "profiles-confirmed", passed: true, message: "The owner confirmed these profiles belong to the business." }] : []),
      { id: "no-unsupported-claims", passed: true, message: `The draft contains no review, rating, price, opening-hours or performance claims${local ? "" : ", and no address"}.` },
    ],
  };
}
