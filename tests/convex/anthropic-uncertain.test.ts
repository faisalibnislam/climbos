import { afterEach, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, makePaid, setup } from "./helpers";
const state = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../../shared/ai/turn", async (original) => ({
  ...await original<typeof import("../../shared/ai/turn")>(),
  modelTurn: async () => { state.calls++; return { ok: false, kind: "timeout", billingUncertain: true, message: "Synthetic ambiguous connection failure", usage: { inputTokens: 0, outputTokens: 0, thinkingTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0, webFetches: 0, calls: 0 }, costMicros: 0, appended: [] }; },
}));
afterEach(() => { delete process.env.CLIMBOS_ENGINE; delete process.env.ANTHROPIC_API_KEY; });
it("retains the spending reservation and prevents an automatic duplicate after an ambiguous Claude failure", async () => {
  const t = setup(); delete process.env.CLIMBOS_FAKE_LLM; process.env.CLIMBOS_ENGINE = "v2"; process.env.ANTHROPIC_API_KEY = "synthetic-unit-test-key"; state.calls = 0;
  const owner = await asNewUser(t, "uncertain-owner@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Uncertain Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More paying customers", horizonDays: 14, monthlyAdBudget: 0 });
  await makePaid(t, orgId, 500_000_000);
  const { runId } = await owner.client.mutation(api.orgs.generatePlan, { slug });
  await t.finishAllScheduledFunctions(() => undefined);
  const data = await t.run(async (ctx) => { const run = (await ctx.db.get(runId))!; return { run, reservation: run.reservationId ? await ctx.db.get(run.reservationId) : null, steps: await ctx.db.query("workflowSteps").withIndex("by_run", (q) => q.eq("runId", runId)).collect() }; });
  expect(state.calls).toBe(1); expect(data.run.status).toBe("uncertain");
  expect(data.reservation?.status).toBe("unresolved");
  expect(data.steps.some((step) => step.status === "uncertain")).toBe(true);
  expect(data.run.inFlightMicros).toBeGreaterThan(0);
});
