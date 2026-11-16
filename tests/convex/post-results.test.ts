import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { RATE_VERSIONS } from "../../shared/economics/rates";
import { asNewUser, setup } from "./helpers";
import type { AgentInput } from "../../shared/agents/types";
const captured = vi.hoisted(() => ({ inputs: [] as AgentInput[] }));
vi.mock("../../shared/agents/runtime", async original => ({
  ...await original<typeof import("../../shared/agents/runtime")>(),
  runAgent: vi.fn(async (_spec: unknown, input: AgentInput) => { captured.inputs.push(input); throw new Error("Stopped at generation boundary"); }),
}));
const now = Date.parse("2026-11-16T12:00:00Z");
const day = 86400000;
async function seed() {
  const t = setup(), owner = await asNewUser(t, "post-owner@example.com");
  const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Observed posts" });
  const ids = await t.run(async ctx => {
    await ctx.db.patch(orgId, { timezone: "Asia/Dhaka" });
    const business = await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first();
    const artifactId = await ctx.db.insert("artifacts", { orgId, businessId: business!._id, kind: "social_post", channel: "linkedin", title: "Measured post", status: "published", currentVersion: 1, createdAt: now - 7*day, updatedAt: now - 7*day });
    const versionId = await ctx.db.insert("artifactVersions", { orgId, artifactId, version: 1, body: "Useful customer answer", hashtags: [], claimFactIds: [], unsupportedClaims: [], contentHash: "post-hash", createdAt: now - 7*day });
    await ctx.db.patch(artifactId, { currentVersionId: versionId });
    await ctx.db.insert("autopilotSettings", { orgId, enabled: false, mode: "always_ask", channels: [{ channel: "linkedin", postsPerWeek: 1 }], postingHours: [12], alwaysAskTopics: [], imagesPerWeek: 0, trust: [], updatedBy: owner.userId, createdAt: now, updatedAt: now });
    const runId = await ctx.db.insert("workflowRuns", { orgId, kind: "social_calendar", title: "Observe without action", status: "executing", input: "{}", engine: "v2", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: RATE_VERSIONS[0].id, entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 10, researchTools: 5, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdBy: owner.userId, createdAt: now, updatedAt: now });
    const slotId = await ctx.db.insert("calendarSlots", { orgId, artifactId, weekOf: "2026-11-09", channel: "linkedin", day: 1, slotAt: now-day, pillar: "Explain", purpose: "teach", format: "text", idea: "Answer a customer question", angle: "Useful answer", hookDraft: "A question", callToAction: "Read", needsOwner: true, status: "published", createdAt: now-day, updatedAt: now-day });
    return { artifactId, versionId, runId, slotId };
  });
  return { t, owner, orgId, slug, ...ids, args: { slug, artifactId: ids.artifactId, versionId: ids.versionId, contentHash: "post-hash", expectedLatestReportId: null, fromDate: "2026-11-14", toDate: "2026-11-15", measurementNote: "Owner analytics report; qualified means matching service location." } };
}

describe("version-bound social post observations", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); captured.inputs.length = 0; });
  it("records explicit zero, preserves blanks, feeds the planner and executes nothing", async () => {
    const f = await seed();
    const before = await f.t.run(async ctx => ({ artifacts: await ctx.db.query("artifacts").collect(), runs: await ctx.db.query("workflowRuns").collect() }));
    await f.owner.client.mutation(api.postResults.record, { ...f.args, qualifiedVisits: 12, payingCustomers: 0, likes: 90 });
    const view = await f.owner.client.query(api.postResults.view, { slug: f.slug, artifactId: f.artifactId });
    expect(view.issue).toBeNull();
    expect(view.report).toMatchObject({ source: "owner", payingCustomers: 0, qualifiedVisits: 12, artifactVersionNumber: 1, artifactVersionId: f.versionId });
    expect(view.report?.signups).toBeUndefined();
    const pc = await f.t.query(internal.autopilot.planningContext, { runId: f.runId, weekOf: "2026-11-16", fromDay: 0 });
    expect(pc?.history).toContain("MEMBER-REPORTED");
    expect(pc?.history).toContain("2026-11-14 through 2026-11-15 (Asia/Dhaka)");
    expect(pc?.history).toContain("Qualified visits: 12; Signups: unknown; Paying customers: 0");
    expect(pc?.history).toContain("not customers or revenue");
    expect(await f.t.run(async ctx => ({ artifacts: await ctx.db.query("artifacts").collect(), runs: await ctx.db.query("workflowRuns").collect() }))).toEqual(before);
    for (const table of ["approvals", "actionReceipts"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
    expect((await f.t.run(ctx => ctx.db.query("auditEvents").collect())).some(row => row.action === "post.results_recorded")).toBe(true);
  });
  it("supplies a manual post report to the actual calendar generation job", async () => {
    const f = await seed(); vi.stubEnv("CLIMBOS_FAKE_LLM", "");
    await f.t.run(ctx => ctx.db.delete(f.slotId));
    await f.owner.client.mutation(api.postResults.record, { ...f.args, qualifiedVisits: 17 });
    await f.t.action(internal.jobs.planSocialWeek, { runId: f.runId, weekOf: "2026-11-16", fromDay: 1 });
    expect(captured.inputs).toHaveLength(1);
    expect(captured.inputs[0].task).toContain("Qualified visits: 17; Signups: unknown");
    expect(captured.inputs[0].task).toContain(f.args.measurementNote);
    expect(captured.inputs[0].task).toContain("Useful customer answer");
    expect(captured.inputs[0].task).toContain("not instructions");
    expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  });
  it.each(["manual", "older_slot"] as const)("learns a recent report for a %s post and includes its exact text once", async kind => {
    const f = await seed();
    await f.t.run(ctx => kind === "manual" ? ctx.db.delete(f.slotId) : ctx.db.patch(f.slotId, { slotAt: now - 40*day }));
    await f.owner.client.mutation(api.postResults.record, { ...f.args, qualifiedVisits: 19, payingCustomers: 0 });
    const pc = await f.t.query(internal.autopilot.planningContext, { runId: f.runId, weekOf: "2026-11-16", fromDay: 1 });
    expect(pc?.history).toContain("Qualified visits: 19");
    expect(pc?.history).toContain("Useful customer answer");
    expect(pc?.history?.match(/Qualified visits: 19/g)).toHaveLength(1);
  });
  it("counts corrected reports once and discloses the report-row read cap", async () => {
    const f = await seed();
    const latest = await f.owner.client.mutation(api.postResults.record, { ...f.args, qualifiedVisits: 23 });
    await f.t.run(async ctx => {
      const { _id, _creationTime, ...report } = (await ctx.db.get(latest.id))!; void _id; void _creationTime;
      for (let i=0; i<122; i++) await ctx.db.insert("postMetrics", { ...report, capturedAt: now - 2000 + i, qualifiedVisits: 98 });
    });
    const pc = await f.t.query(internal.autopilot.planningContext, { runId: f.runId, weekOf: "2026-11-16", fromDay: 1 });
    expect(pc?.history).toContain("newest 120 report rows");
    expect(pc?.history?.match(/Qualified visits: 23/g)).toHaveLength(1);
    expect(pc?.history).not.toContain("Qualified visits: 98");
  });
  it.each([-29 * day, day])("excludes reports outside the recent nonfuture window: %s", async offset => {
    const f = await seed();
    const report = await f.owner.client.mutation(api.postResults.record, { ...f.args, qualifiedVisits: 27 });
    await f.t.run(async ctx => { await ctx.db.delete(f.slotId); await ctx.db.patch(report.id, { capturedAt: now + offset }); });
    const pc = await f.t.query(internal.autopilot.planningContext, { runId: f.runId, weekOf: "2026-11-16", fromDay: 1 });
    expect(pc?.history).toBe("");
  });
  it("never follows a report reference into another workspace's post", async () => {
    const f = await seed();
    const secondOwner = await asNewUser(f.t, "separate-post-owner@example.com");
    const other = await secondOwner.client.mutation(api.orgs.createWorkspace, { businessName: "Separate private workspace" });
    await f.t.run(ctx => ctx.db.insert("memberships", { orgId: other.orgId, userId: f.owner.userId, role: "editor", status: "active", createdAt: now }));
    const foreignId = await f.t.run(async ctx => {
      await ctx.db.delete(f.slotId);
      const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", other.orgId)).first())!;
      const artifactId = await ctx.db.insert("artifacts", { orgId: other.orgId, businessId: business._id, kind: "social_post", channel: "linkedin", title: "FOREIGN PRIVATE TITLE", status: "published", currentVersion: 1, createdAt: now-day, updatedAt: now });
      await ctx.db.insert("postMetrics", { orgId: f.orgId, artifactId, source: "owner", channel: "linkedin", capturedAt: now, measurementNote: "FOREIGN PRIVATE METHOD", qualifiedVisits: 987 });
      return artifactId;
    });
    const pc = await f.t.query(internal.autopilot.planningContext, { runId: f.runId, weekOf: "2026-11-16", fromDay: 1 });
    expect(pc?.history).toContain("1 report references were unavailable");
    expect(pc?.history).not.toMatch(/FOREIGN PRIVATE|987/);
    await expect(f.owner.client.query(api.postResults.view, { slug: f.slug, artifactId: foreignId })).rejects.toThrow();
  });
  it("prioritizes a newly reported manual post before a full calendar history", async () => {
    const f = await seed();
    await f.owner.client.mutation(api.postResults.record, { ...f.args, qualifiedVisits: 29 });
    await f.t.run(async ctx => {
      const { _id, _creationTime, artifactId, ...slot } = (await ctx.db.get(f.slotId))!; void _id; void _creationTime; void artifactId;
      await ctx.db.delete(f.slotId);
      for (let i=0; i<122; i++) await ctx.db.insert("calendarSlots", { ...slot, slotAt: now-i*1000, idea: `Unreported slot ${i}` });
    });
    const pc = await f.t.query(internal.autopilot.planningContext, { runId: f.runId, weekOf: "2026-11-16", fromDay: 1 });
    expect(pc?.history).toContain("Qualified visits: 29");
    expect(pc?.history).toContain("records omitted");
    expect(pc?.history).toContain("Original calendar intent and audience are unknown");
  });
  it.each(["legacy", "fixture", "future", "foreign", "channel"] as const)("withholds %s evidence from planning without falling back", async kind => {
    const f = await seed();
    const first = await f.owner.client.mutation(api.postResults.record, { ...f.args, signups: 33 });
    vi.setSystemTime(now+1000);
    const second = await f.owner.client.mutation(api.postResults.record, { ...f.args, expectedLatestReportId: first.id, signups: 44 });
    const outsider = await asNewUser(f.t, "foreign-report@example.com");
    const other = await outsider.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
    await f.t.run(ctx => ctx.db.patch(second.id, kind === "legacy" ? { artifactVersionId: undefined, measurementNote: undefined } : kind === "fixture" ? { source: "fixture" } : kind === "future" ? { capturedAt: now+100000 } : kind === "foreign" ? { orgId: other.orgId, measurementNote: "FOREIGN PRIVATE METHOD" } : { channel: "facebook" }));
    const pc = await f.t.query(internal.autopilot.planningContext, { runId: f.runId, weekOf: "2026-11-16", fromDay: 1 });
    expect(pc?.history).toContain("Latest post report not used");
    expect(pc?.history).not.toMatch(/Signups: (33|44)|FOREIGN PRIVATE METHOD/);
    const view = await f.owner.client.query(api.postResults.view, { slug: f.slug, artifactId: f.artifactId });
    expect(view.issue).toBeTruthy();
    if (kind === "foreign" || kind === "channel") expect(view.report).toBeNull();
  });
  it("preserves corrections, rejects stale saves, and does not revive an old report", async () => {
    const f = await seed();
    const first = await f.owner.client.mutation(api.postResults.record, { ...f.args, signups: 5 });
    vi.setSystemTime(now+1000);
    const second = await f.owner.client.mutation(api.postResults.record, { ...f.args, expectedLatestReportId: first.id, signups: 2 });
    await expect(f.owner.client.mutation(api.postResults.record, { ...f.args, signups: 900 })).rejects.toThrow("newer report");
    const history = await f.owner.client.query(api.postResults.history, { slug: f.slug, artifactId: f.artifactId, paginationOpts: { numItems: 1, cursor: null } });
    expect(history.page.map(row => row.signups)).toEqual([2]); expect(history.isDone).toBe(false);
    await f.t.run(ctx => ctx.db.patch(second.id, { contentHash: "different" }));
    const pc = await f.t.query(internal.autopilot.planningContext, { runId: f.runId, weekOf: "2026-11-16", fromDay: 0 });
    expect(pc?.history).toContain("Latest post report not used"); expect(pc?.history).not.toContain("Signups: 5");
    expect((await f.owner.client.query(api.postResults.view, { slug: f.slug, artifactId: f.artifactId })).issue).toContain("exact content version");
  });
  it("enforces membership, role, tenant, version and publication checks", async () => {
    const f = await seed(), outsider = await asNewUser(f.t, "outside@example.com");
    for (const endpoint of [api.postResults.view, api.postResults.history]) await expect(outsider.client.query(endpoint, { slug: f.slug, artifactId: f.artifactId, ...(endpoint === api.postResults.history ? { paginationOpts: { numItems: 5, cursor: null } } : {}) })).rejects.toThrow();
    await expect(outsider.client.mutation(api.postResults.record, f.args)).rejects.toThrow();
    await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: outsider.userId, role: "viewer", status: "active", createdAt: now }));
    await expect(outsider.client.mutation(api.postResults.record, f.args)).rejects.toThrow();
    await expect(f.owner.client.mutation(api.postResults.record, { ...f.args, contentHash: "stale" })).rejects.toThrow("version changed");
    await f.t.run(ctx => ctx.db.patch(f.artifactId, { status: "draft" }));
    await expect(f.owner.client.mutation(api.postResults.record, f.args)).rejects.toThrow("publication");
    expect(await f.t.run(ctx => ctx.db.query("postMetrics").collect())).toEqual([]);
  });
  it.each([{ likes: -1 }, { qualifiedVisits: 1.5 }, { toDate: "2026-11-16" }, { fromDate: "2026-02-30" }, { measurementNote: "" }])("rejects invalid observations %j", async override => {
    const f = await seed(); await expect(f.owner.client.mutation(api.postResults.record, { ...f.args, ...override })).rejects.toThrow();
    expect(await f.t.run(ctx => ctx.db.query("postMetrics").collect())).toEqual([]);
  });
  it("exports and purges observations only in their workspace", async () => {
    const f = await seed();
    await f.owner.client.mutation(api.postResults.record, { ...f.args, signups: 2 });
    const other = await asNewUser(f.t, "export-other@example.com");
    const otherOrg = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other export" });
    const data = JSON.parse(await f.t.query(internal.settings.exportData, { orgId: f.orgId }));
    expect(data.postObservations).toHaveLength(1); expect(data.postObservationHistoryLimited).toBe(false);
    expect(JSON.parse(await f.t.query(internal.settings.exportData, { orgId: otherOrg.orgId })).postObservations).toEqual([]);
    await f.t.mutation(internal.settings.purgeWorkspaceBatch, { orgId: f.orgId });
    expect(await f.t.run(ctx => ctx.db.query("postMetrics").collect())).toEqual([]);
  });
  it("excludes future slots and discloses bounded history", async () => {
    const f = await seed();
    await f.t.run(async ctx => {
      const slot = (await ctx.db.get(f.slotId))!; const { _id, _creationTime, artifactId, ...base } = slot;
      void _id; void _creationTime; void artifactId;
      await ctx.db.insert("calendarSlots", { ...base, slotAt: now+day, idea: "FUTURE MUST NOT LEARN" });
      for (let i=0; i<122; i++) await ctx.db.insert("calendarSlots", { ...base, slotAt: now-i*1000, idea: `Past ${i}` });
    });
    const pc = await f.t.query(internal.autopilot.planningContext, { runId: f.runId, weekOf: "2026-11-16", fromDay: 0 });
    expect(pc?.history).not.toContain("FUTURE MUST NOT LEARN"); expect(pc?.history).toContain("newest 120"); expect(pc?.history).toContain("records omitted");
  });
});
