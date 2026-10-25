import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

describe("lost-deal reasons", () => {
  it("records an optional reason only for lost deals, clears it on reopen, and keeps it tenant-scoped", async () => {
    const t = setup();
    const owner = await asNewUser(t, "loss-owner@example.com");
    const viewer = await asNewUser(t, "loss-viewer@example.com");
    const other = await asNewUser(t, "loss-other@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Loss Co" });
    const { slug: otherSlug } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    await t.run(async (ctx) => ctx.db.insert("memberships", { orgId: orgId as Id<"organizations">, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    const id = await owner.client.mutation(api.crm.create, { slug, name: "Ana Lopez", stage: "talking" });

    await expect(owner.client.mutation(api.crm.update, { slug, id, lostReason: "price" })).rejects.toThrow(/only be recorded for a lost deal/);
    await owner.client.mutation(api.crm.update, { slug, id, stage: "lost", lostReason: "price", lostReasonNote: "  Went with a cheaper local option  " });
    let row = (await owner.client.query(api.crm.list, { slug })).deals[0];
    expect(row).toMatchObject({ stage: "lost", lostReason: "price", lostReasonNote: "Went with a cheaper local option", lostAt: expect.any(Number), stageChangedAt: expect.any(Number) });

    await expect(viewer.client.mutation(api.crm.update, { slug, id, lostReason: "timing" })).rejects.toThrow(/can't/i);
    await expect(other.client.mutation(api.crm.update, { slug: otherSlug, id, lostReason: "timing" })).rejects.toThrow();

    // Clearing the reason keeps the deal lost; reopening clears the loss record.
    await owner.client.mutation(api.crm.update, { slug, id, lostReason: null });
    row = (await owner.client.query(api.crm.list, { slug })).deals[0];
    expect(row).toMatchObject({ stage: "lost", lostReason: null, lostReasonNote: "Went with a cheaper local option" });
    await owner.client.mutation(api.crm.update, { slug, id, stage: "talking" });
    row = (await owner.client.query(api.crm.list, { slug })).deals[0];
    expect(row).toMatchObject({ stage: "talking", lostReason: null, lostReasonNote: null, lostAt: null });
  });
});
