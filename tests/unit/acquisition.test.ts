import { describe, expect, it } from "vitest";
import { BUSINESS_TYPES, CHANNELS, CHANNEL_BY_ID, budgetBand } from "../../shared/acquisition/library";
import { candidatesFor, dimensionsToConfirm, mergeFit, scoreChannels, type AcquisitionProfile } from "../../shared/acquisition/scoring";

const v = (value: string) => ({ value, confidence: "high" as const, source: "owner" as const });
const formkit: AcquisitionProfile = { types: ["b2b_saas"], budgetUsd: 600, horizonDays: 90, dims: { customerType: v("b2b"), geography: v("global"), aov: v("low"), salesMotion: v("self_service"), team: v("solo") } };
const plumber: AcquisitionProfile = { types: ["local_services"], budgetUsd: 400, horizonDays: 60, dims: { customerType: v("b2c"), geography: v("local"), team: v("small") } };

describe("acquisition library", () => {
  it("has unique channel ids and every type references real channels", () => {
    expect(new Set(CHANNELS.map((c) => c.id)).size).toBe(CHANNELS.length);
    expect(CHANNELS.length).toBeGreaterThan(200);
    expect(BUSINESS_TYPES).toHaveLength(30);
    for (const t of BUSINESS_TYPES) for (const id of [...t.starters, ...t.channels]) expect(CHANNEL_BY_ID[id], `${t.key} → ${id}`).toBeTruthy();
  });
  it("maps budgets to the framework's bands", () => {
    expect(budgetBand(600).label).toBe("$500–1,000");
    expect(budgetBand(50).maxPaid).toBe(0);
  });
});

describe("channel scoring", () => {
  it("B2B SaaS at $600: focused, at most one paid channel, no local or app-store channels", () => {
    const rows = scoreChannels(formkit);
    const plan = rows.filter((r) => r.status === "primary" || r.status === "in_plan");
    expect(plan.length).toBeGreaterThanOrEqual(2);
    expect(plan.length).toBeLessThanOrEqual(3);
    expect(plan.filter((r) => r.paid).length).toBeLessThanOrEqual(1);
    expect(rows.find((r) => r.id === "S04")?.status).toBe("ineligible"); // Google Maps
    expect(rows.find((r) => r.id === "M06")?.status).toBe("ineligible"); // App Store
    expect(rows.find((r) => r.id === "P09")?.status).not.toMatch(/primary|in_plan/); // LinkedIn Ads needs $1,500
    expect(rows[0].status).toBe("primary");
    expect(rows[0].family).not.toBe("outreach"); // low-ticket self-serve: not one-to-one selling
  });
  it("local services: Google Maps ranks near the top", () => {
    const rows = scoreChannels(plumber).filter((r) => r.status !== "ineligible");
    expect(rows.slice(0, 5).map((r) => r.id)).toContain("S04");
  });
  it("only a supported diagnosis changes channel shortlist priority toward the affected journey stage", () => {
    const ordinary = scoreChannels(formkit);
    const focused = scoreChannels(formkit, [], undefined, undefined, "retention");
    const first = focused[0];
    expect(first.diagnosisFit).toBe(true);
    expect(CHANNEL_BY_ID[first.id]!.stages.some((stage) => stage === "existing" || stage === "returning")).toBe(true);
    expect(focused.find((r) => r.id === first.id)?.why).toMatch(/measured retention bottleneck/);
    // Without a supported diagnosis, the established score ordering is unchanged.
    expect(scoreChannels(formkit).map((r) => r.id)).toEqual(ordinary.map((r) => r.id));
  });
  it("evidence-backed adjustments move a channel, within bounds", () => {
    const before = scoreChannels(formkit).find((r) => r.id === "M10")!.score;
    const after = scoreChannels(formkit, [{ channelId: "M10", deltas: { competition: 90, audience: 20 }, reason: "No rival launched there in 2 years", evidence: "producthunt.com search" }]).find((r) => r.id === "M10")!;
    expect(after.score).toBeGreaterThan(before);
    expect(after.factors.competition).toBe(80); // 50 + capped 30
    expect(after.why).toMatch(/No rival/);
  });
  it("uses owner-reported channel experience as a soft, explained preference without bypassing hard limits", () => {
    const channelId = "M10";
    const before = scoreChannels(formkit).find((r) => r.id === channelId)!;
    const preferred = scoreChannels({ ...formkit, channelPreferences: [{ channelId, preference: "prefer", rationale: "We got qualified demos from this channel." }] }).find((r) => r.id === channelId)!;
    const avoided = scoreChannels({ ...formkit, channelPreferences: [{ channelId, preference: "avoid", rationale: "Prior tests brought poor-fit leads." }] }).find((r) => r.id === channelId)!;
    expect(preferred.score).toBe(before.score + 12);
    expect(avoided.score).toBe(before.score - 12);
    expect(preferred.ownerPreference).toMatchObject({ preference: "prefer", rationale: "We got qualified demos from this channel." });
    expect(scoreChannels({ ...formkit, channelPreferences: [{ channelId: "S04", preference: "prefer", rationale: "We want local visibility." }] }).find((r) => r.id === "S04")?.status).toBe("ineligible");
    const overBudget = scoreChannels({ ...formkit, channelPreferences: [{ channelId: "P09", preference: "prefer", rationale: "This channel brought strong leads before." }] }).find((r) => r.id === "P09")!;
    expect(overBudget.status).not.toBe("primary");
    expect(overBudget.status).not.toBe("in_plan");
  });
  it("eligibility follows traits: Ad Grants only for nonprofits, ASO only for apps", () => {
    const np = scoreChannels({ ...plumber, types: ["nonprofit"] });
    expect(np.find((r) => r.id === "X09")?.status).not.toBe("ineligible");
    expect(scoreChannels(formkit).find((r) => r.id === "X09")?.status).toBe("ineligible");
    const app = scoreChannels({ ...plumber, types: ["mobile_app"], dims: { customerType: v("b2c"), geography: v("global") } });
    expect(app.find((r) => r.id === "S18")?.status).not.toBe("ineligible");
  });
  it("does not let inferred customer type or geography unlock hard channel eligibility", () => {
    const inferredLocal = { ...formkit, dims: { ...formkit.dims, geography: { value: "local", confidence: "high" as const, source: "inferred" as const } } };
    expect(scoreChannels(inferredLocal).find((r) => r.id === "S04")?.status).toBe("ineligible");
    const inferredConsumer = { ...formkit, dims: { ...formkit.dims, customerType: { value: "b2c", confidence: "medium" as const, source: "inferred" as const } } };
    expect(scoreChannels(inferredConsumer).find((r) => r.id === "P14")?.status).toBe("ineligible");
    const lowConfidence = { ...formkit, dims: { ...formkit.dims, aov: { value: "low", confidence: "low" as const, source: "inferred" as const } } };
    expect(scoreChannels(lowConfidence).find((r) => r.id === "D01")?.priceFit).toBeUndefined();
  });
  it("keeps inferred business-type traits soft until the owner confirms the types", () => {
    const inferred: AcquisitionProfile = { types: ["mobile_app"], typesSource: "inferred", budgetUsd: 600, horizonDays: 90, dims: {} };
    const ownerConfirmed = { ...inferred, typesSource: "owner" as const };
    expect(scoreChannels(inferred).find((r) => r.id === "S18")?.status).toBe("ineligible");
    expect(scoreChannels(ownerConfirmed).find((r) => r.id === "S18")?.status).not.toBe("ineligible");
    const updated = mergeFit(ownerConfirmed, { types: ["b2b_saas"], dimensions: [] }, new Set(["mobile_app", "b2b_saas"]));
    expect(updated).toMatchObject({ types: ["mobile_app"], typesSource: "owner" });
  });
  it("asks only about unknown or low-confidence dimensions", () => {
    expect(dimensionsToConfirm({ ...formkit, dims: {} })).toEqual(["customerType", "geography", "salesMotion"]);
    expect(dimensionsToConfirm(formkit)).toEqual(["salesCycle", "scale"]);
  });
  it("candidates include every starter for the type", () => {
    const ids = candidatesFor(formkit, 10).map((r) => r.id);
    for (const s of ["S09", "S10", "P01", "R07"]) expect(ids).toContain(s);
  });
});
