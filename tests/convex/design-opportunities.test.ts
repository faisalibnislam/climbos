import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup, type T } from "./helpers";
import type { Id } from "../../convex/_generated/dataModel";

async function addAudit(t: T, orgId: Id<"organizations">, patch: { isFixture?: boolean; status?: "failed" | "verified"; createdAt: number; output?: string }) {
  return t.run(ctx => ctx.db.insert("workflowRuns", { orgId, kind: "conversion_audit", title: "Saved audit", status: "verified", input: "{}", output: JSON.stringify({ designCritic: { findings: [{ lens: "usability", region: "Form", observation: "A label is missing", sourceUrl: "https://example.com/contact" }] } }), roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "test", entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 0, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, updatedAt: Date.now(), ...patch }));
}

describe("workspace design opportunities", () => {
  it("pages to older usable audits past failed records, preserves corrections and performs no external work", async () => {
    const t = setup();
    const owner = await asNewUser(t, "queue-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Queue" });
    const oldest = await addAudit(t, orgId, { createdAt: 1 });
    for (let i = 2; i < 14; i++) await addAudit(t, orgId, { createdAt: i, status: "failed" });
    await owner.client.mutation(api.designCritic.setFeedback, { slug, runId: oldest, findingIndex: 0, status: "corrected", note: "The label exists in the rendered mobile page." });
    const first = await owner.client.query(api.designCritic.opportunitiesPage, { slug, paginationOpts: { numItems: 10, cursor: null } });
    expect(first.isDone).toBe(false);
    expect(first.page.every(row => row.unavailable && !row.findings.length)).toBe(true);
    const second = await owner.client.query(api.designCritic.opportunitiesPage, { slug, paginationOpts: { numItems: 10, cursor: first.continueCursor } });
    expect(second.isDone).toBe(true);
    expect(second.page.flatMap(row => row.findings)).toMatchObject([{ runId: oldest, findingIndex: 0, review: { status: "corrected", note: "The label exists in the rendered mobile page." } }]);
    await t.run(async ctx => {
      expect(await ctx.db.query("workflowRuns").collect()).toHaveLength(13);
      expect(await ctx.db.query("approvals").collect()).toHaveLength(0);
      expect(await ctx.db.query("actionReceipts").collect()).toHaveLength(0);
      expect(await ctx.db.query("landingPages").collect()).toHaveLength(0);
      expect(await ctx.db.query("designFindingReviewEvents").collect()).toHaveLength(1);
    });
  });

  it("isolates tenants, permits viewer reads, rejects viewer reviews and excludes fixture learning from real workspaces", async () => {
    const t = setup();
    const owner = await asNewUser(t, "queue-owner2@example.com");
    const viewer = await asNewUser(t, "queue-viewer@example.com");
    const outsider = await asNewUser(t, "queue-outsider@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Queue" });
    const { slug: otherSlug } = await outsider.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
    const runId = await addAudit(t, orgId, { createdAt: 1 });
    await addAudit(t, orgId, { createdAt: 2, isFixture: true });
    await addAudit(t, orgId, { createdAt: 3, output: "not json" });
    await t.run(ctx => ctx.db.insert("memberships", { orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    const args = { slug, paginationOpts: { numItems: 10, cursor: null } };
    await expect(outsider.client.query(api.designCritic.opportunitiesPage, args)).rejects.toThrow();
    const visible = await viewer.client.query(api.designCritic.opportunitiesPage, args);
    expect(visible.page.every(row => !row.canEdit)).toBe(true);
    expect(visible.page.flatMap(row => row.findings)).toHaveLength(1);
    expect(JSON.stringify(visible)).not.toContain(String(owner.userId));
    await expect(viewer.client.mutation(api.designCritic.setFeedback, { slug, runId, findingIndex: 0, status: "resolved" })).rejects.toThrow();
    expect((await outsider.client.query(api.designCritic.opportunitiesPage, { ...args, slug: otherSlug })).page).toEqual([]);
  });
});
