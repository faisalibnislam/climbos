import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

async function addAudit(t: ReturnType<typeof setup>, orgId: string) {
  const now = Date.now();
  return await t.run(async (ctx) => ctx.db.insert("workflowRuns", {
    orgId: orgId as never,
    kind: "conversion_audit",
    title: "Website review",
    status: "verified",
    input: "{}",
    output: JSON.stringify({ auditCoverage: { website: { visualReview: { capturedAt: now } } }, designCritic: { findings: [{ region: "Hero", sourceUrl: "https://example.com/", visualEvidence: { view: "mobile" }, directions: [{ id: "hero-concise", name: "Make the offer clearer", previewBrief: "Clarify the offer in the hero." }, { id: "hero-proof", name: "Show proof earlier", previewBrief: "Move confirmed proof above the fold." }] }] } }),
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

  it("saves an owner's chosen direction against the exact finding without marking the finding resolved or publishing it", async () => {
    const t = setup();
    const owner = await asNewUser(t, "design-direction-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Design Co" });
    const runId = await addAudit(t, orgId);

    expect(await owner.client.mutation(api.designCritic.selectDirection, { slug, runId, findingIndex: 0, directionId: "hero-proof" })).toMatchObject({ selectedDirectionId: "hero-proof", selectedDirectionName: "Show proof earlier", selectedAt: expect.any(Number) });
    expect(await owner.client.query(api.designCritic.feedback, { slug, runId })).toMatchObject({ rows: [{ findingIndex: 0, selectedDirectionId: "hero-proof", selectedDirectionName: "Show proof earlier", selectedDirectionAt: expect.any(Number), viewport: "mobile" }] });
    expect(await t.run(async (ctx) => (await ctx.db.query("auditEvents").withIndex("by_org_created", (q) => q.eq("orgId", orgId as never)).collect()).map((event) => event.action))).toContain("design_finding.direction_selected");
  });

  it("binds a landing-page draft to the exact saved finding and direction and rejects forged or cross-tenant sources", async () => {
    const t = setup();
    const owner = await asNewUser(t, "design-source-owner@example.com");
    const other = await asNewUser(t, "design-source-other@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Design Co" });
    const { slug: otherSlug } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    const runId = await addAudit(t, orgId);
    const source = { runId, findingIndex: 0, directionId: "hero-proof" };

    await expect(owner.client.mutation(api.landing.create, { slug, brief: "Redesign our landing page", designCriticSource: source })).rejects.toThrow(/choose and save this direction/i);
    await expect(other.client.mutation(api.landing.create, { slug: otherSlug, brief: "Redesign another page", designCriticSource: source })).rejects.toThrow(/same workspace|couldn't find/i);
    await owner.client.mutation(api.designCritic.selectDirection, { slug, runId, findingIndex: 0, directionId: "hero-concise" });
    await expect(owner.client.mutation(api.landing.create, { slug, brief: "Redesign our landing page", designCriticSource: source })).rejects.toThrow(/choose and save this direction/i);
    await owner.client.mutation(api.designCritic.selectDirection, { slug, ...source });
    const pageId = await owner.client.mutation(api.landing.create, { slug, brief: "Redesign our landing page", designCriticSource: source });
    expect((await owner.client.query(api.landing.list, { slug })).pages.find((page) => page.id === pageId)?.designCriticSource).toMatchObject({ ...source, directionName: "Show proof earlier", region: "Hero", sourceUrl: "https://example.com/", selectedAt: expect.any(Number) });
  });

  it("rejects a direction that is not in the immutable audit finding", async () => {
    const t = setup();
    const owner = await asNewUser(t, "design-direction-invalid@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Design Co" });
    const runId = await addAudit(t, orgId);
    await expect(owner.client.mutation(api.designCritic.selectDirection, { slug, runId, findingIndex: 0, directionId: "not-in-this-finding" })).rejects.toThrow(/not part of this finding/i);
    await expect(owner.client.mutation(api.designCritic.selectDirection, { slug, runId, findingIndex: 1, directionId: "hero-proof" })).rejects.toThrow(/not present/i);
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
    await expect(viewer.client.mutation(api.designCritic.selectDirection, { slug, runId, findingIndex: 0, directionId: "hero-proof" })).rejects.toThrow(/can't/i);
    await expect(other.client.query(api.designCritic.feedback, { slug: otherSlug, runId })).rejects.toThrow(/couldn't find/i);
    await expect(viewer.client.mutation(api.designCritic.setFeedback, { slug, runId, findingIndex: 0, status: "resolved" })).rejects.toThrow(/can't/i);
    expect(await viewer.client.query(api.designCritic.feedback, { slug, runId })).toMatchObject({ canEdit: false, rows: [{ status: "dismissed" }] });
  });

  it("shows private viewport captures only to members of the audit tenant and expires them", async () => {
    const t = setup();
    const owner = await asNewUser(t, "design-screenshot-owner@example.com");
    const other = await asNewUser(t, "design-screenshot-other@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Design Co" });
    const { slug: otherSlug } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    const runId = await addAudit(t, orgId);
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" })));
    const capturedAt = Date.now();

    await t.mutation(internal.designCritic.saveScreenshot, { orgId: orgId as never, runId, pageUrl: "https://example.com/", view: "mobile", storageId, width: 390, height: 844, capturedAt });
    expect(await owner.client.query(api.designCritic.feedback, { slug, runId })).toMatchObject({ screenshots: [{ view: "mobile", pageUrl: "https://example.com/", width: 390, height: 844, capturedAt, url: expect.any(String) }] });
    await expect(other.client.query(api.designCritic.feedback, { slug: otherSlug, runId })).rejects.toThrow(/couldn't find/i);

    await t.run(async (ctx) => ctx.db.patch((await ctx.db.query("websiteAuditScreenshots").first())!._id, { expiresAt: capturedAt - 1 }));
    expect(await t.mutation(internal.maintenance.purgeWebsiteAuditScreenshots, {})).toBe(1);
    expect(await owner.client.query(api.designCritic.feedback, { slug, runId })).toMatchObject({ screenshots: [] });
  });

  it("rejects screenshot records that do not belong to the exact audit tenant", async () => {
    const t = setup();
    const owner = await asNewUser(t, "design-screenshot-run-owner@example.com");
    const other = await asNewUser(t, "design-screenshot-run-other@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Design Co" });
    const runId = await addAudit(t, orgId);
    const { orgId: otherOrgId } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" })));
    await expect(t.mutation(internal.designCritic.saveScreenshot, { orgId: otherOrgId as never, runId, pageUrl: "https://example.com/", view: "mobile", storageId, width: 390, height: 844, capturedAt: Date.now() })).rejects.toThrow(/same workspace/i);
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
