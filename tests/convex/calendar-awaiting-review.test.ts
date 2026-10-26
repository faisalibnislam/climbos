import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("content calendar and items awaiting review", () => {
  it("shows unscheduled drafts that need review on the day they were drafted, and only for this workspace", async () => {
    const t = setup();
    const u = await asNewUser(t, "calendar-review@example.com", { anonymous: true });
    const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
    const { orgId, target } = await t.run(async (ctx) => {
      const org = (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique())!;
      const a = (await ctx.db.query("artifacts").withIndex("by_org_updated", (q) => q.eq("orgId", org._id)).collect()).find((x) => x.status === "in_review")!;
      await ctx.db.patch(a._id, { scheduledFor: undefined });
      return { orgId: org._id, target: (await ctx.db.get(a._id))! };
    });
    const day = 86_400_000;
    const cal = await u.client.query(api.content.calendar, { slug, from: target._creationTime - day, to: target._creationTime + day });
    expect(cal.items.find((i) => i.artifactId === target._id)).toMatchObject({ unscheduled: true, status: "in_review", scheduledFor: target._creationTime });
    expect(cal.limitsReached.awaitingReview).toBe(false);

    const outside = await u.client.query(api.content.calendar, { slug, from: target._creationTime + day, to: target._creationTime + 2 * day });
    expect(outside.items.some((i) => i.artifactId === target._id)).toBe(false);

    const other = await asNewUser(t, "calendar-other@example.com");
    const { slug: otherSlug } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    const otherCal = await other.client.query(api.content.calendar, { slug: otherSlug, from: target._creationTime - day, to: target._creationTime + day });
    expect(otherCal.items.some((i) => i.artifactId === target._id)).toBe(false);
    expect(orgId).toBeTruthy();
  });
});
