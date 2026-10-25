import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

describe("Stripe open invoice context", () => {
  it("makes only the current tenant's aggregate snapshot available to its strategy run", async () => {
    const t = setup();
    const owner = await asNewUser(t, "receivables-owner@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Receivables Owner" });
    const other = await asNewUser(t, "receivables-other@example.com");
    const otherWorkspace = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Receivables" });
    const now = Date.now();
    const runId = await t.run(async (ctx) => {
      const addConnection = (workspace: Id<"organizations">, userId: Id<"users">, remainingMinor: number) => ctx.db.insert("connections", {
        orgId: workspace,
        provider: "stripe_revenue",
        status: "connected",
        accountLabel: "Stripe",
        scopes: [],
        lastSyncAt: now,
        stripeOpenInvoiceSnapshot: {
          asOf: now,
          partial: false,
          byCurrency: [{ currency: "USD", invoiceCount: 1, remainingMinor, pastDueInvoiceCount: 1, pastDueRemainingMinor: remainingMinor, dueDateUnknownCount: 0 }],
        },
        isFixture: false,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
      await addConnection(orgId as Id<"organizations">, owner.userId, 9_000);
      await addConnection(otherWorkspace.orgId as Id<"organizations">, other.userId, 9_900_000);
      return ctx.db.insert("workflowRuns", {
        orgId: orgId as Id<"organizations">,
        kind: "strategy",
        title: "Receivables review",
        status: "executing",
        input: "{}",
        roles: [],
        estimateMicros: 0,
        actualMicros: 0,
        rateVersionId: "verified-2026-10-17",
        entitlementVersionId: "ent-credits-2026-10-18",
        routingVersionId: "r1",
        budget: { modelSteps: 1, researchTools: 0, repairs: 0 },
        used: { modelSteps: 0, researchTools: 0, repairs: 0 },
        isFixture: false,
        createdAt: now,
        updatedAt: now,
      });
    });

    const context = await t.query(internal.jobWrites.jobContext, { runId });
    expect(context?.stripeReceivables).toMatchObject({
      connected: true,
      syncFailed: false,
      snapshot: { byCurrency: [{ currency: "USD", remainingMinor: 9_000 }] },
    });
    expect(JSON.stringify(context?.stripeReceivables)).not.toContain("9900000");
  });
});
