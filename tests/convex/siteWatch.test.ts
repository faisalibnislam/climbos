import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

describe("site watch (keeps researching the business)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_LLM;
    delete process.env.CLIMBOS_FAKE_SITE_TEXT;
  });

  it("first read is a free baseline; a real change proposes facts to confirm", async () => {
    const t = setup();
    const owner = await asNewUser(t, "site@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Site Co", website: "https://site.example" });
    await t.action(internal.siteWatchActions.check, { orgId: orgId as Id<"organizations"> });
    expect((await owner.client.query(api.siteWatch.facts, { slug }))?.siteCheckedAt).toBeTruthy();
    expect(await t.run(async (ctx) => (await ctx.db.query("workflowRuns").collect()).filter((r) => r.kind === "site_watch").length)).toBe(0);

    process.env.CLIMBOS_FAKE_SITE_TEXT = "Plans from $14/mo\nNew: team plan for agencies with 10 seats included";
    await t.action(internal.siteWatchActions.check, { orgId: orgId as Id<"organizations"> });
    const f = await owner.client.query(api.siteWatch.facts, { slug });
    const pending = f!.facts.filter((x) => x.state === "needs_review" && x.provenance === "researched");
    expect(pending.length).toBeGreaterThan(0);
    await owner.client.mutation(api.siteWatch.confirmUpdate, { slug, factId: pending[0].id });
    expect((await owner.client.query(api.siteWatch.facts, { slug }))!.facts.find((x) => x.id === pending[0].id)?.state).toBe("confirmed");
    expect((await owner.client.query(api.siteWatch.facts, { slug }))!.facts.find((x) => x.id === pending[0].id)?.verifiedAt).toEqual(expect.any(Number));
    expect((await owner.client.query(api.team.myNotices, {})).items.some((n) => /website changed/.test(n.text))).toBe(true);
  });

  it("surfaces conflicting confirmed prices with links to the facts that disagree", async () => {
    const t = setup();
    const owner = await asNewUser(t, "conflict@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Site Co", website: "https://site.example" });
    const firstId = await owner.client.mutation(api.orgs.addFact, { slug, category: "pricing", statement: "The Pro plan costs $19 per month." });
    const secondId = await owner.client.mutation(api.orgs.addFact, { slug, category: "pricing", statement: "The Pro plan costs $24 per month." });

    const facts = await owner.client.query(api.siteWatch.facts, { slug });
    expect(facts?.conflicts).toEqual([expect.objectContaining({
      subject: "Pro price per month",
      values: ["$19", "$24"],
      factIds: expect.arrayContaining([firstId, secondId]),
      facts: expect.arrayContaining([
        expect.objectContaining({ id: firstId, statement: "The Pro plan costs $19 per month." }),
        expect.objectContaining({ id: secondId, statement: "The Pro plan costs $24 per month." }),
      ]),
    })]);
  });

  it("surfaces a researched price that conflicts with the owner's confirmed price and marks it pending", async () => {
    const t = setup();
    const owner = await asNewUser(t, "pending-conflict@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Site Co", website: "https://site.example" });
    const confirmedId = await owner.client.mutation(api.orgs.addFact, { slug, category: "pricing", statement: "The Pro plan costs $19 per month." });
    await t.run(async (ctx) => {
      const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId as Id<"organizations">)).first();
      expect(business).toBeTruthy();
      const now = Date.now();
      const sourceId = await ctx.db.insert("factSources", { orgId: orgId as Id<"organizations">, businessId: business!._id, kind: "website", url: "https://site.example/pricing", excerpt: "Pro plan $24 per month", fetchedAt: now, status: "ok", expiresAt: now + 1000 });
      await ctx.db.insert("businessFacts", { orgId: orgId as Id<"organizations">, businessId: business!._id, category: "pricing", statement: "The Pro plan costs $24 per month.", confidence: "medium", reviewState: "needs_review", provenance: "researched", sourceIds: [sourceId], replacesFactId: confirmedId, createdAt: now, updatedAt: now });
    });

    const facts = await owner.client.query(api.siteWatch.facts, { slug });
    expect(facts?.conflicts).toEqual([expect.objectContaining({
      subject: "Pro price per month",
      values: ["$19", "$24"],
      facts: expect.arrayContaining([
        expect.objectContaining({ id: confirmedId, state: "confirmed", provenance: "owner_supplied" }),
        expect.objectContaining({ statement: "The Pro plan costs $24 per month.", state: "needs_review", provenance: "researched", sources: [expect.objectContaining({ url: "https://site.example/pricing" })] }),
      ]),
    })]);
  });

  it("shows exact duplicates as one fact with all source history and reviews the group together", async () => {
    const t = setup();
    const owner = await asNewUser(t, "duplicate-facts@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Site Co", website: "https://site.example" });
    const business = await t.run(async (ctx) => ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId as Id<"organizations">)).first());
    expect(business).toBeTruthy();
    const ids = await t.run(async (ctx) => {
      const now = Date.now();
      const sourceA = await ctx.db.insert("factSources", { orgId: orgId as Id<"organizations">, businessId: business!._id, kind: "website", url: "https://site.example/pricing", fetchedAt: now - 100, status: "ok", expiresAt: now + 1000 });
      const sourceB = await ctx.db.insert("factSources", { orgId: orgId as Id<"organizations">, businessId: business!._id, kind: "website", url: "https://site.example/plans", fetchedAt: now, status: "ok", expiresAt: now + 1000 });
      const first = await ctx.db.insert("businessFacts", { orgId: orgId as Id<"organizations">, businessId: business!._id, category: "pricing", statement: "Pro plan costs $20 per month.", confidence: "medium", reviewState: "needs_review", provenance: "researched", sourceIds: [sourceA], createdAt: now - 100, updatedAt: now - 100 });
      const second = await ctx.db.insert("businessFacts", { orgId: orgId as Id<"organizations">, businessId: business!._id, category: "pricing", statement: "  PRO plan costs $20 per month? ", confidence: "medium", reviewState: "needs_review", provenance: "researched", sourceIds: [sourceB], createdAt: now, updatedAt: now });
      return { first, second, sourceA, sourceB };
    });

    const before = await owner.client.query(api.siteWatch.facts, { slug });
    expect(before?.facts).toHaveLength(1);
    expect(before?.facts[0]).toMatchObject({
      id: ids.second,
      duplicateIds: [ids.first],
      duplicateRecords: [{ id: ids.first, statement: "Pro plan costs $20 per month.", sources: [expect.objectContaining({ url: "https://site.example/pricing" })] }],
      state: "needs_review",
      sources: expect.arrayContaining([expect.objectContaining({ url: "https://site.example/pricing" }), expect.objectContaining({ url: "https://site.example/plans" })]),
    });
    await owner.client.mutation(api.orgs.reviewFact, { slug, factId: ids.second, action: "confirm" });
    expect(await t.run(async (ctx) => [await ctx.db.get(ids.first), await ctx.db.get(ids.second)])).toEqual([
      expect.objectContaining({ reviewState: "confirmed", verifiedAt: expect.any(Number) }),
      expect.objectContaining({ reviewState: "confirmed", verifiedAt: expect.any(Number) }),
    ]);
  });

  it("surfaces conservative semantic overlap suggestions without combining facts", async () => {
    const t = setup();
    const owner = await asNewUser(t, "similar-facts@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Site Co", website: "https://site.example" });
    const firstId = await owner.client.mutation(api.orgs.addFact, { slug, category: "product", statement: "Pro plan includes team reporting and analytics." });
    const secondId = await owner.client.mutation(api.orgs.addFact, { slug, category: "product", statement: "The Pro plan offers team reports plus analytics." });
    const otherEntityId = await owner.client.mutation(api.orgs.addFact, { slug, category: "product", statement: "The Starter plan offers team reports plus analytics." });
    const otherOwner = await asNewUser(t, "similar-facts-other@example.com");
    const otherWorkspace = await otherOwner.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co", website: "https://other.example" });
    const otherFactId = await otherOwner.client.mutation(api.orgs.addFact, { slug: otherWorkspace.slug, category: "product", statement: "Pro plan includes team reporting and analytics." });
    const facts = await owner.client.query(api.siteWatch.facts, { slug });

    expect(facts?.possibleDuplicateFacts).toEqual([{ first: { id: firstId, statement: "Pro plan includes team reporting and analytics." }, second: { id: secondId, statement: "The Pro plan offers team reports plus analytics." } }]);
    expect(facts?.facts.map((fact) => fact.id)).toEqual(expect.arrayContaining([firstId, secondId, otherEntityId]));
    expect(JSON.stringify(facts)).not.toContain(String(otherFactId));
    expect(await t.run(async (ctx) => [await ctx.db.get(firstId), await ctx.db.get(secondId)])).toEqual([
      expect.objectContaining({ reviewState: "confirmed" }),
      expect.objectContaining({ reviewState: "confirmed" }),
    ]);
  });

  it("queues a permission-checked, bounded homepage readiness scan", async () => {
    const t = setup();
    const owner = await asNewUser(t, "readiness@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Site Co", website: "https://site.example" });
    expect(await owner.client.query(api.siteWatch.searchReadiness, { slug })).toEqual({ businessName: "Site Co", website: "https://site.example", scan: null, inventory: [] });
    await owner.client.mutation(api.siteWatch.scanSearchReadiness, { slug });
    const result = await owner.client.query(api.siteWatch.searchReadiness, { slug });
    expect(result?.scan).toEqual(expect.objectContaining({ status: "queued", startedAt: expect.any(Number) }));
    const viewer = await asNewUser(t, "readiness-viewer@example.com");
    await t.run(async (ctx) => ctx.db.insert("memberships", { orgId: orgId as Id<"organizations">, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    await expect(viewer.client.query(api.siteWatch.searchReadiness, { slug })).resolves.toMatchObject({ businessName: "Site Co", website: "https://site.example" });
    await expect(viewer.client.mutation(api.siteWatch.scanSearchReadiness, { slug })).rejects.toThrow(/role \(viewer\) can't/);
  });

  it("shows a tenant-scoped inventory from saved same-site conversion audits", async () => {
    const t = setup();
    const owner = await asNewUser(t, "inventory@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Site Co", website: "https://site.example" });
    const now = Date.now();
    const output = JSON.stringify({ auditCoverage: {
      website: { requestedUrl: "https://site.example/", discoveredCandidates: 8, pagesSampled: 1, pagesRead: 1, pages: [{ url: "https://site.example/pricing/", status: "read" }] },
      seoReadiness: { state: "measured", pagesWithStaticHtml: 1, pages: [{ url: "https://site.example/pricing/", metadataState: "observed", titleLength: 50, descriptionLength: 120, headingCounts: { h1: 1, h2: 2, h3: 0 }, canonicalUrl: null, robotsDirectives: null, structuredDataTypes: [] }], findings: [{ id: "missing-description", level: "attention", title: "Search description is missing", evidence: "No description was found.", nextStep: "Add a clear summary.", pageUrl: "https://site.example/pricing/" }] },
    } });
    const addRun = (workspaceId: Id<"organizations">, requestedUrl: string, createdAt: number) => t.run(async (ctx) => ctx.db.insert("workflowRuns", {
      orgId: workspaceId, kind: "conversion_audit", title: "Website review", status: "verified", input: "{}", output: JSON.stringify({ auditCoverage: { website: { requestedUrl } } }), roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "test", entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 0, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt, updatedAt: createdAt, finishedAt: createdAt,
    }));
    const auditRunId = await t.run(async (ctx) => ctx.db.insert("workflowRuns", {
      orgId: orgId as Id<"organizations">, kind: "conversion_audit", title: "Website review", status: "verified", input: "{}", output, roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "test", entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 0, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: now, updatedAt: now, finishedAt: now,
    }));
    await addRun(orgId as Id<"organizations">, "https://old.example/", now + 1);
    const other = await asNewUser(t, "other-inventory@example.com");
    const otherWorkspace = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co", website: "https://other.example" });
    await addRun(otherWorkspace.orgId as Id<"organizations">, "https://site.example/", now + 2);

    const result = await owner.client.query(api.siteWatch.searchReadiness, { slug });
    expect(result?.inventory).toHaveLength(1);
    expect(result?.inventory[0]).toMatchObject({ website: "https://site.example/", discoveredCandidates: 8, pagesRead: 1, pages: [{ url: "https://site.example/pricing/", findings: [{ id: "missing-description" }] }] });
    await expect(owner.client.mutation(api.seoOpportunities.updateFindingState, { slug, runId: auditRunId, pageUrl: "https://outside.example/", findingId: "missing-description", state: "addressed" })).rejects.toThrow(/Choose a finding from the saved review/);
    await owner.client.mutation(api.seoOpportunities.updateFindingState, { slug, runId: auditRunId, pageUrl: "https://site.example/pricing/", findingId: "missing-description", state: "addressed" });
    await expect(owner.client.query(api.siteWatch.searchReadiness, { slug })).resolves.toMatchObject({ inventory: [{ pages: [{ findings: [{ id: "missing-description", state: "addressed" }] }] }] });
    await owner.client.mutation(api.seoOpportunities.updateFindingState, { slug, runId: auditRunId, pageUrl: "https://site.example/pricing/", findingId: "missing-description", state: "open" });
    await expect(owner.client.query(api.siteWatch.searchReadiness, { slug })).resolves.toMatchObject({ inventory: [{ pages: [{ findings: [{ id: "missing-description", state: "open" }] }] }] });
    await owner.client.mutation(api.seoOpportunities.updateFindingState, { slug, runId: auditRunId, pageUrl: "https://site.example/pricing/", findingId: "missing-description", state: "not_relevant" });
    await expect(owner.client.query(api.siteWatch.searchReadiness, { slug })).resolves.toMatchObject({ inventory: [{ pages: [{ findings: [{ id: "missing-description", state: "not_relevant" }] }] }] });
    await expect(other.client.mutation(api.seoOpportunities.updateFindingState, { slug, runId: auditRunId, pageUrl: "https://site.example/pricing/", findingId: "missing-description", state: "addressed" })).rejects.toThrow(/workspace|member|organization/i);
  });
});
