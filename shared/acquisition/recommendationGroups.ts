import { CHANNELS, type Family } from "./library";

/** Owner-facing purpose labels keep unlike discovery channels from sharing one success definition. */
export type RecommendationGroup = "review_comparison" | "launch_feedback" | "content_community" | "app_store";

export interface RecommendationGuidance {
  group: RecommendationGroup;
  label: string;
  purpose: string;
  measurement: string;
}

const REVIEW_COMPARISON: RecommendationGuidance = {
  group: "review_comparison",
  label: "Reviews, comparisons & directories",
  purpose: "Help eligible buyers discover or compare this business where customer evidence shows they look.",
  measurement: "Track qualified profile visits or referrals through to signups, activation, or customers where attribution is available. Ratings and review counts alone are not customer or revenue outcomes.",
};

const LAUNCH_FEEDBACK: RecommendationGuidance = {
  group: "launch_feedback",
  label: "Launch & feedback",
  purpose: "Prepare a relevant launch or major update for an audience likely to give useful early feedback.",
  measurement: "Track qualified visits, signups, activation, useful product feedback, and owner time. Votes, rank, and comments are not customer or revenue outcomes.",
};

const CONTENT_COMMUNITY: RecommendationGuidance = {
  group: "content_community",
  label: "Content & discussion",
  purpose: "Answer real customer questions, support research or search discovery, and participate helpfully where the audience fits.",
  measurement: "Track qualified visits, signups, activation, retention, customer questions answered, and owner time where available. Impressions, votes, and comments are not customer or revenue outcomes.",
};

const APP_STORE: RecommendationGuidance = {
  group: "app_store",
  label: "App stores",
  purpose: "Help people who already search an app store find, judge and install this app.",
  measurement: "Track store listing visits, installs, activation and retained users where the store reports them. Rankings and star averages alone are not customer or revenue outcomes.",
};

const RECOMMENDATION_GUIDANCE: Record<string, RecommendationGuidance> = {
  M06: APP_STORE, // Apple App Store.
  M07: APP_STORE, // Google Play.
  S18: APP_STORE, // App store optimization.
  S04: REVIEW_COMPARISON, // Google Business Profile: eligible local discovery and reputation.
  S09: REVIEW_COMPARISON,
  S10: REVIEW_COMPARISON,
  C01: CONTENT_COMMUNITY, // Owned blog.
  C02: CONTENT_COMMUNITY,
  C16: CONTENT_COMMUNITY,
  C18: CONTENT_COMMUNITY, // Newsletter.
  C26: CONTENT_COMMUNITY, // Medium; current authorship and distribution rules still need checking.
  M10: LAUNCH_FEEDBACK, // Product Hunt is a launch and feedback venue, not a review program.
  M11: REVIEW_COMPARISON, // G2.
  M12: REVIEW_COMPARISON, // Capterra.
  M13: REVIEW_COMPARISON, // TrustRadius.
  M20: REVIEW_COMPARISON,
  M26: REVIEW_COMPARISON, // Trustpilot.
  M27: REVIEW_COMPARISON, // Yelp profile discovery; do not solicit Yelp reviews.
  M28: REVIEW_COMPARISON, // Tripadvisor.
  M29: REVIEW_COMPARISON, // GetApp.
  N01: CONTENT_COMMUNITY, // Reddit communities; participation requires manual, rule-checked owner activity.
  N02: CONTENT_COMMUNITY,
  N03: CONTENT_COMMUNITY,
  N04: CONTENT_COMMUNITY,
  N05: CONTENT_COMMUNITY,
  N06: CONTENT_COMMUNITY,
  N07: CONTENT_COMMUNITY,
  N08: CONTENT_COMMUNITY,
  N09: CONTENT_COMMUNITY,
  N10: CONTENT_COMMUNITY,
  N12: CONTENT_COMMUNITY,
  N13: CONTENT_COMMUNITY,
  N14: CONTENT_COMMUNITY,
  N15: CONTENT_COMMUNITY,
  O14: CONTENT_COMMUNITY,
  O15: CONTENT_COMMUNITY, // Quora.
  O16: CONTENT_COMMUNITY,
  O17: CONTENT_COMMUNITY,
  O18: CONTENT_COMMUNITY,
  O19: CONTENT_COMMUNITY,
  O20: CONTENT_COMMUNITY,
  R15: CONTENT_COMMUNITY, // Industry associations; recommend only with evidence of customer relevance.
  R18: CONTENT_COMMUNITY, // Creator partnerships; evidence, budget and capacity still determine fit.
  X04: REVIEW_COMPARISON,
};

export function recommendationGuidance(channelId: string): RecommendationGuidance | null {
  return RECOMMENDATION_GUIDANCE[channelId] ?? null;
}

/** Spec §6: the job a channel is meant to do, so unlike channels are judged by different outcomes. */
export type ChannelJob = "research" | "community" | "search" | "referral" | "launch" | "comparison" | "authority" | "direct";
export const CHANNEL_JOB_LABEL: Record<ChannelJob, string> = {
  research: "Help buyers research",
  community: "Join where buyers talk",
  search: "Be found when buyers search",
  referral: "Turn customers and partners into referrals",
  launch: "Launch and gather feedback",
  comparison: "Be compared and chosen",
  authority: "Build credibility",
  direct: "Reach buyers directly",
};
const FAMILY_JOB: Record<Family, ChannelJob> = {
  organic_search: "search",
  paid_search: "search",
  local: "search",
  organic_social: "community",
  communities: "community",
  events: "community",
  content: "research",
  video_audio: "research",
  pr: "authority",
  creators: "authority",
  referral: "referral",
  partnerships: "referral",
  marketplaces: "comparison",
  email: "direct",
  outreach: "direct",
  retargeting: "direct",
  paid_social: "direct",
  traditional: "direct",
  distribution: "direct",
  product_led: "referral",
};
const JOB_OVERRIDE: Record<string, ChannelJob> = { S09: "comparison", S10: "comparison", M10: "launch", M06: "search", M07: "search", S18: "search" };
const BY_ID = new Map(CHANNELS.map((c) => [c.id, c]));

export function channelJob(channelId: string): ChannelJob | null {
  const channel = BY_ID.get(channelId);
  if (!channel) return null;
  return JOB_OVERRIDE[channelId] ?? (recommendationGuidance(channelId)?.group === "review_comparison" ? "comparison" : FAMILY_JOB[channel.family]);
}
