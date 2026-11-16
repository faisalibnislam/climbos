import { afterEach, expect, it, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import { startPlanWork } from "../../convex/lib/cards";
import { stepWorkFixture } from "../fixtures/stepWork";
import { makePaid } from "./helpers";

const state = vi.hoisted(() => ({ wrongDestination: false }));
vi.mock("../../convex/ai/fixtures", async original => {
  const actual = await original<typeof import("../../convex/ai/fixtures")>();
  return { ...actual, fixtureOutput: (...args: Parameters<typeof actual.fixtureOutput>) => {
    const output = actual.fixtureOutput(...args);
    if (state.wrongDestination && args[0] === "social_posts") for (const post of (output as { posts: { channel: string }[] }).posts) post.channel = "facebook";
    return output;
  } };
});

afterEach(() => { state.wrongDestination = false; delete process.env.CLIMBOS_FAKE_LLM; delete process.env.CLIMBOS_ENGINE; });

it.each([
  ["LinkedIn posts", ["linkedin"]],
  ["Instagram and Facebook posts", ["instagram", "facebook"]],
  ["YouTube demonstrations", ["youtube"]],
] as const)("keeps %s attached to the plan's drafting job", async (name, expected) => {
  const f = await stepWorkFixture();
  await makePaid(f.t, f.orgId, 50_000_000);
  process.env.CLIMBOS_FAKE_LLM = "ship";
  process.env.CLIMBOS_ENGINE = "v2";
  const result = await f.t.run(async ctx => {
    await ctx.db.patch(f.strategyId, { status: "approved", expert: undefined, channels: [{ key: "social_organic", name, why: "Prepare useful posts for the selected audience.", priority: 1, status: "active", monthlyCostMicros: 0, adSpendMinor: 0, deliverables: ["Private social drafts"], dependencies: [], measurement: "Review the drafts" }] });
    return startPlanWork(ctx, { org: (await ctx.db.get(f.orgId))!, strategyId: f.strategyId, userId: f.owner.userId });
  });
  expect(result.started).toHaveLength(1);
  const run = (await f.t.run(ctx => ctx.db.query("workflowRuns").first()))!;
  const input = JSON.parse(run.input);
  expect(input.channels ?? (input.channel ? [input.channel] : [])).toEqual(expected);
  await f.t.finishAllScheduledFunctions(() => undefined);
  const artifacts = await f.t.run(ctx => ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", run._id)).collect());
  expect(artifacts.length).toBeGreaterThan(0);
  expect(artifacts.every(artifact => expected.some(channel => channel === artifact.channel))).toBe(true);
  expect(artifacts.every(artifact => ["draft", "in_review"].includes(artifact.status))).toBe(true);
  expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it.each(["Social posts", "Instagram or LinkedIn", "Avoid Facebook", "Facebook group participation"])("keeps ambiguous destination %s waiting instead of choosing extra platforms", async name => {
  const f = await stepWorkFixture();
  await makePaid(f.t, f.orgId, 50_000_000);
  const result = await f.t.run(async ctx => {
    await ctx.db.patch(f.strategyId, { status: "approved", expert: undefined, channels: [{ key: "social_organic", name, why: "A proposed social direction", priority: 1, status: "active", monthlyCostMicros: 0, adSpendMinor: 0, deliverables: [], dependencies: [], measurement: "Owner review" }] });
    return startPlanWork(ctx, { org: (await ctx.db.get(f.orgId))!, strategyId: f.strategyId, userId: f.owner.userId });
  });
  expect(result.started).toEqual([]);
  expect(result.waiting).toContainEqual(expect.objectContaining({ reason: expect.stringMatching(/does not clearly select/) }));
  await f.t.mutation(internal.content.startFirstWin, { orgId: f.orgId, userId: f.owner.userId });
  expect(await f.t.run(ctx => ctx.db.query("workflowRuns").collect())).toEqual([]);
});

it("rejects a wrong-platform fixture result instead of relabeling it as the requested platform", async () => {
  const f = await stepWorkFixture();
  state.wrongDestination = true;
  await f.t.run(async ctx => {
    await ctx.db.patch(f.orgId, { kind: "demo" });
    await ctx.db.patch(f.strategyId, { status: "approved", expert: undefined, channels: [{ key: "social_organic", name: "LinkedIn posts", why: "Prepare LinkedIn copy", priority: 1, status: "active", monthlyCostMicros: 0, adSpendMinor: 0, deliverables: [], dependencies: [], measurement: "Owner review" }] });
    await startPlanWork(ctx, { org: (await ctx.db.get(f.orgId))!, strategyId: f.strategyId, userId: f.owner.userId });
  });
  await f.t.finishAllScheduledFunctions(() => undefined);
  const run = (await f.t.run(ctx => ctx.db.query("workflowRuns").first()))!;
  expect(run.status).toBe("failed");
  expect(run.error).toBe("social_destination_mismatch");
  expect(run.userMessage).toMatch(/requested social platforms/);
  expect(await f.t.run(ctx => ctx.db.query("artifacts").collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});
