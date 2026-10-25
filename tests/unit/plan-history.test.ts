import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { toBullets } from "../../src/components/app/ProseBullets";
import { lineDiff, wordDiff } from "../../src/components/app/plan/history/diff";
import { comparePlans, compareSavedDecisions, type ComparablePlan } from "../../src/components/app/plan/history/parts";
import { DecisionChangesSummary } from "../../src/components/app/plan/history/DecisionChangesSummary";
import { describeParts } from "../../shared/planParts";

const plan = (over: Partial<ComparablePlan> = {}): ComparablePlan => ({
  summary: "Test three plays. Do not scale yet.",
  positioning: "Privacy first.",
  audiences: [{ name: "Customers", hypothesis: "They refer.", evidence: "21k subscribers." }],
  channels: [{ name: "Referrals", priority: 1, status: "proposed", why: "Largest lever.", monthlyCostMicros: 0, adSpendMinor: 0 }],
  constraints: ["Ad budget: $500/month"],
  measurementPlan: "Tag every link.",
  ...over,
});

describe("toBullets", () => {
  it("splits sentences and keeps abbreviations together", () => {
    expect(toBullets("Test three plays. The maths is not a forecast: reach is unverified. Do not scale.")).toEqual(["Test three plays", "The maths is not a forecast: reach is unverified", "Do not scale"]);
    expect(toBullets("Use e.g. UTMs on links. Then review.")).toEqual(["Use e.g. UTMs on links", "Then review"]);
  });
  it("keeps an existing list", () => {
    expect(toBullets("- one\n- two")).toEqual(["one", "two"]);
  });
});

describe("plan version diff", () => {
  it("marks changed words", () => {
    const d = wordDiff("cap search at $50", "cap search at $80");
    expect(d.left.some((o) => o.t === "del" && o.text.includes("$50"))).toBe(true);
    expect(d.right.some((o) => o.t === "add" && o.text.includes("$80"))).toBe(true);
  });
  it("pairs changed lines and keeps same lines", () => {
    const rows = lineDiff(["a", "b", "c"], ["a", "B", "c", "d"]);
    expect(rows.map((r) => r.kind)).toEqual(["same", "changed", "same", "added"]);
  });
  it("finds which plan parts changed", () => {
    const parts = comparePlans(plan(), [], plan({ positioning: "Privacy first, no cookies." }), []);
    expect(parts.filter((p) => p.changed).map((p) => p.key)).toEqual(["positioning"]);
  });
  it("summarizes saved diagnosis, play, and portfolio decisions between plan versions", () => {
    const before = plan({
      channels: [{ name: "Search", priority: 1, status: "proposed", why: "Ready", monthlyCostMicros: 0, adSpendMinor: 0 }],
      savedDecisions: {
        diagnosis: "Trust may be slowing purchases.",
        plays: [{ id: "search", name: "Improve local search", kind: "search", oneLiner: "Improve the booking page.", unit: "bookings", p10: 1, p50: 3, p90: 6 }],
        portfolio: { selected: ["Improve local search"], customers: 3, horizonDays: 90 },
      },
    });
    const after = plan({
      channels: [{ name: "Referrals", priority: 1, status: "proposed", why: "Customer evidence", monthlyCostMicros: 0, adSpendMinor: 0 }],
      audiences: [{ name: "Returning customers", hypothesis: "They may refer peers.", evidence: "Owner reported referrals." }],
      savedDecisions: {
        diagnosis: "Repeat purchases need attention.",
        plays: [
          { id: "search", name: "Improve local search", kind: "search", oneLiner: "Improve the booking page.", unit: "bookings", p10: 1, p50: 4, p90: 8 },
          { id: "referral", name: "Ask for referrals", kind: "retention", oneLiner: "Invite all eligible customers.", unit: "bookings", p10: 0, p50: 2, p90: 5 },
        ],
        portfolio: { selected: ["Ask for referrals"], customers: 2, horizonDays: 120 },
      },
    });
    const changes = compareSavedDecisions(before, after)!;
    expect(changes.map((change) => change.key)).toContain("diagnosis");
    expect(changes.find((change) => change.key === "play-search")?.after).toContain("saved lower/middle/upper modeled customers: 1 / 4 / 8 bookings");
    expect(changes.find((change) => change.key === "play-referral")?.before).toBe("Not recommended in this version");
    expect(changes.find((change) => change.key === "chosen-set")?.before).toContain("Improve local search · 3 modeled customers over 90 days");
    expect(changes.find((change) => change.key === "chosen-set")?.after).toContain("Ask for referrals · 2 modeled customers over 120 days");
    expect(changes.find((change) => change.key === "channels")?.after).toBe("1. Referrals (proposed)");
    expect(changes.find((change) => change.key === "audiences")?.after).toBe("Returning customers");
  });
  it("does not claim a decision comparison when saved decision details are missing", () => {
    expect(compareSavedDecisions(plan(), plan({ savedDecisions: null }))).toBeNull();
  });
  it("renders the saved before/after decision summary and labels modeled ranges honestly", () => {
    const markup = renderToStaticMarkup(createElement(DecisionChangesSummary, {
      beforeLabel: "v1",
      afterLabel: "v2",
      changes: [{ key: "play-search", label: "Improve local search", before: "saved lower/middle/upper modeled customers: 1 / 3 / 6 bookings", after: "saved lower/middle/upper modeled customers: 1 / 4 / 8 bookings" }],
    }));
    expect(markup).toContain("What changed in the recommendation?");
    expect(markup).toContain("Before · v1");
    expect(markup).toContain("After · v2");
    expect(markup).toContain("scenarios, not actual results");
    expect(markup).toContain("saved lower/middle/upper modeled customers: 1 / 4 / 8 bookings");
  });
  it("describes restored parts", () => {
    expect(describeParts(["channels", "plays"])).toBe("Channels and Growth plays");
  });
});
