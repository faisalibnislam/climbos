import { expect, it } from "vitest";
import { internal } from "../../convex/_generated/api";
import { startPlanWork } from "../../convex/lib/cards";
import type { Doc } from "../../convex/_generated/dataModel";
import { stepWorkFixture } from "../fixtures/stepWork";
import { makePaid } from "./helpers";

async function fixture(status: Doc<"workflowRuns">["status"], artifact: "usable" | "none" | "archived" | "broken" = "none", linked = true) {
  const f = await stepWorkFixture();
  await makePaid(f.t, f.orgId, 0); // New work can wait for credits; never run a provider in this test.
  const runId = await f.t.run(async ctx => {
    const now = Date.now(), plan = (await ctx.db.get(f.strategyId))!;
    const channel = { why: "Use the approved plan", priority: 1, status: "active" as const, monthlyCostMicros: 0, adSpendMinor: 0, deliverables: [], dependencies: [], measurement: "Owner review" };
    await ctx.db.patch(f.strategyId, { status: "approved", expert: undefined, channels: [{ ...channel, key: "social_organic", name: "Social drafts" }, { ...channel, key: "email_lifecycle", name: "Email drafts", priority: 2 }] });
    const runId = await ctx.db.insert("workflowRuns", { orgId: f.orgId, kind: "content_social", title: "First social drafts", status, input: JSON.stringify({ firstWin: true, ...(linked ? { strategyId: f.strategyId } : {}), channel: "linkedin", quantity: 1 }), roles: ["social_media_manager"], estimateMicros: 0, actualMicros: 0, rateVersionId: "verified-2026-10-17", entitlementVersionId: "ent-credits-2026-10-18", routingVersionId: "test", budget: { modelSteps: 1, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: true, createdAt: now, updatedAt: now });
    await ctx.db.patch(f.orgId, { firstWinRunIds: [runId] });
    if (artifact !== "none") {
      const artifactId = await ctx.db.insert("artifacts", { orgId: f.orgId, businessId: plan.businessId, runId, kind: "social_post", channel: "linkedin", title: "First post", status: artifact === "archived" ? "archived" : "draft", currentVersion: 1, createdAt: now, updatedAt: now });
      if (artifact !== "broken") {
        const versionId = await ctx.db.insert("artifactVersions", { orgId: f.orgId, artifactId, version: 1, body: "A complete private draft for the owner to review.", hashtags: [], claimFactIds: [], unsupportedClaims: [], contentHash: "test-hash", createdAt: now });
        await ctx.db.patch(artifactId, { currentVersionId: versionId });
      }
    }
    return runId;
  });
  const start = () => f.t.run(async ctx => startPlanWork(ctx, { org: (await ctx.db.get(f.orgId))!, strategyId: f.strategyId, userId: f.owner.userId }));
  return { ...f, runId, start };
}

it.each(["failed", "canceled", "verified"] as const)("does not claim a %s first run with no drafts covers social or email", async status => {
  const f = await fixture(status);
  const result = await f.start();
  expect(result.covered).toEqual([]);
  expect(result.waiting.map(item => item.title)).toHaveLength(2);
  expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it("reports a running same-plan draft as waiting without duplicating its AI job", async () => {
  const f = await fixture("executing");
  const before = await f.t.run(ctx => ctx.db.query("workflowRuns").collect());
  const result = await f.start();
  expect(result.covered).toEqual([]);
  expect(result.waiting).toContainEqual(expect.objectContaining({ title: "Social drafts", reason: expect.stringMatching(/in progress/i) }));
  expect(await f.t.run(ctx => ctx.db.query("workflowRuns").collect())).toEqual(before);
});

it.each(["uncertain", "paused"] as const)("keeps %s starter work visible without an automatic replacement", async status => {
  const f = await fixture(status);
  const result = await f.start();
  expect(result.covered).toEqual([]);
  expect(result.waiting).toContainEqual(expect.objectContaining({ title: "Social drafts", reason: expect.stringMatching(/unknown|paused/) }));
  expect(await f.t.run(ctx => ctx.db.query("workflowRuns").collect())).toHaveLength(1);
});

it("reuses completed same-plan social work without pretending email was also prepared", async () => {
  const f = await fixture("verified", "usable");
  const result = await f.start();
  expect(result.covered).toEqual(["Social drafts"]);
  expect(result.waiting).toEqual([expect.objectContaining({ title: expect.stringMatching(/^Email drafts:/) })]);
});

it.each(["archived", "broken"] as const)("does not reuse %s drafts", async artifact => {
  const f = await fixture("verified", artifact);
  expect((await f.start()).covered).toEqual([]);
});

it("does not assume an unbound legacy run belongs to the approved plan", async () => {
  const f = await fixture("verified", "usable", false);
  expect((await f.start()).covered).toEqual([]);
});

it.each(["different_plan", "wrong_channel", "partial_quantity", "foreign_run", "foreign_version"] as const)("does not count %s evidence as reusable preparation", async mismatch => {
  const f = await fixture("verified", "usable");
  await f.t.run(async ctx => {
    const run = (await ctx.db.get(f.runId))!;
    const artifact = (await ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", f.runId)).first())!;
    if (mismatch === "different_plan") await ctx.db.patch(f.runId, { input: JSON.stringify({ ...JSON.parse(run.input), strategyId: "another-plan" }) });
    if (mismatch === "partial_quantity") await ctx.db.patch(f.runId, { input: JSON.stringify({ ...JSON.parse(run.input), quantity: 3 }) });
    if (mismatch === "wrong_channel") await ctx.db.patch(artifact._id, { channel: "instagram" });
    if (mismatch === "foreign_run" || mismatch === "foreign_version") {
      const { _id, _creationTime, ...org } = (await ctx.db.get(f.orgId))!;
      const foreign = await ctx.db.insert("organizations", { ...org, slug: "foreign-first-win-test" });
      if (mismatch === "foreign_run") await ctx.db.patch(f.runId, { orgId: foreign });
      else await ctx.db.patch(artifact.currentVersionId!, { orgId: foreign });
    }
  });
  expect((await f.start()).covered).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it("binds newly reserved first-win work to the plan that requested it", async () => {
  const f = await fixture("verified");
  await makePaid(f.t, f.orgId, 50_000_000);
  await f.t.run(async ctx => {
    await ctx.db.patch(f.orgId, { firstWinRunIds: undefined });
    const plan = (await ctx.db.get(f.strategyId))!;
    await ctx.db.patch(f.strategyId, { channels: plan.channels.map(channel => channel.key === "social_organic" ? { ...channel, name: "LinkedIn posts" } : channel) });
  });
  await f.t.mutation(internal.content.startFirstWin, { orgId: f.orgId, userId: f.owner.userId });
  const ids = (await f.t.run(ctx => ctx.db.get(f.orgId)))?.firstWinRunIds ?? [];
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) {
    const run = (await f.t.run(ctx => ctx.db.get(id)))!;
    expect(JSON.parse(run.input)).toMatchObject({ firstWin: true, strategyId: f.strategyId });
    if (run.kind === "content_social") expect(JSON.parse(run.input).quantity).toBeGreaterThan(0);
    expect(run.status).not.toBe("verified");
  }
  expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});
