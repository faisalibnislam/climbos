import type { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { PLATFORM_LIMITS, countForPlatform, normalizeHashtag, type DraftPlatform } from "@shared/integrations/drafts";

export type ArtifactView = FunctionReturnType<typeof api.content.get>;
export type VersionView = ArtifactView["versions"][number];

export const SOCIAL_CHANNELS = ["instagram", "facebook", "linkedin", "x", "tiktok", "pinterest", "youtube"] as const;
export const AD_CHANNELS = ["google_search_ad", "meta_ad"] as const;

export function isSocial(channel: string): channel is DraftPlatform {
  return (SOCIAL_CHANNELS as readonly string[]).includes(channel);
}

export function isCampaignAd(channel: string): channel is (typeof AD_CHANNELS)[number] {
  return (AD_CHANNELS as readonly string[]).includes(channel);
}

export interface TextLimit {
  limit: number;
  /** What is counted, in words. */
  label: string;
  count: (text: string) => number;
}

const codepoints = (s: string) => [...s].length;

/** Join body + hashtags the way the export pack does, for an honest count. */
export function composeSocial(body: string, hashtags: string[]): string {
  const tags = [...new Set(hashtags.map(normalizeHashtag).filter((h): h is string => Boolean(h)))];
  return tags.length ? `${body.trim()}\n\n${tags.join(" ")}` : body.trim();
}

/** Character limit for the main text, where we know it. */
export function bodyLimit(channel: string): TextLimit | null {
  if (isSocial(channel)) {
    const l = PLATFORM_LIMITS[channel];
    if (channel === "facebook") return null; // 63k: not useful to show
    return {
      limit: l.textMax,
      label: channel === "x" ? "Post with hashtags (links count as 23)" : "Caption with hashtags",
      count: (s) => countForPlatform(s, l.countMode),
    };
  }
  if (channel === "google_search_ad") return { limit: 90, label: "Description", count: codepoints };
  return null;
}

export function headlineLimit(channel: string): TextLimit | null {
  if (channel === "google_search_ad") return { limit: 30, label: "Headline", count: codepoints };
  if (channel === "pinterest") return { limit: 100, label: "Title", count: codepoints };
  if (channel === "youtube") return { limit: 100, label: "Title", count: codepoints };
  return null;
}

/** Field labels per channel, in plain words. */
export function fieldLabels(channel: string, kind: string) {
  if (channel === "email" || kind === "email" || kind === "email_sequence") {
    return { headline: "Subject line", body: "Email text", showHeadline: true, showCta: true };
  }
  if (channel === "google_search_ad") return { headline: "Headline", body: "Description", showHeadline: true, showCta: false };
  if (channel === "meta_ad" || channel === "linkedin_ad") return { headline: "Headline", body: "Ad text", showHeadline: true, showCta: true };
  if (channel === "blog" || channel === "website") return { headline: "Page title", body: "Page text", showHeadline: true, showCta: true };
  if (channel === "pinterest" || channel === "youtube") return { headline: "Title", body: "Description", showHeadline: true, showCta: false };
  return { headline: "Headline", body: "Caption", showHeadline: false, showCta: false };
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Parse "a, #b,  c" → ["a", "b", "c"]. */
export function parseHashtags(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((t) => t.trim().replace(/^#+/, "").trim())
    .filter(Boolean);
}
