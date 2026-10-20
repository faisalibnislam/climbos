/**
 * Platform rules for planning (expansion slice 9). Reference notes from
 * docs/growth-expansion/collections/platform_rules.json, as that pack read the
 * official pages on 2026-10-20. They guide what a plan may assume. They are
 * not permission checks: execution keeps its own adapters and approvals, and
 * every rule needs re-checking against the source before an action relies on it.
 */

export interface PlatformRule {
  id: string;
  platform: string;
  sourceUrl: string;
  retrievedAt: string;
  /** What a plan must not assume, in one line for the prompt. */
  planningNote: string;
  /** Library business types the note matters for; empty = all. */
  types: string[];
}

export const PLATFORM_RULES: PlatformRule[] = [
  {
    id: "RULE-01",
    platform: "Google Search",
    sourceUrl: "https://developers.google.com/search/docs/essentials",
    retrievedAt: "2026-10-20",
    planningNote: "Meeting Google's requirements doesn't guarantee indexing or ranking: never promise a position or traffic from SEO.",
    types: [],
  },
  {
    id: "RULE-02",
    platform: "Apple product page optimization",
    sourceUrl: "https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/overview-of-product-page-optimization/",
    retrievedAt: "2026-10-20",
    planningNote: "App Store product page optimization tests are documented for iOS/iPadOS; don't plan them for a Mac app. Test Mac App Store messaging another way (your own site, before/after).",
    types: ["desktop_app"],
  },
  {
    id: "RULE-05",
    platform: "Resend sending eligibility",
    sourceUrl: "https://resend.com/legal/acceptable-use",
    retrievedAt: "2026-10-20",
    planningNote: "ClimbOS's own email service (Resend) needs explicit opt-in and forbids cold outreach, bought or scraped lists; owner approval doesn't override that.",
    types: [],
  },
  {
    id: "RULE-06",
    platform: "Gmail sender requirements",
    sourceUrl: "https://support.google.com/mail/answer/81126?hl=en",
    retrievedAt: "2026-10-20",
    planningNote: "Sending to Gmail has authentication and unsubscribe rules that tighten for bulk senders; plan volume and list hygiene within them.",
    types: [],
  },
];

/** The notes that apply to these business types, for the plan's capability context. */
export function platformNotes(types: string[]): string {
  const rules = PLATFORM_RULES.filter((r) => !r.types.length || r.types.some((t) => types.includes(t)));
  return rules.length ? `PLATFORM RULES (as read ${rules[0].retrievedAt}; don't assume beyond them):\n${rules.map((r) => `- ${r.platform}: ${r.planningNote}`).join("\n")}` : "";
}

const MAC_PPO = /\b(?:product page optimi[sz]ation|app store (?:a\/b|split) tests?|ppo tests?|custom product pages?)\b/i;

/** A plan for a Mac app can't rely on App Store product page tests (RULE-02). */
export function lintPlatformEligibility(fields: { path: string; text: string }[], types: string[]) {
  if (!types.includes("desktop_app") || types.includes("mobile_app")) return [];
  return fields
    .filter((f) => MAC_PPO.test(f.text))
    .slice(0, 2)
    .map((f) => ({ severity: "error" as const, rule: "platform_eligibility", message: "App Store product page optimization is documented for iOS/iPadOS, not Mac apps (RULE-02). Test the message on your own site or with a before/after instead.", path: f.path }));
}
