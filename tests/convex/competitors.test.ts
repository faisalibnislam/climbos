import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { diffLines, isObservedChangeQuote, meaningful, normaliseForDiff } from "../../shared/competitors";
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

  it("requires an exact retained page-change line for a suggested test", () => {
    const evidence = { added: ["New: free onboarding with each annual plan"], removed: ["Plans from $10/mo"] };
    expect(isObservedChangeQuote("New: free onboarding with each annual plan", evidence)).toBe(true);
    expect(isObservedChangeQuote("The owner should offer a discount", evidence)).toBe(false);
    expect(isObservedChangeQuote(undefined, evidence)).toBe(false);
    expect(isObservedChangeQuote("New: free onboarding with each annual plan", undefined)).toBe(false);
    expect(isObservedChangeQuote("x".repeat(301), { added: ["x".repeat(301)], removed: [] })).toBe(false);
  });

  it("drops a stored test idea when its evidence quote is not in the exact page diff", async () => {
    const t = setup();
    const owner = await asNewUser(t, "watch-evidence@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Evidence Co" });
    const watchId = await owner.client.mutation(api.competitors.add, { slug, name: "Rival", url: "rival.example" });
    const evidenceQuote = "New: free onboarding with each annual plan";
    const suggestion = {
      action: "Check interest in the new onboarding offer",
      firstStep: "Ask recent prospects about the onboarding support they need.",
      successMetric: "Qualified inquiries about onboarding support",
      reviewAfterDays: 14,
      caveat: "A competitor page does not prove that customers want this offer.",
      evidenceQuote,
    };
    const evidence = { removed: ["Plans from $10/mo"], added: [evidenceQuote] };
    await t.mutation(internal.competitors.recordChange, {
      orgId, watchId, name: "Rival", summary: "Evidence-bound test", bullets: [], suggestedAction: suggestion, evidence,
    });
    await t.mutation(internal.competitors.recordChange, {
      orgId, watchId, name: "Rival", summary: "Unsupported test", bullets: [],
      suggestedAction: { ...suggestion, evidenceQuote: "The owner should offer a discount." }, evidence,
    });

    const overview = await owner.client.query(api.competitors.overview, { slug });
    expect(overview.changes.find((change) => change.summary === "Evidence-bound test")?.suggestedAction?.evidenceQuote).toBe(evidenceQuote);
    expect(overview.changes.find((change) => change.summary === "Unsupported test")?.suggestedAction).toBeNull();
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
    expect(o.changes[0].suggestedAction).toMatchObject({
      action: "Test clearer migration support",
      firstStep: expect.stringContaining("Ask five recent prospects"),
      successMetric: expect.stringContaining("Qualified inquiries"),
      reviewAfterDays: 14,
      caveat: expect.stringContaining("does not show"),
      evidenceQuote: "New: free migration for every new customer this autumn",
    });
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

  it("bundles multiple competitor changes into one owner notice", async () => {
    const t = setup();
    const owner = await asNewUser(t, "watch-digest@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Digest Co" });
    await makePaid(t, orgId);
    await owner.client.mutation(api.competitors.add, { slug, name: "Rival A", url: "rival-a.example" });
    await owner.client.mutation(api.competitors.add, { slug, name: "Rival B", url: "rival-b.example" });
    await t.finishAllScheduledFunctions(vi.runAllTimers); // Establish each free baseline.

    process.env.CLIMBOS_FAKE_SITE_TEXT = "Plans from $14/mo\nNew: free migration for every new customer this autumn";
    await t.mutation(internal.competitors.weekly, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const notices = await t.run(async (ctx) => (await ctx.db.query("notices").collect()).filter((notice) => notice.userId === owner.userId && notice.href.endsWith("/competitors")));
    expect(notices).toHaveLength(1);
    expect(notices[0]?.text).toContain("2 watched competitor sites");
    const overview = await owner.client.query(api.competitors.overview, { slug });
    expect(overview.changes).toHaveLength(2);
  });

  it("lets only owners/admins set digest cadence and debounces daily notices while aggregating distinct changed sites", async () => {
    const t = setup();
    const owner = await asNewUser(t, "competitor-digest-cadence@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Digest Cadence Co" });
    await makePaid(t, orgId);
    const firstWatchId = await owner.client.mutation(api.competitors.add, { slug, name: "Rival A", url: "rival-a.example" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const secondWatchId = await t.run((ctx) => ctx.db.insert("competitorWatches", {
      orgId, name: "Rival B", url: "https://rival-b.example", active: true, createdAt: Date.now(),
    }));

    const { token } = await owner.client.mutation(api.team.createInviteLink, { slug, role: "editor", days: 7, maxUses: 1 });
    const editor = await asNewUser(t, "competitor-digest-editor@example.com");
    await editor.client.mutation(api.settings.acceptInvite, { token });
    await expect(editor.client.mutation(api.competitors.setDigestCadence, { slug, cadence: "daily" })).rejects.toThrow(/Only an owner or admin/);
    const outsider = await asNewUser(t, "competitor-digest-outsider@example.com");
    await expect(outsider.client.mutation(api.competitors.setDigestCadence, { slug, cadence: "weekly" })).rejects.toThrow(/find that workspace/u);

    await owner.client.mutation(api.competitors.setDigestCadence, { slug, cadence: "daily" });
    expect((await owner.client.query(api.competitors.overview, { slug })).digestCadence).toBe("daily");
    const firstAt = Date.now();
    await t.mutation(internal.competitors.notifyDigest, { orgId, count: 1 });
    vi.setSystemTime(firstAt + 60 * 60_000);
    await t.mutation(internal.competitors.notifyDigest, { orgId, count: 1 });
    let notices = await t.run(async (ctx) => (await ctx.db.query("notices").collect()).filter((notice) => notice.orgId === orgId && notice.href.endsWith("/competitors")));
    expect(notices).toHaveLength(1);

    await t.run(async (ctx) => {
      await ctx.db.insert("competitorChanges", { orgId, watchId: firstWatchId, name: "Rival A", summary: "First change", bullets: [], at: firstAt + 2 * 60 * 60_000 });
      await ctx.db.insert("competitorChanges", { orgId, watchId: secondWatchId, name: "Rival B", summary: "Second change", bullets: [], at: firstAt + 2 * 60 * 60_000 });
    });
    vi.setSystemTime(firstAt + 24 * 60 * 60_000 + 1);
    await t.mutation(internal.competitors.notifyDigest, { orgId, count: 1 });
    notices = await t.run(async (ctx) => (await ctx.db.query("notices").collect()).filter((notice) => notice.orgId === orgId && notice.href.endsWith("/competitors")));
    expect(notices).toHaveLength(2);
    expect(notices[1]?.text).toContain("2 watched competitor sites");
    await owner.client.mutation(api.competitors.setDigestCadence, { slug, cadence: "off" });
    await t.mutation(internal.competitors.notifyDigest, { orgId, count: 1 });
    expect(await t.run(async (ctx) => (await ctx.db.query("notices").collect()).filter((notice) => notice.orgId === orgId && notice.href.endsWith("/competitors")))).toHaveLength(2);
    expect(await t.run((ctx) => ctx.db.query("auditEvents").withIndex("by_org_created", (q) => q.eq("orgId", orgId)).collect())).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "competitor_digest.cadence_changed" }),
    ]));
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
          { name: "Rival", url: "https://www.rival.example/pricing", sourceUrl: "https://rival.example/pricing", note: "Sourced rival", kind: "direct", comparison: [{ dimension: "offer", finding: "Lists onboarding with annual plans.", sourceUrl: "https://rival.example/pricing", implication: "May be relevant if switching support is an owner-confirmed buyer concern." }] },
          { name: "Adjacent", url: "https://adjacent.example", sourceUrl: "https://adjacent.example", note: "Related tool", kind: "adjacent" },
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
    expect(overview.suggested).toEqual([{ name: "Rival", url: "https://rival.example", sourceUrl: "https://rival.example/pricing", kind: "direct", comparison: [{ dimension: "offer", finding: "Lists onboarding with annual plans.", sourceUrl: "https://rival.example/pricing", implication: "May be relevant if switching support is an owner-confirmed buyer concern." }] }]);
  });

  it("records an irrelevant suggestion without starting a watch and keeps it suppressed", async () => {
    const t = setup();
    const owner = await asNewUser(t, "competitor-dismiss@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Owner Co" });
    const business = await t.run((ctx) => ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first());
    if (!business) throw new Error("Business was not created");
    await t.run((ctx) => ctx.db.patch(business._id, {
      insights: {
        audiences: [],
        competitors: [{ name: "Rival", url: "https://rival.example", sourceUrl: "https://research.example/rival", note: "Sourced candidate", kind: "direct" }],
        positioning: "", pricingNotes: "", swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] }, journey: [], opportunities: [], generatedAt: Date.now(),
      },
    }));
    expect((await owner.client.query(api.competitors.overview, { slug })).suggested).toHaveLength(1);

    await owner.client.mutation(api.competitors.dismissSuggestion, { slug, url: "https://www.rival.example/pricing" });
    let overview = await owner.client.query(api.competitors.overview, { slug });
    expect(overview.suggested).toEqual([]);
    expect(overview.watches).toEqual([]);
    expect(overview.dismissedSuggestions).toMatchObject([{ name: "Rival", sourceUrl: "https://research.example/rival" }]);
    expect(await t.run((ctx) => ctx.db.query("workflowRuns").withIndex("by_org_kind_created", (q) => q.eq("orgId", orgId).eq("kind", "competitor_watch")).collect())).toEqual([]);

    await owner.client.mutation(api.competitors.add, { slug, name: "Rival", url: "https://rival.example" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    overview = await owner.client.query(api.competitors.overview, { slug });
    expect(overview.watches).toHaveLength(1);
    expect(overview.dismissedSuggestions).toEqual([]);

    const outsider = await asNewUser(t, "competitor-dismiss-outsider@example.com");
    await expect(outsider.client.mutation(api.competitors.dismissSuggestion, { slug, url: "https://rival.example" })).rejects.toThrow(/find that workspace/u);
  });

  it("keeps researched competitors as suggestions until an owner starts monitoring", async () => {
    const t = setup();
    const owner = await asNewUser(t, "competitor-auto-seed@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Owner Co" });
    const business = await t.run((ctx) => ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first());
    if (!business) throw new Error("Business was not created");
    const insightsAt = Date.now();
    await t.run((ctx) => ctx.db.patch(business._id, {
      website: "https://owner.example",
      insights: {
        audiences: [],
        competitors: [
          { name: "Rival", url: "https://unrelated.example", sourceUrl: "https://research.example/rival", note: "Direct competitor", kind: "direct" },
          { name: "Adjacent", url: "https://adjacent.example", sourceUrl: "https://research.example/adjacent", note: "Related tool", kind: "adjacent" },
          { name: "Other", url: "https://elsewhere.example", sourceUrl: "https://research.example/other", note: "Another competitor", kind: "direct" },
        ],
        positioning: "",
        pricingNotes: "",
        swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
        journey: [],
        opportunities: [],
        generatedAt: insightsAt,
      },
    }));

    expect(await t.action(internal.competitorDiscovery.seedFromInsights, { orgId, businessId: business._id, insightsAt })).toBe(0);
    const overview = await owner.client.query(api.competitors.overview, { slug });
    expect(overview.watches).toEqual([]);
    expect(overview.suggested.map((candidate) => candidate.name)).toEqual(["Rival", "Other"]);
    expect(overview.suggested[0]).toMatchObject({ sourceUrl: "https://research.example/rival", kind: "direct" });
    expect(await t.run((ctx) => ctx.db.query("workflowRuns").withIndex("by_org_kind_created", (q) => q.eq("orgId", orgId).eq("kind", "competitor_watch")).collect())).toEqual([]);

    const restoredId = await owner.client.mutation(api.competitors.add, { slug, name: "Rival", url: "https://www.unrelated.example/pricing" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const afterOwnerAdd = await owner.client.query(api.competitors.overview, { slug });
    expect(afterOwnerAdd.watches).toHaveLength(1);
    expect(afterOwnerAdd.watches[0].id).toBe(restoredId);
    expect(afterOwnerAdd.watches[0]).toMatchObject({ autoSeeded: false, discoverySourceUrl: null });
  });

  it("holds legacy auto-added sites until an owner or admin confirms the recurring check", async () => {
    const t = setup();
    const owner = await asNewUser(t, "legacy-watch-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Legacy Watch Co" });
    await makePaid(t, orgId);
    const watchId = await t.run((ctx) => ctx.db.insert("competitorWatches", {
      orgId,
      name: "Legacy Rival",
      url: "https://legacy-rival.example",
      active: true,
      autoSeededAt: Date.now() - 10_000,
      discoverySourceUrl: "https://research.example/legacy-rival",
      createdAt: Date.now() - 10_000,
    }));

    const { token } = await owner.client.mutation(api.team.createInviteLink, { slug, role: "editor", days: 7, maxUses: 1 });
    const editor = await asNewUser(t, "legacy-watch-editor@example.com");
    await editor.client.mutation(api.settings.acceptInvite, { token });
    await expect(editor.client.mutation(api.competitors.confirmLegacyWatch, { slug, id: watchId })).rejects.toThrow(/Only an owner or admin/);

    let overview = await owner.client.query(api.competitors.overview, { slug });
    expect(overview.canConfirmLegacyWatch).toBe(true);
    expect(overview.watches[0]).toMatchObject({ id: watchId, needsConfirmation: true, autoSeeded: true });
    await expect(owner.client.mutation(api.competitors.checkNow, { slug })).rejects.toThrow(/must confirm a saved site/i);
    await t.mutation(internal.competitors.weekly, {});
    await t.action(internal.competitorActions.check, { orgId, watchIds: [watchId] });
    expect((await t.run((ctx) => ctx.db.get(watchId)))?.lastCheckedAt).toBeUndefined();

    await owner.client.mutation(api.competitors.confirmLegacyWatch, { slug, id: watchId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    overview = await owner.client.query(api.competitors.overview, { slug });
    expect(overview.watches[0]).toMatchObject({ id: watchId, needsConfirmation: false });
    expect(overview.watches[0].lastCheckedAt).toEqual(expect.any(Number));
    expect(await t.run((ctx) => ctx.db.query("auditEvents").withIndex("by_org_created", (q) => q.eq("orgId", orgId)).collect())).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "competitor_watch.confirmed", subjectId: watchId }),
    ]));
  });

  it("keeps scheduled competitor summaries within the workspace credit approval limit", async () => {
    const t = setup();
    const owner = await asNewUser(t, "competitor-watch-credit-cap@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Watch Budget Co" });
    await makePaid(t, orgId);
    await t.run((ctx) => ctx.db.patch(orgId, { creditApprovalLimit: 0 }));

    expect(await t.mutation(internal.competitors.startSummaryRun, { orgId, count: 1 })).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("workflowRuns").withIndex("by_org_kind_created", (q) => q.eq("orgId", orgId).eq("kind", "competitor_watch")).collect())).toEqual([]);

    await t.run((ctx) => ctx.db.patch(orgId, { creditApprovalLimit: undefined }));
    const runId = await t.mutation(internal.competitors.startSummaryRun, { orgId, count: 1 });
    if (!runId) throw new Error("Expected a summary run when the workspace has no approval cap.");
    const run = await t.run((ctx) => ctx.db.get(runId));
    expect(run?.status).toBe("cost_reserved");
    expect(run?.actualMicros).toBe(0);
    expect(run?.estimateMicros).toBeGreaterThan(0);
  });

  it("pauses weekly competitor checks without blocking an owner-requested manual check", async () => {
    const t = setup();
    const owner = await asNewUser(t, "competitor-schedule-pause@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Pause Watch Co" });
    await makePaid(t, orgId);
    const watchId = await owner.client.mutation(api.competitors.add, { slug, name: "Rival", url: "rival.example" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const baseline = await t.run((ctx) => ctx.db.get(watchId));
    if (!baseline?.lastCheckedAt) throw new Error("Expected an initial free baseline check.");

    vi.setSystemTime(baseline.lastCheckedAt + 7 * 3_600_000);
    process.env.CLIMBOS_FAKE_SITE_TEXT = "Plans from $14/mo\nA new service tier is available.";
    await owner.client.mutation(api.competitors.setScheduledMonitoring, { slug, enabled: false });
    let automation = (await owner.client.query(api.automationRegistry.get, { slug })).entries.find((entry) => entry.id === "competitor_watch");
    expect(automation).toMatchObject({ state: "paused", activeCount: 0, competitorWatchEnabled: false });
    expect(automation?.summary).toContain("manual checks remain available");

    expect(await t.mutation(internal.competitors.weekly, {})).toBe(0);
    await t.action(internal.competitorActions.check, { orgId, watchIds: [watchId], scheduled: true });
    expect((await t.run((ctx) => ctx.db.get(watchId)))?.lastCheckedAt).toBe(baseline.lastCheckedAt);
    expect((await owner.client.query(api.competitors.overview, { slug })).changes).toHaveLength(0);

    await owner.client.mutation(api.competitors.checkNow, { slug });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await owner.client.query(api.competitors.overview, { slug })).changes).toHaveLength(1);

    await owner.client.mutation(api.competitors.setScheduledMonitoring, { slug, enabled: true });
    automation = (await owner.client.query(api.automationRegistry.get, { slug })).entries.find((entry) => entry.id === "competitor_watch");
    expect(automation).toMatchObject({ state: "active", competitorWatchEnabled: true });
  });

  it("refreshes competitor research on its owner-configured cadence and keeps scheduled work under the approval cap", async () => {
    const t = setup();
    const owner = await asNewUser(t, "competitor-refresh@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Refresh Co" });
    await makePaid(t, orgId);
    const business = await t.run((ctx) => ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first());
    if (!business) throw new Error("Business was not created");
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.patch(orgId, { aiMode: "basic" });
      await ctx.db.patch(business._id, {
        website: "https://refresh.example",
        insights: { audiences: [], competitors: [], positioning: "", pricingNotes: "", swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] }, journey: [], opportunities: [], generatedAt: now - 100 * 86_400_000 },
        competitorResearchCompletedAt: now - 100 * 86_400_000,
        competitorResearchNextAt: now - 1,
      });
    });
    await owner.client.mutation(api.orgs.setCompetitorResearchRefreshDays, { slug, days: 30 });
    const started = await t.mutation(internal.competitorDiscovery.startScheduledRefresh, { businessId: business._id });
    expect(started).toBe(true);
    const stored = await t.run(async (ctx) => ({
      org: await ctx.db.get(orgId),
      business: await ctx.db.get(business._id),
      run: await ctx.db.query("workflowRuns").withIndex("by_org_kind_created", (q) => q.eq("orgId", orgId).eq("kind", "onboarding_research")).order("desc").first(),
    }));
    expect(stored.org?.competitorResearchRefreshDays).toBe(30);
    expect(stored.business?.competitorResearchLastStatus).toBe("scheduled");
    expect(stored.business?.competitorResearchNextAt).toBeGreaterThan(now);
    expect(String(stored.run?.input)).toContain("scheduled_competitor_research");

    await owner.client.mutation(api.orgs.setCompetitorResearchRefreshDays, { slug, days: 180 });
    const rescheduled = await t.run((ctx) => ctx.db.get(business._id));
    expect(rescheduled?.competitorResearchNextAt).toBe(now - 100 * 86_400_000 + 180 * 86_400_000);

    await t.run(async (ctx) => {
      await ctx.db.patch(orgId, { creditApprovalLimit: 1 });
      if (stored.run) await ctx.db.patch(stored.run._id, { status: "verified", finishedAt: Date.now() });
    });
    await owner.client.mutation(api.orgs.addFact, { slug, category: "offer", statement: "We now offer a fixed-price onboarding package." });
    const invalidated = await t.run((ctx) => ctx.db.get(business._id));
    expect(invalidated?.competitorResearchNextAt).toBeLessThanOrEqual(Date.now());
    expect(invalidated?.competitorResearchStaleAt).toBeDefined();
    const deferred = await t.mutation(internal.competitorDiscovery.startScheduledRefresh, { businessId: business._id });
    expect(deferred).toBe(false);
    const deferredBusiness = await t.run((ctx) => ctx.db.get(business._id));
    expect(deferredBusiness?.competitorResearchLastStatus).toBe("waiting_for_owner");
  });

  it("initializes bounded refresh schedules for legacy businesses with saved research", async () => {
    const t = setup();
    const owner = await asNewUser(t, "competitor-refresh-backfill@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Legacy Research Co" });
    const business = await t.run((ctx) => ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first());
    if (!business) throw new Error("Business was not created");
    const generatedAt = Date.now() - 100 * 86_400_000;
    await t.run((ctx) => ctx.db.patch(business._id, {
      insights: { audiences: [], competitors: [], positioning: "", pricingNotes: "", swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] }, journey: [], opportunities: [], generatedAt },
    }));
    const result = await t.mutation(internal.competitorDiscovery.backfillLegacySchedules, {});
    expect(result.businesses).toBe(1);
    const stored = await t.run(async (ctx) => ({ business: await ctx.db.get(business._id), org: await ctx.db.get(orgId) }));
    expect(stored.business?.competitorResearchCompletedAt).toBe(generatedAt);
    expect(stored.business?.competitorResearchNextAt).toBe(generatedAt + 90 * 86_400_000);
    expect(stored.org?.competitorResearchBackfillDone).toBe(true);
  });

  it("clears a due marker when the business has not completed its first research yet", async () => {
    const t = setup();
    const owner = await asNewUser(t, "competitor-refresh-no-insights@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Not Researched Co" });
    const business = await t.run((ctx) => ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first());
    if (!business) throw new Error("Business was not created");
    await t.run((ctx) => ctx.db.patch(business._id, { competitorResearchNextAt: Date.now() - 1 }));
    expect(await t.mutation(internal.competitorDiscovery.startScheduledRefresh, { businessId: business._id })).toBe(false);
    const stored = await t.run((ctx) => ctx.db.get(business._id));
    expect(stored?.competitorResearchNextAt).toBeUndefined();
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
