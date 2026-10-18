import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { diffLines, meaningful, normaliseForDiff } from "../../shared/competitors";
import { asNewUser, makePaid, setup } from "./helpers";

describe("competitor watch", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_LLM;
    delete process.env.CLIMBOS_FAKE_SITE_TEXT;
  });

  it("ignores noise and flags price changes", () => {
    const a = normaliseForDiff("Trusted by 12,000 teams\n© 2025 Acme\nPlans from $10/mo");
    const b = normaliseForDiff("Trusted by 13,500 teams\n© 2026 Acme\nPlans from $12/mo");
    expect(meaningful(diffLines(a, b))).toBe(true);
    const c = normaliseForDiff("Trusted by 13,500 teams\n© 2026 Acme\nPlans from $10/mo");
    expect(meaningful(diffLines(a, c))).toBe(false);
  });

  it("first read is a free baseline; a later change is summarised and lands in the report", async () => {
    const t = setup();
    const owner = await asNewUser(t, "watch@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Watch Co" });
    await owner.client.mutation(api.competitors.add, { slug, name: "Rival", url: "rival.example" });
    // Free accounts watch one competitor.
    await expect(owner.client.mutation(api.competitors.add, { slug, name: "Other", url: "other.example" })).rejects.toThrow(/Free accounts/);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    let o = await owner.client.query(api.competitors.overview, { slug });
    expect(o.watches[0].lastCheckedAt).toBeTruthy();
    expect(o.changes).toHaveLength(0);
    const runsBefore = await t.run(async (ctx) => (await ctx.db.query("workflowRuns").collect()).filter((r) => r.kind === "competitor_watch").length);
    expect(runsBefore).toBe(0);

    await makePaid(t, orgId);
    process.env.CLIMBOS_FAKE_SITE_TEXT = "Plans from $14/mo\nNew: free migration for every new customer this autumn";
    await t.mutation(internal.competitors.weekly, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    o = await owner.client.query(api.competitors.overview, { slug });
    expect(o.changes).toHaveLength(1);
    expect(o.changes[0].name).toBe("Rival");
    const report = await owner.client.query(api.reports.weekly, { slug });
    expect(report.competitors).toHaveLength(1);
  });
});
