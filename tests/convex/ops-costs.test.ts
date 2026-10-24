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
    });

    const dashboard = await ops.client.query(api.ops.dashboard, {});
    expect(dashboard.costs).toMatchObject({
      approvedPlans30d: 2,
      approvedPlanCost30dMicros: 6_000_000,
      costPerApprovedPlan30dMicros: 3_000_000,
    });
  });
});
