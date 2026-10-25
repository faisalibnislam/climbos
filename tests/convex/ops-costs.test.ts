import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

describe("operator accepted-plan costs", () => {
  it("reports actual cost per owner-approved verified strategy", async () => {
    const t = setup();
    const ops = await asNewUser(t, "ops@example.com");
    const { orgId } = await ops.client.mutation(api.orgs.createWorkspace, { businessName: "Cost Co" });
    await t.run(async (ctx) => {
      const now = Date.now();
      for (const [index, decision, costMicros, kind] of [
        [0, "approve", 4_000_000, "strategy"],
        [1, "approve", 2_000_000, "strategy"],
        [2, "reject", 10_000_000, "strategy"],
        [3, "approve", 20_000_000, "chat"],
      ] as const) {
        const runId = await ctx.db.insert("workflowRuns", {
          orgId: orgId as Id<"organizations">,
          kind,
          title: `Run ${index}`,
          status: "verified",
          input: "{}",
          roles: [],
          estimateMicros: costMicros,
          actualMicros: costMicros,
          rateVersionId: "test",
          entitlementVersionId: "test",
          routingVersionId: "test",
          budget: { modelSteps: 1, researchTools: 0, repairs: 0 },
          used: { modelSteps: 1, researchTools: 0, repairs: 0 },
          isFixture: false,
          createdAt: now - 60_000,
          updatedAt: now,
        });
        await ctx.db.insert("engineQuality", {
          runId,
          agentId: "owner_decision",
          mode: "basic",
          data: JSON.stringify({ decision }),
          createdAt: now,
        });
      }
      for (const [model, costMicros, estimated] of [["gpt-6.1-sol", 90_000, false], ["gpt-6.1-sol", 60_000, true], ["gpt-6-luna", 20_000, false]] as const) {
        await ctx.db.insert("usageEvents", {
          orgId: orgId as Id<"organizations">,
          taskKind: "strategy",
          stepKind: "model",
          stepIndex: 0,
          routingVersionId: "openai-v1",
          aiMode: "basic",
          type: "model_call",
          provider: "openai",
          model,
          inputTokens: 100,
          outputTokens: 20,
          reasoningTokens: 5,
          cacheReadTokens: 40,
          cacheWriteTokens: 0,
          quantity: 1,
          costMicros,
          estimated,
          createdAt: now,
        });
      }
      const run = (await ctx.db.query("workflowRuns").first())!;
      await ctx.db.insert("workflowSteps", {
        orgId: orgId as Id<"organizations">,
        runId: run._id,
        index: 0,
        kind: "compute",
        label: "Strategy research (cached)",
        status: "succeeded",
        idempotencyKey: `cache-hit-${run._id}`,
        attempt: 1,
        costMicros: 0,
        cacheHit: true,
        startedAt: now - 100,
        finishedAt: now,
      });
    });

    const dashboard = await ops.client.query(api.ops.dashboard, {});
    expect(dashboard.costs).toMatchObject({
      approvedPlans30d: 2,
      approvedPlanCost30dMicros: 6_000_000,
      costPerApprovedPlan30dMicros: 3_000_000,
      spend24hMicros: 170_000,
      usage24h: { eventsRead: 3, coverageCapped: false },
      researchCache24h: { hits: 1, coverageCapped: false },
      modelCostAnomalies8d: { available: false, reason: "insufficient_baseline", thresholdMultiple: 3, alerts: [] },
      byTaskPhase24h: {
        events: 3,
        taggedEvents: 3,
        coverage: 1,
        groups: [
          { taskKind: "strategy", stepKind: "model", role: null, routingVersionId: "openai-v1", aiMode: "basic", provider: "openai", model: "gpt-6.1-sol", calls: 2, estimatedCalls: 1, recordedCalls: 1, costMicros: 150_000 },
          { taskKind: "strategy", stepKind: "model", role: null, routingVersionId: "openai-v1", aiMode: "basic", provider: "openai", model: "gpt-6-luna", calls: 1, estimatedCalls: 0, recordedCalls: 1, costMicros: 20_000 },
        ],
      },
      byModel24h: [
        { provider: "openai", model: "gpt-6.1-sol", calls: 2, estimatedCalls: 1, recordedCalls: 1, costMicros: 150_000, cacheReadRate: 2 / 7 },
        { provider: "openai", model: "gpt-6-luna", calls: 1, estimatedCalls: 0, recordedCalls: 1, costMicros: 20_000, cacheReadRate: 2 / 7 },
      ],
    });
  });

  it("shows bounded workflow timing, task status, and research cost without counting fixtures", async () => {
    const t = setup();
    const ops = await asNewUser(t, "ops@example.com");
    const { orgId } = await ops.client.mutation(api.orgs.createWorkspace, { businessName: "Learning Co" });
    await t.run(async (ctx) => {
      const now = Date.now();
      for (let index = 0; index < 5; index++) {
        await ctx.db.insert("workflowRuns", {
          orgId: orgId as Id<"organizations">,
          kind: "strategy",
          title: `Strategy ${index}`,
          status: index === 0 ? "verified" : "needs_approval",
          input: "{}",
          roles: [],
          estimateMicros: 100,
          actualMicros: 100,
          rateVersionId: "test",
          entitlementVersionId: "test",
          routingVersionId: "test",
          budget: { modelSteps: 1, researchTools: 1, repairs: 0 },
          used: { modelSteps: 1, researchTools: 1, repairs: 0 },
          isFixture: false,
          createdAt: now - 10_000,
          updatedAt: now,
          firstFindingAt: now - 8_000 + index * 1_000,
          ...(index < 4 ? { firstActionAt: now - 7_000 + index * 1_000 } : {}),
        });
      }
      await ctx.db.insert("workflowRuns", {
        orgId: orgId as Id<"organizations">,
        kind: "strategy",
        title: "Fixture",
        status: "verified",
        input: "{}",
        roles: [],
        estimateMicros: 100,
        actualMicros: 100,
        rateVersionId: "test",
        entitlementVersionId: "test",
        routingVersionId: "test",
        budget: { modelSteps: 1, researchTools: 1, repairs: 0 },
        used: { modelSteps: 1, researchTools: 1, repairs: 0 },
        isFixture: true,
        createdAt: now - 10_000,
        updatedAt: now,
        firstFindingAt: now - 1_000,
        firstActionAt: now - 500,
      });
      for (const [costMicros, estimated] of [[40_000, false], [10_000, true]] as const) {
        await ctx.db.insert("usageEvents", {
          orgId: orgId as Id<"organizations">,
          taskKind: "strategy",
          stepKind: "research",
          stepIndex: 0,
          routingVersionId: "openai-v1",
          aiMode: "basic",
          type: "search_call",
          provider: "openai",
          inputTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          quantity: 1,
          costMicros,
          estimated,
          createdAt: now,
        });
      }
    });

    const dashboard = await ops.client.query(api.ops.dashboard, {});
    expect(dashboard.costs.workflowMetrics).toMatchObject({
      runs: 5,
      strategyRuns: 5,
      firstFindingSamples: 5,
      firstActionSamples: 4,
      firstFindingP50Ms: 4_000,
      firstActionP50Ms: null,
      statusCounts: { verified: 1, needs_approval: 4 },
    });
    expect(dashboard.costs.researchCost24h).toMatchObject({
      events: 2,
      recordedMicros: 40_000,
      estimatedMicros: 10_000,
      coverageCapped: false,
    });
  });
});
