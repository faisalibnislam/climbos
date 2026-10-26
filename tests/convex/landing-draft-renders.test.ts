import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

const content = { headline: "A clear offer", subhead: "Details for the right customer.", benefits: [{ title: "Useful", text: "A concrete benefit." }], steps: ["Ask a question"], proof: "", faq: [{ q: "Who is this for?", a: "Ask us." }], ctaLabel: "Get details", formIntro: "" };

async function draftPage(t: ReturnType<typeof setup>, orgId: string) {
  const now = Date.now();
  return t.run(async (ctx) => {
    const pageId = await ctx.db.insert("landingPages", { orgId: orgId as Id<"organizations">, slug: `draft-${now}`, title: "Spring offer", brief: "Redesign", status: "draft", content: JSON.stringify(content), color: "#1f4d3a", version: 2, views: 0, leads: 0, createdAt: now, updatedAt: now });
    await ctx.db.insert("landingPageVersions", { orgId: orgId as Id<"organizations">, pageId, version: 2, title: "Spring offer", color: "#1f4d3a", content: JSON.stringify({ ...content, headline: "Version two headline" }), kind: "edited", createdAt: now });
    return pageId;
  });
}

describe("landing draft captures", () => {
  it("serves only the exact requested version by a single-use token, and records an unavailable capture without a worker", async () => {
    const t = setup();
    const owner = await asNewUser(t, "draft-render-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Render Co" });
    const pageId = await draftPage(t, orgId);

    await expect(owner.client.mutation(api.landingRenders.request, { slug, id: pageId, expectedVersion: 1 })).rejects.toThrow(/page changed/i);
    const renderId = await owner.client.mutation(api.landingRenders.request, { slug, id: pageId, expectedVersion: 2 });
    await expect(owner.client.mutation(api.landingRenders.request, { slug, id: pageId, expectedVersion: 2 })).rejects.toThrow(/already running/i);

    const token = (await t.run(async (ctx) => ctx.db.get(renderId)))!.token!;
    expect(await t.query(api.landingRenders.draftByToken, { token })).toMatchObject({ version: 2, content: { headline: "Version two headline" } });
    expect(await t.query(api.landingRenders.draftByToken, { token: "0".repeat(48) })).toBeNull();

    await t.action(internal.landingRenders.capture, { renderId });
    expect(await t.query(api.landingRenders.draftByToken, { token })).toBeNull();
    const [latest] = await owner.client.query(api.landingRenders.list, { slug, id: pageId });
    expect(latest).toMatchObject({ version: 2, status: "unavailable", shots: [] });
    expect((await t.run(async (ctx) => ctx.db.get(pageId)))!.status).toBe("draft");
  });

  it("keeps other workspaces and view-only roles out", async () => {
    const t = setup();
    const owner = await asNewUser(t, "draft-render-tenant@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Render Co" });
    const pageId = await draftPage(t, orgId);
    const other = await asNewUser(t, "draft-render-other@example.com");
    const { slug: otherSlug } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    await expect(other.client.mutation(api.landingRenders.request, { slug: otherSlug, id: pageId, expectedVersion: 2 })).rejects.toThrow();
    await expect(other.client.query(api.landingRenders.list, { slug: otherSlug, id: pageId })).rejects.toThrow();
  });
});

describe("original page kept for a chosen design direction", () => {
  it("saves the audited page text, its hash and the screenshots without the 30-day expiry", async () => {
    const t = setup();
    const owner = await asNewUser(t, "design-original-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Design Co" });
    const now = Date.now();
    const runId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("workflowRuns", { orgId: orgId as Id<"organizations">, kind: "conversion_audit", title: "Website review", status: "verified", input: "{}", output: JSON.stringify({ designCritic: { findings: [{ region: "Hero", sourceUrl: "https://example.com/", directions: [{ id: "hero-proof", name: "Show proof earlier" }] }] } }), roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "test", entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 0, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: now, updatedAt: now, finishedAt: now });
      await ctx.db.insert("workflowSteps", { orgId: orgId as Id<"organizations">, runId: id, index: 0, kind: "research", label: "Read key pages", status: "succeeded", idempotencyKey: `k-${now}`, attempt: 1, costMicros: 0, output: JSON.stringify({ text: `<untrusted_content source="https://example.com/">\nTITLE: Example\nPAGE TEXT:\nFresh bread daily.\n</untrusted_content>` }) } as never);
      const storageId = await ctx.storage.store(new Blob(["png"]));
      await ctx.db.insert("websiteAuditScreenshots", { orgId: orgId as Id<"organizations">, runId: id, pageUrl: "https://example.com/", view: "desktop", storageId, width: 1440, height: 900, capturedAt: now, expiresAt: now + 30 * 86_400_000 });
      return id;
    });
    await owner.client.mutation(api.designCritic.selectDirection, { slug, runId, findingIndex: 0, directionId: "hero-proof" });
    await owner.client.mutation(api.designCritic.selectDirection, { slug, runId, findingIndex: 0, directionId: "hero-proof" });
    const { originals } = await owner.client.query(api.designCritic.feedback, { slug, runId });
    expect(originals).toEqual([expect.objectContaining({ pageUrl: "https://example.com/", views: ["desktop"], textHash: expect.stringMatching(/^[a-f0-9]{64}$/) })]);
    const row = await t.run(async (ctx) => (await ctx.db.query("designOriginalPages").collect())[0]);
    expect(row.text).toContain("Fresh bread daily.");
    const shot = await t.run(async (ctx) => (await ctx.db.query("websiteAuditScreenshots").collect())[0]);
    expect(shot.expiresAt).toBe(Number.MAX_SAFE_INTEGER);
    expect(await t.mutation(internal.maintenance.purgeWebsiteAuditScreenshots, {})).toBe(0);
  });
});
