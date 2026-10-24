import { attribute } from "./attribution";
import { dedupeRevenueEvents } from "./dedupe";
import type { RevenueEvent, Touch } from "./types";

const PLATFORM_BY_SOURCE: Record<string, string> = {
  google: "Google",
  googleads: "Google",
  adwords: "Google",
  facebook: "Meta",
  meta: "Meta",
  instagram: "Meta",
  fb: "Meta",
  ig: "Meta",
  tiktok: "TikTok",
  tiktokads: "TikTok",
  linkedin: "LinkedIn",
  linkedinads: "LinkedIn",
  amazon: "Amazon",
  amazonads: "Amazon",
  pinterest: "Pinterest",
  youtube: "YouTube",
  bing: "Microsoft",
  microsoftads: "Microsoft",
  email: "Email",
  newsletter: "Email",
};

function platformLabel(source: string | undefined, medium: string | undefined): string | null {
  const normalized = source?.toLocaleLowerCase("en-US").replace(/[^a-z0-9]/g, "") ?? "";
  const platform = PLATFORM_BY_SOURCE[normalized];
  if (!platform) return null;
  const normalizedMedium = medium?.toLocaleLowerCase("en-US").replace(/[^a-z0-9]/g, "") ?? "";
  if (["cpc", "ppc", "paid", "paidsocial", "paidsearch", "display"].includes(normalizedMedium)) return `${platform} ads`;
  if (normalizedMedium === "organic") return `${platform} organic`;
  return `${platform} tagged`;
}

export interface PlatformConcentration {
  currency: string;
  eventCount: number;
  attributedConversions: number;
  totalConversions: number;
  attributedPositiveNetMinor: number;
  topSource: string | null;
  topSourceShare: number | null;
  topThreeShare: number | null;
  duplicatesRemoved: number;
  partial: boolean;
}

/**
 * Summarize positive net billing revenue attributed to a bounded set of known
 * UTM platforms. This is a tracked last-touch path signal, not causal impact or
 * a complete inventory of the business's platform dependence.
 */
export function platformConcentration(
  input: readonly RevenueEvent[],
  options: { currency: string; fromMs: number; toMs: number; partial?: boolean },
): PlatformConcentration | null {
  const { events, duplicates } = dedupeRevenueEvents(input.filter(
    (event) => event.currency === options.currency && event.occurredAt >= options.fromMs && event.occurredAt <= options.toMs,
  ));
  if (!events.length) return null;

  const touches: Touch[] = events.flatMap((event) => {
    const label = platformLabel(event.utmSource, event.utmMedium);
    return label && event.customerRef
      ? [{ customerRef: event.customerRef, source: event.source, occurredAt: event.occurredAt - 1, channel: label }]
      : [];
  });
  const result = attribute(events, touches, { model: "last_touch", lookbackDays: 30 });
  const currency = result.byCurrency[options.currency];
  if (!currency) return null;
  const ranked = Object.entries(currency.channels)
    .map(([source, totals]) => ({ source, net: totals.netRevenueMinor, conversions: totals.conversions }))
    .filter((row) => row.net > 0)
    .sort((a, b) => b.net - a.net || a.source.localeCompare(b.source));
  const attributedPositiveNetMinor = ranked.reduce((sum, row) => sum + row.net, 0);
  return {
    currency: options.currency,
    eventCount: events.length,
    attributedConversions: Object.values(currency.channels).reduce((sum, totals) => sum + totals.conversions, 0),
    totalConversions: events.filter((event) => event.kind !== "refund").length,
    attributedPositiveNetMinor,
    topSource: ranked[0]?.source ?? null,
    topSourceShare: attributedPositiveNetMinor ? (ranked[0]?.net ?? 0) / attributedPositiveNetMinor : null,
    topThreeShare: attributedPositiveNetMinor
      ? ranked.slice(0, 3).reduce((sum, row) => sum + row.net, 0) / attributedPositiveNetMinor
      : null,
    duplicatesRemoved: duplicates,
    partial: options.partial ?? false,
  };
}
