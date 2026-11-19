import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import { sha256Hex } from "../../shared/policy";
import { customerProgressBrief, customerProgressFacts } from "../../shared/growth/customerProgress";
import { planningEmailAudience } from "../../convex/lib/marketingAudience";

const NOW = Date.UTC(2026, 10, 19, 9), DAY = 86_400_000;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
async function fixture(consent = false) {
  const t = setup(), owner = await asNewUser(t, "tracker@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Product events" });
  await owner.client.action(api.marketing.importContacts, { slug, csv: `email,consent,consent_source,consent_date,segment\nana@example.com,${consent ? "yes,signup,2026-11-18" : "no,,"},customers` });
  const config = { slug, name: "App server", scope: "Export app", mappings: [{ event: "signup", state: "started" as const, criterion: "Account created" }, { event: "real_export", state: "activated" as const, criterion: "Exported a real document" }] };
  const { token, sourceId } = await owner.client.mutation(api.productTracking.create, config);
  const body = { eventId: "event-1", email: "ANA@example.com", event: "signup", occurredAt: new Date(NOW - 1000).toISOString() };
  const post = (patch = {}, key = token) => t.fetch("/product-events", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ ...body, ...patch }) });
  const read = () => owner.client.query(api.marketing.contactProgress, { slug, email: "ana@example.com" });
  const contactId = (await read())!.contactId;
  return { t, owner, slug, orgId, sourceId, token, config, body, post, read, contactId };
}

it("receives a source-labeled milestone over HTTP, never granting consent or executing work", async () => {
  const f = await fixture(); const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("External calls disabled"));
  const r = await f.post(); expect(r.status).toBe(200); expect(await r.json()).toEqual({ result: "applied", duplicate: false });
  expect((await f.read())!.progress.current[0]).toMatchObject({ state: "started", source: { id: f.sourceId, name: "App server", event: "signup", occurredAt: NOW - 1000 }, observedOn: "2026-11-19" });
  expect((await f.owner.client.query(api.marketing.emailAudiencePreview, { slug: f.slug, segment: "customers" })).eligible).toBe(0);
  for (const table of ["consentRecords", "approvals", "actionReceipts", "emailLog", "workflowRuns", "journeyContacts"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
  const rows = await f.t.run(ctx => ctx.db.query("productEvents").collect());
  expect(JSON.stringify(rows)).not.toMatch(/ana@example.com|event-1|climb_events_/i);
  expect(fetch).not.toHaveBeenCalled();
});
it("deduplicates retries and rejects conflicting reuse of an event ID", async () => {
  const f = await fixture(); await f.post();
  expect(await (await f.post()).json()).toEqual({ result: "applied", duplicate: true });
  expect((await f.post({ event: "real_export" })).status).toBe(409);
  expect((await f.read())!.progress.revision).toBe(1);
  expect(await f.t.run(ctx => ctx.db.query("productEvents").collect())).toHaveLength(1);
  vi.setSystemTime(NOW + 8 * DAY); expect((await f.post()).status).toBe(200); // unchanged retry while receipt remains
});
it("orders reports by event time, normalizes explicit offsets and holds simultaneous conflicting milestones", async () => {
  const f = await fixture(); await f.post({ event: "real_export", occurredAt: "2026-11-19T15:00:00+06:00" });
  expect((await f.read())!.progress.current[0].source!.occurredAt).toBe(NOW);
  expect(await (await f.post({ eventId: "older" })).json()).toMatchObject({ result: "older" });
  expect((await f.read())!.progress.current[0].state).toBe("activated");
  expect(await (await f.post({ eventId: "same-time", occurredAt: new Date(NOW).toISOString() })).json()).toMatchObject({ result: "conflict" });
  expect((await f.read())!.progress.current[0].state).toBe("unknown");
  expect((await f.owner.client.query(api.marketing.emailAudiencePreview, { slug: f.slug, segment: "customers", includeProgressOptions: true })).progressOptions).toEqual([]);
  vi.setSystemTime(NOW + 1);
  await f.post({ eventId: "later", event: "real_export", occurredAt: new Date(NOW + 1).toISOString() });
  expect((await f.read())!.progress.current[0].state).toBe("activated");
});
it("keeps owner corrections, even Unknown, instead of letting telemetry overwrite them", async () => {
  const f = await fixture(); await f.post();
  await f.owner.client.mutation(api.marketing.recordContactProgress, { slug: f.slug, contactId: f.contactId, expectedRevision: 1, scope: " EXPORT APP ", state: "unknown", criterion: "Check whether the export is real", evidence: "Owner found demo data", observedOn: "2026-11-19" });
  expect(await (await f.post({ eventId: "second", event: "real_export", occurredAt: new Date(NOW).toISOString() })).json()).toMatchObject({ result: "owner_override" });
  const p = (await f.read())!.progress;
  expect(p.current[0].state).toBe("unknown"); expect(p.current[0].source).toBeUndefined(); expect(p.revision).toBe(2);
  expect(p.history[0].source!.id).toBe(f.sourceId);
});
it("resumes only explicitly selected future events, preserving the correction and rejecting queued old state", async () => {
  const f = await fixture(true); await f.post();
  await f.owner.client.mutation(api.marketing.recordContactProgress, { slug: f.slug, contactId: f.contactId, expectedRevision: 1, scope: f.config.scope, state: "unknown", criterion: "Check a suspected demo export", evidence: "Owner correction", observedOn: "2026-11-19" });
  const args = { slug: f.slug, sourceId: f.sourceId, contactId: f.contactId, expectedRevision: 2 };
  const selected = await f.owner.client.mutation(api.productTracking.useFutureEvents, args);
  expect(selected.current[0]).toMatchObject({ state: "unknown", tracking: { sourceId: f.sourceId, after: NOW } });
  expect(selected.current[0]).not.toHaveProperty("source");
  expect(selected.history[1].evidence).toBe("Owner correction");
  await expect(f.owner.client.mutation(api.productTracking.useFutureEvents, args)).rejects.toThrow(/changed/);
  await expect(f.owner.client.mutation(api.productTracking.useFutureEvents, { ...args, expectedRevision: 3 })).rejects.toThrow(/already waiting/);
  expect(await (await f.post({ eventId: "delayed", event: "real_export", occurredAt: new Date(NOW).toISOString() })).json()).toMatchObject({ result: "older" });
  expect((await f.read())!.progress.current[0].state).toBe("unknown");
  vi.setSystemTime(NOW + 1000);
  await f.post({ eventId: "new-value", event: "real_export", occurredAt: new Date(NOW + 1).toISOString() });
  const current = (await f.read())!.progress.current[0];
  expect(current.state).toBe("activated"); expect(current.source?.id).toBe(f.sourceId); expect(current.tracking).toBeUndefined();
  for (const table of ["approvals", "actionReceipts", "emailLog", "workflowRuns"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});
it("requires a current manual observation, matching tenant scope, available source and manage permission to resume", async () => {
  const f = await fixture(), viewer = await asNewUser(f.t, "viewer@example.com"), other = await asNewUser(f.t, "other@example.com");
  const foreign = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
  await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: NOW }));
  const args = { slug: f.slug, sourceId: f.sourceId, contactId: f.contactId, expectedRevision: 0 };
  await expect(f.owner.client.mutation(api.productTracking.useFutureEvents, args)).rejects.toThrow();
  await f.post();
  await expect(f.owner.client.mutation(api.productTracking.useFutureEvents, { ...args, expectedRevision: 1 })).rejects.toThrow(/manual observation/);
  await f.owner.client.mutation(api.marketing.recordContactProgress, { slug: f.slug, contactId: f.contactId, expectedRevision: 1, scope: f.config.scope, state: "unknown", criterion: "Needs review", evidence: "Owner correction", observedOn: "2026-11-19" });
  for (const client of [viewer.client, f.t]) await expect(client.mutation(api.productTracking.useFutureEvents, { ...args, expectedRevision: 2 })).rejects.toThrow();
  await expect(other.client.mutation(api.productTracking.useFutureEvents, { ...args, slug: foreign.slug, expectedRevision: 2 })).rejects.toThrow();
  const different = await f.owner.client.mutation(api.productTracking.create, { ...f.config, scope: "Another product" });
  await expect(f.owner.client.mutation(api.productTracking.useFutureEvents, { ...args, sourceId: different.sourceId, expectedRevision: 2 })).rejects.toThrow();
  await f.owner.client.mutation(api.productTracking.revoke, { slug: f.slug, sourceId: f.sourceId });
  await expect(f.owner.client.mutation(api.productTracking.useFutureEvents, { ...args, expectedRevision: 2 })).rejects.toThrow(/unavailable/);
  expect((await f.read())!.progress.revision).toBe(2);
});
it("allows replacing a revoked waiting source but never removes a subsequent manual override", async () => {
  const f = await fixture();
  const report = { slug: f.slug, contactId: f.contactId, expectedRevision: 0, scope: f.config.scope, state: "unknown" as const, criterion: "Not yet known", evidence: "Owner is checking", observedOn: "2026-11-19" };
  await f.owner.client.mutation(api.marketing.recordContactProgress, report);
  await f.owner.client.mutation(api.productTracking.useFutureEvents, { slug: f.slug, contactId: f.contactId, sourceId: f.sourceId, expectedRevision: 1 });
  await f.owner.client.mutation(api.productTracking.revoke, { slug: f.slug, sourceId: f.sourceId });
  const replacement = await f.owner.client.mutation(api.productTracking.create, f.config);
  await f.owner.client.mutation(api.productTracking.useFutureEvents, { slug: f.slug, contactId: f.contactId, sourceId: replacement.sourceId, expectedRevision: 2 });
  expect((await f.read())!.progress.current[0].tracking?.sourceId).toBe(replacement.sourceId);
  await f.owner.client.mutation(api.marketing.recordContactProgress, { ...report, expectedRevision: 3 });
  vi.setSystemTime(NOW + 1000);
  expect(await (await f.post({ occurredAt: new Date(NOW + 1).toISOString() }, replacement.token)).json()).toMatchObject({ result: "owner_override" });
  expect((await f.read())!.progress.current[0].tracking).toBeUndefined();
});
it.each([
  { occurredAt: "2026-11-19T09:00:00" }, { occurredAt: "2026-02-30T00:00:00Z" },
  { occurredAt: new Date(NOW + 1).toISOString() }, { occurredAt: new Date(NOW - 7 * DAY - 1).toISOString() },
  { event: "not_configured" }, { email: "not an email" }, { eventId: "" }, { eventId: "x".repeat(129) },
  { properties: { sensitive: "unneeded" } }, { orgId: "another_tenant" }, { scope: "another_product" },
])("rejects malformed, unsupported or extra input %j", async patch => {
  const f = await fixture(); expect((await f.post(patch)).status).toBe(400);
  expect((await f.read())!.progress.revision).toBe(0);
});
it("enforces actual body size, JSON type and dedicated credentials", async () => {
  const f = await fixture();
  expect((await f.t.fetch("/product-events", { method: "POST", headers: { authorization: `Bearer ${f.token}`, "content-type": "application/json" }, body: " ".repeat(4097) })).status).toBe(413);
  expect((await f.t.fetch("/product-events", { method: "POST", headers: { authorization: `Bearer ${f.token}` }, body: JSON.stringify(f.body) })).status).toBe(415);
  expect((await f.post({}, "climb_" + "a".repeat(64))).status).toBe(401);
  expect((await f.post({}, "climb_events_" + "a".repeat(64))).status).toBe(401);
});
it("isolates identical emails between tenants; tokens never choose or create a tenant/contact", async () => {
  const f = await fixture(), other = await asNewUser(f.t, "other@example.com");
  const foreign = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
  const { token } = await other.client.mutation(api.productTracking.create, { ...f.config, slug: foreign.slug });
  expect((await f.post({}, token)).status).toBe(422);
  await other.client.action(api.marketing.importContacts, { slug: foreign.slug, csv: "email,segment\nana@example.com,customers" });
  expect((await f.post({}, token)).status).toBe(200);
  expect((await f.read())!.progress.revision).toBe(0);
  await expect(other.client.mutation(api.productTracking.revoke, { slug: foreign.slug, sourceId: f.sourceId })).rejects.toThrow();
  await expect(other.client.query(api.productTracking.list, { slug: f.slug })).rejects.toThrow();
  expect((await f.post({ email: "unknown@example.com" })).status).toBe(422);
  expect(await f.t.run(ctx => ctx.db.query("contacts").collect())).toHaveLength(2);
});
it.each(["revoked", "expired", "removed member", "demoted member", "suspended", "deleted", "emergency stop"])("stops even duplicate ingestion when %s", async change => {
  const f = await fixture(); await f.post();
  await f.t.run(async ctx => {
    const member = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", f.orgId).eq("userId", f.owner.userId)).unique())!;
    if (change === "revoked") await ctx.db.patch(f.sourceId, { revokedAt: NOW });
    if (change === "expired") await ctx.db.patch(f.sourceId, { expiresAt: NOW });
    if (change === "removed member") await ctx.db.delete(member._id);
    if (change === "demoted member") await ctx.db.patch(member._id, { role: "viewer" });
    if (change === "suspended") await ctx.db.patch(f.orgId, { suspendedAt: NOW });
    if (change === "deleted") await ctx.db.patch(f.orgId, { deletedAt: NOW });
    if (change === "emergency stop") await ctx.db.patch(f.orgId, { emergencyStop: { active: true, at: NOW, by: f.owner.userId } });
  });
  expect((await f.post()).status).toBe(401);
});
it("requires manage permission and stores only a digest; rotating invalidates the previous key", async () => {
  const f = await fixture(), viewer = await asNewUser(f.t, "viewer@example.com");
  await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: NOW }));
  for (const client of [viewer.client, f.t]) await expect(client.mutation(api.productTracking.create, f.config)).rejects.toThrow();
  await expect(viewer.client.mutation(api.productTracking.rotate, { slug: f.slug, sourceId: f.sourceId })).rejects.toThrow();
  expect(JSON.stringify(await viewer.client.query(api.productTracking.list, { slug: f.slug }))).not.toContain(await sha256Hex(f.token));
  const stored = (await f.t.run(ctx => ctx.db.get(f.sourceId)))!;
  expect(stored.tokenHash).toBe(await sha256Hex(f.token)); expect(JSON.stringify(stored)).not.toContain(f.token);
  const next = await f.owner.client.mutation(api.productTracking.rotate, { slug: f.slug, sourceId: f.sourceId });
  expect((await f.post()).status).toBe(401); expect((await f.post({}, next.token)).status).toBe(200);
  await f.owner.client.mutation(api.productTracking.revoke, { slug: f.slug, sourceId: f.sourceId });
  await expect(f.owner.client.mutation(api.productTracking.rotate, { slug: f.slug, sourceId: f.sourceId })).rejects.toThrow();
  expect((await f.post({}, next.token)).status).toBe(401);
});
it("keeps immutable definitions and bounds source and event mapping counts", async () => {
  const f = await fixture();
  await expect(f.owner.client.mutation(api.productTracking.create, { ...f.config, scope: " EXPORT  APP " })).rejects.toThrow(/Revoke/);
  for (const mappings of [[], [f.config.mappings[0], f.config.mappings[0]], [{ ...f.config.mappings[0], criterion: " " }], [{ ...f.config.mappings[0], event: "bad name" }], Array(9).fill(f.config.mappings[0])]) await expect(f.owner.client.mutation(api.productTracking.create, { ...f.config, scope: "Other", mappings })).rejects.toThrow();
  await f.owner.client.mutation(api.productTracking.revoke, { slug: f.slug, sourceId: f.sourceId });
  await f.owner.client.mutation(api.productTracking.create, f.config);
  for (let i = 2; i < 20; i++) await f.owner.client.mutation(api.productTracking.create, { ...f.config, scope: `Product ${i}` });
  await expect(f.owner.client.mutation(api.productTracking.create, { ...f.config, scope: "Over limit" })).rejects.toThrow(/20-source/);
});
it("rate limits retries and stops when the bounded receipt store is full", async () => {
  const f = await fixture(); await f.post();
  await f.t.run(ctx => ctx.db.patch(f.sourceId, { rateMinute: Math.floor(NOW / 60_000), rateCount: 120 }));
  expect((await f.post()).status).toBe(429);
  vi.setSystemTime(NOW + 60_000); expect((await f.post()).status).toBe(200);
  await f.t.run(async ctx => { const { _id, _creationTime, ...row } = (await ctx.db.query("productEvents").first())!; for (let i = 1; i < 1000; i++) await ctx.db.insert("productEvents", { ...row, eventIdHash: await sha256Hex(`fixture-${i}`) }); });
  expect(await (await f.post({ eventId: "full" })).json()).toMatchObject({ result: "workspace_receipt_limit" });
  expect((await f.read())!.progress.revision).toBe(1);
});
it("exports attributable history without keys and erases receipts and observations with a contact", async () => {
  const f = await fixture(); await f.post();
  const exported = JSON.parse(await f.t.query(internal.settings.exportData, { orgId: f.orgId }));
  expect(exported.productEvents).toHaveLength(1); expect(exported.productTrackingSources).toHaveLength(1);
  expect(JSON.stringify(exported)).not.toContain(await sha256Hex(f.token));
  await f.owner.client.mutation(api.settings.deleteContact, { slug: f.slug, email: "ana@example.com" });
  expect(await f.read()).toBeNull(); expect(await f.t.run(ctx => ctx.db.query("productEvents").collect())).toEqual([]);
  expect((await f.post()).status).toBe(422);
  await f.owner.client.action(api.marketing.importContacts, { slug: f.slug, csv: "email,segment\nana@example.com,customers" });
  expect((await f.post()).status).toBe(422); // deletion suppression prevents re-creating erased telemetry
});
it("expires receipt history without inferring new activity or allowing old events to replay", async () => {
  const f = await fixture(); await f.post(); vi.setSystemTime(NOW + 31 * DAY);
  await f.t.mutation(internal.productTracking.cleanup, {});
  expect(await f.t.run(ctx => ctx.db.query("productEvents").collect())).toEqual([]);
  expect((await f.read())!.progress.revision).toBe(1);
  expect((await f.post()).status).toBe(400);
});
it("feeds source-labeled dated evidence to planning without contact identities or inferred rates", async () => {
  const f = await fixture(); await f.post();
  const snapshot = await f.t.run(ctx => planningEmailAudience(ctx, f.orgId));
  expect(snapshot.customerProgress?.groups[0].basis).toBe("source_reported");
  expect(customerProgressFacts(snapshot.customerProgress)[0]).toContain("Source-reported customer progress");
  expect(customerProgressBrief(snapshot.customerProgress)).toContain("Missing reports mean unknown");
  expect(JSON.stringify(snapshot)).not.toContain("ana@example.com");
});
it("changes final review identity and exits an existing follow-up without sending or creating approval", async () => {
  const f = await fixture(true); await f.post();
  const rule = { scope: f.config.scope, state: "started" as const, criterion: "Account created", maxAgeDays: 7 };
  const before = await f.owner.client.query(api.marketing.emailAudiencePreview, { slug: f.slug, segment: "customers", lifecycleRule: rule });
  expect(before.eligible).toBe(1);
  const journeyId = await f.t.run(async ctx => {
    const businessId = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", f.orgId)).first())!._id;
    const artifactId = await ctx.db.insert("artifacts", { orgId: f.orgId, businessId, kind: "email", channel: "email", title: "Help", status: "approved", currentVersion: 1, createdAt: NOW, updatedAt: NOW });
    const artifactVersionId = await ctx.db.insert("artifactVersions", { orgId: f.orgId, artifactId, version: 1, headline: "Help", body: "Helpful draft", hashtags: [], claimFactIds: [], unsupportedClaims: [], contentHash: "fixture", createdAt: NOW });
    await ctx.db.patch(artifactId, { currentVersionId: artifactVersionId });
    return await ctx.db.insert("customerJourneys", { orgId: f.orgId, name: "Help", segment: "customers", rule, steps: [{ artifactId, artifactVersionId, emailIndex: 0, delayDays: 0, title: "Help" }], status: "active", revision: 1, createdBy: f.owner.userId, trackingOwnerId: f.owner.userId, createdAt: NOW, updatedAt: NOW, nextCheckAt: NOW });
  });
  await f.owner.client.mutation(api.customerJourneys.refresh, { slug: f.slug, journeyId });
  expect((await f.t.run(ctx => ctx.db.query("journeyContacts").first()))!.status).toBe("active");
  await f.post({ eventId: "value", event: "real_export", occurredAt: new Date(NOW).toISOString() });
  expect((await f.t.run(ctx => ctx.db.query("journeyContacts").first()))!.status).toBe("exited");
  const after = await f.owner.client.query(api.marketing.emailAudiencePreview, { slug: f.slug, segment: "customers", lifecycleRule: rule });
  expect(after.eligible).toBe(0); expect(after.previewHash).not.toBe(before.previewHash);
  expect(await f.owner.client.query(api.marketing.emailRecipientReview, { slug: f.slug, segment: "customers", lifecycleRule: rule, previewHash: before.previewHash, offset: 0 })).toMatchObject({ ready: false });
  for (const table of ["approvals", "actionReceipts", "emailLog", "workflowRuns"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});
