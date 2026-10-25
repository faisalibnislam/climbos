import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { signWebhook } from "../../shared/webhooks";
import { contentHash } from "../../shared/policy";
import { asNewUser, setup } from "./helpers";

describe("outgoing webhooks", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    process.env.CLIMBOS_FAKE_WEBHOOKS = "1";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_WEBHOOKS;
  });

  it("queues subscribed events, delivers them and rejects private URLs", async () => {
    const t = setup();
    const owner = await asNewUser(t, "hooks@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Hooks Co" });
    await expect(owner.client.mutation(api.webhooks.create, { slug, url: "https://localhost/x", events: ["lead.created"] })).rejects.toThrow(/public/);
    const { secret } = await owner.client.mutation(api.webhooks.create, { slug, url: "https://hooks.zapier.com/hooks/catch/1/abc", events: ["lead.created", "deal.won"] });
    expect(secret).toMatch(/^whsec_/);
    const dealId = await owner.client.mutation(api.crm.create, { slug, name: "Ana", email: "ana@x.example", value: 500 });
    await owner.client.mutation(api.crm.update, { slug, id: dealId, stage: "won" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const list = await owner.client.query(api.webhooks.list, { slug });
    expect(list.endpoints[0].recent.map((d) => d.event).sort()).toEqual(["deal.won", "lead.created"]);
    expect(list.endpoints[0].recent.every((d) => d.status === "delivered")).toBe(true);
    const payload = await t.run(async (ctx) => JSON.parse((await ctx.db.query("webhookDeliveries").first())!.payload));
    expect(payload.event).toBeTruthy();
  });

  it("signs timestamp.body with HMAC-SHA256", async () => {
    const sig = await signWebhook("whsec_test", 1_800_000_000, '{"a":1}');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(await signWebhook("whsec_test", 1_800_000_000, '{"a":1}')).toBe(sig);
    expect(await signWebhook("whsec_other", 1_800_000_000, '{"a":1}')).not.toBe(sig);
  });

  it("sends the exact approved blog version as an export handoff, never as publish authorization", async () => {
    const t = setup();
    const owner = await asNewUser(t, "seo-hooks@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "SEO Hooks Co" });
    await owner.client.mutation(api.webhooks.create, { slug, url: "https://hooks.zapier.com/hooks/catch/1/seo", events: ["content.approved"] });
    const body = "# A useful, evidence-based article\n\nThe approved article body.";
    const artifactId = await t.run(async (ctx) => {
      const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first()) as Doc<"businesses">;
      const now = Date.now();
      const id = await ctx.db.insert("artifacts", { orgId: orgId as Id<"organizations">, businessId: business._id, kind: "blog_post", channel: "blog", title: "Useful article", status: "in_review", currentVersion: 1, createdAt: now, updatedAt: now });
      const versionId = await ctx.db.insert("artifactVersions", { orgId: orgId as Id<"organizations">, artifactId: id, version: 1, body, hashtags: [], claimFactIds: [], unsupportedClaims: [], contentHash: await contentHash({ body, hashtags: [], channel: "blog" }), createdAt: now });
      await ctx.db.patch(id, { currentVersionId: versionId });
      return id;
    });
    await owner.client.mutation(api.content.decide, { slug, artifactId, decision: "approve" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const payload = await t.run(async (ctx) => {
      const row = (await ctx.db.query("webhookDeliveries").collect()).find((item) => item.orgId === orgId);
      return JSON.parse(row!.payload) as { event: string; data: Record<string, unknown> };
    });
    expect(payload.event).toBe("content.approved");
    expect(payload.data).toMatchObject({
      artifactId,
      artifactVersion: 1,
      actionScope: "approved_export",
      publishAuthorized: false,
      title: "Useful article",
      contentFormat: "markdown",
      content: body,
      contentComplete: true,
    });
    expect(payload.data.contentHash).toBe(await contentHash({ body, hashtags: [], channel: "blog" }));
  });
});
