import type { OrganizationWebsiteDraft } from "./structuredData";
import type { ReadinessPageSample } from "./pageSample";

const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const urlKey = (raw: string) => { try { const url = new URL(raw); url.hash = ""; return url.toString().replace(/\/$/, ""); } catch { return ""; } };

/** Exact normalized text/link presence only. This cannot establish rendered visibility or truth. */
export function structuredDataParity(draft: OrganizationWebsiteDraft, pages: readonly ReadinessPageSample[], now = Date.now()) {
  const page = pages.find((sample) => sample.status === "read" && urlKey(sample.url) === urlKey(draft.canonicalUrl));
  const available = Boolean(page && now - page.checkedAt >= 0 && now - page.checkedAt <= 7 * 86_400_000);
  const graph = JSON.parse(draft.jsonLd) as { "@graph": { name?: string; telephone?: string; address?: Record<string, string>; sameAs?: string[] }[] };
  const organization = graph["@graph"][0];
  const text = normalize(page?.visibleText ?? "");
  const containsPhrase = (value: string) => Boolean(normalize(value)) && ` ${text} `.includes(` ${normalize(value)} `);
  const values = [{ field: "Business name", value: organization.name ?? "", found: containsPhrase(organization.name ?? "") }, ...Object.entries(organization.address ?? {}).filter(([field]) => field !== "@type").map(([field, value]) => ({ field, value, found: containsPhrase(value) }))];
  if (organization.telephone) {
    const digits = (value: string) => value.replace(/\D/g, "");
    const candidates = (page?.visibleText ?? "").match(/\+?[\d(][\d ().-]{5,31}\d/g) ?? [];
    values.push({ field: "Public phone", value: organization.telephone, found: candidates.some((value) => digits(value) === digits(organization.telephone!)) });
  }
  for (const profile of organization.sameAs ?? []) values.push({ field: "Profile link", value: profile, found: Boolean(page?.observedLinks?.some((link) => urlKey(link) === urlKey(profile))) });
  return { pageUrl: page?.url ?? null, checkedAt: page?.checkedAt ?? null, method: "static_html_text_and_links" as const, checks: values.map(({ field, value, found }) => ({ field, value, state: available && (field !== "Profile link" || page?.observedLinks !== undefined) ? found ? "matched" as const : "not_found" as const : "unavailable" as const })), limitation: available ? "Text/link presence in fetched HTML does not prove rendered visibility, ownership, truth, rich-result eligibility or completeness. Check the live page before installing." : "No matching page sample from the last seven days. Recheck the exact URL or verify it manually; missing evidence is not a match." };
}
