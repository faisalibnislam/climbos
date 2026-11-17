import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import type { AgentInput } from "../../shared/agents/types";
import { RATE_VERSIONS } from "../../shared/economics/rates";

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
