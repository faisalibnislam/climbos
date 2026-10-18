import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

const SECRET = "test-server-secret";
const IP_A = "a".repeat(64);
const IP_B = "b".repeat(64);

describe("tracked links (Convex)", () => {
  it("makes a short link, counts human clicks once per person a day, and reports them", async () => {
    const t = setup();
    const owner = await asNewUser(t, "links@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Links Co" });
    const made = await owner.client.mutation(api.links.create, { slug, url: "shop.example/offer", channel: "instagram", campaign: "Autumn Sale" });
    expect(made.url).toContain("utm_campaign=autumn-sale");
    const code = made.shortUrl.split("/l/")[1];
    expect(await t.mutation(api.links.click, { serverSecret: SECRET, code, human: true, ipHash: IP_A })).toBe(made.url);
    // The same person again, and a bot: not counted.
    await t.mutation(api.links.click, { serverSecret: SECRET, code, human: true, ipHash: IP_A });
    await t.mutation(api.links.click, { serverSecret: SECRET, code, human: false, ipHash: IP_B });
    expect(await t.mutation(api.links.click, { serverSecret: SECRET, code: "nope0000", human: true, ipHash: IP_A })).toBeNull();
    // Only the /l route (server secret) can count clicks.
    await expect(t.mutation(api.links.click, { serverSecret: "guess", code, human: true, ipHash: IP_B })).rejects.toThrow(/Not allowed/);
    let list = await owner.client.query(api.links.list, { slug });
    expect(list.links[0]).toMatchObject({ clicks: 1, week: 1, source: "manual" });
    expect(list.tracking).toBe(true);
    await t.mutation(api.links.click, { serverSecret: SECRET, code, human: true, ipHash: IP_B });
    list = await owner.client.query(api.links.list, { slug });
    expect(list.weekTotal).toBe(2);
    // Removing the link removes its clicks from the totals.
    await owner.client.mutation(api.links.remove, { slug, id: list.links[0].id });
    list = await owner.client.query(api.links.list, { slug });
    expect(list.weekTotal).toBe(0);
    expect(await t.run(async (ctx) => (await ctx.db.query("linkClickIps").collect()).length)).toBe(0);
  });
});
