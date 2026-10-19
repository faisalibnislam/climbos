/**
 * What ClimbOS itself runs for the owner, with realistic capacity. Engines
 * save production time but still need the owner's approvals and replies.
 * Static for now; S5 (REQ-ENG-11) generates it from each workspace's live
 * capabilities and connections.
 */
export const CLIMBOS_ENGINES = `WHAT YOUR TEAM (CLIMBOS) RUNS FOR THE OWNER — use them for production volume; they cost credits and still need the owner's time for approvals, replies and calls (count it):
- Find customers + outreach: researches companies that fit, finds only published business emails, writes a personal first line each, sends from the owner's own mailbox (warm-up 10 → 50 emails/day per mailbox ≈ 600–1,000/month), follow-ups, stops on reply, booking page included. Cold email benchmarks (grade B, not this business's results): 1–3% reply, 20–40% of replies booking.
- Creator finder: finds relevant creators/influencers with contact routes and drafts collab pitches (benchmark, grade C: 10–20% replies).
- Social autopilot: plans each week and drafts posts, reels and images in the owner's voice; publishes directly to Instagram, Facebook, LinkedIn and X once connected (others via export), following the workspace's approval mode.
- Landing pages with lead forms, website chat that answers from the business facts and captures emails, A/B tests on headlines and subject lines, tracked short links, review requests to past customers, a Pipeline (CRM) and Inbox for replies.
- Ad drafts for Google and Meta within the owner's budget (the owner launches them).
Rules: name which engine runs each play and its weekly volume; owner hours go to calls and closing, not production.
Match the engine to the price: one-to-one outreach pays only when a customer is worth roughly $300+ in 12-month gross profit (or when targeting partners/agencies who bring many accounts). Low-price products lean on self-serve loops: comparison/SEO pages, integrations and marketplaces, referrals, creators and communities.`;

/** What this workspace can actually do right now (REQ-ENG-11), from its connections and approval mode. */
export interface WorkspaceCapabilities {
  /** Providers with status "connected". */
  connected: readonly string[];
  autonomy: "copilot" | "review" | "bounded_autopilot";
}

const SOCIAL_DIRECT = ["instagram", "facebook_pages", "linkedin", "x"] as const;
const SOCIAL_NAME: Record<string, string> = { instagram: "Instagram", facebook_pages: "Facebook", linkedin: "LinkedIn", x: "X" };
const MODE_LINE: Record<WorkspaceCapabilities["autonomy"], string> = {
  copilot: "Approval mode: Copilot. ClimbOS prepares everything; the owner sends, posts and launches each item themselves.",
  review: "Approval mode: Review. Nothing goes out until the owner approves that exact item.",
  bounded_autopilot: "Approval mode: Bounded Autopilot. Routine posts within the owner's limits go out automatically; outreach, ads and anything new still need approval.",
};

/**
 * The engines block for the planner, built from live state. A play may only
 * rely on an engine that's ready, or must name the setup step as its first action.
 */
export function capabilityContext(c: WorkspaceCapabilities): string {
  const has = (p: string) => c.connected.includes(p);
  const social = SOCIAL_DIRECT.filter(has).map((p) => SOCIAL_NAME[p]);
  const lines = [
    "WHAT CLIMBOS CAN RUN FOR THIS OWNER RIGHT NOW (from their connections; never promise more). Engines save production time but still need the owner's time for approvals, replies and calls (count it):",
    has("email_mailbox")
      ? "- Find customers + outreach: READY. Researches fitting companies, keeps only published business emails, writes a first line each, sends from the owner's mailbox (warm-up 10 → 50 emails/day per mailbox), follow-ups, stops on reply."
      : "- Find customers + outreach: finding and drafting are ready; SENDING NEEDS SETUP (connect the owner's mailbox under Connections). A play that relies on it must make that its first action.",
    "- Creator finder: READY. Finds relevant creators with public contact routes and drafts pitches (sent from the owner's mailbox once connected).",
    social.length
      ? `- Social: plans and drafts weekly; publishes directly to ${social.join(", ")} (connected). Other channels: export packs.`
      : "- Social: plans and drafts weekly; NO channel is connected for direct publishing yet, so posts go out via export packs until the owner connects one.",
    has("google_ads") || has("meta_ads")
      ? `- Ads: drafts within budget; ${[has("google_ads") ? "Google" : "", has("meta_ads") ? "Meta" : ""].filter(Boolean).join(" and ")} connected, so campaigns are created paused and go live only on the owner's approval.`
      : "- Ads: drafts within budget only; no ad account is connected, so the owner launches them.",
    "- Landing pages with lead forms, website chat, A/B tests on headlines, tracked short links, review requests, Pipeline (CRM) and Inbox: READY.",
    has("search_console") ? "- Search Console connected (data isn't used in plans yet)." : "",
    MODE_LINE[c.autonomy],
    "Benchmarks (not this business's results): cold email 1–3% reply and 20–40% of replies booking (grade B); creator pitches 10–20% replies (grade C).",
    "Rules: name which engine runs each play and its weekly volume; owner hours go to calls and closing, not production.",
    "Match the engine to the price: one-to-one outreach pays only when a customer is worth roughly $300+ in 12-month gross profit (or when targeting partners/agencies who bring many accounts). Low-price products lean on self-serve loops: comparison/SEO pages, integrations and marketplaces, referrals, creators and communities.",
  ];
  return lines.filter(Boolean).join("\n");
}
