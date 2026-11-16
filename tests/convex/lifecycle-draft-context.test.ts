import { afterEach, expect, it, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import { startPlanWork } from "../../convex/lib/cards";
import type { AgentInput } from "../../shared/agents/types";
import { stepWorkFixture } from "../fixtures/stepWork";
import { makePaid } from "./helpers";

const captured = vi.hoisted(() => ({ inputs: [] as AgentInput[], output: null as unknown }));
vi.mock("../../shared/agents/runtime", async original => ({
  ...await original<typeof import("../../shared/agents/runtime")>(),
  runAgent: vi.fn(async (_spec: unknown, input: AgentInput) => {
    captured.inputs.push(input);
    if (captured.output) return { output: captured.output, assessment: { ship: true, gatesPassed: true, average: 5, minimum: 5, lint: [], critique: { gates: [], criteria: [], fixes: [], strengths: [] } }, rounds: 1, history: [], research: null };
    throw new Error("Stop at the actual generation boundary");
  }),
}));
afterEach(() => { captured.inputs = []; captured.output = null; vi.unstubAllEnvs(); });

async function fixture(purpose: string, approved = false) {
  const f = await stepWorkFixture();
  await makePaid(f.t, f.orgId, 50_000_000);
  vi.stubEnv("CLIMBOS_ENGINE", "v2");
  vi.stubEnv("CLIMBOS_FAKE_LLM", "ship");
  await f.t.run(async ctx => ctx.db.patch(f.strategyId, {
    expert: undefined, status: approved ? "approved" : "needs_approval",
    audiences: [{ name: "Past workshop attendees", hypothesis: "Offer another workshop only to attendees who asked for updates", evidence: "Owner reported customer questions; repeat interest unmeasured", sources: [{ kind: "web", url: "https://business.example/workshops" }] }],
    channels: [{ key: "email_lifecycle", name: purpose, why: "Help eligible past attendees choose a relevant next workshop", priority: 1, status: approved ? "active" : "proposed", monthlyCostMicros: 0, adSpendMinor: 0, deliverables: ["A reminder about the next workshop", "A useful preparation guide", "A final availability check", "Keep renewal questions separate from signup instructions"], dependencies: ["Owner must confirm capacity and topic-specific consent"], measurement: "Qualified repeat bookings; outcome unknown", sources: [{ kind: "web", url: "https://business.example/workshops" }] }],
    constraints: ["No discount or invented event date"],
  }));
  return f;
}

it.each(["Retention series", "Reactivation series", "Product education"])("keeps %s in first-win drafting without turning it into a welcome email", async purpose => {
  const f = await fixture(purpose);
  await f.t.mutation(internal.content.startFirstWin, { orgId: f.orgId, userId: f.owner.userId });
  const run = (await f.t.run(ctx => ctx.db.query("workflowRuns").first()))!;
  await f.t.finishAllScheduledFunctions(() => undefined);
  expect(run.title).not.toMatch(/welcome/i);
  expect(JSON.parse(run.input)).toMatchObject({ strategyId: f.strategyId, planChannel: "email_lifecycle" });
  expect(captured.inputs).toHaveLength(1);
  const input = captured.inputs[0];
  expect(input.task).toContain(purpose);
  expect(input.task).toContain("Past workshop attendees");
  expect(input.task).toContain("Owner reported customer questions; repeat interest unmeasured");
  expect(input.task).toContain("Owner must confirm capacity and topic-specific consent");
  expect(input.task).toContain("Keep renewal questions separate from signup instructions");
  expect(input.task).toContain("https://business.example/workshops");
  expect(input.task).toContain("needs_approval");
  expect(input.approvedOfferTerms).toBeUndefined();
  for (const table of ["approvals", "actionReceipts", "artifacts"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});

it("keeps the originating approved plan's lifecycle context after a newer plan replaces it", async () => {
  const f = await fixture("Customer renewal preparation", true);
  await f.t.run(async ctx => {
    await startPlanWork(ctx, { org: (await ctx.db.get(f.orgId))!, strategyId: f.strategyId, userId: f.owner.userId });
    const { _id, _creationTime, ...old } = (await ctx.db.get(f.strategyId))!;
    await ctx.db.patch(f.strategyId, { status: "superseded" });
    await ctx.db.insert("strategies", { ...old, version: 2, channels: old.channels.map(c => ({ ...c, name: "UNRELATED NEW WELCOME PLAN" })), createdAt: Date.now() + 1 });
  });
  await f.t.finishAllScheduledFunctions(() => undefined);
  expect(captured.inputs).toHaveLength(1);
  expect(captured.inputs[0].task).toContain("Customer renewal preparation");
  expect(captured.inputs[0].task).toContain("Owner must confirm capacity and topic-specific consent");
  expect(captured.inputs[0].task).not.toContain("UNRELATED NEW WELCOME PLAN");
  expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it("keeps missing audience evidence explicit instead of assuming new subscribers", async () => {
  const f = await fixture("Email test");
  await f.t.run(ctx => ctx.db.patch(f.strategyId, { audiences: [] }));
  await f.t.mutation(internal.content.startFirstWin, { orgId: f.orgId, userId: f.owner.userId });
  await f.t.finishAllScheduledFunctions(() => undefined);
  expect(captured.inputs[0].task).toContain("No audience is recorded in this plan");
  expect(captured.inputs[0].task).not.toContain("A short welcome email for new subscribers");
});

it.each([false, true])("preserves starter approval state after supersession (approved=%s)", async approved => {
  const f = await fixture("Proposed retention test", approved);
  await f.t.mutation(internal.content.startFirstWin, { orgId: f.orgId, userId: f.owner.userId });
  await f.t.run(ctx => ctx.db.patch(f.strategyId, { status: "superseded" }));
  await f.t.finishAllScheduledFunctions(() => undefined);
  expect(captured.inputs).toHaveLength(1);
  expect(captured.inputs[0].task).toContain("Proposed retention test");
  expect(captured.inputs[0].task.includes("APPROVED GROWTH PLAN")).toBe(approved);
  expect(captured.inputs[0].approvedOfferTerms).toBeUndefined();
});

it("uses saved lifecycle context for an older starter job with the former welcome-only brief", async () => {
  const f = await fixture("Renewal preparation");
  await f.t.mutation(internal.content.startFirstWin, { orgId: f.orgId, userId: f.owner.userId });
  const run = (await f.t.run(ctx => ctx.db.query("workflowRuns").first()))!;
  await f.t.run(async ctx => {
    await ctx.db.patch(run._id, { input: JSON.stringify({ firstWin: true, strategyId: f.strategyId, channel: "email" }) });
    for (const task of await ctx.db.system.query("_scheduled_functions").collect()) if (task.name.includes("createContent")) await ctx.scheduler.cancel(task._id);
  });
  await f.t.action(internal.jobs.createContent, { runId: run._id, job: "content_email", channel: "email", brief: "A short welcome email for new subscribers or customers based on the growth plan." });
  expect(captured.inputs).toHaveLength(1);
  expect(captured.inputs[0].task).toContain("Renewal preparation");
  expect(captured.inputs[0].task).not.toContain("A short welcome email for new subscribers");
});

it.each(["parked", "missing_plan", "oversized", "ambiguous"] as const)("does not substitute generic email work for %s plan context", async kind => {
  const f = await fixture("Retention series");
  await f.t.mutation(internal.content.startFirstWin, { orgId: f.orgId, userId: f.owner.userId });
  const run = (await f.t.run(ctx => ctx.db.query("workflowRuns").first()))!;
  await f.t.run(async ctx => {
    const plan = (await ctx.db.get(f.strategyId))!;
    if (kind === "parked") await ctx.db.patch(plan._id, { channels: plan.channels.map(c => ({ ...c, status: "parked" })) });
    if (kind === "missing_plan") await ctx.db.patch(run._id, { input: JSON.stringify({ ...JSON.parse(run.input), strategyId: "unavailable-plan" }) });
    if (kind === "oversized") await ctx.db.patch(plan._id, { constraints: ["Do not discard this constraint. ".repeat(400)] });
    if (kind === "ambiguous") await ctx.db.patch(plan._id, { channels: [...plan.channels, { ...plan.channels[0], name: "A different audience and purpose" }] });
  });
  await f.t.finishAllScheduledFunctions(() => undefined);
  expect(captured.inputs).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.get(run._id))).toMatchObject({ status: "failed", error: "email_plan_context" });
  for (const table of ["artifacts", "actionReceipts"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});

it.each(["unknown", "negative", "fractional", "empty"] as const)("handles %s timing/output before saving email drafts", async kind => {
  const f = await fixture("Customer education");
  captured.output = { name: "Workshop preparation", audience: "Past attendees who asked for workshop updates", factIndexes: [], emails: kind === "empty" ? [] : [{ subject: "Preparing for a workshop", previewText: "A preparation idea", body: "Consider the question you want to explore at a future workshop.", callToAction: "Review your question", sendAfterDays: kind === "unknown" ? null : kind === "negative" ? -1 : 1.5 }] };
  await f.t.mutation(internal.content.startFirstWin, { orgId: f.orgId, userId: f.owner.userId });
  await f.t.finishAllScheduledFunctions(() => undefined);
  const artifacts = await f.t.run(ctx => ctx.db.query("artifacts").collect());
  if (kind === "unknown") {
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].status).toMatch(/draft|in_review/);
    expect(artifacts[0].scheduledFor).toBeUndefined();
    const version = (await f.t.run(ctx => ctx.db.get(artifacts[0].currentVersionId!)))!;
    expect(version.body).toContain("Email 1 — timing to confirm");
    expect(version.body).not.toContain("day null");
  } else {
    expect(artifacts).toEqual([]);
    expect(await f.t.run(ctx => ctx.db.query("workflowRuns").first())).toMatchObject({ status: "failed", error: "invalid_email_sequence" });
  }
  for (const table of ["approvals", "actionReceipts"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});
