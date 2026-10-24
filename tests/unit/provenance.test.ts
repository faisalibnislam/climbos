import { describe, expect, it } from "vitest";
import { applyOwnerEconomics, lockedNumbers, type Economics } from "../../shared/agents/economics";
import { economicsSources, forecastBasis, playInputs, withDerivedAssumed } from "../../shared/agents/provenance";
import { lintProvenance } from "../../shared/agents/specs";

const tagged: Economics = {
  revenuePerCustomerMonthUsd: 29,
  grossMargin: 0.8,
  monthlyChurn: 0.04,
  basis: "pricing page",
  sources: { revenue: { source: "research", ref: "https://formkit.app/pricing" }, margin: { source: "assumption", ref: "" }, churn: { source: "benchmark", ref: "SaaS SMB churn survey" } },
};
const play = (reach: "research" | "assumption" = "research") => ({
  name: "Agency outreach",
  kind: "bankable",
  unit: "paying customers",
  horizonDays: 91,
  model: {
    weeklyReach: 250,
    weeklyReachLow: 150,
    weeklyReachHigh: 300,
    reachSource: { source: reach, ref: reach === "research" ? "https://formkit.app" : "" },
    steps: [
      { name: "reply", rate: 0.02, low: 0.01, high: 0.04, source: "benchmark" as const, ref: "Cold email benchmark 2026" },
      { name: "paid", rate: 0.15, low: 0.1, high: 0.25, source: "research" as const, ref: "https://formkit.app/pricing" },
    ],
    monthlySpendUsd: 0,
    spendSource: { source: "owner" as const, ref: "No ad budget" },
    ownerHoursPerWeek: 1,
    hoursSource: { source: "assumption" as const, ref: "" },
  },
});

describe("input provenance", () => {
  it("lists every input with its source", () => {
    const rows = playInputs(play(), tagged);
    expect(rows.map((r) => [r.key, r.tag.source])).toEqual([
      ["reach", "research"],
      ["step0", "benchmark"],
      ["step1", "research"],
      ["spend", "owner"],
      ["hours", "assumption"],
      ["revenue", "research"],
      ["margin", "assumption"],
      ["churn", "benchmark"],
      ["ownerHour", "assumption"], // $50/h default until the owner says
    ]);
  });

  it("labels the customer forecast by its own inputs and the cost by everything", () => {
    expect(forecastBasis(play(), tagged).customers.kind).toBe("sourced_estimate");
    expect(forecastBasis(play("assumption"), tagged).customers).toMatchObject({ kind: "assumption_scenario", assumed: ["Weekly reach"] });
    expect(forecastBasis(play(), tagged).cost.assumed).toEqual(["Your hours a week", "Margin", "Value of your hour"]);
  });

  it("owner-confirmed numbers become the owner's and stop being assumptions", () => {
    const e = applyOwnerEconomics(withDerivedAssumed(tagged), { grossMargin: 0.7, ownerHourUsd: 80 });
    expect(economicsSources(e).margin).toMatchObject({ source: "owner", check: "owner_input" });
    expect(economicsSources(e).ownerHour.source).toBe("owner");
    expect(e.assumed).toEqual([]);
    expect(withDerivedAssumed(tagged).assumed).toEqual(["margin"]);
  });

  it("older plans read as not labelled, using their assumed list where it exists", () => {
    const legacy: Economics = { revenuePerCustomerMonthUsd: 19, grossMargin: 0.8, monthsRetained: 10, basis: "", assumed: ["margin"] };
    const s = economicsSources(legacy);
    expect([s.revenue.source, s.margin.source]).toEqual(["unlabelled", "assumption"]);
    const old = { ...play(), model: { weeklyReach: 250, steps: [{ name: "reply", rate: 0.02 }], monthlySpendUsd: 0, ownerHoursPerWeek: 0 } };
    expect(forecastBasis(old, legacy).customers.kind).toBe("unlabelled_scenario");
  });

  it("locked numbers tell the plan what each forecast rests on", () => {
    const text = lockedNumbers({ economics: tagged, plays: [play("assumption")] });
    expect(text).toContain("Forecast basis: assumption-based scenario (assumed: Weekly reach)");
    expect(text).toContain("margin assumption");
    expect(text).toContain("None of these forecasts is calibrated");
  });

  it("research and benchmark numbers must name a source; research must be a page that was read", () => {
    const bad = { economics: { sources: { revenue: { source: "benchmark", ref: "" } } }, plays: [{ model: { reachSource: { source: "research", ref: "https://unknown.example.org/x" }, steps: [{ name: "reply", source: "assumption", ref: "" }] } }] };
    const issues = lintProvenance(bad, "Sources: https://formkit.app");
    // Benchmark without a name; research from a page not read, and without a quote.
    expect(issues.map((i) => i.path)).toEqual(["economics.sources.revenue", "plays[0].model.reachSource", "plays[0].model.reachSource", "plays[0].model.reachSource"]);
    expect(lintProvenance({ economics: {}, plays: [{ model: { steps: [{ name: "reply" }] } }] }, "")).toEqual([]); // older outputs
  });
});

describe("adversarial source checks", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Loose = (out: unknown, ctx: { pages: Record<string, string | null>; owner?: Record<string, number> }) => any;
  type Tag = { source: "owner" | "research" | "benchmark" | "planned" | "assumption"; ref: string; quote?: string; population?: string; denominator?: string; period?: string };
  const econ = (sources: Record<string, Tag>) => ({ revenuePerCustomerMonthUsd: 29, grossMargin: 0.8, monthlyChurn: 0.05, basis: "", sources });
  const onePlay = (step: Partial<{ rate: number; low: number; high: number; source: Tag["source"]; ref: string; quote: string; name: string; population: string; denominator: string; period: string }>, extra: Record<string, unknown> = {}) => ({
    economics: econ({}),
    plays: [{ model: { weeklyReach: 250, weeklyReachLow: 200, weeklyReachHigh: 300, steps: [{ name: "trial to paid", rate: 0.15, low: 0.1, high: 0.2, source: "research" as const, ref: "https://formkit.app/pricing", quote: "", ...step }], monthlySpendUsd: 0, ownerHoursPerWeek: 0, ...extra } }],
  });
  const PAGE = "Pricing. Pro costs $29 per month. Trial to paid conversion is 15% for teams out of trial starters in Q1 2026. 15% off annual plans. 80% of our customers are agencies. Serving 29 countries.";

  it("owner: coincidental numbers in facts never confirm; only structured owner metrics do", async () => {
    const verifyTags = (await import("../../shared/agents/provenance")).verifyTags as unknown as Loose;
    // Facts aren't even an input any more: the margin 80% "matching" a fact about agencies is an assumption.
    const out = verifyTags({ economics: econ({ margin: { source: "owner", ref: "facts" }, revenue: { source: "owner", ref: "" } }), plays: [] }, { pages: {} });
    expect(out.economics.sources?.margin?.source).toBe("assumption");
    expect(out.economics.sources?.revenue?.source).toBe("assumption");
    // With the owner's confirmed margin, the tag stays owner and the override stamps it.
    const owned = verifyTags({ economics: econ({ margin: { source: "owner", ref: "" } }), plays: [] }, { pages: {}, owner: { grossMargin: 0.7 } });
    expect(owned.economics.sources?.margin?.source).toBe("owner");
    const e = applyOwnerEconomics(owned.economics, { grossMargin: 0.7, updatedAt: 1_700_000_000_000 });
    expect(economicsSources(e).margin).toMatchObject({ source: "owner", check: "owner_input", confirmedAt: 1_700_000_000_000 });
    expect(e.grossMargin).toBe(0.7);
  });

  it("owner on a funnel rate or reach is never verifiable and becomes an assumption", async () => {
    const verifyTags = (await import("../../shared/agents/provenance")).verifyTags as unknown as Loose;
    const out = verifyTags(onePlay({ source: "owner", ref: "" }, { reachSource: { source: "owner", ref: "" } }), { pages: {}, owner: { grossMargin: 0.7 } });
    expect(out.plays[0].model.steps[0].source).toBe("assumption");
    expect(out.plays[0].model.reachSource?.source).toBe("assumption");
  });

  it("research: verified only when the loaded page has the quote with the number and the metric", async () => {
    const { urlKey } = await import("../../shared/agents/provenance");
    const verifyTags = (await import("../../shared/agents/provenance")).verifyTags as unknown as Loose;
    const pages = { [urlKey("https://formkit.app/pricing")]: PAGE };
    const check = (step: Parameters<typeof onePlay>[0]) => verifyTags(onePlay(step), { pages }).plays[0].model.steps[0].check;
    expect(check({ quote: "Trial to paid conversion is 15% for teams out of trial starters in Q1 2026.", population: "teams", denominator: "trial starters", period: "Q1 2026" })).toBe("source_verified");
    expect(check({ quote: "Trial to paid conversion is 15% for teams." })).toBe("retrieved"); // context not supplied
    expect(check({ quote: "Trial to paid conversion is 15% for teams out of trial starters in Q1 2026.", population: "teams", denominator: "paid customers", period: "Q1 2026" })).toBe("retrieved"); // wrong denominator
    // Same number, unrelated passage (a discount): the metric isn't named.
    expect(check({ quote: "15% off annual plans." })).toBe("retrieved");
    // Coincidence: "80% of customers are agencies" for an 80% rate.
    expect(check({ rate: 0.8, low: 0.7, high: 0.9, quote: "80% of our customers are agencies." })).toBe("retrieved");
    // A quote the page doesn't contain (invented or paraphrased).
    expect(check({ quote: "Trial to paid conversion is 15% for every plan." })).toBe("retrieved");
    // Only one end of the range in the quote doesn't count.
    expect(check({ rate: 0.12, low: 0.15, high: 0.2, quote: "Trial to paid conversion is 15% for teams." })).toBe("retrieved");
    // No quote at all.
    expect(check({ quote: "" })).toBe("reported");
  });

  it("research: mismatched units and periods don't verify", async () => {
    const { urlKey } = await import("../../shared/agents/provenance");
    const verifyTags = (await import("../../shared/agents/provenance")).verifyTags as unknown as Loose;
    const tag = (quote: string, page = PAGE) =>
      verifyTags({ economics: econ({ revenue: { source: "research", ref: "https://formkit.app/pricing", quote, population: "Pro", period: "month" } }), plays: [] }, { pages: { [urlKey("https://formkit.app/pricing")]: page } }).economics.sources?.revenue?.check;
    expect(tag("Pro costs $29 per month.")).toBe("source_verified");
    expect(tag("Serving 29 countries.")).toBe("retrieved"); // no currency, no period
    expect(tag("Pro costs $29 per year.", "Pro costs $29 per year.")).toBe("retrieved"); // yearly, not monthly
    expect(tag("Trial to paid conversion is 15% for teams.")).toBe("retrieved"); // a percent, not a price
  });

  it("stale or invented citations: pages the search didn't return aren't loaded, and unloaded pages don't verify", async () => {
    const { urlKey, citedUrls } = await import("../../shared/agents/provenance");
    const verifyTags = (await import("../../shared/agents/provenance")).verifyTags as unknown as Loose;
    const { fetchCitedPages } = await import("../../convex/ai/research");
    const draft = onePlay({ ref: "https://formkit.app/old-pricing", quote: "Trial to paid conversion is 15% for teams." });
    // Not among the searched URLs: nothing is fetched (no network call happens).
    expect(await fetchCitedPages(citedUrls(draft as never), ["https://formkit.app/pricing"], urlKey)).toEqual({});
    expect(verifyTags(draft, { pages: {} }).plays[0].model.steps[0].check).toBe("reported");
    // Loaded but failed (null): still not verified.
    expect(verifyTags(draft, { pages: { [urlKey("https://formkit.app/old-pricing")]: null } }).plays[0].model.steps[0].check).toBe("reported");
    // Same domain, different page: no match.
    expect(verifyTags(draft, { pages: { [urlKey("https://formkit.app/pricing")]: PAGE } }).plays[0].model.steps[0].check).toBe("reported");
  });

  it("missing notes or failed research: research stays not checked", async () => {
    const verifyTags = (await import("../../shared/agents/provenance")).verifyTags as unknown as Loose;
    expect(verifyTags(onePlay({ quote: "Trial to paid conversion is 15% for teams." }), { pages: {} }).plays[0].model.steps[0].check).toBe("reported");
  });

  it("forged or legacy checks read as not checked; ownerHour needs a stamped owner input", () => {
    const forged: Economics = { revenuePerCustomerMonthUsd: 29, grossMargin: 0.8, basis: "", sources: { revenue: { source: "research", ref: "x", check: "source_verified" }, margin: { source: "owner", ref: "", check: "owner_input" } } };
    expect(economicsSources(forged).revenue.check).toBe("reported");
    expect(economicsSources(forged).margin.check).toBe("reported");
    const legacy = { revenuePerCustomerMonthUsd: 29, grossMargin: 0.8, basis: "", sources: { revenue: { source: "research", ref: "x", check: "research_notes", checkedBy: "climbos-provenance-1" } } } as unknown as Economics;
    expect(economicsSources(legacy).revenue.check).toBe("reported"); // retired check value
    expect(economicsSources({ revenuePerCustomerMonthUsd: 1, grossMargin: 0.5, basis: "", ownerHourUsd: 50 }).ownerHour).toMatchObject({ source: "owner", check: "reported" });
    const confirmed = applyOwnerEconomics({ revenuePerCustomerMonthUsd: 1, grossMargin: 0.5, basis: "" }, { ownerHourUsd: 80 });
    expect(economicsSources(confirmed).ownerHour).toMatchObject({ source: "owner", check: "owner_input" });
  });

  it("allocations are planned, never owner", async () => {
    const verifyTags = (await import("../../shared/agents/provenance")).verifyTags as unknown as Loose;
    const out = verifyTags(onePlay({}, { spendSource: { source: "owner", ref: "Budget $600" }, hoursSource: { source: "owner", ref: "" } }), { pages: {}, owner: { ownerHoursPerWeek: 3 } });
    expect(out.plays[0].model.spendSource?.source).toBe("planned");
    expect(out.plays[0].model.hoursSource?.source).toBe("planned");
  });

  it("the cost line always has a basis, and unverified sources are named", async () => {
    const { COST_BASIS_LABEL, forecastBasis, urlKey } = await import("../../shared/agents/provenance");
    const verifyTags = (await import("../../shared/agents/provenance")).verifyTags as unknown as Loose;
    expect(COST_BASIS_LABEL.sourced_estimate).toMatch(/not yet your results/);
    const out = verifyTags(onePlay({ quote: "15% off annual plans." }, { reachSource: { source: "benchmark", ref: "Survey" } }), { pages: { [urlKey("https://formkit.app/pricing")]: PAGE } });
    expect(forecastBasis(out.plays[0] as never, out.economics).customers.unchecked).toEqual(["Weekly reach", "trial to paid"]);
  });
});
