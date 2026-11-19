import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import type { CustomerProgressRule } from "../../shared/growth/customerProgress";
import { journeyDueAt } from "../../shared/growth/customerJourneys";

const NOW = Date.UTC(2026, 10, 19, 9);
const rule: CustomerProgressRule = { scope: "Export app", state: "started", criterion: "Account created; first export not observed", maxAgeDays: 7 };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

async function fixture(delayDays = 0) {
  const t = setup(), owner = await asNewUser(t, "followup@example.com");
  const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Follow-up tests" });
  await owner.client.action(api.marketing.importContacts, { slug, csv: "email,consent,consent_source,consent_date,segment\nana@example.com,yes,owner signup form,2026-11-18,customers" });
  const contact = (await owner.client.query(api.marketing.contactProgress, { slug, email: "ana@example.com" }))!;
  const report = { slug, contactId: contact.contactId, expectedRevision: 0, scope: rule.scope, state: rule.state, criterion: rule.criterion, evidence: "Owner inspected account", observedOn: "2026-11-19" };
  await owner.client.mutation(api.marketing.recordContactProgress, report);
  const step = await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    const artifactId = await ctx.db.insert("artifacts", { orgId, businessId: business._id, kind: "email", channel: "email", title: "Export help", status: "approved", currentVersion: 1, createdAt: NOW, updatedAt: NOW });
    const artifactVersionId = await ctx.db.insert("artifactVersions", { orgId, artifactId, version: 1, headline: "A useful export tip", body: "Here is a useful tip.", hashtags: [], claimFactIds: [], unsupportedClaims: [], contentHash: "fixture", createdAt: NOW });
    await ctx.db.patch(artifactId, { currentVersionId: artifactVersionId });
    return { artifactId, artifactVersionId, emailIndex: 0, delayDays };
  });
  const input = { slug, name: "Export help", segment: "customers", rule, steps: [step, { ...step, delayDays: 2 }] };
  const journeyId = await owner.client.mutation(api.customerJourneys.create, input);
  const status = async (status: "active" | "paused" | "archived") => { const journey = (await t.run(ctx => ctx.db.get(journeyId)))!; await owner.client.mutation(api.customerJourneys.setStatus, { slug, journeyId, revision: journey.revision, status }); };
  const entries = () => t.run(ctx => ctx.db.query("journeyContacts").withIndex("by_journey", q => q.eq("journeyId", journeyId)).collect());
  const ref = () => t.run(async ctx => ({ journeyId, revision: (await ctx.db.get(journeyId))!.revision, stepIndex: 0 }));
  const preview = async () => owner.client.query(api.marketing.emailAudiencePreview, { slug, segment: "customers", lifecycleRule: rule, journeyStep: await ref() });
  return { t, owner, orgId, slug, report, step, input, journeyId, status, entries, ref, preview, contactId: contact.contactId };
}

it("saves a private journey; explicit tracking enrolls once without creating sends, approvals or jobs", async () => {
  const f = await fixture();
  expect(await f.entries()).toHaveLength(0);
  await f.status("active");
  await f.owner.client.mutation(api.customerJourneys.refresh, { slug: f.slug, journeyId: f.journeyId });
  expect(await f.entries()).toMatchObject([{ status: "active", dueAt: NOW, stepIndex: 0, accepted: [] }]);
  expect((await f.preview()).eligible).toBe(1);
  for (const table of ["approvals", "actionReceipts", "emailLog", "workflowRuns"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
});

it("uses exact elapsed waiting time, including its boundary, without choosing a local delivery time", async () => {
  const f = await fixture(2); await f.status("active");
  expect((await f.preview()).excluded.not_due).toBe(1);
  vi.setSystemTime(NOW + 2 * 86_400_000 - 1); expect((await f.preview()).eligible).toBe(0);
  vi.setSystemTime(NOW + 2 * 86_400_000); expect((await f.preview()).eligible).toBe(1);
  expect(journeyDueAt(NOW, 2)).toBe(NOW + 2 * 86_400_000);
  for (const n of [-1, 1.5, 366, NaN, Infinity]) expect(journeyDueAt(NOW, n)).toBeNull();
  expect(journeyDueAt(Number.MAX_SAFE_INTEGER, 1)).toBeNull();
});

it.each(["unknown", "outdated", "conflicting"] as const)("holds %s progress; a new usable report resumes the same enrollment", async kind => {
  const f = await fixture(); await f.status("active");
  await f.t.run(async ctx => {
    const r = (await ctx.db.query("contactProgress").first())!;
    const current = r.progress.current[0];
    await ctx.db.patch(r._id, { progress: { ...r.progress, current: kind === "unknown" ? [{ ...current, state: "unknown" }] : kind === "outdated" ? [{ ...current, observedOn: "2026-10-01" }] : [current, current] } });
  });
  expect((await f.preview()).eligible).toBe(0); // Final send eligibility never waits for the tracker.
  await f.owner.client.mutation(api.customerJourneys.refresh, { slug: f.slug, journeyId: f.journeyId });
  expect((await f.entries())[0].status).toBe("held");
  await f.owner.client.mutation(api.marketing.recordContactProgress, { ...f.report, expectedRevision: 1 });
  await f.owner.client.mutation(api.customerJourneys.refresh, { slug: f.slug, journeyId: f.journeyId });
  expect(await f.entries()).toMatchObject([{ status: "active", enrolledAt: NOW, dueAt: NOW }]);
});

it("exits immediately when progress changes, even while paused, and never silently re-enrolls", async () => {
  const f = await fixture(); await f.status("active"); await f.status("paused");
  await f.owner.client.mutation(api.marketing.recordContactProgress, { ...f.report, expectedRevision: 1, state: "activated" });
  expect((await f.entries())[0].status).toBe("exited");
  await f.owner.client.mutation(api.marketing.recordContactProgress, { ...f.report, expectedRevision: 2 });
  await f.status("active");
  expect((await f.entries())[0].status).toBe("exited"); expect((await f.preview()).eligible).toBe(0);
});

it.each(["withdrawn", "suppressed", "removed group", "deleted"])("exits %s contacts and final eligibility excludes them before tracking", async kind => {
  const f = await fixture(); await f.status("active");
  await f.t.run(async ctx => {
    if (kind === "withdrawn") await ctx.db.patch((await ctx.db.query("consentRecords").first())!._id, { withdrawnAt: NOW });
    if (kind === "suppressed") await ctx.db.insert("suppressions", { orgId: f.orgId, emailHash: (await ctx.db.get(f.contactId))!.emailHash, reason: "unsubscribe", source: "test", createdAt: NOW });
    if (kind === "removed group") await ctx.db.patch(f.contactId, { segments: [] });
    if (kind === "deleted") await ctx.db.patch(f.contactId, { deletedAt: NOW });
  });
  expect((await f.preview()).eligible).toBe(0);
  await f.owner.client.mutation(api.customerJourneys.refresh, { slug: f.slug, journeyId: f.journeyId });
  expect((await f.entries())[0].status).toBe("exited");
});

it("binds status revision and draft version; a paused or obsolete link never becomes an ordinary send", async () => {
  const f = await fixture(); await f.status("active"); const old = await f.ref();
  await f.status("paused");
  expect(await f.owner.client.query(api.customerJourneys.stepReview, { slug: f.slug, journey: f.journeyId, stepIndex: 0, artifactId: f.step.artifactId })).toMatchObject({ ready: false });
  await f.status("active");
  await expect(f.owner.client.query(api.marketing.emailAudiencePreview, { slug: f.slug, segment: "customers", lifecycleRule: rule, journeyStep: old })).rejects.toThrow();
  await f.t.run(ctx => ctx.db.patch(f.step.artifactId, { currentVersion: 2 }));
  await expect(f.preview()).rejects.toThrow();
});

it("never mixes tenants or grants a viewer configuration authority", async () => {
  const f = await fixture(), other = await asNewUser(f.t, "other@example.com");
  const workspace = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
  await expect(other.client.mutation(api.customerJourneys.create, { ...f.input, slug: workspace.slug })).rejects.toThrow();
  await expect(other.client.mutation(api.customerJourneys.refresh, { slug: workspace.slug, journeyId: f.journeyId })).rejects.toThrow();
  expect(await other.client.query(api.customerJourneys.stepReview, { slug: workspace.slug, journey: f.journeyId, stepIndex: 0, artifactId: f.step.artifactId })).toMatchObject({ ready: false });
  await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: other.userId, role: "viewer", status: "active", createdAt: NOW }));
  await expect(other.client.mutation(api.customerJourneys.setStatus, { slug: f.slug, journeyId: f.journeyId, revision: 1, status: "active" })).rejects.toThrow();
  expect((await other.client.query(api.customerJourneys.list, { slug: f.slug })).canManage).toBe(false);
});

it("holds tracking after owner access is removed", async () => {
  const f = await fixture(); await f.status("active");
  await f.t.run(async ctx => { const m = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", f.orgId).eq("userId", f.owner.userId)).unique())!; await ctx.db.patch(m._id, { role: "viewer" }); });
  await f.t.mutation(internal.customerJourneys.checkDue, { journeyId: f.journeyId });
  await expect(f.preview()).rejects.toThrow();
  expect((await f.t.run(ctx => ctx.db.get(f.journeyId)))?.checkError).toContain("lacks access");
});

it("fails closed on a group above the bounded contact limit rather than authorizing a sample", async () => {
  const f = await fixture();
  await f.t.run(async ctx => { for (let i = 0; i < 200; i++) await ctx.db.insert("contacts", { orgId: f.orgId, emailHash: `hash-${i}`, emailDomain: "example.com", source: "csv_import", segments: ["customers"], createdAt: NOW }); });
  await f.status("active");
  expect(await f.entries()).toEqual([]); await expect(f.preview()).rejects.toThrow(/200/);
});

it("exports follow-up records and deletes contact history during privacy erasure", async () => {
  const f = await fixture(); await f.status("active");
  const exported = JSON.parse(await f.t.query(internal.settings.exportData, { orgId: f.orgId }));
  expect(exported.customerJourneys).toHaveLength(1);
  expect(exported.journeyContacts).toHaveLength(1);
  expect(exported.customerJourneysLimited).toBe(false);
  // The public privacy flow removes enrollment and accepted-step records, not just the contact.
  await f.owner.client.mutation(api.settings.deleteContact, { slug: f.slug, email: "ana@example.com" });
  expect(await f.entries()).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.get(f.contactId))).toBeNull();
});

it("the scheduled check queues only data refreshes, never generation or provider actions", async () => {
  const f = await fixture(); await f.status("active");
  vi.setSystemTime(NOW + 16 * 60_000);
  await f.t.mutation(internal.customerJourneys.tick, {});
  const scheduled = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(scheduled.map(s => s.name)).toEqual(["customerJourneys:checkDue"]);
  for (const s of scheduled) await f.t.run(ctx => ctx.scheduler.cancel(s._id));
});

it("continues through more than one due batch without starving later journeys", async () => {
  const f = await fixture(); await f.status("active");
  await f.t.run(async ctx => {
    const { _id, _creationTime, ...record } = (await ctx.db.get(f.journeyId))!;
    for (let i = 0; i < 10; i++) await ctx.db.insert("customerJourneys", { ...record, name: `Batch ${i}` });
  });
  vi.setSystemTime(NOW + 16 * 60_000);
  await f.t.mutation(internal.customerJourneys.tick, {});
  const queued = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(queued.filter(s => s.name === "customerJourneys:checkDue")).toHaveLength(10);
  expect(queued.filter(s => s.name === "customerJourneys:tick")).toHaveLength(1);
  await f.t.mutation(internal.customerJourneys.tick, {});
  expect((await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).filter(s => s.name === "customerJourneys:checkDue")).toHaveLength(11);
  for (const s of await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())) await f.t.run(ctx => ctx.scheduler.cancel(s._id));
});
