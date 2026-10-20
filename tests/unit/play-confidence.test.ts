import { describe, expect, it } from "vitest";
import { playConfidence } from "../../shared/agents/confidence";
import { diagnose } from "../../shared/agents/diagnosis";
import type { Economics } from "../../shared/agents/economics";

/** Cycle 2: problem, fix and forecast evidence kept apart, in code. */
const owner = { source: "owner", ref: "", quote: "" };
const research = { source: "research", ref: "https://x.com", quote: "q" };
const assumption = { source: "assumption", ref: "", quote: "" };
const econKnown: Economics = { revenuePerCustomerMonthUsd: 30, grossMargin: 0.8, monthlyChurn: 0.05, basis: "", assumed: [], sources: { revenue: owner, margin: owner, churn: owner } as never };
const play = (steps: { source: string }[], words = "Onboarding fix: remove the setup step where trials stall") => ({
  name: words,
  kind: "bankable",
  horizonDays: 90,
  model: { weeklyReach: 100, reachSource: owner, steps: steps.map((s, i) => ({ name: `s${i}`, rate: 0.2, low: 0.1, high: 0.3, ref: "", quote: "", ...s })), monthlySpendUsd: 0, spendSource: owner, ownerHoursPerWeek: 1, hoursSource: owner },
});

describe("play confidence", () => {
  const activation = diagnose({ funnel: { leads: 100, activated: 12, newCustomers: 3 }, types: ["b2b_saas"] });
  it("strong problem evidence when the owner's numbers show the play's target is the weak link", () => {
    const c = playConfidence(play([assumption]) as never, econKnown, activation);
    expect(c.problem).toBe("strong");
    expect(c.fix).toBe("weak");
    expect(c.why.fix).toMatch(/assumptions/);
  });
  it("problem evidence is weak when the play works elsewhere, or there are no numbers", () => {
    expect(playConfidence(play([research], "Google Ads for more trials") as never, econKnown, activation).problem).toBe("weak");
    expect(playConfidence(play([research]) as never, econKnown, diagnose({})).problem).toBe("weak");
  });
  it("fix and forecast firm up with sourced and owner rates", () => {
    expect(playConfidence(play([research, research]) as never, econKnown, activation).fix).toBe("some");
    const own = playConfidence(play([owner, owner]) as never, econKnown, activation);
    expect(own.fix).toBe("strong");
    expect(["some", "strong"]).toContain(own.forecast);
  });
});
