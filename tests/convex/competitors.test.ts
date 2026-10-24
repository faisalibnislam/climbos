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

  it("ignores standalone navigation and analytics query parameters", () => {
    const before = normaliseForDiff("Home\nPricing\nSign in\nhttps://rival.example/pricing?utm_source=weekly&utm_campaign=october\nPlans from $10/mo");
    const after = normaliseForDiff("Menu\nPricing\nLogin\nhttps://rival.example/pricing?utm_source=search&utm_campaign=november\nPlans from $10/mo");
    expect(diffLines(before, after)).toEqual({ added: [], removed: [] });
    expect(meaningful(diffLines(before, after))).toBe(false);
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
    expect(o.changes[0].sourceUrls).toEqual(["https://rival.example"]);
    const evidence = o.changes[0].evidence;
    expect(evidence).not.toBeNull();
    if (!evidence) throw new Error("Expected stored changed-line evidence.");
    expect(evidence.added).toEqual(expect.arrayContaining(["Plans from $14/mo", "New: free migration for every new customer this autumn"]));
    expect(evidence.removed).toContain("Plans from $10/mo");
    expect(o.changes[0].at).toBeTruthy();
    const report = await owner.client.query(api.reports.weekly, { slug });
    expect(report.competitors).toHaveLength(1);
    expect(report.competitors[0].sourceUrls).toEqual(["https://rival.example"]);
    expect(report.competitors[0].observedAt).toBeTruthy();
  });

  it("shows sourced watch candidates while filtering self, directory, and duplicate domains", async () => {
    const t = setup();
    const owner = await asNewUser(t, "competitor-candidates@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Owner Co" });
    const business = await t.run((ctx) => ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first());
    if (!business) throw new Error("Business was not created");
    await t.run((ctx) => ctx.db.patch(business._id, {
      website: "https://owner.example",
      insights: {
        audiences: [],
        competitors: [
          { name: "Our own comparison page", url: "https://owner.example/compare/rival", sourceUrl: "https://owner.example/compare/rival", note: "Comparison page" },
          { name: "Directory listing", url: "https://g2.com/products/rival", sourceUrl: "https://g2.com/products/rival", note: "Directory" },
          { name: "Rival", url: "https://www.rival.example/pricing", sourceUrl: "https://rival.example/pricing", note: "Sourced rival" },
          { name: "Duplicate", url: "http://rival.example/", sourceUrl: "https://rival.example/", note: "Duplicate host" },
        ],
        positioning: "",
        pricingNotes: "",
        swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
        journey: [],
        opportunities: [],
        generatedAt: Date.now(),
      },
    }));
    const overview = await owner.client.query(api.competitors.overview, { slug });
    expect(overview.suggested).toEqual([{ name: "Rival", url: "https://rival.example", sourceUrl: "https://rival.example/pricing" }]);
  });

  it("does not load or write a competitor watch under another workspace", async () => {
    const t = setup();
    const owner = await asNewUser(t, "watch-tenancy@example.com");
    const a = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Workspace A" });
    await makePaid(t, a.orgId);
    const b = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Workspace B" });
    const watchId = await owner.client.mutation(api.competitors.add, { slug: a.slug, name: "Rival", url: "rival.example" });

    expect(await t.query(internal.competitors.watchesFor, { orgId: b.orgId, watchIds: [watchId] })).toEqual([]);
    await t.mutation(internal.competitors.saveCheck, { orgId: b.orgId, watchId, hash: "cross-tenant", text: "must not be stored" });
    await expect(t.mutation(internal.competitors.recordChange, {
      orgId: b.orgId,
      watchId,
      name: "Rival",
      summary: "Cross-tenant write",
      bullets: [],
    })).rejects.toThrow(/Competitor watch not found/);

    const stored = await t.run((ctx) => ctx.db.get(watchId));
    expect(stored?.lastHash).toBeUndefined();
  });
});
