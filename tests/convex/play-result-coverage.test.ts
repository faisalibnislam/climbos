import { afterEach, describe, expect, it, vi } from "vitest";
import { weekOf } from "../../convex/playResults";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

async function fixture(currency = "KWD") {
  const t = setup(), owner = await asNewUser(t, "weekly-money@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Weekly reports" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
  const ids = await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    await ctx.db.patch(business._id, { currency });
    const goal = (await ctx.db.query("goals").withIndex("by_org_status", q => q.eq("orgId", orgId).eq("status", "active")).first())!;
    const strategyId = await ctx.db.insert("strategies", { orgId, businessId: business._id, goalId: goal._id, version: 1, status: "approved", summary: "Weekly plan", audiences: [], positioning: "p", channels: [], constraints: [], measurementPlan: "m", reviewDate: "2026-11-01", sourceFactIds: [], generationCostMicros: 0, createdAt: Date.now(), expert: { diagnosis: "d", affordableCac: "unknown", notDoing: [], northStar: { metric: "m", baseline: "unknown", target: "unknown" }, leadingIndicators: [], phases: [], weekOneChecklist: [], risks: [], plays: [{ id: "weekly-play", name: "Weekly play", kind: "bankable", horizonDays: 90, model: { weeklyReach: 100, steps: [{ name: "Paying customers", rate: 0.1 }], monthlySpendUsd: 0, ownerHoursPerWeek: 1 } }] } } as never);
    return { strategyId, businessId: business._id };
  });
  const args = { slug, strategyId: ids.strategyId, playName: "Weekly play", reach: 100, steps: [10], spendUsd: 12.345, currency, ownerHours: 1 };
  return { t, owner, slug, orgId, ...ids, args };
}

describe("weekly summary coverage", () => {
  afterEach(() => vi.restoreAllMocks());
  it("does not lose a play behind unrelated rows", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 405; i++) await ctx.db.insert("playResults", { orgId: f.orgId, strategyId: f.strategyId, playName: `AAA ${i}`, weekStart: weekOf(Date.now()), reach: 1, steps: [1], spendUsd: 0, ownerHours: 0, enteredBy: f.owner.userId, updatedAt: Date.now() });
    });
    await f.owner.client.mutation(api.playResults.log, f.args);
    const view = await f.owner.client.query(api.playResults.forStrategy, { slug: f.slug, strategyId: f.strategyId });
    expect(view.byPlay["Weekly play"]).toMatchObject({ customers: 10, reach: 100 });
  });
  it("counts more than 60 recorded weeks without treating a truncated sample as a total", async () => {
    const f = await fixture();
    const first = weekOf(Date.now());
    await f.t.run(async ctx => {
      for (let i = 0; i < 62; i++) await ctx.db.insert("playResults", { orgId: f.orgId, strategyId: f.strategyId, playId: "weekly-play", playName: "Weekly play", weekStart: first + i * 7 * 86400000, reach: 100, steps: [10], spendUsd: 0, ownerHours: 1, enteredBy: f.owner.userId, updatedAt: Date.now() });
    });
    vi.spyOn(Date, "now").mockReturnValue(first + 62 * 7 * 86400000);
    const view = await f.owner.client.query(api.playResults.forStrategy, { slug: f.slug, strategyId: f.strategyId });
    expect(view.byPlay["Weekly play"]).toMatchObject({ weeks: 62, customers: 620 });
  });
  it("counts completed missing weeks after the last report", async () => {
    const f = await fixture();
    const first = weekOf(Date.now());
    await f.owner.client.mutation(api.playResults.log, f.args);
    vi.spyOn(Date, "now").mockReturnValue(first + 4 * 7 * 86400000);
    const view = await f.owner.client.query(api.playResults.forStrategy, { slug: f.slug, strategyId: f.strategyId });
    expect(view.byPlay["Weekly play"]).toMatchObject({ weeks: 1, weeksSinceStart: 4, unloggedWeeks: 3, status: "incomplete_log" });
    expect(await f.t.query(internal.playResults.briefFor, { orgId: f.orgId })).toContain("3 elapsed weeks are unlogged");
  });

  it("keeps an entirely unreported window unknown and current-week reports provisional", async () => {
    const f = await fixture();
    const first = weekOf(Date.now());
    vi.spyOn(Date, "now").mockReturnValue(first + 2 * 7 * 86400000);
    const view = await f.owner.client.query(api.playResults.forStrategy, { slug: f.slug, strategyId: f.strategyId });
    expect(view.byPlay["Weekly play"]).toMatchObject({ weeks: 0, unloggedWeeks: 2, status: "incomplete_log" });
    const brief = await f.t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).toContain("no weekly results reported; customer counts, spending and hours are unknown");
    expect(brief).not.toContain("explicitly reported no spend");
  });

  it("does not let empty plays displace reported results in the learning sample", async () => {
    const f = await fixture();
    await f.owner.client.mutation(api.playResults.log, f.args);
    await f.t.run(async ctx => {
      const s = (await ctx.db.get(f.strategyId))!, expert = s.expert as Record<string, unknown>;
      const play = (expert.plays as Record<string, unknown>[])[0];
      await ctx.db.patch(s._id, { expert: { ...expert, plays: [...Array.from({ length: 8 }, (_, i) => ({ ...play, id: `empty-${i}`, name: `Empty ${i}` })), play] } } as never);
    });
    expect(await f.t.query(internal.playResults.briefFor, { orgId: f.orgId })).toContain("Weekly play: 1 week, reached 100");
  });

  it.each(["duplicate", "foreign", "missing_step", "invalid_count", "changed_definition", "overflow"])("withholds an unusable %s summary without emitting partial totals", async kind => {
    const f = await fixture();
    await f.owner.client.mutation(api.playResults.log, f.args);
    await f.t.run(async ctx => {
      const row = (await ctx.db.query("playResults").collect())[0];
      const { _id: _i, _creationTime: _c, ...data } = row;
      if (kind === "duplicate") await ctx.db.insert("playResults", data);
      if (kind === "foreign") {
        const { _id: _orgId, _creationTime: _orgTime, ...orgData } = (await ctx.db.get(f.orgId))!;
        const otherOrg = await ctx.db.insert("organizations", { ...orgData, name: "Foreign fixture", slug: "foreign-weekly-fixture" });
        await ctx.db.patch(row._id, { orgId: otherOrg });
      }
      if (kind === "missing_step") await ctx.db.patch(row._id, { steps: [] });
      if (kind === "invalid_count") await ctx.db.patch(row._id, { steps: [101] });
      if (kind === "changed_definition") await ctx.db.patch(row._id, { stepNames: ["Unrelated metric"] });
      if (kind === "overflow") for (let i = 0; i < 520; i++) await ctx.db.insert("playResults", { ...data, reach: 1, steps: [1] });
    });
    const view = await f.owner.client.query(api.playResults.forStrategy, { slug: f.slug, strategyId: f.strategyId });
    expect(view.byPlay["Weekly play"]).toBeUndefined();
    expect(view.issues["Weekly play"]).toBeTruthy();
    if (kind === "overflow") expect(view.issues["Weekly play"]).toContain("read limit");
    const brief = await f.t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).toContain("weekly summary unavailable");
    expect(brief).not.toContain("reached 100");
    expect(brief).not.toContain("FORECAST RANGE COVERAGE");
    for (const table of ["approvals", "actionReceipts", "workflowRuns"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("does not include future or pre-plan weeks", async () => {
    const f = await fixture();
    await f.owner.client.mutation(api.playResults.log, f.args);
    await f.t.run(async ctx => {
      const { _id: _i, _creationTime: _c, ...row } = (await ctx.db.query("playResults").collect())[0];
      for (const offset of [-1, 1]) await ctx.db.insert("playResults", { ...row, weekStart: row.weekStart + offset * 7 * 86400000, reach: 500, steps: [50] });
    });
    expect((await f.owner.client.query(api.playResults.forStrategy, { slug: f.slug, strategyId: f.strategyId })).byPlay["Weekly play"]).toMatchObject({ weeks: 1, customers: 10, currentWeekIncluded: true });
  });

  it("checks range coverage only for complete aligned horizons and excludes later results", async () => {
    const f = await fixture();
    const first = weekOf(Date.now()), weekMs = 7 * 86400000;
    await f.t.run(async ctx => {
      const s = (await ctx.db.get(f.strategyId))!;
      const expert = s.expert as Record<string, unknown>;
      const play = (expert.plays as Record<string, unknown>[])[0];
      await ctx.db.patch(s._id, { expert: { ...expert, plays: [0, 1, 2].map(i => ({ ...play, id: `cal-${i}`, name: `Cal ${i}`, horizonDays: 14, p10: 1, p50: 2, p90: 3 })) } } as never);
      for (let i = 0; i < 3; i++) for (let w = 0; w < 3; w++) await ctx.db.insert("playResults", { orgId: f.orgId, strategyId: s._id, playId: `cal-${i}`, playName: `Cal ${i}`, weekStart: first + w * weekMs, reach: 100, steps: [w === 2 ? 90 : 1], spendUsd: 0, ownerHours: 0, enteredBy: f.owner.userId, updatedAt: Date.now() });
    });
    const clock = vi.spyOn(Date, "now").mockReturnValue(first + weekMs + 1);
    expect(await f.t.query(internal.playResults.briefFor, { orgId: f.orgId })).not.toContain("FORECAST RANGE COVERAGE");
    clock.mockReturnValue(first + 3 * weekMs);
    expect(await f.t.query(internal.playResults.briefFor, { orgId: f.orgId })).toContain("3 of 3 landed inside");
    const view = await f.owner.client.query(api.playResults.forStrategy, { slug: f.slug, strategyId: f.strategyId });
    expect(view.byPlay["Cal 0"]).toMatchObject({ customers: 92, expectedByNow: null, comparisonIssue: expect.stringContaining("beyond the original forecast horizon") });
    await f.t.run(async ctx => {
      const s = (await ctx.db.get(f.strategyId))!, expert = s.expert as Record<string, unknown>;
      await ctx.db.patch(s._id, { expert: { ...expert, plays: (expert.plays as Record<string, unknown>[]).map(p => ({ ...p, horizonDays: 13 })) } } as never);
    });
    expect(await f.t.query(internal.playResults.briefFor, { orgId: f.orgId })).not.toContain("FORECAST RANGE COVERAGE");
  });
});
