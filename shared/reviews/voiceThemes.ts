/**
 * Small, transparent phrase groups for surfacing possible recurring customer
 * themes. This is a retrieval aid, not sentiment analysis or a business verdict.
 */

export const VOICE_THEME_LABELS = {
  onboarding: "Getting started",
  reliability: "Reliability",
  response_time: "Response time",
  value: "Price and value",
  product_gap: "Product requests",
  service: "Service experience",
} as const;

export type VoiceThemeKey = keyof typeof VOICE_THEME_LABELS;

const PATTERNS: Record<VoiceThemeKey, RegExp[]> = {
  onboarding: [/\bonboard\w*\b/i, /\bsetup\b/i, /\bgetting started\b/i, /\bsign[ -]?up\b/i, /\bconfus\w*\b/i],
  reliability: [/\bbug\w*\b/i, /\bcrash\w*\b/i, /\bbroken\b/i, /\berror\b/i, /\boutage\b/i, /\bnot working\b/i],
  response_time: [/\bslow\b/i, /\bwait\w*\b/i, /\blate\b/i, /\bdelay\w*\b/i, /\bno response\b/i, /\bno reply\b/i],
  value: [/\bprice\b/i, /\bcost\b/i, /\bexpensive\b/i, /\bworth\b/i, /\bbill\w*\b/i, /\bcharge\w*\b/i],
  product_gap: [/\bmissing\b/i, /\bneed\b/i, /\bwish\b/i, /\bfeature\b/i, /\bdoesn.t support\b/i, /\bwould like\b/i],
  service: [/\bsupport\b/i, /\bstaff\b/i, /\bservice\b/i, /\bhelpful\b/i, /\bfriendly\b/i, /\brude\b/i],
};

export interface VoiceThemeSource {
  id: string;
  kind: string;
  channel: string;
  text: string;
  receivedAt: number;
  redact?: string[];
  sourceUrl?: string;
}

export interface VoiceTheme {
  key: VoiceThemeKey;
  label: string;
  count: number;
  channels: string[];
  firstSeenAt: number;
  lastSeenAt: number;
  confidence: "low" | "medium";
  evidenceBasis: "customer_messages" | "owner_reported" | "mixed";
  examples: { id: string; source: string; sourceUrl?: string; date: number; excerpt: string }[];
}

function snippet(text: string, redact: string[] = []): string {
  const withoutAddresses = text.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]");
  const escaped = redact.filter(Boolean).sort((a, b) => b.length - a.length).reduce((value, secret) => value.replace(new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[redacted]"), withoutAddresses);
  return escaped
    .replace(/(?:\+?\d[\d ().-]{7,}\d)/g, "[phone]")
    .replace(/\s+/g, " ").trim().slice(0, 180);
}

export function groupVoiceThemes(sources: VoiceThemeSource[], minimum = 2): VoiceTheme[] {
  const groups = new Map<VoiceThemeKey, VoiceThemeSource[]>();
  for (const source of sources) {
    const text = source.text.trim();
    if (!text) continue;
    const match = (Object.keys(PATTERNS) as VoiceThemeKey[])
      .map((key) => ({ key, hits: PATTERNS[key].filter((pattern) => pattern.test(text)).length }))
      .filter((item) => item.hits > 0)
      .sort((a, b) => b.hits - a.hits)[0];
    if (!match) continue;
    groups.set(match.key, [...(groups.get(match.key) ?? []), source]);
  }
  return [...groups.entries()]
    .filter(([, rows]) => rows.length >= minimum)
    .map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => a.receivedAt - b.receivedAt);
      const channels = [...new Set(rows.map((row) => row.channel))].sort();
      return {
        key,
        label: VOICE_THEME_LABELS[key],
        count: rows.length,
        channels,
        firstSeenAt: sorted[0]!.receivedAt,
        lastSeenAt: sorted.at(-1)!.receivedAt,
        confidence: rows.length >= 5 && channels.length >= 2 ? "medium" as const : "low" as const,
        evidenceBasis: rows.every((row) => row.kind === "owner-entered CRM note") ? "owner_reported" as const : rows.some((row) => row.kind === "owner-entered CRM note") ? "mixed" as const : "customer_messages" as const,
        examples: [...rows].sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 3).map((row) => ({
          id: row.id,
          source: `${row.kind} · ${row.channel}`,
          ...(row.sourceUrl ? { sourceUrl: row.sourceUrl } : {}),
          date: row.receivedAt,
          excerpt: snippet(row.text, row.redact),
        })),
      };
    })
    .sort((a, b) => b.count - a.count || b.lastSeenAt - a.lastSeenAt);
}
