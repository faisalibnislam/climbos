import { describe, expect, it } from "vitest";
import { planTask, playsTask } from "../../shared/agents/planTasks";
import { changesAsset, growthPlaysSpec, lintDistribution, lintPlanDistribution, routeGaps, strategySpec } from "../../shared/agents/specs";
import { distributionPair, scorecardText, type ScoredChannel } from "../../shared/acquisition/scoring";

type P = { name: string; route?: string; assetUsed: string; firstActionToday: string; mechanic?: string };

// Bench Run 6 outputs (B1 at 13b5be5), trimmed to the fields the checks read. The route field didn't exist yet.
const calcom: P = { name: "Cal.com comparison page", assetUsed: "Existing: https://meetrao.com/vs/cal-com", mechanic: "Improve a high-intent comparison page; measure signups and upgrades.", firstActionToday: "Revise the comparison table and free-plan CTA on the existing page." };
const coach: P = { name: "Coach event follow-up page", assetUsed: "Existing: https://meetrao.com/for/coaches", mechanic: "Use an existing coach page for a timely, audience-specific search path.", firstActionToday: "Rewrite the coach page around event follow-ups and its booking-link workflow." };
const MEETRAO_PLAN = {
  phases: [
    { name: "Foundation", days: "Early", focus: "Revise both existing pages, add tracking, and begin limited, unpaid validation." },
    { name: "Test and decide", days: "Middle", focus: "Review first-party signups, bookings, paid starts, and measured CAC; do not scale above $21." },
    { name: "Commit or change course", days: "By day 90", focus: "Continue only validated acquisition; seek qualified distribution or revisit goal and resources." },
  ],
  weekOneChecklist: [
    "Confirm current paid count and available owner hours; record the existing funnel baseline.",
    "Revise the Cal.com comparison table and free-plan CTA; owner approves publication.",
    "Rewrite the coach page; request approved event-resource distribution.",
    "UTM-tag both routes and track visits, signups, first bookings, paid starts, and source.",
    "Publish both edits for limited unpaid validation; do not scale without CAC evidence.",
  ],
};

describe("asset plays name a distribution route (bench Run 6, Meetrao)", () => {
  it("both Run 6 page plays fail: they edit pages with no route to them", () => {
    const issues = lintDistribution([calcom, coach]);
    expect(issues.map((i) => [i.rule, i.severity, i.path])).toEqual([
      ["distribution", "error", "plays[0].route"],
      ["distribution", "error", "plays[1].route"],
    ]);
    expect(issues[0].message).toMatch(/^"Cal\.com comparison page" changes or builds an asset, but its route names no route\./);
  });
  it("the fix passes: the comparison page paired with a creator test, labelled volume, cost and time", () => {
    const fixed = { ...calcom, route: "Creator test: pitch 10 scheduling YouTubers (planned), ~40 visits a week (assumption); $0, 1 owner hour a week." };
    expect(lintDistribution([fixed])).toEqual([]);
  });
  it("an unknown volume passes when it says how it will be measured", () => {
    expect(routeGaps("Post in r/coaching and two coach Slack groups; visits unknown, measured with UTM links in week 1; $0, 30 minutes a week.")).toEqual([]);
  });
  it("each missing part is named", () => {
    expect(routeGaps("The existing comparison page.")).toEqual(["names no channel", "gives no weekly volume (or how it will be measured)", "gives no cost", "gives no owner time"]);
    expect(routeGaps("Creator test, 40 visits a week; $0, 1 hour a week.")).toEqual(["doesn't label where its weekly volume comes from"]);
    expect(routeGaps("Creator test, 40 visits a week (assumption); 1 hour a week.")).toEqual(["gives no cost"]);
    expect(routeGaps("Creator test, 40 visits a week (assumption); $0.")).toEqual(["gives no owner time"]);
    expect(routeGaps("")).toEqual(["names no route"]);
    expect(routeGaps("n/a")).toEqual(["names no route"]);
  });
  it("waiting for search needs a measured number, or an active test beside it", () => {
    const hope = "Organic search to the page: ~25 visits a week (assumption); $0, no owner time.";
    expect(routeGaps(hope)).toEqual([expect.stringMatching(/^waits for search or existing traffic with no measured number/)]);
    expect(routeGaps("Organic search: 60 visits a week (owner: Search Console, last 4 weeks); $0, no owner time.")).toEqual([]);
    expect(routeGaps(`${hope} Plus a community test: post in two coach Facebook groups (planned).`)).toEqual([]);
    expect(routeGaps("Organic search, $0 and no search ads; ~25 visits a week (assumption); 1 hour a week.")).toHaveLength(1);
    expect(routeGaps("Google search ads on 'cal.com alternative': ~80 clicks a week (benchmark); $150, 1 hour a week.")).toEqual([]);
  });
  it("onboarding and trial changes route through new signups", () => {
    const onboarding: P = { name: "Trial-to-first-value onboarding", assetUsed: "https://folevi.com (existing trial and pricing flow).", firstActionToday: "Add the no-card, seven-day, 100-credit terms beside trial signup.", route: "New sign-ups from the site: ~5 trial starts a week (owner data); $0, 1 hour a week." };
    expect(changesAsset(onboarding)).toBe(true);
    expect(lintDistribution([onboarding])).toEqual([]);
    expect(lintDistribution([{ ...onboarding, route: "" }])).toHaveLength(1);
    const gate: P = { name: "Business feature-gate nudge", assetUsed: "To build: Business feature-trigger email flow.", firstActionToday: "Define the feature trigger and draft the upgrade email; identify the sending tool." };
    expect(changesAsset(gate)).toBe(true);
  });
  it("plays that are themselves the channel need no route", () => {
    const creators: P = { name: "Freelance-writer tutorial referrals", assetUsed: "https://involets.com/pricing; https://chromewebstore.google.com/detail/involets/nfpnodnmfkdggjkoabhlpjnllkikemma", mechanic: "Offer a disclosed 20% recurring referral share; creators demonstrate the invoice workflow.", firstActionToday: "Approve a disclosed 20% recurring referral offer; ClimbOS prepares writer-creator targets." };
    const cold: P = { name: "Agency team-size trigger", assetUsed: "https://taskeni.app/; https://taskeni.app/pricing", mechanic: "Use targeted cold email to reach larger agency teams.", firstActionToday: "Have ClimbOS build 150 agency contacts; approve the first email batch." };
    expect(changesAsset(creators)).toBe(false);
    expect(changesAsset(cold)).toBe(false);
    expect(lintDistribution([creators, cold])).toEqual([]);
  });
});

describe("the plan sends people to the pages it edits (bench Run 6, Meetrao)", () => {
  it("the Run 6 plan edits two pages and only 'seeks distribution' by day 90: fails", () => {
    const issues = lintPlanDistribution(MEETRAO_PLAN, 90);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", rule: "distribution", path: "weekOneChecklist" });
  });
  it("a dated route action passes", () => {
    const fixed = { ...MEETRAO_PLAN, weekOneChecklist: [...MEETRAO_PLAN.weekOneChecklist.slice(0, 4), "Pitch 10 scheduling creators the Cal.com page."] };
    expect(lintPlanDistribution(fixed, 90)).toEqual([]);
    const phased = { ...MEETRAO_PLAN, phases: [...MEETRAO_PLAN.phases, { name: "Route", days: "Days 1–21", focus: "Post the coach page in two coach Facebook groups." }] };
    expect(lintPlanDistribution(phased, 90)).toEqual([]);
  });
  it("an undated or late route doesn't count; a plan that edits no pages isn't checked", () => {
    const late = { ...MEETRAO_PLAN, phases: [...MEETRAO_PLAN.phases, { name: "Later", days: "Days 91–120", focus: "Pitch creators the page." }] };
    expect(lintPlanDistribution(late, 90)).toHaveLength(1);
    expect(lintPlanDistribution({ phases: [{ name: "Outbound", days: "0–30", focus: "Send 200 cold emails a week." }], weekOneChecklist: ["Approve the first batch."] }, 90)).toEqual([]);
  });
});

describe("scorecard pairs page channels with a sender", () => {
  const row = (id: string, family: ScoredChannel["family"], status: ScoredChannel["status"], score: number, paid = false): ScoredChannel => ({ id, name: id, family, exec: "auto", learn: "weeks", minMonthly: paid ? 300 : 0, paid, factors: {} as ScoredChannel["factors"], score, status, why: "" });
  it("names the best unpaid sender when every pick is a page channel", () => {
    const rows = [row("S09", "organic_search", "primary", 85), row("S10", "organic_search", "in_plan", 85), row("P01", "paid_search", "later", 80, true), row("R18", "creators", "later", 70), row("S08", "organic_search", "later", 79)];
    expect(distributionPair(rows)?.id).toBe("R18");
    expect(scorecardText(rows)).toMatch(/pair them with a route that sends qualified people, e\.g\. R18 R18 \(70\/100\)/);
  });
  it("says nothing when a pick already sends people", () => {
    const rows = [row("S09", "organic_search", "primary", 85), row("D01", "outreach", "in_plan", 80), row("R18", "creators", "later", 70)];
    expect(distributionPair(rows)).toBeUndefined();
    expect(scorecardText(rows)).not.toMatch(/pair them/);
  });
});

describe("wired into the specs and tasks", () => {
  it("growth-plays lint runs the route check", () => {
    const out = { portfolioNote: "", economics: { revenuePerCustomerMonthUsd: 6, grossMargin: 0.8, monthlyChurn: 0.05, basis: "", sources: {} }, plays: [{ ...calcom, route: "", oneLiner: "", kind: "bankable", audience: "a", trigger: "", hook: "h", test: "21 days", killIf: "k", scaleIf: "s", funnel: [], unit: "customers", horizonDays: 90, confidence: "low", biggestUnknown: "", scores: [3, 4, 3, 3, 3, 3, 3, 3], climbosCanDo: "", model: { weeklyReach: 10, weeklyReachLow: 5, weeklyReachHigh: 20, reachSource: { source: "assumption", ref: "", quote: "" }, steps: [], monthlySpendUsd: 0, spendSource: { source: "planned", ref: "", quote: "" }, ownerHoursPerWeek: 1, hoursSource: { source: "planned", ref: "", quote: "" } } }] };
    const rules = growthPlaysSpec().lint!(out as never, { task: "", brief: "", facts: [], untrustedContext: "https://meetrao.com/vs/cal-com" } as never).map((i) => i.rule);
    expect(rules).toContain("distribution");
  });
  it("growth-plan lint runs the plan route check", () => {
    const out = { ...MEETRAO_PLAN, summary: "", positioning: "", audiences: [], channels: [], constraints: [], measurementPlan: "", firstActions: [], diagnosis: "", affordableCac: "", notDoing: [], northStar: { metric: "", baseline: "", target: "3 by day 90" }, leadingIndicators: [], risks: [], experiments: [] };
    const rules = strategySpec().lint!(out as never, { task: "", brief: "", facts: [], constraints: { horizonDays: 90 } } as never).map((i) => i.rule);
    expect(rules).toContain("distribution");
  });
  it("the plays and plan tasks state the rule", () => {
    expect(playsTask({ scorecard: "", insights: "" })).toMatch(/also fills route: how qualified visitors reach it.*tagged owner, research, benchmark, planned or assumption.*cost and owner time/);
    expect(planTask({ locked: "", plays: null, scorecard: "", insights: "" })).toMatch(/gets its route as a dated action too/);
  });
});
