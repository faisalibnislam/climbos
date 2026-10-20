/**
 * Playbook decision contracts (expansion cycle 2). Each says what decision it
 * helps make, which constraint it works on, when it applies and when to avoid
 * it, what it requires, its steps, the outcome and harm to watch, and when to
 * stop, revise or expand, plus the fallback when it isn't eligible.
 *
 * Requirements come from the reviewed books (BK04 test cards' requirements,
 * BK06 volume needs, BK02 price fit, BK05 consent) and ClimbOS policy; they are
 * labelled heuristics, not laws. Eligibility is decided here, in code; the plays
 * agent only sees the result.
 *
 * Decision books (2026-10-20): every requirement has a class. A hard one
 * (no consent, no connection, wrong business type, no cash, no owner time,
 * a test that can't read at this traffic) blocks the playbook with the exact
 * reason. A preference (typical budget, price fit, customer base, a leak
 * further down) keeps it eligible at lower priority with its scope stated,
 * so a small, deliberate test isn't banned by a generic threshold. Unknown
 * inputs are listed as "check first", never treated as a pass or a fail.
 */
import type { BindingConstraint } from "../agents/decision";
import { sampleSize } from "../analysis/decisions";

export interface PlaybookContext {
  /** Acquisition library types. */
  types: string[];
  /** Monthly ad budget in USD terms (profile.budgetUsd). */
  budgetUsd: number;
  /** Eligible visitors a week (owner funnel), when known. */
  weeklyVisitors?: number;
  /** Consented email contacts in ClimbOS (capped at 1,000). */
  emailAudience?: number;
  /** Existing paying customers, when known. */
  customers?: number;
  /** Connected providers (e.g. "email_mailbox", "google_ads"). */
  connected: string[];
  /** Lowest price per customer per month, USD terms. */
  priceUsdMonth?: number;
  constraint: BindingConstraint | "unknown";
  geography?: string;
  ownerHoursPerWeek?: number;
  /** Cost per click for the business's search terms, when the owner or research knows it. */
  cpcUsd?: number;
  /** The owner's measured visitor → lead rate (sizes split tests on the real baseline). */
  leadRate?: number;
  /** Diagnosis status: only a supported constraint lowers playbooks that would feed a leak. */
  constraintStatus?: "supported" | "ambiguous" | "insufficient_evidence" | "conflicting_inputs";
}

/** hard: blocks the playbook; preference: keeps it eligible at lower priority, with the reason. */
export type RequirementClass = "hard" | "preference";

type Requirement = (
  | { kind: "budget_min"; usd: number; why: string }
  /** Paid clicks must be affordable at all (no budget blocks); readability depends on cost per click, so unknown CPC is "check first". */
  | { kind: "paid_test"; minClicks: number; why: string }
  /** A split test must finish within `weeks` for a 50% relative swing on the owner's baseline (falls back to `weeklyFallback` visitors when the baseline is unknown). */
  | { kind: "split_readable"; weeks: number; weeklyFallback: number; why: string }
  /** Lower priority while a measured leak sits further down (referrals and paid scale feed it). */
  | { kind: "no_leak"; constraints: BindingConstraint[]; why: string }
  | { kind: "traffic_min"; weekly: number; why: string }
  | { kind: "audience_min"; contacts: number; why: string }
  | { kind: "customers_min"; count: number; why: string }
  | { kind: "connection"; any: string[]; why: string }
  | { kind: "types_any"; types: string[]; why: string }
  | { kind: "types_none"; types: string[]; why: string }
  | { kind: "price_min"; usd: number; why: string }
  | { kind: "geography"; any: string[]; why: string }
  | { kind: "hours_min"; hours: number; why: string }
) & { class?: RequirementClass };

/** Default class by kind: consent, connections, business type, place, owner time and readability are hard; money and base-size floors are preferences. */
const DEFAULT_CLASS: Record<Requirement["kind"], RequirementClass> = {
  budget_min: "preference",
  paid_test: "hard",
  split_readable: "hard",
  no_leak: "preference",
  traffic_min: "hard",
  audience_min: "hard",
  customers_min: "preference",
  connection: "hard",
  types_any: "hard",
  types_none: "hard",
  price_min: "preference",
  geography: "hard",
  hours_min: "hard",
};

export interface Playbook {
  id: string;
  name: string;
  /** The decision it helps the owner make. */
  decision: string;
  worksOn: BindingConstraint[];
  appliesWhen: string;
  avoidWhen: string;
  requires: Requirement[];
  steps: string[];
  outcome: string;
  /** Harm to monitor while it runs. */
  guardrail: string;
  stop: string;
  revise: string;
  expand: string;
  /** Playbook ids to use instead when this one isn't eligible. */
  alternatives: string[];
  /** Finds this playbook in a play's words (for the eligibility check). */
  signature: RegExp;
  /** Where the rules come from (book chapter refs or ClimbOS policy). */
  source: string;
}

const B2B = ["b2b_saas", "enterprise_software", "developer_tools", "agency", "consulting", "professional_services"];
const LOCAL = ["local_services", "healthcare", "hospitality", "food_beverage", "physical_retail", "events"];
const SELF_SERVE = ["b2b_saas", "b2c_saas", "mobile_app", "desktop_app", "ai_product", "digital_products", "developer_tools"];

export const PLAYBOOKS: Playbook[] = [
  {
    id: "PB-interviews",
    name: "Customer episode interviews",
    decision: "Which obstacle or buying situation to fix first",
    worksOn: ["demand", "activation", "conversion", "offer", "positioning", "retention"],
    appliesWhen: "The constraint is unknown or its cause is unclear; any traffic level.",
    avoidWhen: "Never as the only step for a measured, well-understood leak.",
    requires: [],
    steps: ["Pick one segment and one recent episode to reconstruct (signup, cancel, stalled deal)", "Talk to 5–10 people; ask about the last time, not opinions", "Tag notes: facts, commitments, compliments (not data)", "Stop when conversations stop adding new facts"],
    outcome: "A named obstacle seen in several conversations",
    guardrail: "No pitching during discovery; no list-building without consent",
    stop: "No new facts after 5 conversations in a segment",
    revise: "Answers scattered after ~10: narrow the segment",
    expand: "A repeated obstacle: test a repair",
    alternatives: [],
    signature: /\b(customer|user)?\s*interviews?\b|\bcustomer (?:calls|conversations)\b/i,
    source: "BK05 Ch 1–3, 6–8; BK04 discovery cards",
  },
  {
    id: "PB-activation-repair",
    name: "First-value repair",
    decision: "Whether fixing setup lifts paid conversion more than adding traffic",
    worksOn: ["activation"],
    appliesWhen: "Leads arrive but few reach first value.",
    avoidWhen: "Few leads at all, or no way to see who reached first value.",
    requires: [{ kind: "types_any", types: SELF_SERVE, why: "needs a product people set up themselves" }],
    steps: ["Define the first-value event and window", "Watch 3–5 new users try it; list where they stall", "Fix one obstacle", "Measure first-value share and paid conversion for new signups, whole weeks"],
    outcome: "Share of new signups reaching first value, then paid",
    guardrail: "Support tickets and refunds don't rise",
    stop: "No change after the planned weeks: the obstacle was elsewhere",
    revise: "First value up, paid flat: look at the offer or price",
    expand: "Both up: fix the next obstacle, then add traffic",
    alternatives: ["PB-interviews"],
    signature: /\b(onboard\w*|activation|first value|setup flow|getting started)\b/i,
    source: "Pack BT-01; BK01 Ch 8; BK06 Ch 6",
  },
  {
    id: "PB-comparison-page",
    name: "Comparison and alternative pages",
    decision: "Whether buyers already searching for alternatives convert",
    worksOn: ["demand", "positioning"],
    appliesWhen: "Buyers compare named alternatives; the business can state verified differences.",
    avoidWhen: "No verified difference to state; local services found by place, not by comparison.",
    requires: [{ kind: "types_none", types: LOCAL, why: "local customers search by place and service, not by product comparison" }],
    steps: ["List real alternatives incl. doing nothing", "State verified differences only", "Publish one page per main alternative", "Route visitors to it (community answers, existing users, partners)"],
    outcome: "Signups or leads from the pages",
    guardrail: "No unverifiable claims about competitors",
    stop: "No impressions after 8 weeks: wrong queries",
    revise: "Visits but no signups: fix the page's promise",
    expand: "Signups at or above site average: add the next alternative",
    alternatives: ["PB-interviews"],
    signature: /\b(comparison|vs\.?|versus|alternatives?)\s+pages?\b|\balternative to\b/i,
    source: "BK03 Steps 4–8; library S09/S10",
  },
  {
    id: "PB-paid-search-test",
    name: "Capped paid search test",
    decision: "Whether paid search brings customers below their value",
    worksOn: ["demand"],
    appliesWhen: "Buyers search for the service; conversion is tracked; the budget can buy a readable sample.",
    avoidWhen: "Low price per customer, no conversion tracking, or a leak further down the funnel.",
    requires: [
      { kind: "paid_test", minClicks: 100, why: "a search test needs enough clicks to read (about 100 a month is a small, learning-only test)" },
      { kind: "price_min", usd: 25, why: "below $25 a month per customer paid clicks rarely pay back; check the break-even cost per click first" },
      { kind: "no_leak", constraints: ["activation", "retention", "conversion"], why: "a measured leak further down: run only as a capped test that also reads lead quality, no expansion" },
    ],
    steps: ["Pick 1–2 high-intent themes", "Set a hard spend cap and a stop date", "Track paid conversions, not clicks", "Read once at the planned end"],
    outcome: "Cost per paying customer vs what one is worth",
    guardrail: "Spend never above the cap; no national reach for a local business",
    stop: "Cost per customer above value at the planned end",
    revise: "Clicks but no conversions: fix the landing page first",
    expand: "Below value with a readable sample: raise the cap in steps",
    alternatives: ["PB-comparison-page", "PB-local-listing"],
    signature: /\b(google|search|ppc|paid search|bing)\s*ads?\b|\bpaid search\b/i,
    source: "BK02 Ch 8 price fit; BK04 ad cards; BK06 Ch 2",
  },
  {
    id: "PB-local-listing",
    name: "Local listing and reviews",
    decision: "Whether better local visibility fills open slots",
    worksOn: ["demand"],
    appliesWhen: "Customers find the business by place.",
    avoidWhen: "The business doesn't serve a local area.",
    requires: [{ kind: "geography", any: ["local", "regional"], why: "only for businesses customers find by place" }],
    steps: ["Complete the profile and services", "Ask recent customers for reviews (email or SMS)", "Add photos and answer questions weekly"],
    outcome: "Calls, bookings and direction requests from the listing",
    guardrail: "No incentivised or fake reviews",
    stop: "No change in calls after 8 weeks",
    revise: "Views up, calls flat: fix services and hours",
    expand: "Calls up: add a second location page or service",
    alternatives: ["PB-referrals"],
    signature: /\b(google business profile|gbp|local listing|google maps|reviews? requests?|yelp)\b/i,
    source: "Library local channels; base rates (review requests)",
  },
  {
    id: "PB-referrals",
    name: "Referral moment",
    decision: "Whether happy customers bring similar customers",
    worksOn: ["demand"],
    appliesWhen: "There are active, satisfied customers and a natural moment to share.",
    avoidWhen: "Few customers, or activation and retention are weak (referrals feed a leak).",
    requires: [
      { kind: "customers_min", count: 20, why: "referral participation is 3–15% of customers, so a programme needs a base; with fewer, ask happy customers personally" },
      { kind: "no_leak", constraints: ["activation", "retention"], why: "activation or retention is the measured weak link, so referrals would feed a leak" },
    ],
    steps: ["Pick the moment right after first value or a good result", "Add the share link or invite there", "Count invites and referred signups"],
    outcome: "Referred new customers",
    guardrail: "No pressure tactics; rewards disclosed",
    stop: "Under 3% of customers share after 4 weeks",
    revise: "Shares but no signups: fix the landing for referred visitors",
    expand: "Referred customers retain: add a second moment",
    alternatives: ["PB-interviews", "PB-comparison-page"],
    signature: /\breferr\w*\b|\binvite (?:a |your )?(?:friend|colleague|teammate)/i,
    source: "Base rates (referral participation); lens 5 referral drivers",
  },
  {
    id: "PB-lifecycle-email",
    name: "Lifecycle email to consented contacts",
    decision: "Whether timely emails lift activation or repeat purchase",
    worksOn: ["activation", "retention", "conversion"],
    appliesWhen: "There are consented contacts or product-update permission.",
    avoidWhen: "No consented list; cold contacts (never via ClimbOS's own email service).",
    requires: [{ kind: "audience_min", contacts: 50, why: "needs consented contacts to email (no list is assumed)" }],
    steps: ["Pick one moment (signup, stalled setup, lapsed)", "Write one short email with one action", "Hold out a share where volume allows", "Measure the action, not opens"],
    outcome: "Activation or repeat purchase among recipients",
    guardrail: "Unsubscribes and complaints stay low; opens aren't the goal",
    stop: "Unsubscribes rise above normal",
    revise: "Clicks without the action: fix the page it leads to",
    expand: "Action up vs holdout: add the next moment",
    alternatives: ["PB-activation-repair", "PB-lead-magnet"],
    signature: /\b(welcome|onboarding|nurture|win-?back|lifecycle|drip)\s+(?:email|sequence|flow)s?\b|\bemail (?:sequence|flow|newsletter)\b/i,
    source: "BK05 consent; pack RULE-05; BK06 Ch 7 (opens mislead)",
  },
  {
    id: "PB-lead-magnet",
    name: "Build a consented list",
    decision: "Whether a useful free resource builds an audience to email later",
    worksOn: ["demand"],
    appliesWhen: "No email audience yet and buyers research before buying.",
    avoidWhen: "Impulse purchases where a list adds little.",
    requires: [],
    steps: ["Offer one specific resource", "Ask for opt-in clearly", "Send one welcome with a next step"],
    outcome: "Opt-ins and their later conversion",
    guardrail: "Clear consent; no bought or scraped lists",
    stop: "Under 1% of visitors opt in after 4 weeks",
    revise: "Opt-ins but no later buyers: wrong resource or audience",
    expand: "Opt-ins convert: promote the resource",
    alternatives: [],
    signature: /\b(lead magnet|newsletter signup|opt-?in|free (?:guide|template|checklist))\b/i,
    source: "Pack RULE-05; BK05 Ch 6",
  },
  {
    id: "PB-cold-outreach",
    name: "Personal cold outreach (owner's mailbox)",
    decision: "Whether a narrow, well-fit list replies and books calls",
    worksOn: ["demand"],
    appliesWhen: "B2B, a price that pays for personal selling, and the owner's own mailbox connected.",
    avoidWhen: "Low price per customer, consumers, or no connected mailbox; never through ClimbOS's email service.",
    requires: [
      { kind: "types_any", types: B2B, why: "personal outreach suits business buyers" },
      { kind: "price_min", usd: 100, why: "personal selling needs a price that pays for the time" },
      { kind: "connection", any: ["email_mailbox"], why: "sends only from the owner's own mailbox" },
    ],
    steps: ["Pick 50 well-fit companies with a trigger", "Write a short, specific first message", "One follow-up, then stop", "Count replies and booked calls"],
    outcome: "Booked calls and deals",
    guardrail: "Unsubscribe honoured; bounce and complaint rates low",
    stop: "Under 1% reply after 100 contacts",
    revise: "Replies but no calls: fix the ask",
    expand: "Deals at a good cost: add the next segment",
    alternatives: ["PB-comparison-page", "PB-partners"],
    signature: /\bcold (?:email|outreach|dm|message)s?\b|\boutbound\b/i,
    source: "Base rates (cold email); pack RULE-05/06; BK02 Ch 8",
  },
  {
    id: "PB-partners",
    name: "One distribution partner",
    decision: "Whether a partner with the same buyers sends qualified people",
    worksOn: ["demand"],
    appliesWhen: "Another business already serves the same buyers.",
    avoidWhen: "Very low price per customer, where recruiting partners one by one can't pay back.",
    requires: [{ kind: "price_min", usd: 25, why: "recruiting partners one by one rarely pays back below $25 a month" }],
    steps: ["List 10 businesses with your buyers", "Offer something useful to their customers", "Start with one partner and one placement"],
    outcome: "Signups or leads from the partner",
    guardrail: "Clear terms; no misleading co-branding",
    stop: "No leads after the first placement",
    revise: "Visits, no signups: fix the offer for their audience",
    expand: "Leads convert: add a second partner",
    alternatives: ["PB-comparison-page", "PB-referrals"],
    signature: /\bpartner(?:ship)?s?\b|\bnewsletter sponsor\w*\b|\bco-?market\w*\b/i,
    source: "Library partnership channels; price fit",
  },
  {
    id: "PB-pricing-test",
    name: "Offer and package test",
    decision: "Whether a clearer package or price converts better without hurting margin",
    worksOn: ["conversion", "offer", "economics"],
    appliesWhen: "Interested people don't buy, or margin is below target.",
    avoidWhen: "Too few buyers to read a difference, unless it's a deliberate, reversible change for new customers only.",
    requires: [],
    steps: ["Write the pricing decision down (goal, floor, max discount)", "Change one thing (package, anchor, billing unit) for new buyers", "Measure paid conversion and margin together"],
    outcome: "Paid conversion and contribution per customer",
    guardrail: "Existing customers' terms unchanged; no decoy tiers or hidden costs",
    stop: "Conversion flat and margin down",
    revise: "Conversion up, margin down: adjust the package",
    expand: "Both hold: keep and test the next lever",
    alternatives: ["PB-interviews"],
    signature: /\b(pricing|price|package|tier|plan)\s+(?:test|change|experiment)\b|\bnew (?:package|tier|plan)\b/i,
    source: "BK02 Ch 7–8, 11–12",
  },
  {
    id: "PB-capacity",
    name: "Fill capacity before adding demand",
    decision: "Whether pricing, selectivity or scheduling serves demand better than more marketing",
    worksOn: ["delivery"],
    appliesWhen: "New customers are close to what the business can serve.",
    avoidWhen: "There is plenty of room.",
    requires: [],
    steps: ["Measure booked vs available capacity weekly", "Raise price or minimums for new work, or add a waitlist", "Fill gaps with off-peak offers"],
    outcome: "Revenue per available slot and wait time",
    guardrail: "Service quality and response time hold",
    stop: "Bookings fall below capacity after the change",
    revise: "Waitlist grows: add capacity",
    expand: "Room opens: resume demand plays",
    alternatives: [],
    signature: /\b(waitlist|capacity|selectiv\w*|minimum (?:order|project)|price increase|raise (?:the )?prices?)\b/i,
    source: "BK01 Ch 8; pack BT-03/BT-05",
  },
  {
    id: "PB-price-increase",
    name: "Plan-by-plan price increase with proof of value",
    decision: "Whether to raise prices, on which plans and for whom",
    worksOn: ["economics", "delivery", "offer"],
    appliesWhen: "Value or costs grew since the last price change, a flat or unlimited plan draws heavy users, or demand exceeds capacity.",
    avoidWhen: "The real problem is weak value, delivery or communication (fix that first), or contracts forbid a change before renewal.",
    requires: [],
    steps: ["Write down what got better or cost more since the last price", "Raise one plan first, for new buyers; protect the entry price", "Check break-even churn: how many customers could leave before revenue falls", "Existing customers only with notice and the owner's go-ahead"],
    outcome: "Revenue and contribution per customer, at stable churn",
    guardrail: "Churn and refunds of affected customers; no change to existing terms without notice",
    stop: "Churn of affected customers passes the break-even level",
    revise: "New buyers drop sharply: add a lower plan or narrow the change",
    expand: "Holds for new buyers: plan the change for existing customers with notice",
    alternatives: ["PB-pricing-test", "PB-capacity"],
    signature: /\b(price increase|raise (?:the |our )?prices?|increase (?:the |our )?prices?|repric\w*)\b/i,
    source: "Growth Unhinged (GU-08, GU-02); BK02 Ch 8, 12; blog research BRP-06",
  },
  {
    id: "PB-landing-split",
    name: "Landing page split test",
    decision: "Which message converts better on a page with steady traffic",
    worksOn: ["positioning", "conversion"],
    appliesWhen: "The page gets enough visitors to read a difference in weeks.",
    avoidWhen: "Low traffic: use a before/after or interviews instead.",
    requires: [{ kind: "split_readable", weeks: 6, weeklyFallback: 700, why: "a split test must finish in about 6 weeks for a big (50% relative) change" }],
    steps: ["One big change, not a tweak", "Fix the sample and end date in advance", "Check the split matches the plan", "Read once at the end"],
    outcome: "Signups or paid conversion",
    guardrail: "Refunds and support don't rise",
    stop: "Planned end reached: decide once",
    revise: "No difference: test a bigger change",
    expand: "A clear win: keep it, test the next message",
    alternatives: ["PB-interviews", "PB-pricing-test"],
    signature: /\b(a\/b|split|ab)\s+test\w*\b|\blanding page test\b/i,
    source: "BK04 landing page/split test cards; BK06 Ch 2–3, 21",
  },
  {
    id: "PB-concierge",
    name: "Concierge pilot",
    decision: "Whether the result is valuable before automating it",
    worksOn: ["offer", "activation"],
    appliesWhen: "Value is unproven and delivering by hand is possible.",
    avoidWhen: "Customers would be told it's automated (disclose the human help).",
    requires: [{ kind: "hours_min", hours: 3, why: "needs owner time to deliver by hand" }],
    steps: ["Recruit 3–5 well-fit customers", "Deliver by hand; log minutes and exceptions", "Ask for a commitment (pay or renew)"],
    outcome: "Commitments and delivery cost per customer",
    guardrail: "Human help disclosed; no automation claims",
    stop: "Nobody commits after the pilot",
    revise: "Commit but costly: find what to automate first",
    expand: "Commit at a workable cost: automate one step",
    alternatives: ["PB-interviews"],
    signature: /\bconcierge\b|\bwizard of oz\b|\bmanual pilot\b|\bdone[- ]for[- ]you pilot\b/i,
    source: "BK04 concierge/Wizard of Oz cards; pack RECONCILIATION §9",
  },
  {
    id: "PB-social-content",
    name: "Owner-led social content",
    decision: "Whether regular posts build qualified attention",
    worksOn: ["demand", "positioning"],
    appliesWhen: "The owner can show the work and post steadily.",
    avoidWhen: "No time to post, or a leak further down the funnel.",
    requires: [
      { kind: "hours_min", hours: 2, why: "steady posting needs owner time even with drafts done" },
      { kind: "no_leak", constraints: ["activation", "retention", "conversion"], why: "a measured leak further down: attention added now would leak" },
    ],
    steps: ["Pick one platform where buyers are", "Post 3 times a week from real work", "Track profile visits to signups"],
    outcome: "Signups or inquiries from social",
    guardrail: "No engagement bait; views aren't the goal",
    stop: "No inquiries after 8 weeks",
    revise: "Views without inquiries: fix the call to action",
    expand: "Inquiries convert: add a second format",
    alternatives: ["PB-comparison-page", "PB-local-listing"],
    signature: /\b(instagram|linkedin|tiktok|facebook|social)\s+(?:posts?|content|calendar)\b|\bpost (?:\d+|three|3) times\b/i,
    source: "Library social channels; lens 4 (vanity metrics)",
  },
];

const fmtUsd = (n: number) => `$${n}`;

/** Whether a playbook fits this business now; unknown inputs are listed, not assumed. Hard failures block; preferences lower priority. */
export function eligibility(pb: Playbook, ctx: PlaybookContext): { eligible: boolean; reasons: string[]; soft: string[]; unknown: string[]; status: "eligible" | "needs_evidence" | "low_priority" | "blocked" } {
  const reasons: string[] = [];
  const soft: string[] = [];
  const unknown: string[] = [];
  for (const r of pb.requires) {
    const fail = (msg: string) => ((r.class ?? DEFAULT_CLASS[r.kind]) === "hard" ? reasons : soft).push(msg);
    switch (r.kind) {
      case "budget_min":
        if (ctx.budgetUsd < r.usd) fail(`${r.why} (budget ${fmtUsd(ctx.budgetUsd)})`);
        break;
      case "paid_test":
        if (!(ctx.budgetUsd > 0)) reasons.push("no ad budget: paid clicks cost money");
        else if (ctx.cpcUsd === undefined || !(ctx.cpcUsd > 0)) unknown.push("cost per click for your search terms");
        else if (ctx.budgetUsd / ctx.cpcUsd < r.minClicks) soft.push(`about ${Math.round(ctx.budgetUsd / ctx.cpcUsd)} clicks a month at ${fmtUsd(ctx.cpcUsd)} each: a learning test that reads only a big difference`);
        break;
      case "split_readable": {
        if (ctx.weeklyVisitors === undefined) {
          unknown.push("weekly visitors");
          break;
        }
        const base = ctx.leadRate !== undefined && ctx.leadRate > 0 && ctx.leadRate < 0.67 ? ctx.leadRate : null;
        const need = base ? sampleSize({ baseline: base, minDetectable: base * 0.5 }).total : r.weeklyFallback * r.weeks;
        const weeks = ctx.weeklyVisitors > 0 ? need / ctx.weeklyVisitors : Infinity;
        if (weeks > r.weeks) fail(`${r.why}: about ${Math.round(ctx.weeklyVisitors)} visitors a week ${base ? `at your ${Math.round(base * 1000) / 10}% lead rate needs about ${Number.isFinite(weeks) ? Math.ceil(weeks) : "∞"} weeks` : `is below the ${r.weeklyFallback}-a-week rule of thumb (your lead rate isn't known)`}`);
        break;
      }
      case "no_leak":
        if (ctx.constraintStatus === "supported" && r.constraints.includes(ctx.constraint as BindingConstraint)) soft.push(r.why);
        break;
      case "traffic_min":
        if (ctx.weeklyVisitors === undefined) unknown.push("weekly visitors");
        else if (ctx.weeklyVisitors < r.weekly) fail(`${r.why} (about ${Math.round(ctx.weeklyVisitors)} a week)`);
        break;
      case "audience_min":
        if (ctx.emailAudience === undefined) unknown.push("consented contacts");
        else if (ctx.emailAudience < r.contacts) fail(`${r.why} (${ctx.emailAudience} consented contacts)`);
        break;
      case "customers_min":
        if (ctx.customers === undefined) unknown.push("current customers");
        else if (ctx.customers < r.count) fail(`${r.why} (${ctx.customers} customers)`);
        break;
      case "connection":
        if (!r.any.some((p) => ctx.connected.includes(p))) fail(r.why);
        break;
      case "types_any":
        if (!ctx.types.some((t) => r.types.includes(t))) fail(r.why);
        break;
      case "types_none":
        if (ctx.types.some((t) => r.types.includes(t))) fail(r.why);
        break;
      case "price_min":
        if (ctx.priceUsdMonth === undefined) unknown.push("price per customer");
        else if (ctx.priceUsdMonth < r.usd) fail(`${r.why} (about ${fmtUsd(Math.round(ctx.priceUsdMonth))} a month)`);
        break;
      case "geography":
        if (ctx.geography === undefined) unknown.push("where customers are");
        else if (!r.any.includes(ctx.geography)) fail(r.why);
        break;
      case "hours_min":
        if (ctx.ownerHoursPerWeek === undefined) unknown.push("owner hours a week");
        else if (ctx.ownerHoursPerWeek < r.hours) fail(`${r.why} (${ctx.ownerHoursPerWeek} h a week)`);
        break;
    }
  }
  const status = reasons.length ? "blocked" : soft.length ? "low_priority" : unknown.length ? "needs_evidence" : "eligible";
  return { eligible: reasons.length === 0, reasons, soft, unknown, status };
}

export interface PlaybookChoice {
  /** Not blocked: fits now, needs a check first, or fits at lower priority (with why). */
  eligible: { pb: Playbook; unknown: string[]; soft?: string[]; status?: ReturnType<typeof eligibility>["status"] }[];
  ineligible: { pb: Playbook; reasons: string[] }[];
}

/** Eligible playbooks, those working on the computed constraint first. */
export function choosePlaybooks(ctx: PlaybookContext): PlaybookChoice {
  const rows = PLAYBOOKS.map((pb) => ({ pb, e: eligibility(pb, ctx) }));
  const onConstraint = (pb: Playbook) => (ctx.constraint !== "unknown" && pb.worksOn.includes(ctx.constraint) ? 0 : 1);
  const rank = { eligible: 0, needs_evidence: 1, low_priority: 2, blocked: 3 } as const;
  return {
    eligible: rows
      .filter((r) => r.e.eligible)
      .sort((a, b) => onConstraint(a.pb) - onConstraint(b.pb) || rank[a.e.status] - rank[b.e.status])
      .map((r) => ({ pb: r.pb, unknown: r.e.unknown, soft: r.e.soft, status: r.e.status })),
    ineligible: rows.filter((r) => !r.e.eligible).map((r) => ({ pb: r.pb, reasons: r.e.reasons })),
  };
}

/** The choice as the plays agent reads it: what fits, in order, with stop rules; what doesn't, and the fallback. */
export function playbookBrief(choice: PlaybookChoice): string {
  const name = (id: string) => PLAYBOOKS.find((p) => p.id === id)?.name ?? id;
  return [
    "PLAYBOOKS THAT FIT (code-checked; prefer the first ones, which work on the diagnosed constraint):",
    ...choice.eligible.slice(0, 8).map(({ pb, unknown, soft }) => {
      const leak = pb.requires.some((r) => r.kind === "no_leak") && soft?.some((x) => pb.requires.some((r) => r.kind === "no_leak" && r.why === x));
      return `- ${pb.name}: ${pb.decision}. Steps: ${pb.steps.join("; ")}. Watch: ${pb.guardrail}. Stop: ${pb.stop}.${leak ? " Capped test only: no expansion this plan." : ` Expand: ${pb.expand}.`}${soft?.length ? ` Lower priority: ${soft.join("; ")}.` : ""}${unknown.length ? ` Check first: ${unknown.join(", ")}.` : ""}`;
    }),
    ...(choice.ineligible.length ? ["NOT ELIGIBLE NOW (don't build plays on these):", ...choice.ineligible.map(({ pb, reasons }) => `- ${pb.name}: ${reasons.join("; ")}.${pb.alternatives.length ? ` Instead: ${pb.alternatives.map(name).join(" or ")}.` : ""}`)] : []),
  ].join("\n");
}

/** The same check from saved ids (what an agent's constraints carry). */
export function lintEligibilityIds(plays: Parameters<typeof lintEligibility>[0], ineligible: { id: string; reasons: string[] }[] | undefined) {
  if (!ineligible?.length) return [];
  const rows = ineligible.flatMap((x) => {
    const pb = PLAYBOOKS.find((p) => p.id === x.id);
    return pb ? [{ pb, reasons: x.reasons }] : [];
  });
  return lintEligibility(plays, { eligible: [], ineligible: rows });
}

/** Plays built on a playbook the business isn't eligible for. */
export function lintEligibility(plays: { name?: string; oneLiner?: string; mechanic?: string; route?: string; firstActionToday?: string }[], choice: PlaybookChoice | undefined) {
  if (!choice) return [];
  const issues: { severity: "error"; rule: string; message: string; path: string }[] = [];
  plays.forEach((p, i) => {
    const text = `${p.name ?? ""} ${p.oneLiner ?? ""} ${p.mechanic ?? ""} ${p.route ?? ""} ${p.firstActionToday ?? ""}`;
    const hit = choice.ineligible.find(({ pb }) => pb.signature.test(text));
    if (hit) issues.push({ severity: "error", rule: "eligibility", message: `"${p.name ?? `Play ${i + 1}`}" relies on ${hit.pb.name}, which doesn't fit now: ${hit.reasons.join("; ")}.${hit.pb.alternatives.length ? ` Use ${hit.pb.alternatives.map((id) => PLAYBOOKS.find((x) => x.id === id)?.name ?? id).join(" or ")} instead.` : ""}`, path: `plays[${i}]` });
  });
  return issues;
}
