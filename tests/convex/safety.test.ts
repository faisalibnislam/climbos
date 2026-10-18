import { describe, expect, it } from "vitest";
import { checkInvariants } from "../../shared/economics/ledger";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ledgerOf } from "../../convex/lib/periods";
import { asNewUser, setup, type T } from "./helpers";

async function demo(t: T) {
  const u = await asNewUser(t, "demo-user@example.com", { anonymous: true });
  const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
  const orgId = await t.run(async (ctx) => (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique())!._id);
  return { ...u, slug, orgId };
}

async function artifactsByStatus(t: T, orgId: Id<"organizations">, status: string) {
  return t.run(async (ctx) => (await ctx.db.query("artifacts").withIndex("by_org_updated", (q) => q.eq("orgId", orgId)).collect()).filter((a) => a.status === status));
}

describe("cost reservations under concurrency", () => {
  it("parallel jobs can never overspend the account's credits", async () => {
    const t = setup();
    const owner = await asNewUser(t, "owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Race Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
    // Credits for exactly 3 jobs, then fire 10 concurrently.
    const est = await owner.client.query(api.content.estimate, { slug, job: "content_social", quantity: 2, images: 0 });
    await t.run(async (ctx) => {
      const p = await ctx.db.query("usagePeriods").withIndex("by_org_period", (q) => q.eq("orgId", orgId).eq("periodKey", "onboarding")).unique();
      await ctx.db.patch(p!._id, { walletCapMicros: est.maxCostMicros * 3 });
    });
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => owner.client.mutation(api.content.generate, { slug, job: "content_social", quantity: 2, images: 0 })),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toBe(3);
    expect(rejected.every((r) => /credits|busy/i.test(String(r.reason)))).toBe(true);
    const period = await t.run(async (ctx) => ctx.db.query("usagePeriods").withIndex("by_org_period", (q) => q.eq("orgId", orgId).eq("periodKey", "onboarding")).unique());
    expect(checkInvariants(ledgerOf(period!))).toEqual([]);
    expect(period!.walletReservedMicros).toBe(est.maxCostMicros * 3);
  });

  it("failed jobs release meters, keep real costs, and can't retry for free", async () => {
    const t = setup();
    const owner = await asNewUser(t, "owner2@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Retry Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More", horizonDays: 90, monthlyAdBudget: 0 });
    const { runId } = await owner.client.mutation(api.content.generate, { slug, job: "content_email" });
    // Simulate a provider call that cost money and then failed.
    const step = await t.mutation(internal.engine.beginStep, { runId, index: 0, kind: "model", label: "Email sequence" });
    expect(step.proceed).toBe(true);
    await t.mutation(internal.engine.recordUsage, {
      stepId: step.stepId!,
      records: [{ type: "model_call", provider: "openai", model: "gpt-6-luna", inputTokens: 1000, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: 1, costMicros: 120, estimated: false }],
    });
    await t.mutation(internal.engine.failStep, { stepId: step.stepId!, error: "provider_error" });
    await t.mutation(internal.engine.finishRun, { runId, status: "failed", userMessage: "failed" });
    const period = await t.run(async (ctx) => ctx.db.query("usagePeriods").withIndex("by_org_period", (q) => q.eq("orgId", orgId).eq("periodKey", "onboarding")).unique());
    expect(period!.walletReservedMicros).toBe(0);
    expect(period!.walletSpentMicros).toBe(120);
    // A second finish is idempotent (reconciled exactly once).
    await t.mutation(internal.engine.finishRun, { runId, status: "failed" });
    const again = await t.run(async (ctx) => ctx.db.get(period!._id));
    expect(again!.walletSpentMicros).toBe(120);
    // The step budget is enforced per run: no unbounded retries inside a run.
    for (let i = 1; i <= 5; i++) await t.mutation(internal.engine.beginStep, { runId, index: i, kind: "model", label: "x" });
    const seventh = await t.mutation(internal.engine.beginStep, { runId, index: 6, kind: "model", label: "x" });
    expect(seventh).toMatchObject({ proceed: false });
  });

  it("fallback must reserve more before it runs; exhausted capacity fails closed", async () => {
    const t = setup();
    const owner = await asNewUser(t, "owner3@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Fallback Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More", horizonDays: 90, monthlyAdBudget: 0 });
    const { runId } = await owner.client.mutation(api.content.generate, { slug, job: "content_email" });
    await t.run(async (ctx) => {
      const p = (await ctx.db.query("usagePeriods").withIndex("by_org_period", (q) => q.eq("orgId", orgId).eq("periodKey", "onboarding")).unique())!;
      await ctx.db.patch(p._id, { walletSpentMicros: p.walletCapMicros - p.walletReservedMicros });
    });
    const res = await t.mutation(internal.engine.reserveAdditional, { runId, costMicros: 50_000 });
    expect(res.ok).toBe(false);
  });
});

describe("approvals and execution safety", () => {
  it("editing an approved artifact invalidates its approval and requires a new one", async () => {
    const t = setup();
    const d = await demo(t);
    const [approved] = await artifactsByStatus(t, d.orgId, "approved");
    const before = await d.client.query(api.content.get, { slug: d.slug, artifactId: approved._id });
    expect(before.approvals.some((a) => a.status === "approved")).toBe(true);
    await d.client.mutation(api.content.edit, { slug: d.slug, artifactId: approved._id, body: `${before.current!.body} (edited)`, hashtags: before.current!.hashtags, altText: before.current!.altText ?? undefined });
    const after = await d.client.query(api.content.get, { slug: d.slug, artifactId: approved._id });
    expect(after.status).toBe("in_review");
    expect(after.approvals.find((a) => a.status === "approved")).toBeUndefined();
    expect(after.approvals.some((a) => a.status === "invalidated" && /Edited/.test(a.invalidatedReason ?? ""))).toBe(true);
    await expect(d.client.mutation(api.content.publishNow, { slug: d.slug, artifactId: approved._id })).rejects.toThrow(/Approve this first/);
  });

  it("publishes an approved demo post once (fixture receipt) and blocks duplicates and paused workspaces", async () => {
    const t = setup();
    const d = await demo(t);
    const instagramApproved = (await artifactsByStatus(t, d.orgId, "approved")).find((a) => a.channel === "instagram");
    const target =
      instagramApproved ??
      (await t.run(async (ctx) => {
        const a = (await ctx.db.query("artifacts").withIndex("by_org_updated", (q) => q.eq("orgId", d.orgId)).collect()).find((x) => x.channel === "instagram" && x.status === "in_review")!;
        return a;
      }));
    if (target.status !== "approved") await d.client.mutation(api.content.decide, { slug: d.slug, artifactId: target._id, decision: "approve" });

    await t.action(internal.publish.publishArtifact, { artifactId: target._id });
    const once = await d.client.query(api.content.get, { slug: d.slug, artifactId: target._id });
    expect(once.status).toBe("published");
    expect(once.receipts.filter((r) => r.status === "fixture_verified")).toHaveLength(1);
    // A second execution of the same version is a no-op (idempotency key).
    await t.action(internal.publish.publishArtifact, { artifactId: target._id });
    const twice = await d.client.query(api.content.get, { slug: d.slug, artifactId: target._id });
    expect(twice.receipts).toHaveLength(1);

    // Emergency stop blocks execution even for approved work.
    const other = (await t.run(async (ctx) => (await ctx.db.query("artifacts").withIndex("by_org_updated", (q) => q.eq("orgId", d.orgId)).collect()).find((x) => x.channel === "instagram" && x.status === "in_review")));
    if (other) {
      await d.client.mutation(api.content.decide, { slug: d.slug, artifactId: other._id, decision: "approve" });
      await d.client.mutation(api.workspace.pauseAll, { slug: d.slug });
      await t.action(internal.publish.publishArtifact, { artifactId: other._id });
      const blocked = await d.client.query(api.content.get, { slug: d.slug, artifactId: other._id });
      expect(blocked.status).not.toBe("published");
      expect(blocked.receipts).toHaveLength(0);
      await expect(d.client.mutation(api.content.generate, { slug: d.slug, job: "content_social", quantity: 1 })).rejects.toThrow(/paused/i);
    }
  });

  it("an expired approval or a policy change blocks execution", async () => {
    const t = setup();
    const d = await demo(t);
    const target = (await t.run(async (ctx) => (await ctx.db.query("artifacts").withIndex("by_org_updated", (q) => q.eq("orgId", d.orgId)).collect()).find((x) => x.channel === "instagram" && x.status === "in_review")))!;
    await d.client.mutation(api.content.decide, { slug: d.slug, artifactId: target._id, decision: "approve" });
    // Expire it.
    await t.run(async (ctx) => {
      const a = (await ctx.db.get(target._id))!;
      await ctx.db.patch(a.approvalId!, { expiresAt: Date.now() - 1 });
    });
    await t.action(internal.publish.publishArtifact, { artifactId: target._id });
    expect((await d.client.query(api.content.get, { slug: d.slug, artifactId: target._id })).status).toBe("in_review");

    // Re-approve, then change the policy: approval no longer valid.
    await d.client.mutation(api.content.decide, { slug: d.slug, artifactId: target._id, decision: "approve" });
    await d.client.mutation(api.settings.updatePolicy, { slug: d.slug, mode: "review", allowRecurringPostsUnderCalendar: false, allowAdPauseRules: true, maxMonthlyAdSpend: 600, approvalTtlHours: 48 });
    await t.action(internal.publish.publishArtifact, { artifactId: target._id });
    const res = await d.client.query(api.content.get, { slug: d.slug, artifactId: target._id });
    expect(res.status).not.toBe("published");
  });

  it("an unconnected channel never fakes a publish; it falls back to export", async () => {
    const t = setup();
    const d = await demo(t);
    const linkedin = (await t.run(async (ctx) => (await ctx.db.query("artifacts").withIndex("by_org_updated", (q) => q.eq("orgId", d.orgId)).collect()).find((x) => x.channel === "linkedin")))!;
    if (linkedin.status !== "approved") await d.client.mutation(api.content.decide, { slug: d.slug, artifactId: linkedin._id, decision: "approve" });
    await t.action(internal.publish.publishArtifact, { artifactId: linkedin._id });
    const res = await d.client.query(api.content.get, { slug: d.slug, artifactId: linkedin._id });
    expect(res.status).toBe("approved");
    expect(res.receipts).toHaveLength(0);
    const pack = await d.client.query(api.content.exportPack, { slug: d.slug, artifactId: linkedin._id });
    expect(pack?.pack.items.length).toBeGreaterThan(0);
  });

  it("ad campaigns respect the owner's monthly envelope", async () => {
    const t = setup();
    const d = await demo(t);
    const ad = (await artifactsByStatus(t, d.orgId, "approved")).find((a) => a.kind === "ad")!;
    await expect(
      d.client.mutation(api.ads.prepareCampaign, { slug: d.slug, artifactId: ad._id, dailyBudget: 50, startDate: "2026-11-01", endDate: "2026-11-30" }),
    ).rejects.toThrow(/approved monthly ad budget/);
    const ok = await d.client.mutation(api.ads.prepareCampaign, { slug: d.slug, artifactId: ad._id, dailyBudget: 15, startDate: "2026-11-01", endDate: "2026-11-30" });
    expect(ok).toBeTruthy();
  });
});

describe("demo workspace", () => {
  it("is clearly synthetic, uses fixture connections and seeds honest states", async () => {
    const t = setup();
    const d = await demo(t);
    await t.finishAllScheduledFunctions(() => undefined);
    const org = await t.run(async (ctx) => ctx.db.get(d.orgId));
    expect(org?.kind).toBe("demo");
    const conns = await t.run(async (ctx) => ctx.db.query("connections").withIndex("by_org", (q) => q.eq("orgId", d.orgId)).collect());
    expect(conns.every((c) => c.isFixture)).toBe(true);
    const uncertain = await artifactsByStatus(t, d.orgId, "uncertain");
    expect(uncertain.length).toBe(1);
    const forecasts = await t.run(async (ctx) => ctx.db.query("forecastRuns").withIndex("by_org_created", (q) => q.eq("orgId", d.orgId)).collect());
    expect(forecasts.length).toBe(2);
    expect(forecasts.every((f) => f.isFixture)).toBe(true);
    const overview = await d.client.query(api.analytics.overview, { slug: d.slug, days: 30 });
    expect(overview.attribution.lastTouch?.reconciled).toBe(true);
    expect(overview.metrics.find((m) => m.key === "revenue")?.isFixture).toBe(true);
    const cohorts = await d.client.query(api.analytics.cohorts, { slug: d.slug });
    expect(cohorts.isFixture).toBe(true);
    expect(cohorts.rows.length).toBeGreaterThan(3);
    const older = cohorts.rows[0];
    expect(older.retention[0]).toBe(1);
    expect(older.retention[1]).toBeLessThan(1);
    expect(cohorts.rows.at(-1)!.retention[1]).toBeNull();
    // Demo workspaces cannot connect real accounts or buy plans.
    await expect(d.client.mutation(api.connections.startOAuth, { slug: d.slug, provider: "instagram" })).rejects.toThrow(/Demo workspaces/);
  });
});
