import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import { sha256Hex } from "../../shared/policy";
import { customerProgressEvidence, customerProgressFacts, type CustomerProgressObservation } from "../../shared/growth/customerProgress";
import { RATE_VERSIONS } from "../../shared/economics/rates";
import type { AgentInput } from "../../shared/agents/types";
const capture = vi.hoisted(() => ({ inputs: [] as AgentInput[], finish: false }));
vi.mock("../../shared/agents/runtime", async original => ({ ...await original<typeof import("../../shared/agents/runtime")>(), runAgent: vi.fn(async (_spec: unknown, input: AgentInput) => {
  capture.inputs.push(input);
  if (!capture.finish) throw new Error("Stop at generation boundary");
  const index = input.facts.findIndex(fact => fact.includes("Owner-reported customer progress"));
  const output = { segments: [{ name: "Review progress", definition: "Owner-recorded product progress", goal: "Check whether help is useful" }], plays: [{ type: "retention", name: "Review the observed obstacle", trigger: "Owner reviews the dated observation", message: "Prepare helpful guidance for review", channel: "Owner review", expansionAssessment: {
    decision: "no_expansion", offering: null, customerNeed: "Confirm the current obstacle", customerValueSignal: null,
    offerEvidenceBasis: "unknown", offerEvidenceRef: null, offerEvidenceClaim: "",
    valueEvidenceBasis: "owner_reported", valueEvidenceRef: `fact:${index}`, valueEvidenceClaim: input.facts[index],
    timingEvidenceBasis: "unknown", timingEvidenceRef: null, timingEvidenceClaim: "",
    primaryOutcome: "Customer confirms a useful next step", comparison: "Owner-recorded baseline", observationWindowDays: null,
    continueRule: "Continue if the customer confirms help is useful", stopRule: "Stop if the customer has already completed the task", ownerInputs: ["Confirm a meaningful observation window and current progress"], unknowns: ["Current state is unknown"],
  } }] };
  return { output, assessment: { ship: true, gatesPassed: true, average: 5, minimum: 5, lint: [], critique: { gates: [], criteria: [], fixes: [], strengths: [] } }, rounds: 1, history: [], research: null };
}) }));
const NOW = Date.UTC(2026, 10, 17, 12);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); capture.inputs = []; capture.finish = false; });
async function fixture() {
  const t = setup(), owner = await asNewUser(t, "progress@example.com");
  const workspace = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Progress" });
  const emailHash = await sha256Hex("ana@example.com");
  const contactId = await t.run(ctx => ctx.db.insert("contacts", { orgId: workspace.orgId, emailHash, emailDomain: "example.com", displayName: "Ana", source: "csv_import", segments: ["customers"], createdAt: NOW }));
  const input = { slug: workspace.slug, contactId, expectedRevision: 0, scope: "Desktop app", state: "activated" as const, criterion: "Completed a real export", evidence: "Owner watched the customer export a client document", observedOn: "2026-11-16" };
  const read = () => owner.client.query(api.marketing.contactProgress, { slug: workspace.slug, email: " ANA@example.com " });
  return { t, owner, ...workspace, contactId, input, read };
}
async function newRun(f: Awaited<ReturnType<typeof fixture>>) {
  return await f.t.run(ctx => ctx.db.insert("workflowRuns", { orgId: f.orgId, kind: "retention_plan", title: "Progress", status: "executing", input: "{}", engine: "v2", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: RATE_VERSIONS[0].id, entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 20, researchTools: 5, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdBy: f.owner.userId, createdAt: NOW, updatedAt: NOW }));
}
it("records an attributed historical observation without changing permission or executing work", async () => {
  const f = await fixture();
  expect((await f.read())?.progress).toEqual({ current: [], history: [], revision: 0 });
  const saved = await f.owner.client.mutation(api.marketing.recordContactProgress, f.input);
  expect(saved.current[0]).toMatchObject({ scope: "Desktop app", state: "activated", observedOn: "2026-11-16", recordedBy: f.owner.userId, recordedAt: NOW, revision: 1 });
  expect((await f.read())?.progress).toEqual(saved);
  expect((await f.owner.client.query(api.marketing.audience, { slug: f.slug })).segments[0].sendable).toBe(0);
  for (const table of ["consentRecords", "workflowRuns", "approvals", "actionReceipts", "emailLog"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  expect((await f.t.run(ctx => ctx.db.query("auditEvents").collect())).filter(e => e.action === "contact.progress_recorded")).toHaveLength(1);
});
it("keeps product scopes distinct, preserves corrections and rejects stale writes", async () => {
  const f = await fixture();
  await f.owner.client.mutation(api.marketing.recordContactProgress, f.input);
  await expect(f.owner.client.mutation(api.marketing.recordContactProgress, { ...f.input, state: "exited" })).rejects.toThrow(/changed/);
  await f.owner.client.mutation(api.marketing.recordContactProgress, { ...f.input, expectedRevision: 1, scope: "Consulting", state: "evaluating" });
  const saved = await f.owner.client.mutation(api.marketing.recordContactProgress, { ...f.input, expectedRevision: 2, scope: "  DESKTOP   APP ", state: "unknown", evidence: "Earlier export was a demo; actual customer progress is unknown" });
  expect(saved.current).toHaveLength(2);
  expect(saved.current.find(r => r.scope === "Desktop app")?.state).toBe("unknown");
  expect(saved.current.find(r => r.scope === "Consulting")?.state).toBe("evaluating");
  expect(saved.history.map(r => r.state)).toEqual(["activated", "evaluating", "unknown"]);
});
it.each(["2026-02-30", "2026-11-18", "2026-1-1", "", "1969-12-31"])("rejects invalid or future observation date %s", async observedOn => {
  const f = await fixture();
  await expect(f.owner.client.mutation(api.marketing.recordContactProgress, { ...f.input, observedOn })).rejects.toThrow(/observation date/);
  expect((await f.read())?.progress.revision).toBe(0);
});
it.each(["scope", "criterion", "evidence"] as const)("requires a meaningful %s", async field => {
  const f = await fixture();
  await expect(f.owner.client.mutation(api.marketing.recordContactProgress, { ...f.input, [field]: "  " })).rejects.toThrow();
});
it("isolates tenants and denies viewers and unauthenticated writes", async () => {
  const f = await fixture(), other = await asNewUser(f.t, "other@example.com"), viewer = await asNewUser(f.t, "viewer@example.com");
  const foreign = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
  await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: NOW }));
  await expect(other.client.query(api.marketing.contactProgress, { slug: f.slug, email: "ana@example.com" })).rejects.toThrow();
  expect(await other.client.query(api.marketing.contactProgress, { slug: foreign.slug, email: "ana@example.com" })).toBeNull();
  await expect(other.client.mutation(api.marketing.recordContactProgress, { ...f.input, slug: foreign.slug })).rejects.toThrow();
  expect((await viewer.client.query(api.marketing.contactProgress, { slug: f.slug, email: "ana@example.com" }))?.canEdit).toBe(false);
  await expect(viewer.client.mutation(api.marketing.recordContactProgress, f.input)).rejects.toThrow();
  await expect(f.t.mutation(api.marketing.recordContactProgress, f.input)).rejects.toThrow();
});
it("retains latest scope observations when old history is capped, with an inspectable total", async () => {
  const f = await fixture();
  await f.owner.client.mutation(api.marketing.recordContactProgress, f.input);
  for (let i = 1; i <= 22; i++) await f.owner.client.mutation(api.marketing.recordContactProgress, { ...f.input, expectedRevision: i, scope: "Other product", evidence: `Observation ${i}` });
  const p = (await f.read())!.progress;
  expect(p.revision).toBe(23); expect(p.history).toHaveLength(20);
  expect(p.current.find(r => r.scope === "Desktop app")?.revision).toBe(1);
});
it("deleting a contact erases its observations and prevents further updates", async () => {
  const f = await fixture(); await f.owner.client.mutation(api.marketing.recordContactProgress, f.input);
  await f.owner.client.mutation(api.settings.deleteContact, { slug: f.slug, email: "ana@example.com" });
  expect(await f.read()).toBeNull();
  expect(await f.t.run(ctx => ctx.db.get(f.contactId))).toBeNull();
  await expect(f.owner.client.mutation(api.marketing.recordContactProgress, { ...f.input, expectedRevision: 1 })).rejects.toThrow();
});
it("does not resolve duplicated or deleted contacts by guessing", async () => {
  const f = await fixture();
  await f.t.run(async ctx => { const { _id, _creationTime, ...c } = (await ctx.db.get(f.contactId))!; await ctx.db.insert("contacts", c); });
  expect(await f.read()).toBeNull();
  await f.t.run(ctx => ctx.db.patch(f.contactId, { deletedAt: NOW }));
  await expect(f.owner.client.mutation(api.marketing.recordContactProgress, f.input)).rejects.toThrow();
});
it("passes scoped dated owner reports as citable facts to the actual retention writer", async () => {
  const f = await fixture(); await f.owner.client.mutation(api.marketing.recordContactProgress, f.input);
  vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  const runId = await newRun(f);
  await f.t.action(internal.jobs.simplePlanJob, { runId, task: "retention_plan" });
  expect(capture.inputs).toHaveLength(1);
  const input = capture.inputs[0], index = input.facts.findIndex(fact => fact.includes("Owner watched the customer"));
  expect(index).toBeGreaterThanOrEqual(0);
  expect(input.constraints?.factEvidenceBases?.[index]).toBe("owner_reported");
  expect(input.constraints?.factKinds?.[index]).toBe("owner");
  expect(input.facts[index]).toContain("as of 2026-11-16");
  expect(input.brief).toContain("broadcast review can apply an owner-selected product/journey");
  expect(input.brief).toContain("not automatic enrollment or live event tracking");
  expect(input.brief).toContain("Customers → Follow-ups");
  expect(input.brief).toContain("every due step still requires the existing exact-content, recipient and destination approval");
  expect(input.brief).toContain("Missing reports mean unknown, not inactive");
  expect(input.brief).not.toContain("ana@example.com");
  for (const table of ["approvals", "actionReceipts", "artifacts"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});

const report: CustomerProgressObservation = { scope: "App", state: "activated", criterion: "Real export", evidence: "Owner watched", observedOn: "2026-11-16", recordedAt: NOW, recordedBy: "owner", revision: 1 };
it("keeps telemetry source-reported in the actual retention writer and its frozen evidence", async () => {
  const f = await fixture();
  const { token } = await f.owner.client.mutation(api.productTracking.create, { slug: f.slug, name: "Product server", scope: "Export app", mappings: [{ event: "exported", state: "activated", criterion: "Completed a real export" }] });
  expect((await f.t.fetch("/product-events", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ eventId: "event-1", event: "exported", email: "ana@example.com", occurredAt: new Date(NOW - 1000).toISOString() }) })).status).toBe(200);
  vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  const runId = await newRun(f);
  await f.t.action(internal.jobs.simplePlanJob, { runId, task: "retention_plan" });
  expect(capture.inputs).toHaveLength(1);
  const input = capture.inputs[0], index = input.facts.findIndex(f => f.startsWith("Source-reported customer progress"));
  expect(index).toBeGreaterThanOrEqual(0);
  expect(input.constraints?.factEvidenceBases?.[index]).toBe("source_reported");
  expect(input.constraints?.factKinds?.[index]).toBe("behavior");
  expect(input.facts[index]).toContain("not independently measured");
  expect(JSON.stringify(input)).not.toContain("ana@example.com");
  expect(JSON.stringify(input)).not.toContain(token);
});
const contact = (current: CustomerProgressObservation[]) => ({ customerProgress: { current, history: current, revision: current.length } });
it("keeps missing progress unknown and separates different definitions, dates and scopes", () => {
  const e = customerProgressEvidence([{}, contact([report]), contact([report]), contact([{ ...report, criterion: "First order" }]), contact([{ ...report, scope: "Other" }]), contact([{ ...report, observedOn: "2026-11-15" }])], true, NOW);
  expect(e).toMatchObject({ sampledContacts: 6, contactsWithReports: 5, contactsWithoutReports: 1, contactCoverage: "complete" });
  expect(e.groups).toHaveLength(4); expect(e.groups.find(g => g.contacts === 2)?.criterion).toBe("Real export");
  expect(customerProgressFacts(e).join(" ")).toContain("not independently measured");
});
it("reports bounded coverage and excludes invalid/future/conflicting history rather than deriving churn", () => {
  const contacts = Array.from({ length: 10 }, (_, i) => contact([{ ...report, scope: `Scope ${i}` }]));
  contacts.push(contact([{ ...report, observedOn: "2026-12-01" }]), contact([report, { ...report, state: "exited" }]));
  const e = customerProgressEvidence(contacts, false, NOW);
  expect(e).toMatchObject({ contactCoverage: "partial", omittedGroups: 2, invalidReports: 3, contactsWithoutReports: 2 });
  expect(e.groups).toHaveLength(8);
});

it("exports retained observations without contact ciphertext, and deletion removes those reports", async () => {
  const f = await fixture(); await f.owner.client.mutation(api.marketing.recordContactProgress, f.input);
  const exported = JSON.parse(await f.t.query(internal.settings.exportData, { orgId: f.orgId }));
  expect(exported.customerProgress[0].progress.current[0].state).toBe("activated");
  expect(exported.customerProgressLimited).toBe(false);
  expect(exported.customerProgress[0]).not.toHaveProperty("emailCiphertext");
  await f.owner.client.mutation(api.settings.deleteContact, { slug: f.slug, email: "ana@example.com" });
  expect(await f.t.run(ctx => ctx.db.query("contactProgress").collect())).toEqual([]);
});
it("bounds observation reads and never folds foreign or deleted contacts into planning evidence", async () => {
  const f = await fixture(); await f.owner.client.mutation(api.marketing.recordContactProgress, f.input);
  const { planningEmailAudience } = await import("../../convex/lib/marketingAudience");
  await f.t.run(ctx => ctx.db.patch(f.contactId, { deletedAt: NOW }));
  expect((await f.t.run(ctx => planningEmailAudience(ctx, f.orgId))).customerProgress?.contactsWithReports).toBe(0);
  await f.t.run(async ctx => {
    await ctx.db.patch(f.contactId, { deletedAt: undefined });
    for (let i = 0; i < 100; i++) {
      const id = await ctx.db.insert("contacts", { orgId: f.orgId, emailHash: `extra-${i}`, emailDomain: "example.com", source: "csv_import", segments: [], createdAt: NOW });
      await ctx.db.insert("contactProgress", { orgId: f.orgId, contactId: id, progress: { revision: 1, history: [], current: [{ ...report, source: undefined, recordedBy: f.owner.userId }] } });
    }
  });
  expect((await f.t.run(ctx => planningEmailAudience(ctx, f.orgId))).customerProgress).toMatchObject({ contactCoverage: "partial", sampledContacts: 101, contactsWithReports: 100, contactsWithoutReports: 1 });
  expect(JSON.parse(await f.t.query(internal.settings.exportData, { orgId: f.orgId })).customerProgressLimited).toBe(true);
});

it("purges progress with its workspace while preserving another tenant", async () => {
  const f = await fixture(); await f.owner.client.mutation(api.marketing.recordContactProgress, f.input);
  const other = await asNewUser(f.t, "preserved@example.com");
  const foreign = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Preserved" });
  const foreignId = await f.t.run(async ctx => {
    const contactId = await ctx.db.insert("contacts", { orgId: foreign.orgId, emailHash: "foreign", emailDomain: "example.com", source: "csv_import", segments: [], createdAt: NOW });
    return ctx.db.insert("contactProgress", { orgId: foreign.orgId, contactId, progress: { revision: 0, history: [], current: [] } });
  });
  await f.t.mutation(internal.settings.purgeWorkspaceBatch, { orgId: f.orgId });
  expect(await f.t.run(ctx => ctx.db.query("contactProgress").withIndex("by_org", q => q.eq("orgId", f.orgId)).collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.get(foreignId))).not.toBeNull();
});

it("freezes input and citable progress evidence across retries while a new plan uses corrections", async () => {
  const f = await fixture(); await f.owner.client.mutation(api.marketing.recordContactProgress, f.input);
  vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  const runId = await newRun(f);
  await f.t.action(internal.jobs.simplePlanJob, { runId, task: "retention_plan" });
  const first = capture.inputs[0];
  await f.owner.client.mutation(api.marketing.recordContactProgress, { ...f.input, expectedRevision: 1, state: "unknown", evidence: "Correction: the export was only a demo" });
  await f.t.run(ctx => ctx.db.patch(runId, { status: "executing" }));
  capture.finish = true;
  await f.t.action(internal.jobs.simplePlanJob, { runId, task: "retention_plan" });
  expect(capture.inputs[1]).toEqual(first);
  const run = await f.t.run(ctx => ctx.db.get(runId));
  expect(run?.status).toBe("verified");
  const saved = JSON.parse(run!.output!).customerProgressEvidence;
  expect(saved.facts[0]).toMatchObject({ basis: "owner_reported" });
  expect(saved.facts[0].statement).toContain("Owner watched the customer");
  expect(saved.facts[0].statement).not.toContain("Correction");
  const nextId = await newRun(f);
  await f.t.action(internal.jobs.simplePlanJob, { runId: nextId, task: "retention_plan" });
  expect(capture.inputs[2].facts.join(" ")).toContain("Correction: the export was only a demo");
  expect(capture.inputs[2].facts.join(" ")).not.toContain("Owner watched the customer");
});

it("does not attach new evidence to a legacy partially executed plan without its original snapshot", async () => {
  const f = await fixture(); const runId = await newRun(f); vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  await f.t.run(ctx => ctx.db.patch(runId, { used: { modelSteps: 1, researchTools: 0, repairs: 0 } }));
  await f.t.action(internal.jobs.simplePlanJob, { runId, task: "retention_plan" });
  expect(capture.inputs).toEqual([]);
  const run = await f.t.run(ctx => ctx.db.get(runId));
  expect(run?.status).toBe("failed"); expect(run?.userMessage).toContain("no saved evidence snapshot");
});
