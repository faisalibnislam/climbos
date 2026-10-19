import { describe, expect, it } from "vitest";
import { toBullets } from "../../src/components/app/ProseBullets";
import { lineDiff, wordDiff } from "../../src/components/app/plan/history/diff";
import { comparePlans, type ComparablePlan } from "../../src/components/app/plan/history/parts";
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
  it("describes restored parts", () => {
    expect(describeParts(["channels", "plays"])).toBe("Channels and Growth plays");
  });
});
