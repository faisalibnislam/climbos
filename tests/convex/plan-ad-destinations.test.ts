import { afterEach, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { startPlanWork } from "../../convex/lib/cards";
import { stepWorkFixture } from "../fixtures/stepWork";
import { makePaid } from "./helpers";

const state = vi.hoisted(() => ({ output: "normal" as "normal" | "both" | "empty" }));
vi.mock("../../convex/ai/fixtures", async original => {
  const actual = await original<typeof import("../../convex/ai/fixtures")>();
  return { ...actual, fixtureOutput: (...args: Parameters<typeof actual.fixtureOutput>) => {
    if (args[0] === "ad_drafts" && state.output !== "normal") {
      const output = actual.fixtureOutput(args[0], { ...args[1], channel: undefined }) as { searchAds: unknown[]; metaAds: unknown[] };
      if (state.output === "empty") { output.searchAds = []; output.metaAds = []; }
      return output;
    }
    return actual.fixtureOutput(...args);
  } };
});
afterEach(() => { state.output = "normal"; delete process.env.CLIMBOS_ENGINE; delete process.env.CLIMBOS_FAKE_LLM; });

it.each([
  ["search_ads", "google_search_ad", true], ["meta_ads", "meta_ad", true],
  ["search_ads", "google_search_ad", false], ["meta_ads", "meta_ad", false],
] as const)("keeps %s drafts on %s (demo=%s)", async (key, channel, demo) => {
  const f = await stepWorkFixture();
  await makePaid(f.t, f.orgId, 50_000_000);
  process.env.CLIMBOS_ENGINE = "v2";
  process.env.CLIMBOS_FAKE_LLM = "ship";
  const result = await f.t.run(async ctx => {
    if (demo) await ctx.db.patch(f.orgId, { kind: "demo" });
    await ctx.db.patch(f.strategyId, { status: "approved", expert: undefined, channels: [{ key, name: key === "search_ads" ? "Google search ads" : "Meta ads", why: "Prepare drafts for the selected channel", priority: 1, status: "active", monthlyCostMicros: 0, adSpendMinor: 0, deliverables: ["Private ad drafts"], dependencies: [], measurement: "Owner review" }] });
    return startPlanWork(ctx, { org: (await ctx.db.get(f.orgId))!, strategyId: f.strategyId, userId: f.owner.userId });
  });
  expect(result.started).toHaveLength(1);
  const run = (await f.t.run(ctx => ctx.db.query("workflowRuns").first()))!;
  expect(JSON.parse(run.input).channel).toBe(channel);
  await f.t.finishAllScheduledFunctions(() => undefined);
  const artifacts = await f.t.run(ctx => ctx.db.query("artifacts").collect());
  expect(artifacts.length).toBeGreaterThan(0);
  expect(artifacts.every(artifact => artifact.channel === channel)).toBe(true);
  expect(artifacts.every(artifact => ["draft", "in_review"].includes(artifact.status))).toBe(true);
  expect(await f.t.run(ctx => ctx.db.query("campaigns").collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it.each(["both", "empty"] as const)("rejects %s output for a single-platform request before saving", async output => {
  const f = await stepWorkFixture();
  await f.t.run(ctx => ctx.db.patch(f.orgId, { kind: "demo" }));
  state.output = output;
  const { runId } = await f.owner.client.mutation(api.content.generate, { slug: f.slug, job: "content_ads", channel: "google_search_ad" });
  await f.t.finishAllScheduledFunctions(() => undefined);
  expect(await f.t.run(ctx => ctx.db.get(runId))).toMatchObject({ status: "failed", error: "ad_destination_mismatch" });
  expect(await f.t.run(ctx => ctx.db.query("artifacts").collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.query("campaigns").collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it("preserves both draft types for an unspecified ad request", async () => {
  const f = await stepWorkFixture();
  await f.t.run(ctx => ctx.db.patch(f.orgId, { kind: "demo" }));
  await f.owner.client.mutation(api.content.generate, { slug: f.slug, job: "content_ads" });
  await f.t.finishAllScheduledFunctions(() => undefined);
  const artifacts = await f.t.run(ctx => ctx.db.query("artifacts").collect());
  expect([...new Set(artifacts.map(artifact => artifact.channel))].sort()).toEqual(["google_search_ad", "meta_ad"]);
});

it("rejects a non-ad destination without saving drafts or creating a campaign", async () => {
  const f = await stepWorkFixture();
  await f.t.run(ctx => ctx.db.patch(f.orgId, { kind: "demo" }));
  const { runId } = await f.owner.client.mutation(api.content.generate, { slug: f.slug, job: "content_ads", channel: "linkedin" });
  await f.t.finishAllScheduledFunctions(() => undefined);
  expect(await f.t.run(ctx => ctx.db.get(runId))).toMatchObject({ status: "failed", error: "invalid_ad_destination" });
  expect(await f.t.run(ctx => ctx.db.query("artifacts").collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.query("campaigns").collect())).toEqual([]);
});

it("resolves an older unstarted ad card against its approved plan's destination", async () => {
  const f = await stepWorkFixture();
  await f.t.run(async ctx => {
    await ctx.db.patch(f.orgId, { kind: "demo" });
    const cardId = await ctx.db.insert("actionCards", { orgId: f.orgId, title: "Search drafts", description: "Prepare the selected search ad", priority: 1, proposedEffect: "Drafts only", kind: "generate_content", roles: ["ads_manager"], payload: JSON.stringify({ job: "content_ads", channel: "meta_ad", strategyId: f.strategyId, planChannel: "search_ads" }), costEstimateMicros: 0, externalEffect: false, status: "proposed", createdAt: Date.now(), updatedAt: Date.now() });
    await ctx.db.patch(f.strategyId, { status: "approved", expert: undefined, channels: [{ key: "search_ads", name: "Google search ads", why: "Prepare search copy", priority: 1, status: "active", monthlyCostMicros: 0, adSpendMinor: 0, deliverables: [], dependencies: [], measurement: "Owner review", cardId }] });
    await startPlanWork(ctx, { org: (await ctx.db.get(f.orgId))!, strategyId: f.strategyId, userId: f.owner.userId });
  });
  const run = (await f.t.run(ctx => ctx.db.query("workflowRuns").first()))!;
  expect(JSON.parse(run.input).channel).toBe("google_search_ad");
  await f.t.finishAllScheduledFunctions(() => undefined);
  const artifacts = await f.t.run(ctx => ctx.db.query("artifacts").collect());
  expect(artifacts.length).toBeGreaterThan(0);
  expect(artifacts.every(artifact => artifact.channel === "google_search_ad")).toBe(true);
  expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});
