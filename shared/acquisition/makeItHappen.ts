import type { Channel, Family } from "./library";

/**
 * "Make it happen" on a channel: the first concrete work ClimbOS can draft for it, plus to-dos for the steps only the
 * owner can do. Drafts land in Review work; nothing is posted, sent or spent without its own approval.
 */
export type SocialChannel = "linkedin" | "instagram" | "facebook" | "x" | "tiktok" | "pinterest";
export type DraftJob =
  | { job: "content_social"; channel: SocialChannel; quantity: number; brief: string }
  | { job: "content_email"; channel: "email"; brief: string }
  | { job: "content_seo"; brief: string }
  | { job: "content_ads"; brief: string };

export interface ChannelTodo {
  title: string;
  description: string;
  kind: "connect_account" | "note";
}

export interface ChannelWork {
  draft: DraftJob | null;
  todos: ChannelTodo[];
}

const SOCIAL_BY_NAME: [RegExp, SocialChannel][] = [
  [/linked\s?in/i, "linkedin"],
  [/instagram/i, "instagram"],
  [/facebook/i, "facebook"],
  [/\bx\b|twitter/i, "x"],
  [/tik\s?tok/i, "tiktok"],
  [/pinterest/i, "pinterest"],
];

/** Connection providers that let ClimbOS publish to a social channel directly. */
const PUBLISH_PROVIDER: Partial<Record<SocialChannel, string>> = { linkedin: "linkedin", instagram: "instagram", facebook: "facebook_pages", x: "x" };

const EMAIL_BRIEF: Partial<Record<Family, string>> = {
  email: "A short welcome and nurture email sequence for people who opted in.",
  outreach: "A short, personal first-contact email template and one follow-up for a small, well-chosen list. Follow outreach and privacy rules; no mass sending.",
  pr: "A short pitch email to a relevant writer, with one newsworthy, factual angle.",
  partnerships: "A short email proposing a simple joint offer to a business that serves the same buyers.",
  creators: "A short, disclosed collaboration brief and outreach email for one relevant creator.",
  referral: "An email inviting existing customers to introduce others, with a fair thank-you and no pressure.",
  distribution: "A short email introducing the product to a reseller or distributor that already reaches these buyers.",
};

const MANUAL_STEPS: Partial<Record<Family, string>> = {
  events: "Pick one event your buyers attend and decide what you'll offer there. ClimbOS can draft the follow-up email after.",
  communities: "Pick one community where buyers talk and read its rules. ClimbOS can draft useful posts once you've chosen it.",
  marketplaces: "Create or claim your listing on the directory where buyers compare options, with accurate details.",
  local: "Claim and check your local listings (for example Google Business Profile) so the details are accurate.",
  product_led: "Decide where sharing or invitations fit in your product. ClimbOS can draft the in-product copy after.",
  traditional: "Choose one placement in a medium your buyers use and get its price and audience details.",
  video_audio: "Record a first short video or episode on a buyer question. ClimbOS can draft the script and description as a post.",
};

/** What "Make it happen" does for one channel, given the connections already in place. */
export function channelWork(channel: Pick<Channel, "id" | "family"> & { name: string }, connectedProviders: string[] = []): ChannelWork {
  const label = channel.name;
  const todos: ChannelTodo[] = [];
  const social = SOCIAL_BY_NAME.find(([re]) => re.test(label))?.[1];
  if (channel.family === "organic_social" || (social && channel.family !== "paid_social")) {
    const target = social ?? "linkedin";
    const provider = PUBLISH_PROVIDER[target];
    if (!provider || !connectedProviders.includes(provider)) todos.push({ title: `Connect your ${label} account`, description: provider ? "Connect it in Connected accounts so approved posts can go out from ClimbOS, or copy approved drafts and post them yourself." : "Post approved drafts yourself; ClimbOS can't publish here directly yet.", kind: "connect_account" });
    return { draft: { job: "content_social", channel: target, quantity: 3, brief: `First posts for ${label}: what makes the business different, one customer problem it solves, and one clear next step.` }, todos };
  }
  if (channel.family === "organic_search" || channel.family === "content") {
    return { draft: { job: "content_seo", brief: `The first page for ${label}: answer one specific buyer question with facts the business can stand behind, and link to a clear next step.` }, todos };
  }
  if (channel.family === "paid_search" || channel.family === "paid_social" || channel.family === "retargeting") {
    todos.push({ title: `Connect your ad account for ${label}`, description: "Ads stay paused drafts until you connect the ad account and approve a capped budget.", kind: "connect_account" });
    return { draft: { job: "content_ads", brief: `A small, capped first test for ${label}: one audience, one message, paused until approved.` }, todos };
  }
  const emailBrief = EMAIL_BRIEF[channel.family];
  if (emailBrief) {
    if (channel.family === "outreach" || channel.family === "partnerships" || channel.family === "creators" || channel.family === "pr" || channel.family === "distribution") {
      todos.push({ title: `Choose who to contact for ${label}`, description: "ClimbOS drafts the message; you pick the people and approve each send. It never builds or buys contact lists.", kind: "note" });
    }
    return { draft: { job: "content_email", channel: "email", brief: `${label}: ${emailBrief}` }, todos };
  }
  todos.push({ title: `Start ${label}`, description: MANUAL_STEPS[channel.family] ?? "This channel needs you to take the first step. ClimbOS can help with drafts after.", kind: "note" });
  return { draft: null, todos };
}
