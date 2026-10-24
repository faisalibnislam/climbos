import { describe, expect, it } from "vitest";
import { lintNoAudience, lintOutcomeNumbers } from "../../shared/agents/specs";
import { forecastCustomers, lintEconomics, ownerHourOf, type Economics } from "../../shared/agents/economics";
import { buildPlanEvidence } from "../../shared/agents/evidence";
import { formatMoney, fractionDigits, majorToMinor, minorToMajor, thresholdIn, toUsd } from "../../shared/economics/currency";
import { profileFrom } from "../../shared/acquisition/scoring";
import { reconcile } from "../../shared/agents/consistency";
import { z } from "zod";

/** P0 grounding slice (Books 13/14): numbers come from code, unknowns stay unknown, money keeps its currency. */
describe("customer counts must be calculated (Book 14 §7)", () => {
  const c = { lockedCustomers: 40, horizonDays: 90, forecastCustomers: [22, 40, 61, 9, 15, 24], goalNumbers: [100] };
  it("flags a count the plays don't produce, anywhere in the prose", () => {
    const out = { summary: "We expect 140 new customers by day 90.", phases: [{ name: "Build", days: "1-30", focus: "Win the first 40 paying customers." }] };
    const issues = lintOutcomeNumbers(out, c, "");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rule: "consistency", path: "summary" });
    expect(issues[0].message).toMatch(/140.*≈40/);
  });
  it("accepts calculated counts (±15%), the goal, facts, ranges of both and non-outcome counts", () => {
    const out = {
      summary: "About 40–61 customers in 90 days, short of the 100 customers goal.",
      diagnosis: "You already have 230 customers.",
      weekOneChecklist: ["Book 8 customer interviews", "Reach 50 users a week"],
      phases: [{ name: "a", days: "1", focus: "Aim for 43 new customers" }],
    };
    expect(lintOutcomeNumbers(out, c, "FACTS: Formkit has 230 customers")).toEqual([]);
  });
  it("is off until plays are locked", () => {
    expect(lintOutcomeNumbers({ summary: "500 customers" }, { horizonDays: 90 }, "")).toEqual([]);
  });
  it("forecastCustomers lists portfolio and per-play P10/P50/P90", () => {
    const e: Economics = { revenuePerCustomerMonthUsd: 30, grossMargin: 0.8, monthlyChurn: 0.05, basis: "" };
    const plays = [{ name: "SEO", kind: "bankable", horizonDays: 90, model: { weeklyReach: 500, steps: [{ name: "signup", rate: 0.04, low: 0.02, high: 0.06 }, { name: "pay", rate: 0.2, low: 0.1, high: 0.3 }], monthlySpendUsd: 0, ownerHoursPerWeek: 2 } }];
    const nums = forecastCustomers({ economics: e, plays: plays as never }, 90);
    expect(nums.length).toBeGreaterThan(2);
    expect(nums.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
  });
});

describe("no email audience is assumed (Book 14 §4)", () => {
  const plays = [{ name: "Launch", firstActionToday: "Email your list about the new template gallery." }];
  it("flags sending to a list when there are no consented contacts and no fact about one", () => {
    expect(lintNoAudience(plays, { emailAudience: 0 }, "")).toMatchObject([{ rule: "no_audience", path: "[0].firstActionToday" }]);
  });
  it("allows building a list, a stated list, or consented contacts", () => {
    expect(lintNoAudience([{ a: "Start a newsletter and grow your list with a template pack." }], { emailAudience: 0 }, "")).toEqual([]);
    expect(lintNoAudience(plays, { emailAudience: 0 }, "Formkit has 2,400 newsletter subscribers")).toEqual([]);
    expect(lintNoAudience(plays, { emailAudience: 120 }, "")).toEqual([]);
    expect(lintNoAudience(plays, {}, "")).toEqual([]);
  });
});

describe("money keeps the workspace currency", () => {
  it("minor units follow the currency", () => {
    expect(fractionDigits("USD")).toBe(2);
    expect(fractionDigits("JPY")).toBe(0);
    expect(minorToMajor(60_000, "USD")).toBe(600);
    expect(minorToMajor(60_000, "JPY")).toBe(60_000);
    expect(majorToMinor(600, "EUR")).toBe(60_000);
  });
  it("formats with the currency's symbol", () => {
    expect(formatMoney(1200, "USD")).toBe("$1,200");
    expect(formatMoney(6, "USD")).toBe("$6");
    expect(formatMoney(5.99, "USD")).toBe("$5.99");
    expect(formatMoney(40, "EUR")).toBe("€40");
    expect(formatMoney(5000, "BDT")).toMatch(/5,000/);
    expect(formatMoney(null, "USD")).toBe("n/a");
  });
  it("scales USD thresholds, not owner amounts", () => {
    expect(thresholdIn(50, "USD")).toBe(50);
    expect(thresholdIn(50, "BDT")).toBe(6000);
    expect(ownerHourOf({ currency: "BDT" })).toBe(6000);
    expect(ownerHourOf({ ownerHourUsd: 900, currency: "BDT" })).toBe(900);
    // A 30,000 BDT budget is about $250: the low budget band, not the $20k one.
    const p = profileFrom({ legacyType: null, budgetMinor: 3_000_000, horizonDays: 90, legacyTypes: () => ["b2b_saas"], priceUsdMonth: 600, currency: "BDT" });
    expect(p.budgetUsd).toBe(250);
    expect(p.priceUsdMonth).toBe(5);
    expect(p.currency).toBe("BDT");
    expect(toUsd(120, "BDT")).toBe(1);
  });
  it("lint messages use the currency", () => {
    const e: Economics = { revenuePerCustomerMonthUsd: 600, grossMargin: 0.8, monthlyChurn: 0.05, basis: "", currency: "BDT", ownerHourUsd: 100 };
    const plays = [{ name: "Ads", kind: "bankable", horizonDays: 90, model: { weeklyReach: 10, steps: [{ name: "pay", rate: 0.001 }], monthlySpendUsd: 50_000, ownerHoursPerWeek: 1 } }];
    const issues = lintEconomics({ economics: e, plays: plays as never });
    const loses = issues.find((i) => /Does not pay back under the current scenario/.test(i.message));
    expect(loses?.message).toMatch(/৳|BDT/);
    expect(loses?.message).not.toMatch(/\$/);
    expect(loses?.severity).toBe("warn");
  });
});

describe("evidence pack per plan version (Book 13 §3)", () => {
  it("keeps facts, research and versions, bounded and marked when cut", () => {
    const ev = buildPlanEvidence({
      skillIds: ["growth-plays", "owner-brevity", "growth-plays"],
      currency: "USD",
      goal: { statement: "Get 50 customers", horizonDays: 90, monthlyAdBudget: 600 },
      facts: [{ id: "f1", statement: "Pro plan is $19/month", category: "pricing" }],
      insights: "x".repeat(30_000),
      research: [{ agentId: "growth_plays", notes: "Pricing page lists Pro at $19.", sources: [{ url: "https://formkit.app/pricing" }] }, { agentId: "growth_strategy" }],
    });
    expect(Object.keys(ev.skills)).toEqual(["growth-plays", "owner-brevity"]);
    expect(ev.skills["growth-plays"]).not.toBe("missing");
    expect(ev.engine).toMatch(/^v\d/);
    expect(ev.facts[0]).toEqual({ id: "f1", statement: "Pro plan is $19/month", category: "pricing" });
    expect(ev.research).toHaveLength(1);
    expect(ev.insights.length).toBe(24_000);
    expect(ev.truncated).toContain("insights");
  });
});

describe("the consistency pass sees what's failing", () => {
  it("lists the failing checks in its prompt", async () => {
    let prompt = "";
    const schema = z.object({ summary: z.string() });
    await reconcile({
      turn: async (req) => {
        prompt = String(req.messages[0].content);
        return { ok: false } as never;
      },
      plan: { summary: "We'll win 140 customers." },
      locked: "LOCKED NUMBERS: ≈40 customers",
      schema,
      lint: () => [{ severity: "error", rule: "consistency", message: "Customer count 140 isn't one the plays calculate.", path: "summary" }],
    });
    expect(prompt).toMatch(/CHECKS FAILING NOW/);
    expect(prompt).toMatch(/summary: Customer count 140/);
  });
});
