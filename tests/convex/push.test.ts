import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("push notifications", () => {
  it("bell notices become pullable phone notifications for subscribed users only", async () => {
    const t = setup();
    const owner = await asNewUser(t, "push@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Push Co" });
    await expect(owner.client.mutation(api.push.subscribe, { endpoint: "http://insecure" })).rejects.toThrow();
    const endpoint = "https://push.example.com/sub/abc123";
    await owner.client.mutation(api.push.subscribe, { endpoint, label: "iPhone · Safari" });
    expect(await owner.client.query(api.push.mine, {})).toHaveLength(1);
    // A new chat on their website notifies the owner.
    const key = await owner.client.mutation(api.chat.setup, { slug });
    await t.mutation(api.chat.send, { key, visitorId: "visitor-push-0001", text: "Hello, are you open Sunday?" });
    await t.mutation(internal.push.fanout, {});
    const items = await t.mutation(internal.push.pull, { endpoint });
    expect(items[0].body).toContain("New website chat");
    expect(items[0].url).toBe(`/app/${slug}/inbox`);
    // Delivered once.
    expect(await t.mutation(internal.push.pull, { endpoint })).toHaveLength(0);
    // Unknown device gets nothing.
    expect(await t.mutation(internal.push.pull, { endpoint: "https://push.example.com/other" })).toHaveLength(0);
  });
});
