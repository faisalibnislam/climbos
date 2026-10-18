import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, makePaid, setup } from "./helpers";

describe("Low-credit nudges", () => {
  it("notifies owners once when credits run low, and stays quiet while top-ups cover work", async () => {
    const t = setup();
    const owner = await asNewUser(t, "nudge@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Nudge Co" });
    await makePaid(t, orgId, 11_000_000);
    const periodId = await t.run(async (ctx) => {
      const p = (await ctx.db.query("usagePeriods").collect()).find((x) => x.source === "subscription")!;
      await ctx.db.patch(p._id, { walletSpentMicros: 10_000_000 });
      return p._id;
    });
    await t.mutation(internal.notifications.checkUsageAlerts, { periodId });
    const notices = await owner.client.query(api.team.myNotices, {});
    expect(notices.items.some((n) => /credits left/.test(n.text))).toBe(true);
    // Same threshold again: no second notice.
    await t.mutation(internal.notifications.checkUsageAlerts, { periodId });
    expect((await owner.client.query(api.team.myNotices, {})).items.length).toBe(notices.items.length);

    // Plenty of top-ups: crossing 70% on the month says nothing.
    const t2 = setup();
    const o2 = await asNewUser(t2, "topped@example.com");
    const w2 = await o2.client.mutation(api.orgs.createWorkspace, { businessName: "Topped Co" });
    await makePaid(t2, w2.orgId, 11_000_000);
    const p2 = await t2.run(async (ctx) => {
      const org = (await ctx.db.get(w2.orgId as Id<"organizations">))!;
      const now = Date.now();
      await ctx.db.insert("creditPurchases", { orgId: org._id, accountId: org.accountId, polarOrderId: "ord_t", topupKey: "credits_50", deliveryCostMicros: 0, creditsMicros: 40_000_000, remainingMicros: 40_000_000, expiresAt: now + 300 * 86_400_000, status: "active", createdAt: now });
      const p = (await ctx.db.query("usagePeriods").collect()).find((x) => x.source === "subscription")!;
      await ctx.db.patch(p._id, { walletSpentMicros: 8_000_000 });
      return p._id;
    });
    await t2.mutation(internal.notifications.checkUsageAlerts, { periodId: p2 });
    expect((await o2.client.query(api.team.myNotices, {})).items).toHaveLength(0);
  });
});
