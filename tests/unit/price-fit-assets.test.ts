import { describe, expect, it } from "vitest";
import { entryPriceUsdMonth, lowTicket, priceFitText, profileFrom, scoreChannels, scorecardText, type AcquisitionProfile } from "../../shared/acquisition/scoring";
import { playsTask } from "../../shared/agents/planTasks";
import { growthPlaysSpec, lintAssets } from "../../shared/agents/specs";

const v = (value: string) => ({ value, confidence: "medium" as const, source: "inferred" as const });
// Involets-like: B2B SaaS, no ad budget, order size not inferred (bench Run 4).
const saas = (priceUsdMonth?: number, dims: AcquisitionProfile["dims"] = {}): AcquisitionProfile => ({ types: ["b2b_saas"], budgetUsd: 0, horizonDays: 90, dims: { customerType: v("b2b"), geography: v("global"), team: v("solo"), ...dims }, ...(priceUsdMonth ? { priceUsdMonth } : {}) });
const rank = (p: AcquisitionProfile, id: string) => scoreChannels(p).filter((r) => r.status !== "ineligible").findIndex((r) => r.id === id);
const row = (p: AcquisitionProfile, id: string) => scoreChannels(p).find((r) => r.id === id)!;

describe("price fit: entry price from pricing facts", () => {
  it("reads the lowest paid monthly price, per seat or per company", () => {
    expect(entryPriceUsdMonth([{ category: "pricing", statement: "Personal use is free. The Company plan costs $6 per month or $60 per year." }])).toBe(6);
    expect(entryPriceUsdMonth([{ category: "pricing", statement: "The Free plan costs $0. Pro is $6 per member per month billed yearly, and Business is $12 per member per month." }])).toBe(6);
    expect(entryPriceUsdMonth([{ category: "pricing", statement: "Paid plans include Pro ($6/seat/month) and Business ($19/seat/month)." }])).toBe(6);
    expect(entryPriceUsdMonth([{ category: "pricing", statement: "Core at $1.99 per month, Pro at $4.99 a month." }])).toBe(1.99);
  });
  it("falls back to a twelfth of a yearly price; ignores other categories and free plans", () => {
    expect(entryPriceUsdMonth([{ category: "pricing", statement: "Pro is listed at $30 per year, and Business at $99 per year." }])).toBe(2.5);
    expect(entryPriceUsdMonth([{ category: "product", statement: "Saves agencies $90 a month." }])).toBeUndefined();
    expect(entryPriceUsdMonth([{ category: "pricing", statement: "Free forever. $0 a month." }])).toBeUndefined();
  });
  it("profileFrom carries a positive price only", () => {
    const base = { saved: null, budgetMinor: 0, horizonDays: 90, legacyTypes: () => ["b2b_saas"] };
    expect(profileFrom({ ...base, priceUsdMonth: 6 }).priceUsdMonth).toBe(6);
    expect("priceUsdMonth" in profileFrom({ ...base, priceUsdMonth: 0 })).toBe(false);
  });
});

describe("price fit: channel scoring", () => {
  it("a $6/month product: labour-heavy channels fall, self-serve channels lead", () => {
    const cheap = saas(6);
    const unpriced = saas();
    expect(row(unpriced, "D01").status).toBe("primary"); // the bug: cold email led for a $6 product
    expect(row(cheap, "D01").status).not.toMatch(/primary|in_plan/);
    expect(row(cheap, "D01").score).toBeLessThan(row(unpriced, "D01").score);
    expect(row(cheap, "R18").score).toBeLessThan(row(unpriced, "R18").score); // creator recruitment
    expect(row(cheap, "R05").score).toBeLessThan(row(unpriced, "R05").score); // partner outreach
    expect(row(cheap, "S09").score).toBeGreaterThan(row(unpriced, "S09").score); // comparison pages
    expect(row(cheap, "V07").score).toBeGreaterThan(row(unpriced, "V07").score); // in-product virality
    expect(row(cheap, "X01").score).toBeGreaterThan(row(unpriced, "X01").score); // onboarding and activation
    const plan = scoreChannels(cheap).filter((r) => r.status === "primary" || r.status === "in_plan");
    expect(plan.length).toBeGreaterThan(0);
    for (const r of plan) expect(["outreach", "events", "creators", "partnerships", "distribution"]).not.toContain(r.family);
    expect(rank(cheap, "S09")).toBeLessThan(rank(cheap, "D01"));
  });
  it("the scorecard explains the price; the plays task gets the price-fit line", () => {
    const cheap = saas(6);
    expect(row(cheap, "D01").priceFit).toMatch(/\$6\/month/);
    expect(row(cheap, "S09").priceFit).toBeUndefined();
    expect(scorecardText(scoreChannels(cheap), 40)).toMatch(/D01 Cold email: \d+\/100 · Later · Selling one customer at a time doesn't pay back at about \$6\/month/);
    expect(priceFitText(cheap)).toMatch(/PRICE FIT: about \$6 per customer per month.*comparison and SEO pages, onboarding and activation, in-product virality/);
  });
  it("high price, sales-led motion or unknown price change nothing", () => {
    expect(lowTicket(saas(599))).toBe(false);
    expect(lowTicket(saas(6, { salesMotion: v("sales_led") }))).toBe(false);
    expect(lowTicket(saas())).toBe(false);
    expect(priceFitText(saas(599))).toBe("");
    expect(row(saas(599), "D01").score).toBe(row(saas(), "D01").score);
    expect(row(saas(599), "D01").priceFit).toBeUndefined();
  });
  it("without a price, an inferred low order size still counts; a known price wins over it", () => {
    expect(lowTicket(saas(undefined, { aov: v("low") }))).toBe(true);
    expect(lowTicket(saas(80, { aov: v("low") }))).toBe(false);
  });
});

describe("verified assets only", () => {
  const evidence = "RESEARCH NOTES\nhttps://meetrao.com/compare/calendly says ...\nhttps://www.meetrao.com/compare/cal-com\nhttps://meetrao.com/integrations";
  const play = (assetUsed: string, firstActionToday = "Review the page and approve the edits.") => ({ assetUsed, firstActionToday });

  it("bench Run 4: a five-page asset the research never confirmed fails", () => {
    const issues = lintAssets([play("Five existing competitor pages and Meetrao's confirmed booking flow.")], evidence);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", rule: "asset", path: "plays[0].assetUsed" });
  });
  it("an existing page cited by a URL the writer read passes", () => {
    expect(lintAssets([play("Existing Cal.com comparison page: https://meetrao.com/compare/cal-com")], evidence)).toEqual([]);
    expect(lintAssets([play("Integrations page meetrao.com/integrations/")], evidence)).toEqual([]);
  });
  it("a URL the writer never read, or a bare home page, doesn't confirm it", () => {
    expect(lintAssets([play("Existing comparison page: https://meetrao.com/compare/acuity")], evidence)[0].rule).toBe("asset");
    expect(lintAssets([play("Existing comparison pages on https://meetrao.com")], evidence)[0].rule).toBe("asset");
    const mixed = lintAssets([play("Comparison pages: https://meetrao.com/compare/calendly and https://meetrao.com/compare/acuity")], evidence);
    expect(mixed.map((i) => i.message).join(" ")).toMatch(/meetrao\.com\/compare\/acuity/);
  });
  it("a claimed count needs that many confirmed pages", () => {
    const two = "https://meetrao.com/compare/calendly, https://meetrao.com/compare/cal-com";
    expect(lintAssets([play(`Two existing comparison pages: ${two}`)], evidence)).toEqual([]);
    expect(lintAssets([play(`Five existing comparison pages, e.g. ${two}`)], evidence)[0].message).toMatch(/Claims 5 pages, but research confirms 2/);
  });
  it("an asset still to build must be built first", () => {
    expect(lintAssets([play("To build: a Calendly alternative page", "Draft the Calendly alternative page for approval.")], evidence)).toEqual([]);
    const late = lintAssets([play("To build: a Calendly alternative page", "Pick 25 coaches to email.")], evidence);
    expect(late[0]).toMatchObject({ rule: "asset", path: "plays[0].firstActionToday" });
  });
  it("product features alone aren't assets to verify", () => {
    expect(lintAssets([play("Time tracking to branded PDF invoice; free personal use.")], evidence)).toEqual([]);
  });
  it("is part of the growth-plays lint and the plays task contract", () => {
    expect(playsTask({ scorecard: "", insights: "" })).toMatch(/Build only on assets the research confirmed.*To build: …/);
    const spec = growthPlaysSpec();
    const out = { portfolioNote: "", economics: { revenuePerCustomerMonthUsd: 6, grossMargin: 0.8, monthlyChurn: 0.05, basis: "", sources: { revenue: { source: "assumption", ref: "", quote: "" }, margin: { source: "assumption", ref: "", quote: "" }, churn: { source: "assumption", ref: "", quote: "" } } }, plays: [{ ...play("Five existing competitor pages."), name: "x", oneLiner: "", kind: "bankable", audience: "a", trigger: "", hook: "h", mechanic: "m", funnel: [], unit: "customers", horizonDays: 90, confidence: "low", biggestUnknown: "", test: "", killIf: "k", scaleIf: "s", scores: [3, 4, 3, 3, 3, 3, 3, 3], climbosCanDo: "", model: { weeklyReach: 10, weeklyReachLow: 5, weeklyReachHigh: 20, reachSource: { source: "assumption", ref: "", quote: "" }, steps: [], monthlySpendUsd: 0, spendSource: { source: "planned", ref: "", quote: "" }, ownerHoursPerWeek: 1, hoursSource: { source: "planned", ref: "", quote: "" } } }] };
    const issues = spec.lint!(out as never, { task: "", brief: "", facts: [], untrustedContext: evidence } as never);
    expect(issues.some((i) => i.rule === "asset")).toBe(true);
  });
});
