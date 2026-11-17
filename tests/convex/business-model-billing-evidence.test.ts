import { expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
const DAY = 86_400_000;
it.each(["invalid", "duplicate", "conflict", "overflow"])("keeps %s billing evidence truthful in the real business-model context", async mode => {
  const t = setup(), owner = await asNewUser(t, `model-billing-${mode}@example.com`);
  const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Billing evidence" });
  const other = await asNewUser(t, `foreign-model-${mode}@example.com`);
  const foreign = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
  const now = Date.now();
  const runId = await t.run(async ctx => {
    const base = { orgId, source: "stripe", currency: "USD", refundedMinor: 0, kind: "order" as const, customerRef: "private-customer", isFixture: false, ingestedAt: now };
    await ctx.db.insert("revenueEvents", { ...base, sourceEventId: "old", occurredAt: now - 181 * DAY, amountMinor: 100 });
    await ctx.db.insert("revenueEvents", { ...base, sourceEventId: "prior", occurredAt: now - 100 * DAY, amountMinor: mode === "overflow" ? Number.MAX_SAFE_INTEGER : 100 });
    const recent = { ...base, sourceEventId: "recent", occurredAt: now - 30 * DAY, amountMinor: mode === "invalid" ? 1.5 : 100 };
    await ctx.db.insert("revenueEvents", recent);
    if (mode === "duplicate" || mode === "conflict") await ctx.db.insert("revenueEvents", { ...recent, amountMinor: mode === "conflict" ? 50 : recent.amountMinor });
    if (mode === "overflow") await ctx.db.insert("revenueEvents", { ...base, sourceEventId: "extra", occurredAt: now - 101 * DAY, amountMinor: 1 });
    await ctx.db.insert("revenueEvents", { ...recent, orgId: foreign.orgId, sourceEventId: "foreign", amountMinor: 99999 });
    return ctx.db.insert("workflowRuns", { orgId, kind: "business_model_check", title: "Billing check", status: "executing", input: "{}", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "verified-2026-10-17", entitlementVersionId: "ent-credits-2026-10-18", routingVersionId: "r1", budget: { modelSteps: 1, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: now, updatedAt: now });
  });
  const result = await t.query(internal.jobWrites.jobContext, { runId });
  const brief = result!.businessModelSignalsText;
  if (mode === "duplicate") {
    expect(brief).toContain("+0% net USD revenue");
    expect(brief).not.toContain("+100%");
  } else {
    expect(brief).toMatch(/invalid|unsafe|conflicting/);
    expect(brief).not.toContain("[headwind");
    expect(brief).not.toContain("[tailwind");
  }
  expect(brief).not.toContain("private-customer");
  for (const table of ["approvals", "actionReceipts", "emailLog", "webhookDeliveries"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});
