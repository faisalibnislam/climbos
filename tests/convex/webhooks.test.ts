import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { signWebhook } from "../../shared/webhooks";
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
});
