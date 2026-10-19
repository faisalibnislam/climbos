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
    expect(forecastBasis(play("assumption"), tagged).customers).toEqual({ kind: "assumption_scenario", assumed: ["Weekly reach"] });
    expect(forecastBasis(play(), tagged).cost.assumed).toEqual(["Your hours a week", "Margin", "Value of your hour"]);
  });

  it("owner-confirmed numbers become the owner's and stop being assumptions", () => {
    const e = applyOwnerEconomics(withDerivedAssumed(tagged), { grossMargin: 0.7, ownerHourUsd: 80 });
    expect(economicsSources(e).margin).toEqual({ source: "owner", ref: "Owner confirmed" });
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
    expect(issues.map((i) => i.path)).toEqual(["economics.sources.revenue", "plays[0].model.reachSource"]);
    expect(lintProvenance({ economics: {}, plays: [{ model: { steps: [{ name: "reply" }] } }] }, "")).toEqual([]); // older outputs
  });
});
