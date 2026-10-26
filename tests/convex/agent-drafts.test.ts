import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AGENT_DRAFTS_PER_DAY } from "../../convex/agentDrafts";
import { climbToolDefs } from "../../convex/lib/climbTools";
import { asNewUser, setup, type T, makePaid } from "./helpers";

/** Drafts an outside agent wrote itself: saved for review over MCP, no ClimbOS model run, no credits. */

async function workspaceWithToken(t: T, scopes: ("draft" | "request_approval")[] = ["draft"], email = "agent-drafts@example.com") {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Agent Co" });
  await makePaid(t, orgId);
  await owner.client.mutation(api.agentTokens.create, { slug, name: "Claude Desktop", scopes, days: 30 });
  const { tokens } = await owner.client.query(api.agentTokens.list, { slug });
  // The identity the MCP server signs for this token (convex/mcp.ts identityFor).
  const agent = t.withIdentity({ subject: `${owner.userId}|mcp-${tokens[0].id}`, tokenIdentifier: `test|${owner.userId}|mcp` });
  return { ...owner, slug, orgId: orgId as Id<"organizations">, tokenId: tokens[0].id, agent };
}

const post = { kind: "social_post" as const, channel: "linkedin" as const, title: "Spring launch", body: "We just opened spring bookings. Pick a time that suits you." };

describe("save_draft: drafts an agent wrote itself", () => {
  it("saves for review with the agent's name, runs no ClimbOS job and uses no credits", async () => {
    const t = setup();
    const w = await workspaceWithToken(t);
    const before = await w.client.query(api.workspace.credits, { slug: w.slug });
    const runsBefore = await t.run((ctx) => ctx.db.query("workflowRuns").collect());

    const { artifactId } = await w.agent.mutation(api.agentDrafts.save, { slug: w.slug, ...post, hashtags: ["#spring", "booking"], destinationUrl: "https://agent.example.com/book" });

    const draft = await w.client.query(api.content.get, { slug: w.slug, artifactId });
    expect(draft.status).toBe("in_review");
    expect(draft.agentName).toBe("Claude Desktop");
    expect(draft.current?.body).toContain("spring bookings");
    expect(draft.current?.hashtags).toEqual(["spring", "booking"]);
    const after = await w.client.query(api.workspace.credits, { slug: w.slug });
    expect(after).toEqual(before);
    expect((await t.run((ctx) => ctx.db.query("workflowRuns").collect())).length).toBe(runsBefore.length);
    const log = await t.run((ctx) => ctx.db.query("auditEvents").collect());
    expect(log.some((e) => e.action === "content.agent_draft_saved" && e.actorType === "agent")).toBe(true);
  });

  it("flags risky claims exactly like ClimbOS's own drafts", async () => {
    const t = setup();
    const w = await workspaceWithToken(t);
    const { unsupportedClaims } = await w.agent.mutation(api.agentDrafts.save, { slug: w.slug, ...post, body: "Guaranteed results: double your revenue in 30 days." });
    expect(unsupportedClaims.length).toBeGreaterThan(0);
  });

  it("only a draft-scoped agent token for this workspace can save", async () => {
    const t = setup();
    const w = await workspaceWithToken(t);
    // The person in the app (or Climb AI acting for them) is not an agent token.
    await expect(w.client.mutation(api.agentDrafts.save, { slug: w.slug, ...post })).rejects.toThrow(/connected agent/);

    const readOnly = await workspaceWithToken(t, [], "agent-read@example.com");
    await expect(readOnly.agent.mutation(api.agentDrafts.save, { slug: readOnly.slug, ...post })).rejects.toThrow(/Prepare work/);

    // A token can't write into a workspace it doesn't belong to.
    await expect(readOnly.agent.mutation(api.agentDrafts.save, { slug: w.slug, ...post })).rejects.toThrow();

    await w.client.mutation(api.agentTokens.revoke, { slug: w.slug, tokenId: w.tokenId });
    await expect(w.agent.mutation(api.agentDrafts.save, { slug: w.slug, ...post })).rejects.toThrow(/no longer works/);
  });

  it("checks channel fit, links and platform length before review", async () => {
    const t = setup();
    const w = await workspaceWithToken(t);
    await expect(w.agent.mutation(api.agentDrafts.save, { slug: w.slug, ...post, channel: "email" })).rejects.toThrow(/can go to/);
    await expect(w.agent.mutation(api.agentDrafts.save, { slug: w.slug, ...post, destinationUrl: "http://insecure.example.com" })).rejects.toThrow(/https/);
    await expect(w.agent.mutation(api.agentDrafts.save, { slug: w.slug, ...post, channel: "x", body: "a".repeat(281) })).rejects.toThrow(/characters on X/);
    await expect(w.agent.mutation(api.agentDrafts.save, { slug: w.slug, ...post, body: "   " })).rejects.toThrow(/empty/);
  });

  it("refuses while the workspace is paused", async () => {
    const t = setup();
    const w = await workspaceWithToken(t);
    await w.client.mutation(api.workspace.pauseAll, { slug: w.slug, reason: "test" });
    await expect(w.agent.mutation(api.agentDrafts.save, { slug: w.slug, ...post })).rejects.toThrow(/paused/);
  });

  it(`caps each token at ${AGENT_DRAFTS_PER_DAY} drafts a day`, async () => {
    const t = setup();
    const w = await workspaceWithToken(t);
    await t.run(async (ctx) => {
      const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", w.orgId)).first();
      const now = Date.now();
      for (let i = 0; i < AGENT_DRAFTS_PER_DAY; i++) {
        await ctx.db.insert("artifacts", { orgId: w.orgId, businessId: business!._id, kind: "social_post", channel: "linkedin", title: `Saved ${i}`, status: "in_review", currentVersion: 1, agentTokenId: w.tokenId as Id<"agentTokens">, agentName: "Claude Desktop", createdAt: now - i * 1000, updatedAt: now });
      }
    });
    await expect(w.agent.mutation(api.agentDrafts.save, { slug: w.slug, ...post })).rejects.toThrow(/in the last day/);
  });
});

describe("get_brand_context", () => {
  it("returns the voice and only owner-confirmed facts", async () => {
    const t = setup();
    const w = await workspaceWithToken(t);
    await t.run(async (ctx) => {
      const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", w.orgId)).first())!;
      const now = Date.now();
      await ctx.db.insert("brandProfiles", { orgId: w.orgId, businessId: business._id, voice: "Warm and plain", toneWords: ["warm"], colors: [], doNots: ["No emojis"], updatedAt: now });
      const fact = { orgId: w.orgId, businessId: business._id, category: "pricing" as const, confidence: "high" as const, provenance: "owner_supplied" as const, sourceIds: [], createdAt: now, updatedAt: now };
      await ctx.db.insert("businessFacts", { ...fact, statement: "Classes cost $20.", reviewState: "confirmed" });
      await ctx.db.insert("businessFacts", { ...fact, statement: "Classes cost $5.", reviewState: "needs_review" });
      await ctx.db.insert("businessFacts", { ...fact, statement: "Classes are free.", reviewState: "rejected" });
    });
    const c = await w.agent.query(api.agentDrafts.context, { slug: w.slug });
    expect(c.voice?.description).toBe("Warm and plain");
    expect(c.voice?.doNots).toEqual(["No emojis"]);
    expect(c.facts.map((f) => f.statement)).toEqual(["Classes cost $20."]);
  });
});

describe("tool registry", () => {
  it("offers save_draft to outside agents only, never to Climb AI in the app", () => {
    const inApp = climbToolDefs({ ui: true }).map((d) => d.name);
    expect(inApp).not.toContain("save_draft");
    expect(inApp).toContain("get_brand_context");
  });
});
