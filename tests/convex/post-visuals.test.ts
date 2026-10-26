import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { maxJobMicros, planJob } from "../../convex/lib/jobPlans";
import { asNewUser, makePaid, setup, type T } from "./helpers";

const visual = { format: "single_image" as const, brief: "A real photo of an event check-in desk with a printed RSVP form, shot from above in window light." };

async function draft(t: T, orgId: string, opts: { status?: string; visual?: unknown } = {}) {
  return t.run(async (ctx) => {
    const org = orgId as Id<"organizations">;
    const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org)).first())!;
    const now = Date.now();
    const artifactId = await ctx.db.insert("artifacts", { orgId: org, businessId: business._id, kind: "social_post", channel: "linkedin", title: "RSVP form", status: opts.status ?? "approved", currentVersion: 1, createdAt: now, updatedAt: now } as never);
    const versionId = await ctx.db.insert("artifactVersions", { orgId: org, artifactId, version: 1, body: "For an event organiser, the RSVP form is a practical first test.", hashtags: [], altText: "An RSVP desk", visual: opts.visual ?? visual, claimFactIds: [], unsupportedClaims: [], contentHash: "x", createdAt: now } as never);
    await ctx.db.patch(artifactId, { currentVersionId: versionId });
    await ctx.db.insert("approvals", { orgId: org, subjectType: "artifact", subjectId: artifactId, actionKind: "publish", title: "RSVP form", contentHash: "x", scope: {}, costEstimateMicros: 0, policyVersion: 1, approvalHash: "h", status: "approved", expiresAt: now + 86_400_000, createdAt: now });
    return artifactId;
  });
}

describe("post visuals", () => {
  it("shows the visual on the draft and prices one image at its true up-to maximum", async () => {
    const t = setup();
    const owner = await asNewUser(t, "visual@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Formkit" });
    const artifactId = await draft(t, orgId);
    const view = await owner.client.query(api.content.get, { slug, artifactId });
    expect(view?.current?.visual).toEqual(visual);
    const estimate = await owner.client.query(api.postVisuals.imageEstimate, { slug });
    expect(estimate.maxCostMicros).toBe(maxJobMicros(planJob("post_image", {})));
  });

  it("starts a metered image run only for a still visual in the owner's own workspace", async () => {
    const t = setup();
    const owner = await asNewUser(t, "maker@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Formkit" });
    await makePaid(t, orgId);
    const artifactId = await draft(t, orgId);
    const video = await draft(t, orgId, { visual: { format: "reel", brief: visual.brief, shotList: [{ timing: "0-3s", show: "Desk" }] } });

    await expect(owner.client.mutation(api.postVisuals.createImage, { slug, artifactId: video })).rejects.toThrow(/short video/);
    const other = await asNewUser(t, "other@example.com");
    const { slug: otherSlug } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
    await expect(other.client.mutation(api.postVisuals.createImage, { slug: otherSlug, artifactId })).rejects.toThrow();

    const { runId } = await owner.client.mutation(api.postVisuals.createImage, { slug, artifactId });
    const run = await t.run((ctx) => ctx.db.get(runId));
    expect(run).toMatchObject({ kind: "post_image", status: expect.any(String) });
    expect(run?.estimateMicros).toBeGreaterThan(0);
  });

  it("adds a made image as a new labelled version that needs approval again", async () => {
    const t = setup();
    const owner = await asNewUser(t, "attach@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Formkit" });
    const artifactId = await draft(t, orgId);
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" })));
    const res = await t.mutation(internal.postVisuals.attachImage, { artifactId, userId: owner.userId, storageId, mime: "image/png" });
    expect(res.attached).toBe(true);
    const after = await t.run(async (ctx) => {
      const art = (await ctx.db.get(artifactId))!;
      const ver = (await ctx.db.get(art.currentVersionId!))!;
      const approvals = await ctx.db.query("approvals").withIndex("by_subject", (q) => q.eq("subjectType", "artifact").eq("subjectId", artifactId)).collect();
      const assets = await ctx.db.query("assets").collect();
      return { art, ver, approvals, assets };
    });
    expect(after.art).toMatchObject({ status: "in_review", currentVersion: 2 });
    expect(after.ver).toMatchObject({ version: 2, imageStorageId: storageId, imageLabel: "AI-generated illustration", visual, altText: "An RSVP desk" });
    expect(after.approvals.every((a) => a.status === "invalidated")).toBe(true);
    expect(after.assets.filter((a) => a.kind === "ai_image")).toHaveLength(1);
  });

  it("keeps the image in the library only when the post was published meanwhile", async () => {
    const t = setup();
    const owner = await asNewUser(t, "late@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Formkit" });
    const artifactId = await draft(t, orgId, { status: "published" });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array([1])], { type: "image/png" })));
    expect((await t.mutation(internal.postVisuals.attachImage, { artifactId, userId: owner.userId, storageId, mime: "image/png" })).attached).toBe(false);
    expect((await t.run((ctx) => ctx.db.get(artifactId)))?.currentVersion).toBe(1);
  });
});
