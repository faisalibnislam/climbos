const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?|\[?f[cd][0-9a-f]{2}:|metadata\.google\.internal)/i;

/** Public http(s) URLs only (no internal hosts or credentials): guards every fetch of customer-supplied URLs. */
export function safePublicUrl(input: string, base?: string): URL | null {
  try {
    const u = base ? new URL(input, base) : new URL(input);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (PRIVATE_HOST.test(u.hostname) || u.hostname.endsWith(".internal") || u.hostname.endsWith(".local")) return null;
    if (u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

export interface FoundProduct {
  name: string;
  price?: string;
  url?: string;
  images: string[];
}

/** Products and their images from a store page: JSON-LD Product data, then Open Graph. */
export function productsFromHtml(html: string, pageUrl: string): FoundProduct[] {
  const out: FoundProduct[] = [];
  const abs = (src: string) => safePublicUrl(src, pageUrl)?.toString();
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const json = JSON.parse(m[1].trim()) as unknown;
      const nodes: unknown[] = Array.isArray(json) ? json : (json as { "@graph"?: unknown[] })["@graph"] ?? [json];
      for (const n of nodes) {
        const node = n as { "@type"?: string | string[]; name?: string; image?: unknown; offers?: { price?: string | number; priceCurrency?: string } | { price?: string | number; priceCurrency?: string }[]; url?: string };
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        if (!types.includes("Product") || !node.name) continue;
        const imgs = (Array.isArray(node.image) ? node.image : [node.image]).flatMap((i) => (typeof i === "string" ? [i] : i && typeof i === "object" && "url" in i ? [(i as { url: string }).url] : []));
        const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
        out.push({
          name: String(node.name).slice(0, 140),
          price: offer?.price !== undefined ? `${offer.price}${offer.priceCurrency ? ` ${offer.priceCurrency}` : ""}` : undefined,
          url: node.url ? abs(node.url) : pageUrl,
          images: imgs.map(abs).filter((x): x is string => Boolean(x)).slice(0, 4),
        });
      }
    } catch {
      // malformed JSON-LD: skip
    }
  }
  if (out.length === 0) {
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
    const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? html.match(/<title>([^<]+)<\/title>/i)?.[1];
    const img = og ? abs(og) : undefined;
    if (img && title) out.push({ name: title.trim().slice(0, 140), url: pageUrl, images: [img] });
  }
  return out;
}

/** Links on a page that look like product pages. */
export function productLinks(html: string, pageUrl: string, max = 8): string[] {
  const seen = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"'#?]+)["']/gi)) {
    if (!/\/(products?|shop|item|p)\/[a-z0-9-]/i.test(m[1])) continue;
    const u = safePublicUrl(m[1], pageUrl);
    if (!u || u.hostname !== new URL(pageUrl).hostname) continue;
    seen.add(u.toString());
    if (seen.size >= max) break;
  }
  return [...seen];
}
