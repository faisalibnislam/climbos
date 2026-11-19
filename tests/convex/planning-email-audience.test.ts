import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import type { AgentInput } from "../../shared/agents/types";
import type { Id } from "../../convex/_generated/dataModel";
import { RATE_VERSIONS } from "../../shared/economics/rates";
import { emailAudienceBrief } from "../../shared/growth/emailAudience";

const capture = vi.hoisted(() => ({ inputs: [] as AgentInput[] }));
vi.mock("../../shared/agents/runtime", async original => ({ ...await original<typeof import("../../shared/agents/runtime")>(), runAgent: vi.fn(async (_spec: unknown, input: AgentInput) => {
  capture.inputs.push(input);
  throw new Error("Stop at the generation boundary");
}) }));

const NOW = Date.UTC(2026, 10, 17, 12);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); capture.inputs = []; });

async function fixture() {
  const t = setup(), owner = await asNewUser(t, "audience-evidence@example.com");
  const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Audience evidence" });
  const data = await t.run(async ctx => {
    const contactId = await ctx.db.insert("contacts", { orgId, emailHash: "a".repeat(64), emailCiphertext: "encrypted", emailIv: "k1:iv", emailDomain: "example.com", source: "csv_import", segments: ["newsletter"], createdAt: NOW });
    const consentId = await ctx.db.insert("consentRecords", { orgId, contactId, purpose: "marketing_email", basis: "opt_in", source: "Signup form", evidence: "Owner-imported opt-in", capturedAt: NOW - 1000 });
    const runId = await ctx.db.insert("workflowRuns", { orgId, kind: "retention_plan", title: "Audience evidence", status: "executing", input: "{}", engine: "v2", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: RATE_VERSIONS[0].id, entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 20, researchTools: 5, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdBy: owner.userId, createdAt: NOW, updatedAt: NOW });
    return { contactId, consentId, runId };
  });
  const audience = async () => (await t.query(internal.jobWrites.jobContext, { runId: data.runId }))!.audience;
  return { t, owner, orgId, slug, ...data, audience };
}

async function followup(f: Awaited<ReturnType<typeof fixture>>, status: "active" | "paused" = "active") {
  return f.t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", f.orgId)).first())!;
    const artifactId = await ctx.db.insert("artifacts", { orgId: f.orgId, businessId: business._id, kind: "email", channel: "email", title: "Useful guidance", status: "draft", currentVersion: 1, createdAt: NOW, updatedAt: NOW });
    const artifactVersionId = await ctx.db.insert("artifactVersions", { orgId: f.orgId, artifactId, version: 1, body: "Private draft", hashtags: [], claimFactIds: [], unsupportedClaims: [], contentHash: "fixture", createdAt: NOW });
    await ctx.db.patch(artifactId, { currentVersionId: artifactVersionId });
    const journeyId = await ctx.db.insert("customerJourneys", { orgId: f.orgId, name: "Help with first export", segment: "newsletter", rule: { scope: "Export app", state: "started", criterion: "First useful export not yet observed", maxAgeDays: 7 }, steps: [{ artifactId, artifactVersionId, emailIndex: 0, delayDays: 2, title: "Useful guidance" }], status, revision: 2, createdBy: f.owner.userId, trackingOwnerId: f.owner.userId, createdAt: NOW, updatedAt: NOW, checkedAt: NOW - 60_000, nextCheckAt: NOW + 60_000 });
    await ctx.db.insert("journeyContacts", { orgId: f.orgId, journeyId, contactId: f.contactId, status: "held", stepIndex: 0, enrolledAt: NOW - 86400000, dueAt: NOW, reason: "Progress needs review", updatedAt: NOW, accepted: [] });
    return journeyId;
  });
}

it("delivers saved follow-up state to the real writer as bookkeeping, never unique customers or authorization", async () => {
  const f = await fixture(); const activeId = await followup(f); await followup(f, "paused");
  const evidence = (await f.audience()).followups!;
  expect(evidence).toMatchObject({ configurationCounts: { active: 1, paused: 1 }, enrollmentCounts: { held: 2 }, observedEnrollments: 2, coverage: "complete" });
  vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  await f.t.action(internal.jobs.simplePlanJob, { runId: f.runId, task: "retention_plan" });
  const brief = capture.inputs[0].brief;
  expect(brief).toContain("Help with first export"); expect(brief).toContain('"paused":1');
  expect(brief).toContain("not a unique customer across journeys");
  expect(brief).toContain("not customer activation, retention, delivery or revenue");
  expect(brief).toContain("not automatic reactivation");
  expect(brief).not.toContain(f.contactId); expect(brief).not.toContain("a".repeat(64));
  const step = (await f.t.run(ctx => ctx.db.query("workflowSteps").withIndex("by_run", q => q.eq("runId", f.runId)).collect())).find(s => s.index === -1)!;
  expect(JSON.parse(step.output!).progressSnapshot.followups).toEqual(evidence);
  await f.t.run(async ctx => { await ctx.db.patch(activeId, { status: "archived" }); await ctx.db.patch(f.runId, { status: "executing" }); });
  await f.t.action(internal.jobs.simplePlanJob, { runId: f.runId, task: "retention_plan" });
  expect(capture.inputs[1]).toEqual(capture.inputs[0]); // Retry keeps the original context.
  expect((await f.audience()).followups!.configurationCounts).toMatchObject({ active: 0, paused: 1, archived: 1 });
  for (const table of ["approvals", "actionReceipts", "emailLog"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});

it("keeps absent historical follow-up evidence unknown and known empty current records distinct", async () => {
  const f = await fixture(); const a = await f.audience();
  expect(a.followups).toMatchObject({ configurationCounts: { active: 0, draft: 0, paused: 0, archived: 0 }, enrollmentCounts: { active: 0, held: 0, exited: 0, completed: 0 }, coverage: "complete" });
  expect(emailAudienceBrief({ ...a, followups: undefined })).toContain("configuration and tracking history unavailable");
  expect(emailAudienceBrief(a)).not.toContain("configuration and tracking history unavailable");
});

it("does not churn channel identity on a recheck clock, while changed state and holds invalidate it", async () => {
  const f = await fixture(); const journeyId = await followup(f); const before = await f.audience();
  await f.t.run(ctx => ctx.db.patch(journeyId, { checkedAt: NOW }));
  const refreshed = await f.audience();
  expect(emailAudienceBrief(refreshed, { cacheKey: true })).toBe(emailAudienceBrief(before, { cacheKey: true }));
  expect(emailAudienceBrief(refreshed)).not.toBe(emailAudienceBrief(before));
  await f.t.run(ctx => ctx.db.patch(journeyId, { status: "paused", checkError: "Needs owner review" }));
  expect(emailAudienceBrief(await f.audience(), { cacheKey: true })).not.toBe(emailAudienceBrief(before, { cacheKey: true }));
});

it("keeps capped configuration totals unknown and discloses omitted configuration details", async () => {
  const f = await fixture(); const id = await followup(f);
  await f.t.run(async ctx => {
    const { _id, _creationTime, ...record } = (await ctx.db.get(id))!;
    for (let i = 0; i < 20; i++) await ctx.db.insert("customerJourneys", { ...record, name: `Historical follow-up ${i}` });
  });
  expect((await f.audience()).followups).toMatchObject({ configurationCounts: null, enrollmentCounts: null, observedConfigurations: 20, coverage: "partial", omittedConfigurations: null });
  expect((await f.audience()).followups!.recent).toHaveLength(5);
});

it("never presents a bounded enrollment sample as complete customer or journey totals", async () => {
  const f = await fixture(); const ids: Id<"customerJourneys">[] = [];
  for (let j = 0; j < 6; j++) ids.push(await followup(f));
  await f.t.run(async ctx => {
    for (let i = 0; i < 199; i++) {
      const contactId = await ctx.db.insert("contacts", { orgId: f.orgId, emailHash: `entry-${i}`, emailDomain: "example.com", source: "csv_import", segments: ["newsletter"], createdAt: NOW });
      for (const journeyId of ids) await ctx.db.insert("journeyContacts", { orgId: f.orgId, journeyId, contactId, status: "held", stepIndex: 0, enrolledAt: NOW, dueAt: NOW, reason: "Needs report", updatedAt: NOW, accepted: [] });
    }
  });
  expect((await f.audience()).followups).toMatchObject({ configurationCounts: { active: 6 }, enrollmentCounts: null, observedEnrollments: 1000, coverage: "partial", omittedConfigurations: 1 });
});

it("does not include another workspace's follow-up or treat an unmatched enrollment as valid coverage", async () => {
  const f = await fixture();
  const other = await asNewUser(f.t, "foreign-followup@example.com");
  const org = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Foreign follow-up" });
  const own = await followup(f);
  await f.t.run(async ctx => { await ctx.db.patch(own, { orgId: org.orgId, name: "FOREIGN PRIVATE WORKFLOW" }); });
  const evidence = (await f.audience()).followups!;
  expect(evidence).toMatchObject({ configurationCounts: { active: 0 }, enrollmentCounts: null, coverage: "partial" });
  expect(JSON.stringify(evidence)).not.toContain("FOREIGN PRIVATE WORKFLOW");
});

it.each(["deleted", "suppressed", "withdrawn", "future", "no source", "no address"] as const)("does not describe a %s contact as a ready recorded audience", async fault => {
  const f = await fixture();
  await f.t.run(async ctx => {
    if (fault === "deleted") await ctx.db.patch(f.contactId, { deletedAt: NOW });
    if (fault === "suppressed") await ctx.db.insert("suppressions", { orgId: f.orgId, emailHash: "a".repeat(64), reason: "unsubscribe", source: "owner", createdAt: NOW });
    if (fault === "withdrawn") await ctx.db.patch(f.consentId, { withdrawnAt: 0 });
    if (fault === "future") await ctx.db.patch(f.consentId, { capturedAt: NOW + 1000 });
    if (fault === "no source") await ctx.db.patch(f.consentId, { source: " " });
    if (fault === "no address") await ctx.db.patch(f.contactId, { emailCiphertext: undefined });
  });
  expect(await f.audience()).toMatchObject({ consented: 0, coverage: "complete" });
});

it("counts a live eligible person once despite multiple consent records", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const { _id: _id, _creationTime: _time, ...consent } = (await ctx.db.get(f.consentId))!;
    await ctx.db.insert("consentRecords", consent);
  });
  expect(await f.audience()).toMatchObject({ contacts: 1, consented: 1, coverage: "complete", observedAt: NOW });
  for (const table of ["approvals", "actionReceipts", "artifacts"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});

it.each(["contacts", "consentRecords", "suppressions"] as const)("keeps capped %s coverage unknown instead of inventing a complete audience", async table => {
  const f = await fixture();
  await f.t.run(async ctx => {
    for (let i = 0; i < 1001; i++) {
      if (table === "contacts") await ctx.db.insert("contacts", { orgId: f.orgId, emailHash: `history-${i}`, emailDomain: "example.com", source: "csv_import", segments: [], deletedAt: NOW, createdAt: NOW });
      if (table === "consentRecords") await ctx.db.insert("consentRecords", { orgId: f.orgId, contactId: f.contactId, purpose: "marketing_email", basis: "opt_in", source: "Old opt-in", evidence: "Owner report", capturedAt: NOW - 1000, withdrawnAt: NOW });
      if (table === "suppressions") await ctx.db.insert("suppressions", { orgId: f.orgId, emailHash: `history-${i}`, reason: "unsubscribe", source: "owner", createdAt: NOW });
    }
  });
  expect(await f.audience()).toMatchObject({ consented: null, coverage: "partial" });
});

it("does not count an orphan or another tenant's contact through a local consent record", async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.delete(f.contactId));
  expect(await f.audience()).toMatchObject({ contacts: 0, consented: 0 });
  const other = await asNewUser(f.t, "other-audience@example.com");
  const otherOrg = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other audience" });
  await f.t.run(async ctx => {
    const foreignId = await ctx.db.insert("contacts", { orgId: otherOrg.orgId, emailHash: "b".repeat(64), emailCiphertext: "encrypted", emailIv: "iv", emailDomain: "example.com", source: "csv_import", segments: [], createdAt: NOW });
    await ctx.db.patch(f.consentId, { contactId: foreignId });
  });
  expect(await f.audience()).toMatchObject({ contacts: 0, consented: 0 });
});

it("reports exactly 1,000 contact records as complete, not 1,000 or more", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    for (let i = 0; i < 999; i++) await ctx.db.insert("contacts", { orgId: f.orgId, emailHash: `contact-${i}`, emailDomain: "example.com", source: "csv_import", segments: [], createdAt: NOW });
  });
  expect(await f.audience()).toMatchObject({ contacts: 1000, consented: 1, coverage: "complete" });
});

it("preserves a proven empty local audience even if unrelated orphan consent history is capped", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    await ctx.db.delete(f.contactId);
    for (let i = 0; i < 1001; i++) await ctx.db.insert("consentRecords", { orgId: f.orgId, contactId: f.contactId, purpose: "marketing_email", basis: "opt_in", source: "Old opt-in", evidence: "Owner report", capturedAt: NOW - 1000 });
  });
  expect(await f.audience()).toMatchObject({ contacts: 0, consented: 0, coverage: "partial" });
});

it.each([false, true])("carries real audience evidence and uncertainty into generation (partial=%s)", async partial => {
  const f = await fixture();
  vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  if (partial) await f.t.run(async ctx => {
    for (let i = 0; i < 100; i++) await ctx.db.insert("consentRecords", { orgId: f.orgId, contactId: f.contactId, purpose: "marketing_email", basis: "opt_in", source: "Old permission", evidence: "Owner report", capturedAt: NOW - 1000, withdrawnAt: NOW });
  });
  await f.t.action(internal.jobs.simplePlanJob, { runId: f.runId, task: "retention_plan" });
  expect(capture.inputs).toHaveLength(1);
  expect(capture.inputs[0].constraints?.emailAudience).toBe(partial ? null : 1);
  expect(capture.inputs[0].constraints?.businessName).toBe("Audience evidence");
  expect(capture.inputs[0].brief).toContain(new Date(NOW).toISOString());
  expect(capture.inputs[0].brief).toContain(partial ? "Eligible audience unknown because coverage is incomplete" : "1 contact has recorded current marketing consent");
  expect(capture.inputs[0].brief).toContain("not independently verified permission");
  expect(capture.inputs[0].brief).toContain("sending-domain readiness remain unknown");
  for (const table of ["approvals", "actionReceipts", "artifacts"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});

it.each(["verified", "setup_required", "unknown"] as const)("passes dated %s sender evidence into the real writer input without granting authority", async state => {
  const f = await fixture();
  vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  await f.t.run(async ctx => {
    const connectionId = await ctx.db.insert("connections", { orgId: f.orgId, provider: "email_resend", status: "connected", scopes: [], isFixture: false, createdBy: f.owner.userId, createdAt: NOW, updatedAt: NOW });
    const credentialId = await ctx.db.insert("connectionSecrets", { orgId: f.orgId, connectionId, kind: "api_key", keyId: "fixture", iv: "fixture", ciphertext: "fixture", createdAt: NOW });
    await ctx.db.patch(connectionId, { emailSenderReadiness: { credentialId, report: { domain: "news.example.com", state, checkedAt: NOW - 86400000, sourceUrl: "https://api.resend.com/domains/fixture", message: "Provider observation for this domain." } } });
  });
  await f.t.action(internal.jobs.simplePlanJob, { runId: f.runId, task: "retention_plan" });
  expect(capture.inputs).toHaveLength(1);
  expect(capture.inputs[0].brief).toContain("historical provider report captured 2026-11-16T12:00:00.000Z for news.example.com");
  expect(capture.inputs[0].brief).toContain(state);
  expect(capture.inputs[0].brief).toContain("does not verify DMARC");
  expect(capture.inputs[0].brief).toContain("recheck the intended sender");
  for (const table of ["approvals", "actionReceipts", "artifacts"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});
