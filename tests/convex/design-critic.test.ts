import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

async function addAudit(t: ReturnType<typeof setup>, orgId: string) {
  const now = Date.now();
  return await t.run(async (ctx) => ctx.db.insert("workflowRuns", {
    orgId: orgId as never,
    kind: "conversion_audit",
    title: "Website review",
    status: "verified",
    input: "{}",
    output: JSON.stringify({ auditCoverage: { website: { visualReview: { capturedAt: now } } }, designCritic: { findings: [{ region: "Hero", sourceUrl: "https://example.com/", visualEvidence: { view: "mobile" } }] } }),
    roles: [],
    estimateMicros: 0,
    actualMicros: 0,
    rateVersionId: "test",
    entitlementVersionId: "test",
    routingVersionId: "test",
    budget: { modelSteps: 0, researchTools: 0, repairs: 0 },
    used: { modelSteps: 0, researchTools: 0, repairs: 0 },
    isFixture: false,
    createdAt: now,
    updatedAt: now,
    finishedAt: now,
  }));
}

describe("Design Critic finding review", () => {
  it("persists owner correction and resolution against an immutable audit run and records the action", async () => {
    const t = setup();
    const owner = await asNewUser(t, "design-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Design Co" });
    const runId = await addAudit(t, orgId);

    await expect(owner.client.mutation(api.designCritic.setFeedback, { slug, runId, findingIndex: 0, status: "corrected" })).rejects.toThrow(/add the correction/i);
    await owner.client.mutation(api.designCritic.setFeedback, { slug, runId, findingIndex: 0, status: "corrected", note: "The page already has a customer-approved proof panel below the hero." });
    await owner.client.mutation(api.designCritic.setFeedback, { slug, runId, findingIndex: 0, status: "resolved", note: "Reviewed with the owner." });
    await owner.client.mutation(api.designCritic.setFeedback, { slug, runId, findingIndex: 0, status: "reopened", note: "A new page version makes this relevant again." });

    expect(await owner.client.query(api.designCritic.feedback, { slug, runId })).toMatchObject({ canEdit: true, rows: [{ findingIndex: 0, status: "reopened", note: "A new page version makes this relevant again.", evidenceRef: `${runId}:0`, sourceUrl: "https://example.com/", viewport: "mobile", screenshotCapturedAt: expect.any(Number) }] });
    expect(await t.run(async (ctx) => (await ctx.db.query("auditEvents").withIndex("by_org_created", (q) => q.eq("orgId", orgId as never)).collect()).filter((event) => event.action.startsWith("design_finding.")))).toHaveLength(3);
  });

  it("keeps feedback tenant-isolated and enforces edit permission", async () => {
    const t = setup();
    const owner = await asNewUser(t, "design-owner@example.com");
    const viewer = await asNewUser(t, "design-viewer@example.com");
    const other = await asNewUser(t, "design-other@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Design Co" });
    const { slug: otherSlug } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    const runId = await addAudit(t, orgId);
    await t.run(async (ctx) => ctx.db.insert("memberships", { orgId: orgId as never, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));

    await owner.client.mutation(api.designCritic.setFeedback, { slug, runId, findingIndex: 0, status: "dismissed" });
    await expect(other.client.query(api.designCritic.feedback, { slug: otherSlug, runId })).rejects.toThrow(/couldn't find/i);
    await expect(viewer.client.mutation(api.designCritic.setFeedback, { slug, runId, findingIndex: 0, status: "resolved" })).rejects.toThrow(/can't/i);
    expect(await viewer.client.query(api.designCritic.feedback, { slug, runId })).toMatchObject({ canEdit: false, rows: [{ status: "dismissed" }] });
  });

  it("rejects indices not present in the cited audit", async () => {
    const t = setup();
    const owner = await asNewUser(t, "design-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Design Co" });
    const runId = await addAudit(t, orgId);
    await expect(owner.client.mutation(api.designCritic.setFeedback, { slug, runId, findingIndex: 1, status: "dismissed" })).rejects.toThrow(/not present/i);
  });

  it("requires a closed finding before it can be reopened", async () => {
    const t = setup();
    const owner = await asNewUser(t, "design-reopen@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Design Co" });
    const runId = await addAudit(t, orgId);
    await expect(owner.client.mutation(api.designCritic.setFeedback, { slug, runId, findingIndex: 0, status: "reopened" })).rejects.toThrow(/resolved or dismissed/i);
  });
});
