import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

async function completedPreview(t: ReturnType<typeof setup>, token: string, website: string, expiresAt = Date.now() + 86_400_000, status: "done" | "planning" = "done") {
  await t.run((ctx) => ctx.db.insert("previews", {
    token,
    ipHash: "test-ip-hash",
    website,
    goal: "Get more customers",
    status,
    steps: [
      { key: "reading", label: "Reading your website", status: "done" },
      { key: "understanding", label: "Understanding your business", status: "done" },
      { key: "planning", label: "Drafting first growth ideas", status: "done" },
    ],
    business: { name: "Preview Business", summary: "A reported business profile", audience: "People seeking help", category: "services" },
    facts: [
      { statement: "The website lists a paid consultation.", sourceUrl: website, confidence: "high", category: "offer" },
      { statement: "The website names a local service area.", sourceUrl: website, confidence: "medium", category: "audience" },
    ],
    ideas: [],
    costMicros: 10_000,
    createdAt: Date.now(),
    expiresAt,
  }));
}

describe("public website preview claiming", () => {
  it("records the first homepage snapshot once and records the final completion time", async () => {
    const t = setup();
    const createdAt = Date.now() - 15_000;
    await t.run((ctx) => ctx.db.insert("previews", {
      token: "timing-preview-token",
      ipHash: "test-ip-hash",
      website: "https://example.com/",
      goal: "Get more customers",
      status: "understanding",
      steps: [
        { key: "reading", label: "Reading your website", status: "done" },
        { key: "understanding", label: "Understanding your business", status: "running" },
        { key: "planning", label: "Drafting first growth ideas", status: "pending" },
      ],
      facts: [],
      ideas: [],
      costMicros: 0,
      createdAt,
      expiresAt: Date.now() + 86_400_000,
    }));

    await t.mutation(internal.preview.update, { token: "timing-preview-token", patch: {
      status: "planning",
      stepKey: "understanding",
      stepStatus: "done",
      business: { name: "Example", summary: "A page summary", audience: "Page visitors", category: "services" },
      firstValueReady: true,
    } });
    const first = await t.query(api.preview.get, { token: "timing-preview-token" });
    expect(first?.firstValueMs).toBeGreaterThanOrEqual(15_000);
    expect(first?.completedMs).toBeNull();

    await t.mutation(internal.preview.update, { token: "timing-preview-token", patch: {
      status: "done",
      stepKey: "planning",
      stepStatus: "done",
      ideas: [],
      firstValueReady: true,
    } });
    const complete = await t.query(api.preview.get, { token: "timing-preview-token" });
    expect(complete?.firstValueMs).toEqual(first?.firstValueMs);
    expect(complete?.completedMs).toBeGreaterThanOrEqual(complete?.firstValueMs ?? 0);
  });

  it("accepts one optional usefulness response only after the snapshot is complete", async () => {
    const t = setup();
    await completedPreview(t, "useful-preview-token", "https://example.com/");
    await completedPreview(t, "unfinished-preview-token", "https://example.com/", Date.now() + 86_400_000, "planning");
    await expect(t.mutation(api.preview.recordUsefulness, { token: "unfinished-preview-token", usefulness: "useful" })).resolves.toEqual({ recorded: false });
    await expect(t.mutation(api.preview.recordUsefulness, { token: "useful-preview-token", usefulness: "useful" })).resolves.toEqual({ recorded: true });
    await expect(t.mutation(api.preview.recordUsefulness, { token: "useful-preview-token", usefulness: "not_yet" })).resolves.toEqual({ recorded: false });
    await expect(t.query(api.preview.get, { token: "useful-preview-token" })).resolves.toMatchObject({ usefulness: "useful" });
  });

  it("imports same-site facts as sourced items awaiting owner review, once", async () => {
    const t = setup();
    const owner = await asNewUser(t, "preview-owner@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Owner Business", website: "https://www.example.com" });
    await completedPreview(t, "preview-token", "https://example.com/");

    await expect(owner.client.mutation(api.preview.claim, { token: "preview-token", orgId })).resolves.toMatchObject({ imported: 2, website: "https://example.com/", goal: "Get more customers" });
    const imported = await t.run(async (ctx) => {
      const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first();
      const facts = business ? await ctx.db.query("businessFacts").withIndex("by_business", (q) => q.eq("businessId", business._id)).collect() : [];
      const sources = business ? await ctx.db.query("factSources").withIndex("by_business", (q) => q.eq("businessId", business._id)).collect() : [];
      return { business, facts, sources };
    });
    expect(imported.business?.researchStatus).toBe("partial");
    expect(imported.facts).toHaveLength(2);
    expect(imported.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "offer", statement: "The website lists a paid consultation.", confidence: "high", reviewState: "needs_review", provenance: "researched" }),
      expect.objectContaining({ category: "audience", statement: "The website names a local service area.", confidence: "medium", reviewState: "needs_review", provenance: "researched" }),
    ]));
    expect(imported.sources).toHaveLength(1);
    expect(imported.sources[0]).toMatchObject({ kind: "website", url: "https://example.com/", title: "ClimbOS public website preview", status: "ok" });
    expect(imported.facts.every((fact) => fact.sourceIds.includes(imported.sources[0]._id))).toBe(true);
    await expect(owner.client.mutation(api.preview.claim, { token: "preview-token", orgId })).resolves.toMatchObject({ imported: 0 });
    await expect(t.run((ctx) => ctx.db.query("businessFacts").collect())).resolves.toHaveLength(2);
  });

  it("does not import a preview into a different site and rejects expired previews", async () => {
    const t = setup();
    const owner = await asNewUser(t, "different-site@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Different Business", website: "https://different.example" });
    await completedPreview(t, "wrong-site-token", "https://example.com/");
    await completedPreview(t, "expired-token", "https://different.example/", Date.now() - 1);

    await expect(owner.client.mutation(api.preview.claim, { token: "wrong-site-token", orgId })).resolves.toMatchObject({ imported: 0 });
    await expect(owner.client.mutation(api.preview.claim, { token: "expired-token", orgId })).resolves.toMatchObject({ imported: 0 });
    await expect(t.run((ctx) => ctx.db.query("businessFacts").collect())).resolves.toHaveLength(0);
    const previews = await t.run((ctx) => ctx.db.query("previews").collect());
    expect(previews.every((preview) => !preview.claimedByOrgId)).toBe(true);
  });
});
