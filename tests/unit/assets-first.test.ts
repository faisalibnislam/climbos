import { describe, expect, it } from "vitest";
import { planTask, playsTask } from "../../shared/agents/planTasks";
import { durationDays, growthPlaysSpec, lintActionPlan, lintAssetsFirst, lintExistingTest, phaseEndDay, strategySpec } from "../../shared/agents/specs";

type P = { assetUsed: string; test: string; firstActionToday: string; mechanic?: string; funnel?: string[]; horizonDays?: number };
const play = (o: Partial<P>): P => ({ assetUsed: "", test: "", firstActionToday: "", mechanic: "", funnel: [], horizonDays: 90, ...o });

// Bench Run 5 outputs (B1 at 6417aba), trimmed to the fields the checks read.
const MEETRAO_EVIDENCE = "RESEARCH NOTES\nhttps://meetrao.com/vs/cal-com compares Meetrao and Cal.com.\nhttps://meetrao.com/for/coaches\nhttps://meetrao.com/pricing\nhttps://cal.com/pricing";
const meetrao = play({
  assetUsed: "https://meetrao.com/vs/cal-com; https://meetrao.com/for/coaches; build four comparison pages.",
  test: "Publish four accurate competitor pages beside the existing Cal.com page; measure for 45 days.",
  firstActionToday: "Draft a fact-check matrix for the five named schedulers.",
  mechanic: "ClimbOS drafts five SEO pages; plan for 577 visits weekly at maturity.",
  funnel: ["Visitor→account: 1–5%; likely 3% (niche-page benchmark).", "Account→paid: 2–10%; likely 5% (assumption)."],
});
const FOLEVI_EVIDENCE = "RESEARCH NOTES\nhttps://folevi.com/ notes app.\nhttps://folevi.com/compare\nhttps://folevi.com/pricing\nhttps://novel-november.com/";
const folevi = [
  play({ assetUsed: "https://folevi.com/; To build: onboarding sequence.", test: "Enroll up to 90 opt-in signups over 90 days; $0 ads; cap owner time at 2 hours.", firstActionToday: "Draft the first-note email and a plain-language plan-choice email." }),
  play({ assetUsed: "https://folevi.com/compare; https://novel-november.com/; To build: writing page.", test: "Build one page; measure 100 qualified visits or stop at 90 days; $0 ads; cap owner time at 2 hours.", firstActionToday: "Draft a Novel November page around linked notes, tasks, and offline editing." }),
];
const FOLEVI_PLAN = {
  summary: "The uncalibrated play scenarios total ≈0.1 customers. They are not predictions and should not launch at these economics.",
  phases: [
    { name: "Foundation", days: "Week one", focus: "Set the numeric goal; export billing, signup sources, consent, and actual unit economics." },
    { name: "Validation", days: "After inputs are verified", focus: "Build the cohort scorecard; keep both acquisition plays paused." },
    { name: "Review", days: "Through day 90", focus: "Compare observed outcomes with the goal; reconsider plays only if CAC fits the $11 ceiling." },
  ],
  weekOneChecklist: ["Set the numeric customer target under Business & goal.", "Confirm the revenue assumption and review plan mix.", "Export billing cohorts, signup sources, and consent.", "Track opt-ins, first notes, visits, signups, and upgrades.", "Create a scorecard separating modeled cost from cash spend."],
  experiments: [{ method: "export_instructions", durationDays: 90, stoppingRule: "Do not launch either play until observed CAC fits the $11 ceiling." }],
};

describe("existing assets first (bench Run 5, Meetrao)", () => {
  it("four new comparison pages beside an unused existing one fail twice: start from it, and no batch without a baseline", () => {
    const issues = lintAssetsFirst([meetrao], MEETRAO_EVIDENCE);
    expect(issues.map((i) => i.rule)).toEqual(["assets_first", "assets_first"]);
    expect(issues[0]).toMatchObject({ severity: "error", path: "plays[0].firstActionToday" });
    expect(issues[0].message).toMatch(/existing comparison page \(meetrao\.com\/vs\/cal-com\)/);
    expect(issues[1]).toMatchObject({ severity: "error", path: "plays[0].test" });
    expect(issues[1].message).toMatch(/Commits to 5 new SEO pages at once with no demand baseline\. Start with the existing meetrao\.com\/vs\/cal-com/);
  });
  it("the fix passes: improve the Cal.com page first, more pages gated in scaleIf", () => {
    const fixed = play({
      assetUsed: "Existing comparison page: https://meetrao.com/vs/cal-com",
      test: "Refresh the Cal.com page and its free-plan route; 500 visits over 45 days.",
      firstActionToday: "Update the Cal.com page with verified pricing and a clear free route.",
      mechanic: "Improve the page that already ranks. If it converts at 3%, add four more comparison pages.",
    });
    expect(lintAssetsFirst([fixed], MEETRAO_EVIDENCE)).toEqual([]);
  });
  it("another play improving the existing page is enough for a play that adds one new page", () => {
    const refresh = play({ assetUsed: "https://meetrao.com/vs/cal-com", test: "21 days", firstActionToday: "Refresh the Cal.com comparison." });
    const add = play({ assetUsed: "To build: a Calendly alternative page", test: "21 days", firstActionToday: "Draft the Calendly alternative page for approval." });
    expect(lintAssetsFirst([refresh, add], MEETRAO_EVIDENCE)).toEqual([]);
    expect(lintAssetsFirst([{ ...add, assetUsed: `https://meetrao.com/pricing; ${add.assetUsed}` }], MEETRAO_EVIDENCE)[0].message).toMatch(/existing comparison page/);
  });
  it("an existing page found only in the research, not cited by any play, still comes first", () => {
    const add = play({ assetUsed: "https://meetrao.com/pricing; To build: a Calendly alternative page", firstActionToday: "Draft the Calendly alternative page." });
    expect(lintAssetsFirst([add], MEETRAO_EVIDENCE)[0].message).toMatch(/meetrao\.com\/vs\/cal-com/);
  });
  it("a new asset of a kind the business doesn't have yet needs no existing one", () => {
    const add = play({ assetUsed: "https://meetrao.com/pricing; To build: a Zapier listing", firstActionToday: "Draft the Zapier listing." });
    expect(lintAssetsFirst([add], MEETRAO_EVIDENCE)).toEqual([]);
  });
  it("several new pages pass with a cited demand baseline, not with 'search demand unknown'", () => {
    const batch = (mechanic: string) => play({ assetUsed: "To build: three alternative pages", test: "Publish three alternative pages; 45 days.", firstActionToday: "Draft three alternative pages.", mechanic });
    expect(lintAssetsFirst([batch("Each targets 1,200 monthly searches (Search Console).")], "https://acme.io/")).toEqual([]);
    expect(lintAssetsFirst([batch("Search volume is unknown.")], "https://acme.io/")[0].message).toMatch(/Commits to 3 new/);
    expect(lintAssetsFirst([batch("")], "https://acme.io/")[0].message).toMatch(/Start with one,/);
  });
  it("a bare brand name isn't a URL, so a competitor isn't taken for the business's own site", () => {
    const p = play({ assetUsed: "Cal.com switchers; https://meetrao.com/vs/cal-com", test: "45 days", firstActionToday: "Refresh the Cal.com page." });
    expect(lintAssetsFirst([p], `${MEETRAO_EVIDENCE}\ncal.com/alternatives/calendly`)).toEqual([]);
  });
});

describe("never data-only: plays (bench Run 5, Folevi)", () => {
  it("only new builds, nothing tested on an existing asset, fails", () => {
    const issues = lintExistingTest(folevi, FOLEVI_EVIDENCE, 90);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", rule: "existing_test", path: "plays" });
  });
  it("a concrete test on the existing compare page within the horizon passes", () => {
    const fix = play({ assetUsed: "Existing comparison page: https://folevi.com/compare", test: "Rewrite the hero and free-trial CTA; 300 visits over 30 days.", firstActionToday: "Update the compare page hero with the offline-editing proof." });
    expect(lintExistingTest([...folevi, fix], FOLEVI_EVIDENCE, 90)).toEqual([]);
  });
  it("the test must run inside the horizon, name a duration, and not be data collection", () => {
    const base = { assetUsed: "https://folevi.com/compare", firstActionToday: "Update the compare page hero." };
    expect(lintExistingTest([play({ ...base, test: "Run for 120 days." })], FOLEVI_EVIDENCE, 90)).toHaveLength(1);
    expect(lintExistingTest([play({ ...base, test: "300 visits." })], FOLEVI_EVIDENCE, 90)).toHaveLength(1);
    expect(lintExistingTest([play({ ...base, test: "Collect data for 30 days, then decide." })], FOLEVI_EVIDENCE, 90)).toHaveLength(1);
    expect(lintExistingTest([play({ ...base, test: "Six-week page test; 200 visits." })], FOLEVI_EVIDENCE, 90)).toEqual([]);
  });
  it("a URL the research never confirmed doesn't count as existing", () => {
    expect(lintExistingTest([play({ assetUsed: "https://folevi.com/trial", test: "30 days", firstActionToday: "Update the trial page." })], FOLEVI_EVIDENCE, 90)).toHaveLength(1);
  });
  it("Run 5 winners (Involets, Taskeni) already pass", () => {
    const ev = "https://www.involets.com/compare/toggl https://www.involets.com/pricing https://taskeni.app/compare";
    const involets = play({ assetUsed: "https://www.involets.com/compare/toggl; https://www.involets.com/pricing", test: "Planned: 21 days, 300 qualified visits, $0; review signups day 21 and sales day 45.", firstActionToday: "Update the Toggl page with verified product facts and a clear free-plan route." });
    const harvest = play({ assetUsed: "https://www.involets.com/pricing; To build: Harvest alternative page.", test: "21 days", firstActionToday: "Build the Harvest alternative page using verified Involets pricing and features." });
    const taskeni = play({ assetUsed: "https://taskeni.app/compare", test: "No ad spend; track 400 qualified visits over four weeks; owner time: one planned hour.", firstActionToday: "Check indexed comparison pages and add tracked Free-plan links." });
    expect(lintExistingTest([involets, harvest], ev, 90)).toEqual([]);
    expect(lintAssetsFirst([involets, harvest], ev)).toEqual([]);
    expect(lintExistingTest([taskeni], ev, 90)).toEqual([]);
    expect(lintAssetsFirst([taskeni], ev)).toEqual([]);
  });
  it("durations parse from digits, number words and day markers", () => {
    expect(durationDays("measure for 45 days")).toBe(45);
    expect(durationDays("over four weeks")).toBe(28);
    expect(durationDays("Six-week page test")).toBe(42);
    expect(durationDays("One-month submission test")).toBe(30);
    expect(durationDays("review signups day 21 and sales day 45")).toBe(45);
    expect(durationDays("300 visits")).toBeUndefined();
  });
});

describe("never data-only: plan (bench Run 5, Folevi)", () => {
  it("'keep plays paused', export-only experiments and no dated action all fail", () => {
    const issues = lintActionPlan(FOLEVI_PLAN, 90);
    expect(issues.every((i) => i.rule === "data_only" && i.severity === "error")).toBe(true);
    expect(issues.map((i) => i.path)).toEqual(["summary", "experiments", "phases"]);
    expect(issues[0].message).toMatch(/should not launch/);
  });
  it("measurement alongside a dated test on an existing asset passes", () => {
    const fixed = {
      summary: "Two capped tests; ≈3 customers by day 90.",
      phases: [
        { name: "Foundation", days: "0–14", focus: "Export billing cohorts; refresh the compare page hero and trial CTA." },
        { name: "Test", days: "15–45", focus: "Run the compare-page test at 300 visits; review weekly." },
      ],
      weekOneChecklist: ["Export billing cohorts and signup sources.", "Approve the compare page edits."],
      experiments: [
        { method: "export_instructions", durationDays: 14, stoppingRule: "Done when cohorts are exported." },
        { method: "pre_post_observational", durationDays: 45, stoppingRule: "Stop below 1% signups at 300 visits." },
      ],
    };
    expect(lintActionPlan(fixed, 90)).toEqual([]);
  });
  it("pausing ads (not plays) is allowed; an undated action phase doesn't count on its own", () => {
    expect(lintActionPlan({ summary: "Hold the $300/month ad budget unspent.", phases: [{ name: "Test", days: "15–45", focus: "Publish the refreshed page." }], weekOneChecklist: [], experiments: [] }, 90)).toEqual([]);
    expect(lintActionPlan({ phases: [{ name: "Later", days: "After inputs are verified", focus: "Publish the page." }], weekOneChecklist: ["Track visits."] }, 90)[0].path).toBe("phases");
  });
  it("phase end days", () => {
    expect(phaseEndDay("0–14")).toBe(14);
    expect(phaseEndDay("Days 46–90")).toBe(90);
    expect(phaseEndDay("Week one")).toBe(7);
    expect(phaseEndDay("Weeks 2–4")).toBe(28);
    expect(phaseEndDay("After inputs are verified")).toBeUndefined();
  });
});

describe("wired into the specs and tasks", () => {
  it("growth-plays lint runs both play checks", () => {
    const out = { portfolioNote: "", economics: { revenuePerCustomerMonthUsd: 6, grossMargin: 0.8, monthlyChurn: 0.05, basis: "", sources: {} }, plays: [{ ...meetrao, name: "x", oneLiner: "", kind: "bankable", audience: "a", trigger: "", hook: "h", killIf: "k", scaleIf: "s", unit: "customers", horizonDays: 90, confidence: "low", biggestUnknown: "", scores: [3, 4, 3, 3, 3, 3, 3, 3], climbosCanDo: "", model: { weeklyReach: 10, weeklyReachLow: 5, weeklyReachHigh: 20, reachSource: { source: "assumption", ref: "", quote: "" }, steps: [], monthlySpendUsd: 0, spendSource: { source: "planned", ref: "", quote: "" }, ownerHoursPerWeek: 1, hoursSource: { source: "planned", ref: "", quote: "" } } }] };
    const rules = growthPlaysSpec().lint!(out as never, { task: "", brief: "", facts: [], untrustedContext: MEETRAO_EVIDENCE } as never).map((i) => i.rule);
    expect(rules).toContain("assets_first");
    expect(rules).toContain("existing_test");
  });
  it("growth-plan lint runs the data-only check", () => {
    const out = { ...FOLEVI_PLAN, positioning: "", audiences: [], channels: [], constraints: [], measurementPlan: "", firstActions: [], diagnosis: "", affordableCac: "", notDoing: [], northStar: { metric: "", baseline: "", target: "3 by day 90" }, leadingIndicators: [], risks: [] };
    const rules = strategySpec().lint!(out as never, { task: "", brief: "", facts: [], constraints: { horizonDays: 90 } } as never).map((i) => i.rule);
    expect(rules.filter((r) => r === "data_only")).toHaveLength(3);
  });
  it("the plays and plan tasks state both rules", () => {
    expect(playsTask({ scorecard: "", insights: "" })).toMatch(/Existing assets first:.*gated on its result.*At least one play must be a concrete test on an existing asset/);
    expect(planTask({ locked: "", plays: null, scorecard: "", insights: "" })).toMatch(/Never a data-only plan/);
  });
});
