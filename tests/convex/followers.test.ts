import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

describe("follower tracking", () => {
  it("keeps one count per platform per day, sums tracked platforms, and stays in its workspace", async () => {
    const t = setup();
    const owner = await asNewUser(t, "followers@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Rise Bakery" });
    const org = orgId as Id<"organizations">;

    const empty = await owner.client.query(api.followers.summary, { slug });
    expect(empty.total).toBeNull();
    expect(empty.platforms.map((p) => [p.provider, p.connected, p.latest])).toEqual([["instagram", false, null], ["facebook_pages", false, null]]);

    await t.mutation(internal.followers.record, { orgId: org, provider: "instagram", accountId: "17841", count: 2100 });
    await t.mutation(internal.followers.record, { orgId: org, provider: "instagram", accountId: "17841", count: 2140 });
    await t.mutation(internal.followers.record, { orgId: org, provider: "facebook_pages", accountId: "9001", count: 610 });
    const rows = await t.run(async (ctx) => ctx.db.query("followerSnapshots").collect());
    expect(rows).toHaveLength(2);

    const s = await owner.client.query(api.followers.summary, { slug });
    expect(s.total).toBe(2750);
    expect(s.platforms.find((p) => p.provider === "instagram")?.latest).toBe(2140);

    const other = await asNewUser(t, "not-a-member@example.com");
    await expect(other.client.query(api.followers.summary, { slug })).rejects.toThrow();
  });
});
