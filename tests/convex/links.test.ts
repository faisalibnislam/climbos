import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("tracked links (Convex)", () => {
  it("makes a short link, counts human clicks only, and reports them", async () => {
    const t = setup();
    const owner = await asNewUser(t, "links@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Links Co" });
    const made = await owner.client.mutation(api.links.create, { slug, url: "shop.example/offer", channel: "instagram", campaign: "Autumn Sale" });
    expect(made.url).toContain("utm_campaign=autumn-sale");
    const code = made.shortUrl.split("/l/")[1];
    expect(await t.mutation(api.links.click, { code, human: true })).toBe(made.url);
    await t.mutation(api.links.click, { code, human: false });
    expect(await t.mutation(api.links.click, { code: "nope0000", human: true })).toBeNull();
    const list = await owner.client.query(api.links.list, { slug });
    expect(list.links[0]).toMatchObject({ clicks: 1, week: 1, source: "manual" });
    expect(list.tracking).toBe(true);
  });
});
