import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

/** Design studio storage: create in the workspace brand, autosave, rename, duplicate, delete, attach to a post. */
describe("design studio", () => {
  it("creates, saves, renames, duplicates and deletes designs, org-scoped", async () => {
    const t = setup();
    const owner = await asNewUser(t, "designer@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Design Co" });
    const id = await owner.client.mutation(api.designs.create, { slug, format: "instagram_square", carousel: true });
    let d = await owner.client.query(api.designs.get, { slug, designId: id });
    expect(d?.doc.pages.length).toBe(5); // cover, 3 points, ending
    expect(d?.doc.width).toBe(1080);
    expect(d?.doc.brand.name).toBe("Design Co");
    const doc = { ...d!.doc, pages: d!.doc.pages.slice(0, 2) };
    await owner.client.mutation(api.designs.save, { slug, designId: id, doc: JSON.stringify(doc) });
    await owner.client.mutation(api.designs.rename, { slug, designId: id, title: "Spring launch" });
    d = await owner.client.query(api.designs.get, { slug, designId: id });
    expect(d).toMatchObject({ title: "Spring launch", pages: 2 });
    await expect(owner.client.mutation(api.designs.save, { slug, designId: id, doc: "{}" })).rejects.toThrow(/isn't valid/);
    await expect(owner.client.mutation(api.designs.save, { slug, designId: id, doc: JSON.stringify({ ...doc, pages: [{ ...doc.pages[0], background: { kind: "solid", color: "#fff", imageSrc: `data:image/png;base64,${"A".repeat(5000)}` } }] }) })).rejects.toThrow(/Photos/);
    const copy = await owner.client.mutation(api.designs.duplicate, { slug, designId: id });
    let list = await owner.client.query(api.designs.list, { slug });
    expect(list.items.map((i) => i.title).sort()).toEqual(["Spring launch", "Spring launch (copy)"]);
    await owner.client.mutation(api.designs.archive, { slug, designId: copy });
    list = await owner.client.query(api.designs.list, { slug });
    expect(list.items).toHaveLength(1);

    // Another workspace can't read or change it.
    const other = await asNewUser(t, "other@example.com");
    const { slug: otherSlug } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    expect(await other.client.query(api.designs.get, { slug: otherSlug, designId: id })).toBeNull();
    await expect(other.client.mutation(api.designs.rename, { slug: otherSlug, designId: id, title: "x" })).rejects.toThrow();
  });

  it("a post's first line becomes the headline, and attaching makes a new version back in review", async () => {
    const t = setup();
    const owner = await asNewUser(t, "poster@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Post Co" });
    const { artifactId, storageId } = await t.run(async (ctx) => {
      const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId as Id<"organizations">)).first())!;
      const now = Date.now();
      const artifactId = await ctx.db.insert("artifacts", { orgId: orgId as Id<"organizations">, businessId: business._id, kind: "social_post", channel: "instagram", title: "Spring offer", status: "approved", currentVersion: 1, createdAt: now, updatedAt: now } as never);
      const versionId = await ctx.db.insert("artifactVersions", { orgId: orgId as Id<"organizations">, artifactId, version: 1, body: "Spring is here. 20% off all plans this week.", hashtags: [], claimFactIds: [], unsupportedClaims: [], contentHash: "x", createdAt: now } as never);
      await ctx.db.patch(artifactId, { currentVersionId: versionId });
      const storageId = await ctx.storage.store(new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }));
      return { artifactId, storageId };
    });
    const id = await owner.client.mutation(api.designs.create, { slug, format: "instagram_portrait", artifactId });
    const d = await owner.client.query(api.designs.get, { slug, designId: id });
    expect(JSON.stringify(d?.doc)).toContain("Spring is here.");
    expect((await owner.client.query(api.designs.attachable, { slug })).map((p) => p.id)).toContain(artifactId);
    await owner.client.mutation(api.designs.attachImage, { slug, designId: id, artifactId, storageId });
    const art = await t.run(async (ctx) => {
      const a = (await ctx.db.get(artifactId))!;
      return { a, v: (await ctx.db.get(a.currentVersionId!))! };
    });
    expect(art.a).toMatchObject({ status: "in_review", currentVersion: 2 });
    expect(art.v).toMatchObject({ imageStorageId: storageId, imageLabel: "Made in Design studio", body: "Spring is here. 20% off all plans this week." });
  });
});

describe("approval modes", () => {
  it("Copilot mode never posts for the owner", async () => {
    const { refuseInCopilot } = await import("../../convex/lib/approvals");
    const t = setup();
    const owner = await asNewUser(t, "copilot@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Copilot Co" });
    await t.run(async (ctx) => {
      const p = await ctx.db.query("autonomyPolicies").withIndex("by_org_active", (q) => q.eq("orgId", orgId as Id<"organizations">).eq("active", true)).first();
      if (p) await ctx.db.patch(p._id, { mode: "copilot" });
      else await ctx.db.insert("autonomyPolicies", { orgId: orgId as Id<"organizations">, mode: "copilot", active: true, version: 1 } as never);
      await expect(refuseInCopilot(ctx, orgId as Id<"organizations">, "post")).rejects.toThrow(/Copilot mode is on/);
    });
  });
});
