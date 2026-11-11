/**
 * What ClimbOS itself runs for the owner, with realistic capacity. Engines
 * save production time but still need the owner's approvals and replies.
 * Static for now; S5 (REQ-ENG-11) generates it from each workspace's live
 * capabilities and connections.
 */
export const CAPACITY_EVIDENCE_POLICY = `Capabilities describe what software can prepare, not buyer demand, deliverability, audience size, consent or the owner's available time. Do not turn technical capacity into an outreach quota, assume a mailbox/list is connected, or quote a reply/conversion benchmark from this block. A proposed small scope is planned, never measured. Derive acquisition affordability from this business's confirmed contribution, retention, delivery costs and owner time; there is no universal customer-value cutoff. A low-price product can benefit from one-to-many earned distribution. A small manual recruitment test can answer a learning question without being a scalable acquisition channel. Never multiply an agency's clients into paid licenses unless the supplied billing terms and evidence support it. Missing economics stay unknown.`;

export const CLIMBOS_ENGINES = `WHAT CLIMBOS CAN PREPARE — actual sending/publishing requires the workspace's connection and permission checks. Production still needs the owner's time for reviews, replies and calls:
- Research fitting businesses and public business contact routes; prepare individual outreach drafts. An available, permitted audience and connected owner mailbox are not assumed.
- Find relevant creators and verify their coverage; prepare unsent editorial, collaboration or affiliate proposals with the arrangement clearly distinguished.
- Prepare channel-native posts, scripts and visual briefs. Direct publishing depends on connected supported accounts and exact approval scope; other channels use export packs.
- Draft landing pages, lead forms, website answers, tracked links, honest review invitations and measurement setups. Live destinations and an eligible consented audience are not assumed.
- Prepare Google/Meta ad drafts within a confirmed budget. Nothing launches from a plan.
${CAPACITY_EVIDENCE_POLICY}`;

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
      ? "- Find customers + outreach: READY. Researches fitting companies, keeps only published business emails, writes a first line each, prepares sends through the owner's connected mailbox within its actual limits and approved scope, follow-ups, stops on reply."
      : "- Find customers + outreach: finding and drafting are ready; SENDING NEEDS SETUP (connect the owner's mailbox under Connections). A play that relies on it must make that its first action.",
    "- Creator finder: READY. Finds relevant creators with public contact routes and drafts pitches (sent from the owner's mailbox once connected).",
    social.length
      ? `- Social: plans and drafts weekly; publishes directly to ${social.join(", ")} (connected). Other channels: export packs.`
      : "- Social: plans and drafts weekly; NO channel is connected for direct publishing yet, so posts go out via export packs until the owner connects one.",
    has("google_ads") || has("meta_ads")
      ? `- Ads: drafts within budget; ${[has("google_ads") ? "Google" : "", has("meta_ads") ? "Meta" : ""].filter(Boolean).join(" and ")} connected, so campaigns are created paused and go live only on the owner's approval.`
      : "- Ads: drafts within budget only; no ad account is connected, so the owner launches them.",
    "- Landing pages, lead forms, website answers, tracked links and measurement setups: drafting is ready. Live publication, experiments and review invitations require a verified destination, eligible audience and permission.",
    has("search_console") ? "- Search Console connected; use the actual query/page observations supplied with this run, not invented rankings." : "",
    MODE_LINE[c.autonomy],
    CAPACITY_EVIDENCE_POLICY,
    "Name the concrete draft or research ClimbOS can prepare now, and keep any action requiring unresolved setup or private facts separate. Only a proposed bounded test scope may be supplied when owner capacity is unknown.",
  ];
  return lines.filter(Boolean).join("\n");
}
