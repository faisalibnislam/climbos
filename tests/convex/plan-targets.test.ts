import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { sha256Hex } from "../../shared/policy";
import { asNewUser, makePaid, setup, type T } from "./helpers";

/**
 * S6 behind plan_targets (REQ-TARGET-01..06, REQ-UX-02/03): approving a plan
 * starts the first target-heavy play's search, linked by play ID; results
 * merge with the existing pipeline without resetting anyone's stage; opted-out
 * and contacted targets are never counted as contactable; no flag, no change.
 */

const creatorPlay = { id: "pl_creators1", name: "Studio creator demos", oneLiner: "Creators show a class", kind: "creative", audience: "Yoga creators in the UK with studio followings", mechanic: "Gifted class for a tutorial", climbosCanDo: "Creator finder drafts pitches", hook: "Film a class with us", p10: 1, p50: 3, p90: 6, horizonDays: 90 };
const seoPlay = { id: "pl_seo1", name: "Comparison pages", oneLiner: "Vs pages", kind: "bankable", audience: "Buyers comparing tools", mechanic: "Write comparison pages", climbosCanDo: "Drafts the pages", hook: "h", p10: 1, p50: 2, p90: 3, horizonDays: 90 };

async function workspace(t: T, email: string, flags: string[] = ["plan_targets"]) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Flow Studio" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More members", horizonDays: 90, monthlyAdBudget: 0 });
  const id = orgId as Id<"organizations">;
  await makePaid(t, id);
  for (const flag of flags) await t.mutation(internal.engineFlags.setEngineFlag, { orgId: id, flag, on: true });
  const strategyId = await t.run(async (ctx) => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", id)).first())!;
    const goalId = (await ctx.db.query("goals").withIndex("by_org_status", (q) => q.eq("orgId", id).eq("status", "active")).first())!._id;
    return ctx.db.insert("strategies", {
      orgId: id, businessId: business._id, goalId, version: 1, status: "needs_approval", summary: "s", audiences: [], positioning: "p", channels: [], constraints: [], measurementPlan: "m", reviewDate: "2026-11-01", sourceFactIds: [], generationCostMicros: 0, createdAt: Date.now(),
      expert: { diagnosis: "d", affordableCac: "a", notDoing: [], northStar: { metric: "m", baseline: "0", target: "5" }, leadingIndicators: [], phases: [], weekOneChecklist: [], risks: [], plays: [seoPlay, creatorPlay] },
    } as never);
  });
  return { ...owner, slug, orgId: id, strategyId: strategyId as Id<"strategies"> };
}

const creator = (handle: string, email = "") => ({ company: `Creator ${handle}`, website: `https://www.instagram.com/${handle}/`, location: "London", sizeBand: "", why: "Teaches beginner flows", evidence: [{ url: `https://www.instagram.com/${handle}/`, observation: "Recent class reel" }], trigger: "", fit: 80, timing: 60, contact: email ? "Email in bio" : "Not found", publicEmail: email || undefined });
const outreach = { sequence: [{ day: 0, subject: "Collab?", body: "{{firstLine}}", purpose: "open" }], firstLines: [], ownerNotes: [] };

describe("plan targets (flagged)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-10-19T08:00:00Z"));
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("approval starts the creator play's search; results merge, stay distinct per profile, and never re-contact", async () => {
    const t = setup();
    const w = await workspace(t, "targets@example.com");
    // Already in the pipeline from an earlier search: contacted, and one who opted out.
    await t.run(async (ctx) => {
      const now = Date.now();
      const old = await ctx.db.insert("outboundCampaigns", { orgId: w.orgId, title: "Old", kind: "creators", brief: { who: "", where: "", count: 5 }, status: "archived", sequence: [], ownerNotes: [], excluded: [], createdBy: w.userId, createdAt: now - 1000, updatedAt: now - 1000 });
      const base = { orgId: w.orgId, campaignId: old, location: "", sizeBand: "", why: "", evidence: [], trigger: "", fit: 50, timing: 50, contact: "", firstLine: "", createdAt: now, updatedAt: now };
      await ctx.db.insert("prospects", { ...base, company: "Ana", domain: "instagram:studio.ana", website: "https://instagram.com/studio.ana", publicEmail: "ana@studioana.com", stage: "contacted" });
      await ctx.db.insert("suppressions", { orgId: w.orgId, emailHash: await sha256Hex("ben@benflows.com"), reason: "unsubscribe", source: "test", createdAt: now });
    });

    const work = await w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: w.strategyId, decision: "approve" });
    expect(work?.started).toContain("Targets: Studio creator demos");
    const campaign = await t.run(async (ctx) => (await ctx.db.query("outboundCampaigns").withIndex("by_org_created", (q) => q.eq("orgId", w.orgId)).order("desc").first())!);
    expect(campaign).toMatchObject({ kind: "creators", playId: "pl_creators1", strategyId: w.strategyId, status: "researching", brief: { who: creatorPlay.audience, count: 10 } });
    let view = await w.client.query(api.targets.forStrategy, { slug: w.slug, strategyId: w.strategyId });
    expect(Object.keys(view!)).toEqual(["pl_creators1"]); // the SEO play needs no search
    expect(view!.pl_creators1).toMatchObject({ state: "researching", campaignId: campaign._id });

    // The search returns: Ana again (URL variant), two new creators on the same platform, Ben who opted out, and a duplicate row.
    await t.mutation(internal.outbound.saveResult, {
      campaignId: campaign._id,
      prospects: { icp: { summary: "", mustHaves: [], disqualifiers: [], triggers: [], decisionMaker: "" }, excluded: [], prospects: [creator("Studio.Ana", "ana@studioana.com"), creator("mia.moves"), creator("mia.moves"), creator("benflows", "ben@benflows.com"), creator("leo.yoga", "leo@leoyoga.com")] },
      outreach,
    });
    const rows = await t.run(async (ctx) => ctx.db.query("prospects").withIndex("by_org_stage", (q) => q.eq("orgId", w.orgId)).collect());
    expect(rows.map((r) => r.domain).sort()).toEqual(["instagram:benflows", "instagram:leo.yoga", "instagram:mia.moves", "instagram:studio.ana"]);
    const ana = rows.find((r) => r.domain === "instagram:studio.ana")!;
    expect(ana).toMatchObject({ stage: "contacted", playIds: ["pl_creators1"] }); // merged, stage kept
    const mia = rows.find((r) => r.domain === "instagram:mia.moves")!;
    expect(mia).toMatchObject({ platform: "instagram", handle: "mia.moves", playIds: ["pl_creators1"] });
    expect(mia.publicEmail).toBeUndefined(); // no email invented; the profile stays


    // Mailbox not connected: Leo is contactable but sending needs the connection.
    view = await w.client.query(api.targets.forStrategy, { slug: w.slug, strategyId: w.strategyId });
    expect(view!.pl_creators1).toMatchObject({ state: "needs_connection", counts: { found: 4, eligible: 2, contactable: 1, excluded: 1, inRelationship: 1 } });
    const listed = view!.pl_creators1.targets;
    expect(listed.find((x) => x.name.includes("benflows"))).toMatchObject({ suppressed: true, contactRoute: "none" });
    expect(listed.find((x) => x.name.includes("mia.moves"))).toMatchObject({ contactRoute: "none", url: "https://www.instagram.com/mia.moves/" });

    // A refreshed plan keeps the play ID, so it keeps the targets and doesn't start a duplicate search.
    const v2 = await t.run(async (ctx) => {
      const s = (await ctx.db.get(w.strategyId))!;
      const { _id: _i, _creationTime: _c, ...rest } = s;
      return ctx.db.insert("strategies", { ...rest, version: 2, status: "needs_approval", createdAt: Date.now() + 1 });
    });
    const work2 = await w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: v2, decision: "approve" });
    expect(work2?.started.some((s) => s.startsWith("Targets"))).toBe(false);
    expect((await w.client.query(api.targets.forStrategy, { slug: w.slug, strategyId: v2 }))!.pl_creators1.counts.found).toBe(4);
  });

  it("an open campaign that's sending is never paused on its own: the play waits for the owner", async () => {
    const t = setup();
    const w = await workspace(t, "waiting@example.com");
    const live = await t.run(async (ctx) => {
      const now = Date.now();
      return ctx.db.insert("outboundCampaigns", { orgId: w.orgId, title: "Live", brief: { who: "", where: "", count: 5 }, status: "review", sequence: [], ownerNotes: [], excluded: [], sending: { status: "on", startedAt: now, startedBy: w.userId, senderName: "A", company: "B", address: "C" }, createdBy: w.userId, createdAt: now, updatedAt: now });
    });
    const work = await w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: w.strategyId, decision: "approve" });
    expect(work?.waiting).toContainEqual({ title: "Targets for your plays", reason: expect.stringContaining("sending") });
    expect((await t.run((ctx) => ctx.db.get(live)))?.sending?.status).toBe("on");
    const view = await w.client.query(api.targets.forStrategy, { slug: w.slug, strategyId: w.strategyId });
    expect(view!.pl_creators1).toMatchObject({ state: "waiting", canStart: true });
    // The owner chooses to start it, and is told sending paused.
    const r = await w.client.mutation(api.targets.startForPlay, { slug: w.slug, strategyId: w.strategyId, playId: "pl_creators1" });
    expect(r.pausedSending).toBe(true);
    await expect(w.client.mutation(api.targets.startForPlay, { slug: w.slug, strategyId: w.strategyId, playId: "pl_seo1" })).rejects.toThrow(/doesn't need a target search/);
  });

  it("flag off: approval starts no search, the plan shows no targets, and the button is refused", async () => {
    const t = setup();
    const w = await workspace(t, "off@example.com", []);
    const work = await w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: w.strategyId, decision: "approve" });
    expect(work?.started.some((s) => s.startsWith("Targets"))).toBe(false);
    expect(await t.run(async (ctx) => ctx.db.query("outboundCampaigns").collect())).toHaveLength(0);
    expect(await w.client.query(api.targets.forStrategy, { slug: w.slug, strategyId: w.strategyId })).toBeNull();
    await expect(w.client.mutation(api.targets.startForPlay, { slug: w.slug, strategyId: w.strategyId, playId: "pl_creators1" })).rejects.toThrow(/isn't switched on/);
  });

  it("another workspace can't read a plan's targets", async () => {
    const t = setup();
    const w = await workspace(t, "a-tenant@example.com");
    const other = await workspace(t, "b-tenant@example.com");
    await expect(other.client.query(api.targets.forStrategy, { slug: other.slug, strategyId: w.strategyId })).rejects.toThrow();
  });

  it("Make it happen uses the stored play by ID (REQ-UX-03)", async () => {
    const t = setup();
    const w = await workspace(t, "start@example.com", []);
    const { messageId } = await w.client.mutation(api.workspace.startPlay, { slug: w.slug, strategyId: w.strategyId, playId: "pl_creators1" });
    const msg = await t.run((ctx) => ctx.db.get(messageId));
    expect(msg?.text).toContain('Start the "Studio creator demos" play (plan v1, play pl_creators1)');
    expect(msg?.text).toContain("Creator finder drafts pitches");
    await expect(w.client.mutation(api.workspace.startPlay, { slug: w.slug, strategyId: w.strategyId, playId: "pl_nope" })).rejects.toThrow(/isn't in this plan/);
  });
});
