"use node";

import { lookup } from "node:dns/promises";
import { v } from "convex/values";
import { checkPublicLinks, extractPageContent, safeFetchPage, validateResearchUrl } from "../shared/integrations/website";
import { offerDestinationStatus } from "../shared/integrations/offerDestination";
import { internalAction } from "./_generated/server";

const resolveHost = async (hostname: string) => (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);

/** Public-link check used only after a social artifact's exact approval has been verified. */
export const check = internalAction({
  args: { urls: v.array(v.string()) },
  handler: async (_ctx, { urls }) => checkPublicLinks(urls, { resolveHost, timeoutMs: 5_000 }),
});

/** Bounded read of a link destination to see whether any approved offer price still appears (warning only). */
export const checkOfferDestination = internalAction({
  args: { url: v.string(), prices: v.array(v.number()) },
  handler: async (_ctx, { url, prices }) => {
    const validated = validateResearchUrl(url);
    if (!validated.ok || !validated.url.startsWith("https:")) return { status: "unavailable" as const, found: [] as number[] };
    const response = await safeFetchPage({ url: validated.url, resolveHost, maxBytes: 400_000, timeoutMs: 8_000 }).catch(() => null);
    if (!response?.ok || response.status < 200 || response.status >= 300 || !response.contentType.toLowerCase().includes("text/html")) return { status: "unavailable" as const, found: [] as number[] };
    const page = extractPageContent(response.body, response.finalUrl, { maxTextChars: 60_000, maxLinks: 0 });
    return offerDestinationStatus({ text: [page.title, page.text].filter(Boolean).join("\n"), jsonLdPrices: page.jsonLdPrices }, prices);
  },
});
