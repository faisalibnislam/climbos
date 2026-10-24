import { netMinor } from "./attribution";
import { dedupeRevenueEvents } from "./dedupe";
import type { RevenueEvent } from "./types";

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

  const ordered = [...events].sort((a, b) => a.occurredAt - b.occurredAt || a.id.localeCompare(b.id));
  const lastTouch = new Map<string, { occurredAt: number; label: string }>();
  const channelByOrder = new Map<string, string>();
  const revenueBySource = new Map<string, number>();
  let attributedConversions = 0;
  let totalConversions = 0;
  const touchKey = (event: RevenueEvent) => event.customerRef ? `${event.source}\u0000${event.customerRef}` : null;
  const orderKey = (event: RevenueEvent) => event.orderRef ? `${event.source}\u0000${event.currency}\u0000${event.orderRef}` : null;

  for (const event of ordered) {
    const key = touchKey(event);
    const directLabel = event.kind === "refund" ? null : platformLabel(event.utmSource, event.utmMedium);
    // Revenue imports represent a purchase touch one millisecond before charge time.
    if (key && directLabel) lastTouch.set(key, { occurredAt: event.occurredAt - 1, label: directLabel });
    const priorTouch = key ? lastTouch.get(key) : undefined;
    const eligibleTouch = priorTouch && priorTouch.occurredAt <= event.occurredAt && event.occurredAt - priorTouch.occurredAt <= 30 * 86_400_000
      ? priorTouch.label
      : null;
    const order = orderKey(event);
    const source = event.kind === "refund"
      ? (order ? channelByOrder.get(order) : undefined) ?? eligibleTouch
      : directLabel ?? eligibleTouch;
    const net = netMinor(event);

    if (event.kind === "refund") {
      if (source) revenueBySource.set(source, (revenueBySource.get(source) ?? 0) + net);
      continue;
    }

    totalConversions++;
    if (order && source && !channelByOrder.has(order)) channelByOrder.set(order, source);
    if (source) {
      attributedConversions++;
      revenueBySource.set(source, (revenueBySource.get(source) ?? 0) + net);
    }
  }

  const ranked = [...revenueBySource.entries()]
    .map(([source, net]) => ({ source, net }))
    .filter((row) => row.net > 0)
    .sort((a, b) => b.net - a.net || a.source.localeCompare(b.source));
  const attributedPositiveNetMinor = ranked.reduce((sum, row) => sum + row.net, 0);
  return {
    currency: options.currency,
    eventCount: events.length,
    attributedConversions,
    totalConversions,
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
