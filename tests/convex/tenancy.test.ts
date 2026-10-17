import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("tenant isolation", () => {
  it("a second tenant cannot read, mutate or export the first tenant's data", async () => {
    const t = setup();
    const alice = await asNewUser(t, "alice@example.com");
    const bob = await asNewUser(t, "bob@example.com");
    const { slug: aliceSlug } = await alice.client.mutation(api.orgs.createWorkspace, { businessName: "Alice Co", website: "alice.example.com" });
    await bob.client.mutation(api.orgs.createWorkspace, { businessName: "Bob Co" });

    // Alice has data: a fact and an artifact.
    const factId = await alice.client.mutation(api.orgs.addFact, { slug: aliceSlug, category: "product", statement: "We sell widgets." });
    const orgId = await t.run(async (ctx) => (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", aliceSlug)).unique())!._id);
    const artifactId = await t.run(async (ctx) => {
      const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first())!;
      const id = await ctx.db.insert("artifacts", { orgId, businessId: business._id, kind: "social_post", channel: "instagram", title: "Secret post", status: "in_review", currentVersion: 1, createdAt: Date.now(), updatedAt: Date.now() });
      const v = await ctx.db.insert("artifactVersions", { orgId, artifactId: id, version: 1, body: "Secret", hashtags: [], claimFactIds: [], unsupportedClaims: [], contentHash: "h", createdAt: Date.now() });
      await ctx.db.patch(id, { currentVersionId: v });
      return id;
    });

    // Bob is not a member: every read returns NOT_FOUND (existence not leaked).
    await expect(bob.client.query(api.orgs.onboardingState, { slug: aliceSlug })).rejects.toThrow(/couldn't find that workspace/);
    await expect(bob.client.query(api.workspace.today, { slug: aliceSlug })).rejects.toThrow(/couldn't find/);
    await expect(bob.client.query(api.content.get, { slug: aliceSlug, artifactId })).rejects.toThrow(/couldn't find/);
    await expect(bob.client.query(api.connections.list, { slug: aliceSlug })).rejects.toThrow(/couldn't find/);
    await expect(bob.client.query(api.analytics.overview, { slug: aliceSlug })).rejects.toThrow(/couldn't find/);
    await expect(bob.client.query(api.billing.overview, { slug: aliceSlug })).rejects.toThrow(/couldn't find/);

    // Mutations and exports are refused.
    await expect(bob.client.mutation(api.content.edit, { slug: aliceSlug, artifactId, body: "hijacked", hashtags: [] })).rejects.toThrow(/couldn't find/);
    await expect(bob.client.mutation(api.content.decide, { slug: aliceSlug, artifactId, decision: "approve" })).rejects.toThrow(/couldn't find/);
    await expect(bob.client.mutation(api.orgs.reviewFact, { slug: aliceSlug, factId, action: "reject" })).rejects.toThrow(/couldn't find/);
    await expect(bob.client.mutation(api.settings.requestExport, { slug: aliceSlug })).rejects.toThrow(/couldn't find/);
    await expect(bob.client.mutation(api.workspace.pauseAll, { slug: aliceSlug })).rejects.toThrow(/couldn't find/);

    // Using Bob's own slug with Alice's document ids is also refused.
    const bobSlug = (await bob.client.query(api.orgs.me))!.orgs[0].slug;
    await expect(bob.client.query(api.content.get, { slug: bobSlug, artifactId })).rejects.toThrow(/couldn't find that draft/);
    await expect(bob.client.mutation(api.orgs.reviewFact, { slug: bobSlug, factId, action: "reject" })).rejects.toThrow(/couldn't find that fact/);

    // Alice's data is untouched.
    const art = await t.run(async (ctx) => ctx.db.get(artifactId));
    expect(art?.status).toBe("in_review");
  });

  it("connection secrets are encrypted at rest, bound to the tenant and never returned by public queries", async () => {
    const t = setup();
    const alice = await asNewUser(t, "alice@example.com");
    const { slug, orgId } = await alice.client.mutation(api.orgs.createWorkspace, { businessName: "Alice Co" });
    const connectionId = await t.mutation(internal.connections.storeConnection, {
      orgId,
      userId: alice.userId,
      provider: "email_resend",
      secret: JSON.stringify({ apiKey: "re_supersecret_123" }),
      secretKind: "api_key",
      scopes: [],
      accountLabel: "Your Resend account",
    });
    const raw = await t.run(async (ctx) => ctx.db.query("connectionSecrets").withIndex("by_connection", (q) => q.eq("connectionId", connectionId)).first());
    expect(raw?.ciphertext).toBeDefined();
    expect(raw?.ciphertext).not.toContain("supersecret");
    const listed = await alice.client.query(api.connections.list, { slug });
    expect(JSON.stringify(listed)).not.toContain("supersecret");
    const decrypted = await t.query(internal.connections.getSecret, { connectionId });
    expect(decrypted?.value).toContain("re_supersecret_123");

    // A ciphertext copied to another tenant's connection fails authentication (AAD binds org + connection).
    const bob = await asNewUser(t, "bob@example.com");
    const bobOrg = await bob.client.mutation(api.orgs.createWorkspace, { businessName: "Bob Co" });
    const stolen = await t.run(async (ctx) => {
      const c = await ctx.db.insert("connections", { orgId: bobOrg.orgId, provider: "email_resend", status: "connected", scopes: [], isFixture: false, createdBy: bob.userId, createdAt: Date.now(), updatedAt: Date.now() });
      await ctx.db.insert("connectionSecrets", { orgId: bobOrg.orgId, connectionId: c, kind: "api_key", keyId: raw!.keyId, iv: raw!.iv, ciphertext: raw!.ciphertext, createdAt: Date.now() });
      return c;
    });
    await expect(t.query(internal.connections.getSecret, { connectionId: stolen })).rejects.toThrow(/decrypt/);
  });

  it("roles are enforced server-side", async () => {
    const t = setup();
    const owner = await asNewUser(t, "owner@example.com");
    const viewer = await asNewUser(t, "viewer@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Owner Co" });
    await t.run(async (ctx) => ctx.db.insert("memberships", { orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    await expect(viewer.client.query(api.workspace.today, { slug })).resolves.toBeTruthy();
    await expect(viewer.client.mutation(api.orgs.addFact, { slug, category: "other", statement: "x" })).rejects.toThrow(/role \(viewer\) can't/);
    await expect(viewer.client.mutation(api.workspace.sendChat, { slug, text: "hi" })).rejects.toThrow(/can't/);
    await expect(viewer.client.mutation(api.settings.invite, { slug, email: "x@example.com", role: "admin" })).rejects.toThrow(/can't/);
  });

  it("operator access is a separate allowlist", async () => {
    const t = setup();
    const ops = await asNewUser(t, "ops@example.com");
    const customer = await asNewUser(t, "customer@example.com");
    await customer.client.mutation(api.orgs.createWorkspace, { businessName: "Customer Co" });
    expect(await ops.client.query(api.ops.isOperatorQuery, {})).toBe(true);
    expect(await customer.client.query(api.ops.isOperatorQuery, {})).toBe(false);
    await expect(customer.client.query(api.ops.dashboard, {})).rejects.toThrow(/Not found/);
    const anon = await asNewUser(t, "ops@example.com", { anonymous: true });
    expect(await anon.client.query(api.ops.isOperatorQuery, {})).toBe(false);
  });
});
