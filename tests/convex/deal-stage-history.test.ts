import { expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import { encodeToolOutput, toolByName, type Caller } from "../../convex/lib/climbTools";

async function fixture() {
  const t = setup(), owner = await asNewUser(t, "history@example.com");
  const w = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "History" });
  const id = await owner.client.mutation(api.crm.create, { slug: w.slug, name: "Buyer" });
  const read = () => owner.client.query(api.crm.stageHistory, { slug: w.slug, id });
  return { t, owner, ...w, id, read };
}
it("records creation, movement, reopening and repeated close decisions without rewriting earlier stages", async () => {
  const f = await fixture();
  for (const stage of ["talking", "lost", "talking", "won", "lead"] as const) await f.owner.client.mutation(api.crm.update, { slug: f.slug, id: f.id, stage });
  const result = await f.read();
  expect(result.fromCreation).toBe(true);
  expect(result.events.map(e => e.to)).toEqual(["lead", "won", "talking", "lost", "talking", "lead"]);
  expect(result.events.at(-1)).toMatchObject({ sequence: 1, from: null, to: "lead", source: "owner" });
  expect((await f.t.run(ctx => ctx.db.get(f.id)))!.stageHistory!.events.every(e => e.actorId === f.owner.userId)).toBe(true);
  const before = result.events;
  await f.owner.client.mutation(api.crm.update, { slug: f.slug, id: f.id, stage: "lead", note: "No stage change", nextStepDate: "2026-11-20" });
  expect((await f.read()).events).toEqual(before);
  for (const table of ["approvals", "actionReceipts", "emailLog"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});
it("does not infer earlier events or entry dates for legacy records", async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.id, { stageHistory: undefined, stageChangedAt: undefined, stage: "booked" }));
  expect(await f.read()).toMatchObject({ fromCreation: false, total: 0, retained: 0, events: [], nextBefore: null });
  await f.owner.client.mutation(api.crm.update, { slug: f.slug, id: f.id, stage: "talking" });
  expect(await f.read()).toMatchObject({ fromCreation: false, total: 1, events: [{ sequence: 1, from: "booked", to: "talking", source: "owner" }] });
});
it("pages bounded retained history with complete events and rejects mixed versions and unretained positions", async () => {
  const f = await fixture();
  for (let i = 0; i < 105; i++) await f.owner.client.mutation(api.crm.update, { slug: f.slug, id: f.id, stage: i % 2 === 0 ? "talking" : "lead" });
  const first = await f.read();
  expect(first).toMatchObject({ total: 106, retained: 100, fromCreation: true, nextBefore: 87 });
  expect(first.events.map(e => e.sequence)).toEqual(Array.from({ length: 20 }, (_, i) => 106 - i));
  const second = await f.owner.client.query(api.crm.stageHistory, { slug: f.slug, id: f.id, beforeEvent: first.nextBefore!, expectedVersion: first.version });
  expect(second.events.map(e => e.sequence)).toEqual(Array.from({ length: 20 }, (_, i) => 86 - i));
  await expect(f.owner.client.query(api.crm.stageHistory, { slug: f.slug, id: f.id, beforeEvent: 4, expectedVersion: first.version })).rejects.toThrow(/not retained/);
  await expect(f.owner.client.query(api.crm.stageHistory, { slug: f.slug, id: f.id, beforeEvent: 50 })).rejects.toThrow(/original review version/);
  const changedAt = (await f.t.run(ctx => ctx.db.get(f.id)))!.updatedAt;
  await f.t.run(ctx => ctx.db.patch(f.id, { name: "Changed at same timestamp", updatedAt: changedAt }));
  await expect(f.owner.client.query(api.crm.stageHistory, { slug: f.slug, id: f.id, beforeEvent: 87, expectedVersion: first.version })).rejects.toThrow(/changed/);
});
it("exposes read-only history to the existing assistant with tenant and source boundaries", async () => {
  const f = await fixture(), other = await asNewUser(f.t, "history-foreign@example.com"), viewer = await asNewUser(f.t, "history-viewer@example.com");
  const foreign = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
  await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
  expect((await viewer.client.query(api.crm.stageHistory, { slug: f.slug, id: f.id })).events).toHaveLength(1);
  await expect(viewer.client.mutation(api.crm.update, { slug: f.slug, id: f.id, stage: "won" })).rejects.toThrow();
  await expect(other.client.query(api.crm.stageHistory, { slug: foreign.slug, id: f.id })).rejects.toThrow();
  await expect(f.t.query(api.crm.stageHistory, { slug: f.slug, id: f.id })).rejects.toThrow();
  const tool = toolByName("get_pipeline")!;
  const caller = { query: (fn: unknown, args: unknown) => (f.owner.client.query as (f: unknown, a: unknown) => Promise<unknown>)(fn, args), mutation: async () => { throw new Error("No mutations"); } } as unknown as Caller;
  const before = await f.t.run(ctx => ctx.db.get(f.id));
  const output = JSON.parse(encodeToolOutput(await tool.run!(caller, f.slug, { view: "history", dealId: f.id }), 7800, tool.output));
  expect(output.view).toBe("history"); expect(output.events[0]).not.toHaveProperty("actorId");
  expect(output.limitations).toContain("not verified buyer decisions");
  expect(await f.t.run(ctx => ctx.db.get(f.id))).toEqual(before);
  await expect(tool.run!(caller, f.slug, { view: "history" })).rejects.toThrow();
  await expect(tool.run!(caller, f.slug, { dealId: f.id, beforeEvent: 1 })).rejects.toThrow(/view=history/);
});
it("exports retained history and removes it with the deal or workspace", async () => {
  const f = await fixture();
  expect(JSON.parse(await f.t.query(internal.settings.exportData, { orgId: f.orgId })).deals[0].stageHistory.events[0].source).toBe("owner");
  await f.owner.client.mutation(api.crm.remove, { slug: f.slug, id: f.id });
  await expect(f.read()).rejects.toThrow();
  const another = await f.owner.client.mutation(api.crm.create, { slug: f.slug, name: "Another" });
  await f.t.mutation(internal.settings.purgeWorkspaceBatch, { orgId: f.orgId });
  expect(await f.t.run(ctx => ctx.db.get(another))).toBeNull();
});
it("records connected inbound imports at capture time and does not duplicate replayed events", async () => {
  const f = await fixture();
  await f.t.mutation(internal.airly.saveLink, { orgId: f.orgId, userId: f.owner.userId, app: "formkit", sealed: { ciphertext: "fixture", iv: "fixture", keyId: "fixture" } });
  const link = await f.t.query(internal.airly.linkFor, { orgId: f.orgId, app: "formkit" });
  const items = [{ externalId: "one", name: "Imported buyer", email: "buyer@example.com", text: "A form", subject: "Question", at: 1000, kind: "form" as const }];
  const before = Date.now();
  await f.t.mutation(internal.airly.importLeads, { linkId: link!._id, items });
  await f.t.mutation(internal.airly.importLeads, { linkId: link!._id, items });
  const imported = (await f.owner.client.query(api.crm.list, { slug: f.slug })).deals.filter(d => d.name === "Imported buyer");
  expect(imported).toHaveLength(1);
  const history = await f.owner.client.query(api.crm.stageHistory, { slug: f.slug, id: imported[0].id });
  expect(history).toMatchObject({ total: 1, fromCreation: true, events: [{ source: "inbound", from: null, to: "lead" }] });
  expect(history.events[0].at).toBeGreaterThanOrEqual(before);
});
