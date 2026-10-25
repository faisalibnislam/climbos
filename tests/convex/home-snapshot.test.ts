import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

function dateInTimezone(timestamp: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}

describe("Growth Home analytics snapshot", () => {
  it("uses only this tenant's observed, all-channel daily visits and sign-ups and excludes today", async () => {
    const t = setup();
    const owner = await asNewUser(t, "home-snapshot-owner@example.com");
    const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Snapshot Co" });
    const otherOwner = await asNewUser(t, "home-snapshot-other@example.com");
    const other = await otherOwner.client.mutation(api.orgs.createWorkspace, { businessName: "Other Snapshot Co" });
    const now = Date.now();

    await t.run(async (ctx) => {
      const org = (await ctx.db.get(orgId as Id<"organizations">))!;
      const previousDay = dateInTimezone(now - 2 * 86_400_000, org.timezone);
      const currentDay = dateInTimezone(now, org.timezone);
      const put = (workspaceId: Id<"organizations">, metricKey: string, date: string, value: number, source: string, kind: "observed" | "attributed" = "observed", channel?: string) => ctx.db.insert("metricDaily", {
        orgId: workspaceId,
        metricKey,
        date,
        value,
        source,
        kind,
        ...(channel ? { channel } : {}),
        isFixture: false,
        ingestedAt: now,
      });
      await put(org._id, "visits", previousDay, 120, "Google Analytics 4");
      await put(org._id, "visits", previousDay, 10, "GA4 import correction");
      await put(org._id, "visits", previousDay, 900, "attributed channel", "attributed", "email");
      await put(org._id, "signups", previousDay, 7, "Google Analytics 4");
      await put(org._id, "visits", currentDay, 999, "Google Analytics 4");
      await put(other.orgId as Id<"organizations">, "visits", previousDay, 4_000, "Google Analytics 4");
    });

    const snapshot = await owner.client.query(api.analytics.homeSnapshot, { slug });
    expect(snapshot.metrics.find((metric) => metric.key === "visits")).toMatchObject({ hasData: true, total: 130, recordedDays: 1, sourceName: "Multiple sources" });
    expect(snapshot.metrics.find((metric) => metric.key === "signups")).toMatchObject({ hasData: true, total: 7, recordedDays: 1 });
  });

  it("keeps absent metrics unknown and enforces workspace access", async () => {
    const t = setup();
    const owner = await asNewUser(t, "home-snapshot-empty@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Empty Snapshot Co" });
    const otherOwner = await asNewUser(t, "home-snapshot-forbidden@example.com");
    await otherOwner.client.mutation(api.orgs.createWorkspace, { businessName: "Other Empty Snapshot Co" });

    const snapshot = await owner.client.query(api.analytics.homeSnapshot, { slug });
    expect(snapshot.metrics.every((metric) => !metric.hasData && metric.total === 0)).toBe(true);
    await expect(otherOwner.client.query(api.analytics.homeSnapshot, { slug })).rejects.toThrow();
  });
});
