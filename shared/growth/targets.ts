/**
 * S6 (REQ-TARGET-01..06, REQ-CREATOR-01/03): a plan's target-heavy plays get
 * named targets from the existing Find customers / creator search, linked by
 * the play's stable ID. Pure and deterministic: which plays need targets,
 * what a creator's identity is, and how ready a play's targets honestly are.
 */

export type TargetKind = "customers" | "creators";

/** The play fields the classifier reads. */
export interface PlayText {
  name: string;
  oneLiner?: string;
  mechanic?: string;
  audience?: string;
  climbosCanDo?: string;
}

const CREATORS = /\b(creators?|influencers?|youtubers?|tiktokers?|instagrammers?|streamers?|ugc|podcast(?:er)?s?|newsletter (?:sponsor|swap|feature)s?)\b|creator finder/i;
const OUTBOUND = /\b(cold (?:email|outreach)|outbound|outreach|prospect(?:s|ing)?|find customers|partner(?:ship)?s?|resellers?|agencies|distributors|stockists|wholesale|account-based|abm|direct (?:sales|email))\b/i;

/**
 * Which search a play needs. The planner is told to name the engine that runs
 * each play, so "Creator finder" / "Find customers" in climbosCanDo decide first.
 */
export function targetKindOf(p: PlayText): TargetKind | null {
  const engine = p.climbosCanDo ?? "";
  if (/creator finder/i.test(engine)) return "creators";
  if (/find customers/i.test(engine)) return "customers";
  const text = [p.name, p.oneLiner, p.mechanic, engine].filter(Boolean).join(" ");
  if (CREATORS.test(text)) return "creators";
  if (OUTBOUND.test(text)) return "customers";
  return null;
}

/** The search brief for a play: its audience as the steer, a useful shortlist (REQ-TARGET-01: 5–10). */
export function targetBrief(p: PlayText): { who: string; where: string; count: number } {
  return { who: (p.audience || p.oneLiner || p.name).trim().slice(0, 300), where: "", count: 10 };
}

/* ---------------- creator identity (REQ-TARGET-03) ---------------- */

const PLATFORMS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(x\.com|twitter\.com)$/, "x"],
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)facebook\.com$/, "facebook"],
  [/(^|\.)threads\.net$/, "threads"],
  [/(^|\.)pinterest\.[a-z.]+$/, "pinterest"],
  [/(^|\.)twitch\.tv$/, "twitch"],
  [/(^|\.)substack\.com$/, "substack"],
];
/** Path segments that are pages, not accounts. */
const NOT_HANDLE = new Set(["p", "reel", "reels", "tv", "stories", "explore", "watch", "shorts", "video", "status", "posts", "in", "company", "channel", "c", "user", "pages", "pin"]);

/**
 * A creator's canonical identity: platform + handle from the profile path.
 * A shared domain (instagram.com) is never an identity on its own; two
 * creators on one platform stay distinct, and URL variants of one profile match.
 */
export function creatorIdentity(url: string): { platform: string; handle: string; key: string } | null {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
  const segs = u.pathname.split("/").filter(Boolean).map((s) => decodeURIComponent(s).toLowerCase());
  const platform = PLATFORMS.find(([re]) => re.test(host))?.[1];
  if (!platform) {
    // A creator's own site or a newsletter subdomain: the host is the identity.
    const sub = host.endsWith(".substack.com") ? host : null;
    return { platform: "web", handle: sub ?? host, key: `web:${sub ?? host}` };
  }
  if (platform === "substack" && host !== "substack.com") return { platform, handle: host.split(".")[0], key: `substack:${host.split(".")[0]}` };
  let handle: string | undefined;
  if (platform === "youtube") {
    // youtube.com/@name, /channel/UC…, /c/name, /user/name: the channel ID or handle, never /watch.
    if (segs[0]?.startsWith("@")) handle = segs[0];
    else if (["channel", "c", "user"].includes(segs[0] ?? "") && segs[1]) handle = `${segs[0]}/${segs[1]}`;
  } else if (platform === "linkedin") {
    if ((segs[0] === "in" || segs[0] === "company") && segs[1]) handle = `${segs[0]}/${segs[1]}`;
  } else if (platform === "facebook" && segs[0] === "profile.php") {
    const id = u.searchParams.get("id");
    if (id) handle = `id/${id}`;
  } else if (segs[0] && !NOT_HANDLE.has(segs[0])) {
    // The account is the first path segment; a post, reel or story URL names no account.
    handle = segs[0];
  }
  if (!handle) return null;
  handle = handle.replace(/^@/, platform === "youtube" ? "@" : "");
  return { platform, handle, key: `${platform}:${handle}` };
}

/* ---------------- readiness (REQ-TARGET-05, REQ-UX-04) ---------------- */

export type TargetState = "not_started" | "waiting" | "researching" | "failed" | "none_found" | "no_contact_route" | "needs_connection" | "ready";

export const TARGET_STATE_LABEL: Record<TargetState, string> = {
  not_started: "Not started",
  waiting: "Waiting",
  researching: "Researching",
  failed: "Search failed",
  none_found: "None found",
  no_contact_route: "Needs your input",
  needs_connection: "Needs connection",
  ready: "Ready",
};

/** Stages where the owner said no, or the relationship already exists: never contacted again from a new plan (REQ-TARGET-06). */
export const EXCLUDED_STAGES = new Set(["skipped", "lost"]);
export const IN_RELATIONSHIP_STAGES = new Set(["contacted", "replied", "booked", "won"]);

export interface TargetRow {
  stage: string;
  /** Only an address published verbatim on the target's own page. */
  publicEmail?: string | null;
  /** The email is on the workspace's suppression list (unsubscribed or bounced). */
  suppressed: boolean;
}

export interface Readiness {
  state: TargetState;
  /** One plain sentence: what's true and the next step. */
  note: string;
  found: number;
  /** Not excluded, not already in a relationship, not suppressed. */
  eligible: number;
  /** Eligible with a published contact route. */
  contactable: number;
  excluded: number;
  inRelationship: number;
}

export function targetReadiness(p: { kind: TargetKind; campaign: { status: string } | null; waitingReason?: string; targets: TargetRow[]; mailboxConnected: boolean }): Readiness {
  const found = p.targets.length;
  const excluded = p.targets.filter((t) => EXCLUDED_STAGES.has(t.stage) || t.suppressed).length;
  const inRelationship = p.targets.filter((t) => !EXCLUDED_STAGES.has(t.stage) && !t.suppressed && IN_RELATIONSHIP_STAGES.has(t.stage)).length;
  const eligibleRows = p.targets.filter((t) => !EXCLUDED_STAGES.has(t.stage) && !IN_RELATIONSHIP_STAGES.has(t.stage) && !t.suppressed);
  const contactable = eligibleRows.filter((t) => Boolean(t.publicEmail)).length;
  const counts = { found, eligible: eligibleRows.length, contactable, excluded, inRelationship };
  const who = p.kind === "creators" ? "creators" : "companies";
  const r = (state: TargetState, note: string): Readiness => ({ state, note, ...counts });
  if (!p.campaign) return p.waitingReason ? r("waiting", p.waitingReason) : r("not_started", `No ${who} searched for this play yet.`);
  if (p.campaign.status === "researching") return r("researching", `Your team is finding ${who} for this play.`);
  if (p.campaign.status === "failed" && !found) return r("failed", "The search didn't finish. Try again.");
  if (!found) return r("none_found", `No fitting ${who} found from public sources. Widen the audience or try another play.`);
  if (!eligibleRows.length) return r("none_found", `All ${found} found are already contacted, declined or opted out; none are contacted again.`);
  if (!contactable)
    return r("no_contact_route", p.kind === "creators" ? `${eligibleRows.length} profiles found; no public contact route. Reach out from each profile, or add an email you have.` : `${eligibleRows.length} companies found; none publishes an email. Add a contact or reach them another way.`);
  if (!p.mailboxConnected) return r("needs_connection", `${contactable} ready to contact. Connect your mailbox to send from it.`);
  return r("ready", `${contactable} ready to contact${eligibleRows.length > contactable ? `; ${eligibleRows.length - contactable} more without a public contact route` : ""}.`);
}
