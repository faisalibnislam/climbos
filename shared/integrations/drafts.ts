/**
 * Manual export packs for platforms ClimbOS cannot (or may not yet) publish to.
 * Everything produced here is labeled kind: "manual_export" — it is copy for a
 * person to paste, never a claim that anything was posted.
 */

import type { CapabilityEvaluation } from "./capabilities";
import type { ProviderId } from "./types";

export type DraftPlatform = "linkedin" | "x" | "tiktok" | "pinterest" | "youtube" | "instagram" | "facebook";

export interface PlatformLimits {
  label: string;
  textMax: number;
  countMode: "codepoints" | "utf16" | "x_weighted";
  titleMax?: number;
  hashtagMax?: number;
  altTextMax?: number;
  verified: boolean;
  docsUrl: string;
  note?: string;
}

/** Limits checked 2026-10-17 (X re-checked 2026-10-18). verified:false = not confirmed from first-party docs. */
export const PLATFORM_LIMITS: Record<DraftPlatform, PlatformLimits> = {
  x: { label: "X", textMax: 280, countMode: "x_weighted", altTextMax: 1000, verified: true, docsUrl: "https://docs.x.com/resources/fundamentals/counting-characters", note: "Weighted count: URLs = 23, CJK/emoji = 2. Premium long posts not assumed." },
  linkedin: { label: "LinkedIn", textMax: 3000, countMode: "codepoints", altTextMax: 4086, verified: false, docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api" },
  tiktok: { label: "TikTok", textMax: 2200, countMode: "utf16", verified: true, docsUrl: "https://developers.tiktok.com/doc/content-posting-api-reference-direct-post", note: "Video caption (title) max 2200 UTF-16 runes incl. hashtags." },
  pinterest: { label: "Pinterest", textMax: 500, countMode: "codepoints", titleMax: 100, altTextMax: 500, verified: false, docsUrl: "https://developers.pinterest.com/docs/api/v5/pins-create/", note: "Sources disagree (500 vs 800) on description; 500 used to be safe." },
  youtube: { label: "YouTube", textMax: 5000, countMode: "utf16", titleMax: 100, verified: false, docsUrl: "https://developers.google.com/youtube/v3/docs/videos#properties", note: "Description limit is 5000 bytes; '<' and '>' are not allowed." },
  instagram: { label: "Instagram", textMax: 2200, countMode: "codepoints", hashtagMax: 30, altTextMax: 1000, verified: true, docsUrl: "https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media" },
  facebook: { label: "Facebook", textMax: 63_206, countMode: "codepoints", verified: false, docsUrl: "https://developers.facebook.com/docs/pages-api/posts" },
};

const X_URL_WEIGHT = 23;

function xWeight(cp: number): number {
  return (cp >= 0 && cp <= 4351) || (cp >= 8192 && cp <= 8205) || (cp >= 8208 && cp <= 8223) || (cp >= 8242 && cp <= 8247) ? 1 : 2;
}

export function countForPlatform(text: string, mode: PlatformLimits["countMode"]): number {
  if (mode === "utf16") return text.length;
  if (mode === "codepoints") return [...text].length;
  let total = 0;
  const urlRe = /https?:\/\/[^\s]+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const weigh = (s: string): number => [...s].reduce((sum, ch) => sum + xWeight(ch.codePointAt(0) ?? 0), 0);
  while ((m = urlRe.exec(text)) !== null) {
    total += weigh(text.slice(last, m.index)) + X_URL_WEIGHT;
    last = m.index + m[0].length;
  }
  return total + weigh(text.slice(last));
}

export function normalizeHashtag(tag: string): string | undefined {
  const cleaned = tag.trim().replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
  return cleaned ? `#${cleaned}` : undefined;
}

export interface DraftInput {
  text: string;
  title?: string;
  hashtags?: string[];
  altText?: string;
  link?: string;
  mediaUrls?: string[];
}

export interface ManualExportItem {
  kind: "manual_export";
  platform: DraftPlatform;
  platformLabel: string;
  title?: string;
  text: string;
  hashtags: string[];
  altText?: string;
  mediaUrls: string[];
  charCount: number;
  limit: number;
  withinLimit: boolean;
  truncated: boolean;
  warnings: string[];
  limitVerified: boolean;
}

export interface ManualExportPack {
  kind: "manual_export";
  generatedAt: string;
  notice: string;
  items: ManualExportItem[];
}

function truncateToFit(text: string, fits: (s: string) => boolean): string {
  if (fits(text)) return text;
  const chars = [...text];
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(`${chars.slice(0, mid).join("").trimEnd()}…`)) lo = mid;
    else hi = mid - 1;
  }
  let cut = chars.slice(0, lo).join("");
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > cut.length * 0.6) cut = cut.slice(0, lastSpace);
  const out = `${cut.trimEnd()}…`;
  return fits(out) ? out : chars.slice(0, Math.max(0, lo - 1)).join("");
}

export function buildPlatformDraft(platform: DraftPlatform, input: DraftInput): ManualExportItem {
  const limits = PLATFORM_LIMITS[platform];
  const warnings: string[] = [];
  const count = (s: string): number => countForPlatform(s, limits.countMode);
  let hashtags = [...new Set((input.hashtags ?? []).map(normalizeHashtag).filter((h): h is string => h !== undefined))];
  if (limits.hashtagMax !== undefined && hashtags.length > limits.hashtagMax) {
    warnings.push(`${limits.label} allows at most ${limits.hashtagMax} hashtags; extra hashtags were dropped.`);
    hashtags = hashtags.slice(0, limits.hashtagMax);
  }
  let body = input.text.trim();
  if (input.link && !body.includes(input.link)) body = `${body}\n\n${input.link}`;
  if (platform === "youtube" && /[<>]/.test(body)) {
    body = body.replace(/[<>]/g, "");
    warnings.push("YouTube descriptions cannot contain < or >; they were removed.");
  }
  const compose = (b: string, tags: string[]): string => (tags.length ? `${b}\n\n${tags.join(" ")}` : b);
  const fits = (s: string): boolean => count(s) <= limits.textMax;

  let text = compose(body, hashtags);
  let truncated = false;
  while (!fits(text) && hashtags.length > 0) {
    hashtags = hashtags.slice(0, -1);
    text = compose(body, hashtags);
    truncated = true;
  }
  if (truncated) warnings.push("Some hashtags were dropped to fit the character limit.");
  if (!fits(text)) {
    text = truncateToFit(body, fits);
    truncated = true;
    warnings.push(`Text was shortened to fit ${limits.label}'s ${limits.textMax}-character limit. Review before posting.`);
  }

  const item: ManualExportItem = {
    kind: "manual_export",
    platform,
    platformLabel: limits.label,
    text,
    hashtags,
    mediaUrls: [...(input.mediaUrls ?? [])],
    charCount: count(text),
    limit: limits.textMax,
    withinLimit: fits(text),
    truncated,
    warnings,
    limitVerified: limits.verified,
  };
  const titleMax = limits.titleMax;
  if (input.title !== undefined && titleMax !== undefined) {
    const t = input.title.trim();
    if ([...t].length > titleMax) {
      item.title = truncateToFit(t, (s) => [...s].length <= titleMax);
      warnings.push(`Title was shortened to ${titleMax} characters.`);
    } else {
      item.title = t;
    }
  }
  if (input.altText !== undefined) {
    const alt = input.altText.trim();
    if (limits.altTextMax !== undefined && [...alt].length > limits.altTextMax) {
      item.altText = [...alt].slice(0, limits.altTextMax).join("");
      warnings.push(`Alt text was shortened to ${limits.altTextMax} characters.`);
    } else {
      item.altText = alt;
    }
  } else if ((input.mediaUrls ?? []).length > 0) {
    warnings.push("Add alt text so people using screen readers can understand the image.");
  }
  if (!limits.verified) warnings.push(`${limits.label}'s limit could not be confirmed from official docs on 2026-10-17; double-check before posting.`);
  return item;
}

export function buildManualExportPack(input: DraftInput, platforms: readonly DraftPlatform[], now: Date = new Date()): ManualExportPack {
  return {
    kind: "manual_export",
    generatedAt: now.toISOString(),
    notice: "Manual export: ClimbOS did not post this anywhere. Copy it into each platform yourself.",
    items: [...new Set(platforms)].map((p) => buildPlatformDraft(p, input)),
  };
}

function csvCell(v: string | number | boolean | undefined): string {
  const s = v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const MANUAL_EXPORT_CSV_COLUMNS = ["kind", "platform", "title", "text", "hashtags", "alt_text", "media_urls", "char_count", "limit", "within_limit", "warnings"] as const;

export function manualExportToCsv(pack: ManualExportPack): string {
  const lines = [MANUAL_EXPORT_CSV_COLUMNS.join(",")];
  for (const it of pack.items) {
    lines.push(
      [it.kind, it.platform, it.title, it.text, it.hashtags.join(" "), it.altText, it.mediaUrls.join(" "), it.charCount, it.limit, it.withinLimit, it.warnings.join(" | ")]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function manualExportToJson(pack: ManualExportPack): string {
  return JSON.stringify(pack, null, 2);
}

const PROVIDER_TO_PLATFORM: Partial<Record<ProviderId, DraftPlatform>> = { instagram: "instagram", facebook_pages: "facebook", linkedin: "linkedin", x: "x" };

/**
 * Platforms that need a manual export: always the unsupported networks, plus
 * Instagram/Facebook/LinkedIn/X when their publish capability is not "ready".
 */
export function platformsNeedingManualExport(evaluations: Partial<Record<ProviderId, CapabilityEvaluation[]>>): DraftPlatform[] {
  const out: DraftPlatform[] = ["tiktok", "pinterest", "youtube"];
  for (const [provider, platform] of Object.entries(PROVIDER_TO_PLATFORM) as Array<[ProviderId, DraftPlatform]>) {
    const evals = evaluations[provider];
    const publish = evals?.find((e) => e.kind === "write");
    if (!publish || (publish.state !== "ready" && publish.state !== "testing_access")) out.push(platform);
  }
  return out;
}
