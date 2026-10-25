/**
 * Platform rules for planning (expansion slice 9). Reference notes from
 * official platform documentation and policies checked on 2026-10-25. They guide what a plan may assume. They are
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
    id: "RULE-GBP-REVIEWS",
    platform: "Google Business Profile reviews and API access",
    sourceUrl: "https://developers.google.com/my-business/content/policies",
    retrievedAt: "2026-10-25",
    planningNote: "GBP API access is restricted and must be requested; verified-profile age, OAuth and end-client project rules apply. Review replies require client authorization. Until credentials and per-client project eligibility are verified, use a manual review link or owner-entered reviews; do not promise review sync.",
    types: ["local_services", "local_retail", "food_beverage", "hospitality", "healthcare"],
  },
  {
    id: "RULE-G2",
    platform: "G2",
    sourceUrl: "https://legal.g2.com/terms-of-use",
    retrievedAt: "2026-10-25",
    planningNote: "Only consider for a relevant verified software category and buyer evidence. Do not scrape or collect review data, or use G2 content for AI, without express permission. Review campaigns and access depend on the owner's G2 account and current terms.",
    types: ["b2b_saas", "enterprise_software", "developer_tool", "ai_software"],
  },
  {
    id: "RULE-TRUSTPILOT",
    platform: "Trustpilot",
    sourceUrl: "https://developers.trustpilot.com/introduction",
    retrievedAt: "2026-10-25",
    planningNote: "Business API access requires a Trustpilot for Business account with API module access. Verify region, account tier, invitation allowance, OAuth/API access, retention and deletion conditions before claiming sync or sending invitations; a manual profile link remains possible.",
    types: [],
  },
  {
    id: "RULE-PRODUCT-HUNT",
    platform: "Product Hunt",
    sourceUrl: "https://help.producthunt.com/en/articles/17350772-launch-guide",
    retrievedAt: "2026-10-25",
    planningNote: "Use only for a relevant software launch or major update with early-adopter fit. Prepare launch assets and feedback measures for owner review; never ask for upvotes, coordinate votes, mass-message, or promise reach or customers.",
    types: ["b2b_saas", "consumer_software", "developer_tool", "ai_software"],
  },
  {
    id: "RULE-REDDIT",
    platform: "Reddit communities",
    sourceUrl: "https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette",
    retrievedAt: "2026-10-25",
    planningNote: "Treat 9:1 as a non-universal rule of thumb. Check the exact target community's current rules; listen and contribute helpfully before any promotion. Never automate posts, comments, DMs, voting or account activity. Do not scrape communities.",
    types: [],
  },
  {
    id: "RULE-MEDIUM",
    platform: "Medium",
    sourceUrl: "https://help.medium.com/hc/en-us/articles/22576852947223-Artificial-Intelligence-AI-content-policy",
    retrievedAt: "2026-10-25",
    planningNote: "Require meaningful human authorship, fact-checking, and any current AI disclosure. Undisclosed AI-assisted/generative writing can be limited to network distribution, AI-generated writing is not paywall-eligible under the Partner Program, and Boost is editorial with no reach guarantee.",
    types: [],
  },
  {
    id: "RULE-YELP",
    platform: "Yelp reviews",
    sourceUrl: "https://business.yelp.com/resources/articles/using-customer-reviews-to-promote-your-business-and-inspire-your-staff/",
    retrievedAt: "2026-10-25",
    planningNote: "Yelp says businesses should not solicit reviews. Do not route the neutral review-invitation workflow to Yelp. For eligible local businesses, consider accurate profile information only when customer-use evidence supports it.",
    types: ["local_services", "local_retail", "food_beverage", "hospitality"],
  },
  {
    id: "RULE-TRIPADVISOR",
    platform: "Tripadvisor",
    sourceUrl: "https://www.tripadvisor.com/Trust-lvBd3L1aU38Y.html",
    retrievedAt: "2026-10-25",
    planningNote: "Consider only for eligible travel, lodging, food, or activity businesses and traveler evidence. Reviews must reflect the reviewer's own experience and the business must have a relevant listing. Business-side API and commercial terms remain unverified.",
    types: ["hospitality", "food_beverage", "travel_tourism", "activities"],
  },
  {
    id: "RULE-GOOGLE-PLAY-REVIEWS",
    platform: "Google Play reviews",
    sourceUrl: "https://support.google.com/googleplay/android-developer/answer/9898684?hl=en",
    retrievedAt: "2026-10-25",
    planningNote: "Only for an eligible Android app. Do not manipulate ratings, incentivize reviews, force prompts, scrape, or promise cross-account sync. Use the developer's own Play Console and verify current official APIs and scopes before integration.",
    types: ["mobile_app"],
  },
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
