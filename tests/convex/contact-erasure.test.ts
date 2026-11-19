import { expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

async function fixture() {
  const t = setup(), owner = await asNewUser(t, "privacy@example.com");
  const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Erasure" });
  await owner.client.action(api.marketing.importContacts, { slug, csv: "email,segment\nana@example.com,customers" });
  const contact = (await t.run(ctx => ctx.db.query("contacts").withIndex("by_org", q => q.eq("orgId", orgId)).first()))!;
  const erase = () => owner.client.mutation(api.settings.deleteContact, { slug, email: "ana@example.com" });
  const consentHistory = async (count: number) => t.run(async ctx => {
    for (let i = 0; i < count; i++) await ctx.db.insert("consentRecords", { orgId, contactId: contact._id, purpose: "marketing_email", basis: "opt_in", source: "Synthetic permission history", evidence: `Record ${i}`, capturedAt: Date.now() - 1000 });
  });
  return { t, owner, orgId, slug, contact, erase, consentHistory };
}

it("erases the complete supported consent history rather than leaving rows beyond an initial page", async () => {
  const f = await fixture(); await f.consentHistory(100);
  expect(await f.erase()).toEqual({ deleted: 1 });
  expect(await f.t.run(ctx => ctx.db.query("consentRecords").collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.get(f.contact._id))).toBeNull();
});
it("does not claim completion or partially delete when consent history exceeds its verified bound", async () => {
  const f = await fixture(); await f.consentHistory(101);
  await expect(f.erase()).rejects.toThrow(/complete consent history/i);
  expect(await f.t.run(ctx => ctx.db.query("consentRecords").collect())).toHaveLength(101);
  expect(await f.t.run(ctx => ctx.db.get(f.contact._id))).not.toBeNull();
  expect(await f.t.run(ctx => ctx.db.query("privacyRequests").collect())).toEqual([]);
});
it("holds erasure with an oversized duplicate-identity set instead of reporting a partial deletion as done", async () => {
  const f = await fixture();
  await f.t.run(async ctx => { const { _id, _creationTime, ...c } = f.contact; for (let i = 0; i < 10; i++) await ctx.db.insert("contacts", c); });
  await expect(f.erase()).rejects.toThrow(/complete matching contact/i);
  expect(await f.t.run(ctx => ctx.db.query("contacts").collect())).toHaveLength(11);
  expect(await f.t.run(ctx => ctx.db.query("privacyRequests").collect())).toEqual([]);
});
it("rolls back all earlier matching deletions when a later duplicate has incomplete history", async () => {
  const f = await fixture(); await f.consentHistory(1);
  await f.t.run(async ctx => {
    const { _id, _creationTime, ...contact } = f.contact;
    const duplicateId = await ctx.db.insert("contacts", contact);
    for (let i = 0; i < 101; i++) await ctx.db.insert("consentRecords", { orgId: f.orgId, contactId: duplicateId, purpose: "marketing_email", basis: "opt_in", source: "Synthetic permission history", evidence: "Synthetic opt-in", capturedAt: Date.now() - 1000 });
  });
  await expect(f.erase()).rejects.toThrow(/complete consent history/i);
  expect(await f.t.run(ctx => ctx.db.query("contacts").collect())).toHaveLength(2);
  expect(await f.t.run(ctx => ctx.db.query("consentRecords").collect())).toHaveLength(102);
  expect(await f.t.run(ctx => ctx.db.query("privacyRequests").collect())).toEqual([]);
});
it("keeps deletion suppression stronger than an existing unsubscribe so re-import cannot revive telemetry", async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.insert("suppressions", { orgId: f.orgId, emailHash: f.contact.emailHash, reason: "unsubscribe", source: "Customer unsubscribe", createdAt: Date.now() }));
  const { token } = await f.owner.client.mutation(api.productTracking.create, { slug: f.slug, name: "App", scope: "Product", mappings: [{ event: "value", state: "activated", criterion: "Observed first value" }] });
  const post = () => f.t.fetch("/product-events", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ eventId: "value-1", email: "ana@example.com", event: "value", occurredAt: new Date(Date.now() - 1000).toISOString() }) });
  expect((await post()).status).toBe(200);
  await f.erase();
  expect(await f.t.run(ctx => ctx.db.query("productEvents").collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.query("contactProgress").collect())).toEqual([]);
  await f.owner.client.action(api.marketing.importContacts, { slug: f.slug, csv: "email,segment\nana@example.com,customers" });
  expect((await post()).status).toBe(422);
  expect((await f.t.run(ctx => ctx.db.query("suppressions").first()))?.reason).toBe("deletion");
});
it("erases only the authorized workspace and denies other members without management access", async () => {
  const f = await fixture(), other = await asNewUser(f.t, "other@example.com"), viewer = await asNewUser(f.t, "viewer@example.com");
  const foreign = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
  await other.client.action(api.marketing.importContacts, { slug: foreign.slug, csv: "email,consent,consent_source,consent_date,segment\nana@example.com,yes,form,2026-10-01,customers" });
  await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
  for (const client of [other.client, viewer.client, f.t]) await expect(client.mutation(api.settings.deleteContact, { slug: f.slug, email: "ana@example.com" })).rejects.toThrow();
  await f.erase();
  expect(await f.t.run(ctx => ctx.db.query("contacts").withIndex("by_org", q => q.eq("orgId", foreign.orgId)).collect())).toHaveLength(1);
  expect(await f.t.run(ctx => ctx.db.query("consentRecords").withIndex("by_org_contact", q => q.eq("orgId", foreign.orgId)).collect())).toHaveLength(1);
});
