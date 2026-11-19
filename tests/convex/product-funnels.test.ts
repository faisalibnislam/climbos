import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import { planningEmailAudience } from "../../convex/lib/marketingAudience";
import { emailAudienceBrief } from "../../shared/growth/emailAudience";
const DAY = 86_400_000, NOW = Date.UTC(2026, 10, 19, 12);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW - 25 * DAY); });
afterEach(() => { vi.useRealTimers(); });
async function fixture() {
  const t = setup(), owner = await asNewUser(t, "funnel@example.com"), { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Product funnels" });
  await owner.client.action(api.marketing.importContacts, { slug, csv: "email,segment\na@example.com,customers\nb@example.com,customers" });
  const { token, sourceId } = await owner.client.mutation(api.productTracking.create, { slug, name: "App server", scope: "Exports", mappings: [{ event: "signup", state: "started", criterion: "Account created" }, { event: "export", state: "activated", criterion: "Real export completed" }] });
  const config = { slug, sourceId, name: "Export value", entity: "person" as const, entryEvent: "signup", activationEvent: "export", returnEvent: "export", activationDays: 3, returnStartDay: 7, returnEndDay: 14, lookbackDays: 30 };
  const id = await owner.client.mutation(api.productFunnels.create, config);
  const post = async (email: string, event: string, daysAgo: number, accountRef?: string) => { vi.setSystemTime(NOW - daysAgo * DAY); return t.fetch("/product-events", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ email, event, eventId: `${email}-${event}-${daysAgo}`, occurredAt: new Date(Date.now()).toISOString(), ...(accountRef ? { accountRef } : {}) }) }); };
  const list = () => owner.client.query(api.productFunnels.list, { slug });
  return { t, owner, slug, orgId, sourceId, token, id, config, post, list };
}
it("persists owner definitions and feeds real HTTP event sequences to the UI query and existing planner", async () => {
  const f = await fixture();
  for (const args of [["a@example.com", "signup", 25], ["a@example.com", "export", 24], ["a@example.com", "export", 15]] as const) expect((await f.post(args[0], args[1], args[2])).status).toBe(200);
  vi.setSystemTime(NOW);
  expect((await f.list()).rows[0].assessment).toMatchObject({ entered: 1, activation: { observed: 1, eligible: 1 }, returnUse: { observed: 1, eligible: 1 } });
  const snapshot = await f.t.run(ctx => planningEmailAudience(ctx, f.orgId));
  expect(emailAudienceBrief(snapshot)).toContain("activation 1/1 mature"); expect(emailAudienceBrief(snapshot)).toContain("source-reported events");
  expect(JSON.stringify(snapshot)).not.toMatch(/a@example.com|b@example.com|climb_events_/);
  for (const table of ["approvals", "actionReceipts", "workflowRuns", "consentRecords", "emailLog"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
  const runId = await f.t.run(ctx => ctx.db.insert("workflowRuns", { orgId: f.orgId, kind: "strategy", title: "Plan", status: "executing", input: "{}", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "verified-2026-10-17", entitlementVersionId: "ent-credits-2026-10-18", routingVersionId: "r1", budget: { modelSteps: 1, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: NOW, updatedAt: NOW }));
  const context = await f.t.query(internal.jobWrites.jobContext, { runId });
  expect(emailAudienceBrief(context?.audience)).toContain("activation 1/1 mature");
});
it("supports explicit accounts without inventing identity and binds account identity to retry payloads", async () => {
  const f = await fixture(); await f.owner.client.mutation(api.productFunnels.remove, { slug: f.slug, id: f.id });
  await f.owner.client.mutation(api.productFunnels.create, { ...f.config, entity: "account" });
  await f.post("a@example.com", "signup", 25, "opaque-account-1");
  await f.post("b@example.com", "signup", 24, "opaque-account-1");
  await f.post("b@example.com", "export", 23, "opaque-account-1");
  await f.post("a@example.com", "export", 15, "opaque-account-1");
  expect((await f.post("a@example.com", "export", 15, "changed-account")).status).toBe(409);
  vi.setSystemTime(NOW);
  expect((await f.list()).rows[0].assessment).toMatchObject({ entered: 1, activation: { observed: 1 }, returnUse: { observed: 1 } });
  expect(JSON.stringify(await f.t.run(ctx => ctx.db.query("productEvents").collect()))).not.toContain("opaque-account-1");
});
it("excludes owner-disputed histories and retains a correction boundary after future events resume", async () => {
  const f = await fixture(); await f.post("a@example.com", "signup", 25); await f.post("a@example.com", "export", 24);
  vi.setSystemTime(NOW - 23 * DAY);
  const contact = (await f.owner.client.query(api.marketing.contactProgress, { slug: f.slug, email: "a@example.com" }))!;
  await f.owner.client.mutation(api.marketing.recordContactProgress, { slug: f.slug, contactId: contact.contactId, expectedRevision: 2, scope: "Exports", state: "unknown", criterion: "Disputed export", evidence: "Owner found test activity", observedOn: new Date(Date.now()).toISOString().slice(0, 10) });
  vi.setSystemTime(NOW); expect((await f.list()).rows[0].assessment).toMatchObject({ entered: 0, excludedContacts: 1 });
  vi.setSystemTime(NOW - 22 * DAY);
  await f.owner.client.mutation(api.productTracking.useFutureEvents, { slug: f.slug, sourceId: f.sourceId, contactId: contact.contactId, expectedRevision: 3 });
  await f.post("a@example.com", "export", 15); vi.setSystemTime(NOW);
  expect((await f.list()).rows[0].assessment).toMatchObject({ entered: 0, excludedEvents: 2 }); // Old disputed signup must not silently re-enter a cohort.
});
it("isolates definitions and reports, enforces management permission, exports and erases contact evidence", async () => {
  const f = await fixture(), other = await asNewUser(f.t, "other@example.com"), viewer = await asNewUser(f.t, "viewer@example.com");
  const foreign = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
  await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
  await expect(other.client.query(api.productFunnels.list, { slug: f.slug })).rejects.toThrow();
  await expect(other.client.mutation(api.productFunnels.create, { ...f.config, slug: foreign.slug })).rejects.toThrow();
  await expect(viewer.client.mutation(api.productFunnels.create, f.config)).rejects.toThrow();
  await expect(viewer.client.mutation(api.productFunnels.remove, { slug: f.slug, id: f.id })).rejects.toThrow();
  await f.post("a@example.com", "signup", 25); vi.setSystemTime(NOW);
  expect(JSON.parse(await f.t.query(internal.settings.exportData, { orgId: f.orgId })).productFunnels).toHaveLength(1);
  await f.owner.client.mutation(api.settings.deleteContact, { slug: f.slug, email: "a@example.com" });
  expect((await f.list()).rows[0].assessment.entered).toBe(0);
  await f.owner.client.mutation(api.productFunnels.remove, { slug: f.slug, id: f.id }); expect((await f.list()).rows).toEqual([]);
});
it("rejects undefined events, guessed zero windows, inconsistent windows and oversized definition sets", async () => {
  const f = await fixture();
  for (const patch of [{ entryEvent: "unknown" }, { activationDays: 0 }, { returnStartDay: 1 }, { returnEndDay: 31 }, { lookbackDays: 20 }]) await expect(f.owner.client.mutation(api.productFunnels.create, { ...f.config, ...patch })).rejects.toThrow();
  for (let i = 1; i < 20; i++) await f.owner.client.mutation(api.productFunnels.create, { ...f.config, name: `Definition ${i}` });
  await expect(f.owner.client.mutation(api.productFunnels.create, f.config)).rejects.toThrow(/20/);
});
