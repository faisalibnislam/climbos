import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("link in bio", () => {
  it("publishes tracked buttons and turns sign-ups into Pipeline leads", async () => {
    const t = setup();
    const owner = await asNewUser(t, "bio@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Bio Bakery" });
    await expect(owner.client.mutation(api.bio.save, { slug, title: "", bio: "", color: "#123456", links: [{ label: "Bad", url: "javascript:alert(1)" }], collectEmails: true, live: true })).rejects.toThrow(/https/);
    const pageSlug = await owner.client.mutation(api.bio.save, { slug, title: "", bio: "Fresh sourdough daily", color: "#123456", links: [{ label: "Order now", url: "shop.example/order" }], collectEmails: true, live: true });
    const pub = await t.query(api.bio.publicPage, { slug: pageSlug });
    expect(pub?.title).toBe("Bio Bakery");
    expect(pub?.links[0].href).toMatch(/^\/l\/[A-Za-z0-9]+$/);
    // Saving again keeps the same tracked link for an unchanged URL.
    await owner.client.mutation(api.bio.save, { slug, title: "Bio Bakery", bio: "", color: "#123456", links: [{ label: "Order today", url: "https://shop.example/order" }], collectEmails: true, live: true });
    expect((await t.query(api.bio.publicPage, { slug: pageSlug }))?.links[0].href).toBe(pub?.links[0].href);
    await t.mutation(api.bio.signup, { slug: pageSlug, email: "fan@x.example" });
    expect((await owner.client.query(api.crm.list, { slug })).deals[0]).toMatchObject({ email: "fan@x.example", stage: "lead" });
    await owner.client.mutation(api.bio.save, { slug, title: "Bio Bakery", bio: "", color: "#123456", links: [], collectEmails: false, live: false });
    expect(await t.query(api.bio.publicPage, { slug: pageSlug })).toBeNull();
  });
});
