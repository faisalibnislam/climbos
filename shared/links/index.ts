/** Tracked links: UTM tagging and the rules for what we shorten. */

export interface Utm {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
}

const SOURCE: Record<string, { source: string; medium: string }> = {
  instagram: { source: "instagram", medium: "social" },
  facebook: { source: "facebook", medium: "social" },
  linkedin: { source: "linkedin", medium: "social" },
  x: { source: "x", medium: "social" },
  tiktok: { source: "tiktok", medium: "social" },
  pinterest: { source: "pinterest", medium: "social" },
  youtube: { source: "youtube", medium: "social" },
  email: { source: "newsletter", medium: "email" },
  outbound_email: { source: "outreach", medium: "email" },
  google_search_ad: { source: "google", medium: "cpc" },
  meta_ad: { source: "facebook", medium: "paid_social" },
};

export function utmFor(channel: string, campaign = "climbos", content?: string): Utm {
  const key = Object.keys(SOURCE).find((k) => channel === k || channel.startsWith(`${k}_`)) ?? "";
  const s = SOURCE[key] ?? { source: channel.replace(/[^a-z0-9_]/gi, "").toLowerCase() || "climbos", medium: "referral" };
  return { ...s, campaign, content };
}

/** Add UTM tags to a URL (keeps any the owner already set). Returns null for non-http URLs. */
export function withUtm(url: string, utm: Utm): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const set = (k: string, v?: string) => {
    if (v && !u.searchParams.has(k)) u.searchParams.set(k, v);
  };
  set("utm_source", utm.source);
  set("utm_medium", utm.medium);
  set("utm_campaign", utm.campaign);
  set("utm_content", utm.content);
  return u.toString();
}

/** Ads must point at the real site (networks reject redirects); everything else gets a short link. */
export function shortenable(kind: string): boolean {
  return kind !== "ad";
}

export function newLinkCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(7)), (b) => alphabet[b % alphabet.length]).join("");
}

/** Link-preview fetchers and crawlers aren't people: don't count them. */
export function isBot(userAgent: string): boolean {
  return /bot|crawl|spider|slurp|facebookexternalhit|linkedinbot|twitterbot|slackbot|discordbot|whatsapp|telegrambot|preview|embedly|quora link|pinterest|vkshare|skypeuripreview|googleimageproxy|headless/i.test(userAgent);
}
