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
    });

    const dashboard = await ops.client.query(api.ops.dashboard, {});
    expect(dashboard.costs).toMatchObject({
      approvedPlans30d: 2,
      approvedPlanCost30dMicros: 6_000_000,
      costPerApprovedPlan30dMicros: 3_000_000,
      spend24hMicros: 170_000,
      usage24h: { eventsRead: 3, coverageCapped: false },
      modelCostAnomalies8d: { available: false, reason: "insufficient_baseline", thresholdMultiple: 3, alerts: [] },
      byModel24h: [
        { provider: "openai", model: "gpt-6.1-sol", calls: 2, estimatedCalls: 1, recordedCalls: 1, costMicros: 150_000, cacheReadRate: 2 / 7 },
        { provider: "openai", model: "gpt-6-luna", calls: 1, estimatedCalls: 0, recordedCalls: 1, costMicros: 20_000, cacheReadRate: 2 / 7 },
      ],
    });
  });
});
