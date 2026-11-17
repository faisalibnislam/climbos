import { expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import { pipelineOutcomes, pipelineOutcomesBrief } from "../../shared/growth/pipeline";

it("records multiple reasons without inventing a primary reason and clears them on reopening", async () => {
  const t = setup(), owner = await asNewUser(t, "many-reasons@example.com");
  const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Reasons" });
  const id = await owner.client.mutation(api.crm.create, { slug, name: "Buyer", stage: "lost" });
  await owner.client.mutation(api.crm.update, { slug, id, lostReasons: ["price", "timing"], expectedLossState: { reasons: [], note: null, closedAt: (await t.run(ctx => ctx.db.get(id)))!.lostAt!, stageSequence: 1 } });
  expect((await owner.client.query(api.crm.list, { slug })).deals[0]).toMatchObject({ lostReason: null, lostReasons: ["price", "timing"] });
  await owner.client.mutation(api.crm.update, { slug, id, stage: "talking" });
  expect((await owner.client.query(api.crm.list, { slug })).deals[0]).toMatchObject({ lostReason: null, lostReasons: [], lostReasonNote: null });
});
it("counts overlapping reasons once per deal while retaining a unique-deal denominator", () => {
  const now = Date.now();
  const p = pipelineOutcomes([
    { stage: "lost", source: "manual", createdAt: now, updatedAt: now, lostAt: now, lostReasons: ["price", "price", "no_need", "timing"] },
    { stage: "lost", source: "manual", createdAt: now, updatedAt: now, lostAt: now, lostReason: "timing" },
    { stage: "lost", source: "manual", createdAt: now, updatedAt: now, lostAt: now },
  ], { nowMs: now });
  expect(p).toMatchObject({ lost: 3, lossReasonNotRecorded: 1, lossReasonDealCount: 2, modelRiskLossDeals: 1 });
  expect(p.lossReasons).toEqual(expect.arrayContaining([{ reason: "price", count: 1 }, { reason: "no_need", count: 1 }, { reason: "timing", count: 2 }]));
  expect(pipelineOutcomesBrief(p)).toContain("Reasons can overlap");
});
it("rejects stale, conflicting and duplicate edits and preserves explicit unknowns", async () => {
  const t = setup(), owner = await asNewUser(t, "loss-conflicts@example.com");
  const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Conflicts" });
  const id = await owner.client.mutation(api.crm.create, { slug, name: "Buyer", stage: "lost" });
  const expected = { reasons: [], note: null, closedAt: (await t.run(ctx => ctx.db.get(id)))!.lostAt!, stageSequence: 1 };
  const save = { slug, id, lostReasons: ["price", "timing"] as const, expectedLossState: expected };
  await expect(owner.client.mutation(api.crm.update, { ...save, lostReasons: ["price", "price"] })).rejects.toThrow(/at most once/);
  await expect(owner.client.mutation(api.crm.update, { ...save, lostReasons: ["price"], lostReason: "timing" })).rejects.toThrow(/not both/);
  await owner.client.mutation(api.crm.update, { ...save, lostReasons: [...save.lostReasons] });
  await expect(owner.client.mutation(api.crm.update, { ...save, lostReasons: [] })).rejects.toThrow(/changed/);
  await expect(owner.client.mutation(api.crm.update, { slug, id, lostReason: "no_need" })).rejects.toThrow(/not reviewed/);
  await owner.client.mutation(api.crm.update, { slug, id, lostReasons: [], expectedLossState: { ...expected, reasons: ["price", "timing"] } });
  expect((await owner.client.query(api.crm.list, { slug })).deals[0].lostReasons).toEqual([]);
  await owner.client.mutation(api.crm.update, { slug, id, stage: "talking" });
  await owner.client.mutation(api.crm.update, { slug, id, stage: "lost" });
  // Even a same-millisecond close date cannot authorize editing a different close decision.
  await t.run(ctx => ctx.db.patch(id, { lostAt: expected.closedAt }));
  await expect(owner.client.mutation(api.crm.update, { ...save, lostReasons: ["price"] })).rejects.toThrow(/changed/);
});
it("keeps edits tenant- and permission-scoped and does not execute consequential work", async () => {
  const t = setup(), owner = await asNewUser(t, "loss-permissions@example.com"), viewer = await asNewUser(t, "loss-viewer-multi@example.com"), other = await asNewUser(t, "loss-other-multi@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Permissions" });
  const foreign = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
  await t.run(ctx => ctx.db.insert("memberships", { orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
  const id = await owner.client.mutation(api.crm.create, { slug, name: "Buyer", stage: "lost" });
  const patch = { slug, id, lostReasons: ["price" as const], expectedLossState: { reasons: [], note: null, closedAt: (await t.run(ctx => ctx.db.get(id)))!.lostAt!, stageSequence: 1 } };
  await expect(viewer.client.mutation(api.crm.update, patch)).rejects.toThrow();
  await expect(other.client.mutation(api.crm.update, { ...patch, slug: foreign.slug })).rejects.toThrow();
  await expect(t.mutation(api.crm.update, patch)).rejects.toThrow();
  expect((await viewer.client.query(api.crm.list, { slug })).canEdit).toBe(false);
  await owner.client.mutation(api.crm.update, patch);
  expect((await owner.client.query(api.crm.detail, { slug, id })).deal.lostReasons).toEqual(["price"]);
  expect(await t.run(ctx => ctx.db.query("auditEvents").filter(q => q.eq(q.field("action"), "crm.loss_reasons")).collect())).toHaveLength(1);
  for (const table of ["approvals", "actionReceipts", "webhookDeliveries", "emailLog"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});
