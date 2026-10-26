import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup, type T } from "./helpers";

/**
 * Platform connections end to end with mocked provider responses: Page/organization
 * choosers, identity, disconnect with revocation, approvals invalidation, tenant
 * isolation, audit logs, and the staff-only setup guide.
 */

type Route = { match: (url: string, method: string) => boolean; respond: (url: string, body: string) => unknown; status?: number };
const calls: { url: string; method: string; body: string }[] = [];

function stubProviders(routes: Route[]) {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? init.body : init?.body instanceof URLSearchParams ? init.body.toString() : "";
    calls.push({ url, method, body });
    const route = routes.find((r) => r.match(url, method));
    if (!route) return new Response(JSON.stringify({ error: { message: `unmocked ${method} ${url}` } }), { status: 404, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify(route.respond(url, body)), { status: route.status ?? 200, headers: { "content-type": "application/json" } });
  }));
}

const META_ROUTES: Route[] = [
  { match: (u, m) => m === "POST" && u.startsWith("https://graph.facebook.com/v26.0/oauth/access_token"), respond: () => ({ access_token: "short-user", expires_in: 3600 }) },
  { match: (u) => u.includes("/oauth/access_token?") && u.includes("fb_exchange_token"), respond: () => ({ access_token: "long-user", expires_in: 5_183_944 }) },
  { match: (u, m) => m === "GET" && u.includes("/me/permissions"), respond: () => ({ data: ["pages_show_list", "business_management", "pages_manage_posts", "pages_read_engagement", "read_insights"].map((permission) => ({ permission, status: "granted" })) }) },
  { match: (u, m) => m === "DELETE" && u.includes("/me/permissions"), respond: () => ({ success: true }) },
  {
    match: (u) => u.includes("/me/accounts"),
    respond: () => ({
      data: [
        { id: "111", name: "Formkit Bakery", access_token: "page-token-111", tasks: ["CREATE_CONTENT", "MANAGE"] },
        { id: "222", name: "Formkit Cafe", access_token: "page-token-222", tasks: ["CREATE_CONTENT"] },
        { id: "333", name: "Analyst Only Page", access_token: "page-token-333", tasks: ["ANALYZE"] },
      ],
    }),
  },
];

async function workspace(t: T, email: string, name: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: name });
  return { owner, slug, orgId: orgId as Id<"organizations"> };
}

/** Start OAuth as the owner, then complete it as the Next.js callback would. */
async function connectViaOAuth(owner: Awaited<ReturnType<typeof asNewUser>>, slug: string, provider: "facebook_pages" | "linkedin" | "x", variant?: "linkedin_pages") {
  const { url } = await owner.client.mutation(api.connections.startOAuth, { slug, provider, ...(variant ? { variant } : {}) });
  const state = new URL(url).searchParams.get("state")!;
  const res = await owner.client.action(api.connectionActions.completeOAuth, { serverSecret: "test-server-secret", state, code: "auth-code" });
  return { url, res };
}

async function connectionRow(t: T, orgId: Id<"organizations">, provider: "facebook_pages" | "linkedin" | "x") {
  return t.run(async (ctx) => ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", orgId).eq("provider", provider)).first());
}

async function auditActions(t: T, orgId: Id<"organizations">) {
  return t.run(async (ctx) => (await ctx.db.query("auditEvents").collect()).filter((e) => e.orgId === orgId).map((e) => e.action));
}

describe("platform connections", () => {
  beforeEach(() => {
    calls.length = 0;
    process.env.META_APP_ID = "meta-app-id";
    process.env.META_APP_SECRET = "meta-app-secret-value";
    process.env.LINKEDIN_CLIENT_ID = "li-member-app";
    process.env.LINKEDIN_CLIENT_SECRET = "li-member-secret";
    process.env.LINKEDIN_PAGES_CLIENT_ID = "li-pages-app";
    process.env.LINKEDIN_PAGES_CLIENT_SECRET = "li-pages-secret";
    process.env.X_CLIENT_ID = "x-client";
    process.env.X_CLIENT_SECRET = "x-secret";
    process.env.SITE_URL = "https://climbos.app";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    for (const k of ["META_APP_ID", "META_APP_SECRET", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_PAGES_CLIENT_ID", "LINKEDIN_PAGES_CLIENT_SECRET", "X_CLIENT_ID", "X_CLIENT_SECRET", "SITE_URL"]) delete process.env[k];
  });

  it("Facebook: several Pages → the owner chooses one; tokens never reach the browser; forged ids are refused", async () => {
    const t = setup();
    const { owner, slug, orgId } = await workspace(t, "fb-owner@example.com", "Formkit");
    stubProviders(META_ROUTES);

    const { url, res } = await connectViaOAuth(owner, slug, "facebook_pages");
    expect(new URL(url).searchParams.get("redirect_uri")).toBe("https://climbos.app/api/oauth/callback");
    expect(new URL(url).searchParams.get("scope")).toContain("business_management");
    expect(res).toMatchObject({ ok: true, provider: "facebook_pages" });

    const pending = await connectionRow(t, orgId, "facebook_pages");
    expect(pending).toMatchObject({ status: "connected", accountType: "selection_required" });
    expect(pending?.externalAccountId).toBeUndefined();
    // Granted permissions come from /me/permissions (Meta's token response has none).
    expect(pending?.scopes).toContain("pages_manage_posts");

    const item = (await owner.client.query(api.connections.list, { slug })).items.find((i) => i.provider === "facebook_pages")!;
    expect(item.choice).toMatchObject({ kind: "page", needed: true });
    expect(item.capabilities.every((c) => c.state !== "ready")).toBe(true);

    const options = await owner.client.action(api.connectionActions.availableAccounts, { slug, provider: "facebook_pages" });
    expect(options.ok).toBe(true);
    expect(options.options.map((o) => [o.id, o.label, o.canPublish])).toEqual([["111", "Formkit Bakery", true], ["222", "Formkit Cafe", true], ["333", "Analyst Only Page", false]]);
    expect(JSON.stringify(options)).not.toContain("page-token");

    await expect(owner.client.action(api.connectionActions.chooseAccount, { slug, provider: "facebook_pages", accountId: "999" })).rejects.toThrow(/returned by your connected sign-in/);
    await expect(owner.client.action(api.connectionActions.chooseAccount, { slug, provider: "facebook_pages", accountId: "333" })).rejects.toThrow(/doesn't allow creating posts/);

    const chosen = await owner.client.action(api.connectionActions.chooseAccount, { slug, provider: "facebook_pages", accountId: "222" });
    expect(chosen).toEqual({ ok: true, accountLabel: "Formkit Cafe" });
    const row = await connectionRow(t, orgId, "facebook_pages");
    expect(row).toMatchObject({ externalAccountId: "222", accountLabel: "Formkit Cafe", accountType: "facebook_page" });
    const secret = await t.query(internal.connections.getSecret, { connectionId: row!._id });
    expect(JSON.parse(secret!.value)).toEqual({ accessToken: "page-token-222", userAccessToken: "long-user" });

    const after = (await owner.client.query(api.connections.list, { slug })).items.find((i) => i.provider === "facebook_pages")!;
    expect(after.choice?.needed).toBe(false);
    expect(after.connection?.accountLabel).toBe("Formkit Cafe");
    expect(await auditActions(t, orgId)).toEqual(expect.arrayContaining(["connection.oauth_started", "connection.connected", "connection.account_selected"]));
  });

  it("changing the Page invalidates approvals bound to the connection", async () => {
    const t = setup();
    const { owner, slug, orgId } = await workspace(t, "fb-change@example.com", "Formkit");
    stubProviders(META_ROUTES);
    await connectViaOAuth(owner, slug, "facebook_pages");
    await owner.client.action(api.connectionActions.chooseAccount, { slug, provider: "facebook_pages", accountId: "111" });
    const conn = await connectionRow(t, orgId, "facebook_pages");
    const approvalId = await t.run(async (ctx) =>
      ctx.db.insert("approvals", { orgId, subjectType: "artifact", subjectId: "artifact-1", actionKind: "publish", title: "Post", contentHash: "x", scope: { connectionId: conn!._id, destination: "facebook" }, costEstimateMicros: 0, policyVersion: 1, approvalHash: "h", status: "approved", expiresAt: Date.now() + 86_400_000, createdAt: Date.now() }),
    );
    await owner.client.action(api.connectionActions.chooseAccount, { slug, provider: "facebook_pages", accountId: "222" });
    const approval = await t.run(async (ctx) => ctx.db.get(approvalId));
    expect(approval).toMatchObject({ status: "invalidated" });
    expect(approval?.invalidatedReason).toMatch(/account changed/);
  });

  it("disconnect revokes with the Meta user token, deletes stored secrets and audits it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const t = setup();
    const { owner, slug, orgId } = await workspace(t, "fb-disconnect@example.com", "Formkit");
    stubProviders(META_ROUTES);
    await connectViaOAuth(owner, slug, "facebook_pages");
    await owner.client.action(api.connectionActions.chooseAccount, { slug, provider: "facebook_pages", accountId: "111" });
    const conn = await connectionRow(t, orgId, "facebook_pages");

    const res = await owner.client.mutation(api.connections.disconnect, { slug, provider: "facebook_pages" });
    expect(res).toEqual({ revokedAtProvider: true, manualStep: null });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const revoke = calls.find((c) => c.method === "DELETE" && c.url.includes("/me/permissions"));
    expect(new URL(revoke!.url).searchParams.get("access_token")).toBe("long-user");
    const after = await t.run(async (ctx) => ({
      conn: await ctx.db.get(conn!._id),
      secrets: await ctx.db.query("connectionSecrets").withIndex("by_connection", (q) => q.eq("connectionId", conn!._id)).collect(),
    }));
    expect(after.conn).toMatchObject({ status: "revoked" });
    expect(after.conn?.externalAccountId).toBeUndefined();
    expect(after.secrets).toHaveLength(0);
    expect(await auditActions(t, orgId)).toEqual(expect.arrayContaining(["connection.revoked", "connection.token_revoked"]));
    const item = (await owner.client.query(api.connections.list, { slug })).items.find((i) => i.provider === "facebook_pages")!;
    expect(item.connection).toBeNull();
  });

  it("tenant isolation: another workspace's owner can't list, choose or disconnect", async () => {
    const t = setup();
    const a = await workspace(t, "tenant-a@example.com", "Tenant A");
    const b = await workspace(t, "tenant-b@example.com", "Tenant B");
    stubProviders(META_ROUTES);
    await connectViaOAuth(a.owner, a.slug, "facebook_pages");

    await expect(b.owner.client.action(api.connectionActions.availableAccounts, { slug: a.slug, provider: "facebook_pages" })).rejects.toThrow();
    await expect(b.owner.client.action(api.connectionActions.chooseAccount, { slug: a.slug, provider: "facebook_pages", accountId: "111" })).rejects.toThrow();
    await expect(b.owner.client.mutation(api.connections.disconnect, { slug: a.slug, provider: "facebook_pages" })).rejects.toThrow();
    // B's own workspace has no Facebook connection, so A's token is never used for B.
    const own = await b.owner.client.action(api.connectionActions.availableAccounts, { slug: b.slug, provider: "facebook_pages" });
    expect(own).toMatchObject({ ok: false, options: [] });
    // The internal binding refuses a connection id from another workspace.
    const aConn = await connectionRow(t, a.orgId, "facebook_pages");
    const bound = await t.mutation(internal.connections.chooseAccount, { orgId: b.orgId, userId: b.owner.userId, connectionId: aConn!._id, provider: "facebook_pages", externalAccountId: "111", accountLabel: "x", accountType: "facebook_page" });
    expect(bound).toBe(false);
    expect((await connectionRow(t, a.orgId, "facebook_pages"))?.externalAccountId).toBeUndefined();
  });

  it("OAuth state from one user can't be completed by another", async () => {
    const t = setup();
    const a = await workspace(t, "state-a@example.com", "State A");
    const intruder = await asNewUser(t, "intruder@example.com");
    stubProviders(META_ROUTES);
    const { url } = await a.owner.client.mutation(api.connections.startOAuth, { slug: a.slug, provider: "facebook_pages" });
    const state = new URL(url).searchParams.get("state")!;
    const res = await intruder.client.action(api.connectionActions.completeOAuth, { serverSecret: "test-server-secret", state, code: "c" });
    expect(res.ok).toBe(false);
    expect(await connectionRow(t, a.orgId, "facebook_pages")).toBeNull();
  });

  it("LinkedIn Pages sign in through the Community Management app; the owner picks an organization", async () => {
    const t = setup();
    const { owner, slug, orgId } = await workspace(t, "li-owner@example.com", "Formkit");
    stubProviders([
      { match: (u, m) => m === "POST" && u === "https://www.linkedin.com/oauth/v2/accessToken", respond: () => ({ access_token: "li-pages-token", expires_in: 5_184_000, scope: "rw_organization_admin,w_organization_social" }) },
      { match: (u) => u.includes("/rest/organizationAcls"), respond: () => ({ elements: [{ organization: "urn:li:organization:501", role: "ADMINISTRATOR", state: "APPROVED" }, { organizationTarget: "urn:li:organization:502", role: "ADMINISTRATOR", state: "APPROVED" }], paging: { total: 2 } }) },
      { match: (u) => u.endsWith("/rest/organizations/501"), respond: () => ({ id: 501, localizedName: "Formkit Ltd", vanityName: "formkit" }) },
      { match: (u) => u.endsWith("/rest/organizations/502"), respond: () => ({ id: 502, localizedName: "Formkit Labs" }) },
    ]);

    const { url } = await connectViaOAuth(owner, slug, "linkedin", "linkedin_pages");
    const auth = new URL(url).searchParams;
    expect(auth.get("client_id")).toBe("li-pages-app");
    expect(auth.get("scope")).toBe("rw_organization_admin w_organization_social");
    const code = calls.find((c) => c.url === "https://www.linkedin.com/oauth/v2/accessToken")!;
    expect(new URLSearchParams(code.body).get("client_id")).toBe("li-pages-app");

    expect(await connectionRow(t, orgId, "linkedin")).toMatchObject({ accountType: "selection_required", accountLabel: "2 LinkedIn Pages available · choose one" });
    const options = await owner.client.action(api.connectionActions.availableAccounts, { slug, provider: "linkedin" });
    expect(options.options.map((o) => [o.id, o.label])).toEqual([["urn:li:organization:501", "Formkit Ltd"], ["urn:li:organization:502", "Formkit Labs"]]);
    await owner.client.action(api.connectionActions.chooseAccount, { slug, provider: "linkedin", accountId: "urn:li:organization:501" });
    expect(await connectionRow(t, orgId, "linkedin")).toMatchObject({ externalAccountId: "urn:li:organization:501", accountType: "linkedin_organization", accountLabel: "Formkit Ltd" });

    const item = (await owner.client.query(api.connections.list, { slug })).items.find((i) => i.provider === "linkedin")!;
    // Community Management isn't recorded as approved, so Page posting says so instead of "Ready".
    expect(item.capabilities.find((c) => c.capability === "linkedin.publish_org_post")).toMatchObject({ state: "approval_needed", reason: expect.stringContaining("LinkedIn Community Management API access") });
    expect(item.capabilities.find((c) => c.capability === "linkedin.publish_post")?.state).toBe("unavailable");

    const res = await owner.client.mutation(api.connections.disconnect, { slug, provider: "linkedin" });
    expect(res.revokedAtProvider).toBe(false);
    expect(res.manualStep).toMatch(/Permitted services/);
  });

  it("X: shows the signed-in identity and account type; there is nothing to choose", async () => {
    const t = setup();
    const { owner, slug, orgId } = await workspace(t, "x-owner@example.com", "Formkit");
    stubProviders([
      { match: (u, m) => m === "POST" && u === "https://api.x.com/2/oauth2/token", respond: () => ({ access_token: "x-access", refresh_token: "x-refresh", expires_in: 7200, scope: "tweet.read tweet.write users.read offline.access" }) },
      { match: (u) => u.startsWith("https://api.x.com/2/users/me"), respond: () => ({ data: { id: "42", username: "formkit", name: "Formkit", verified_type: "business" } }) },
      { match: (u, m) => m === "POST" && u === "https://api.x.com/2/oauth2/revoke", respond: () => ({ revoked: true }) },
    ]);
    await connectViaOAuth(owner, slug, "x");
    expect(calls.find((c) => c.url.startsWith("https://api.x.com/2/users/me"))?.url).toContain("user.fields=verified_type");
    expect(await connectionRow(t, orgId, "x")).toMatchObject({ externalAccountId: "42", accountLabel: "@formkit", accountType: "x_business" });
    const item = (await owner.client.query(api.connections.list, { slug })).items.find((i) => i.provider === "x")!;
    expect(item.choice).toMatchObject({ selectable: false, needed: false });
    expect(item.capabilities.find((c) => c.capability === "x.publish_post")).toMatchObject({ state: "approval_needed", reason: expect.stringContaining("X API posting access") });
    const options = await owner.client.action(api.connectionActions.availableAccounts, { slug, provider: "x" });
    expect(options).toMatchObject({ ok: false, message: expect.stringContaining("signs in as one account") });
  });

  it("recorded approvals turn 'needs approval' into honest ready states; only staff can record them", async () => {
    const t = setup();
    const { owner, slug } = await workspace(t, "fb-approved@example.com", "Formkit");
    stubProviders(META_ROUTES);
    await connectViaOAuth(owner, slug, "facebook_pages");
    await owner.client.action(api.connectionActions.chooseAccount, { slug, provider: "facebook_pages", accountId: "111" });
    const publishState = async () => (await owner.client.query(api.connections.list, { slug })).items.find((i) => i.provider === "facebook_pages")!.capabilities.find((c) => c.capability === "facebook_pages.publish_post")!;
    expect(await publishState()).toMatchObject({ state: "approval_needed", reason: expect.stringContaining("Meta App Review") });

    await expect(owner.client.mutation(api.platformSetup.setApproval, { key: "meta_app_review", status: "approved" })).rejects.toThrow();
    const ops = await asNewUser(t, "ops@example.com");
    await expect(ops.client.mutation(api.platformSetup.setApproval, { key: "meta_app_review", status: "bogus" })).rejects.toThrow(/Unknown status/);
    await ops.client.mutation(api.platformSetup.setApproval, { key: "meta_app_review", status: "pending" });
    expect((await publishState()).state).toBe("provider_review_pending");
    await ops.client.mutation(api.platformSetup.setApproval, { key: "meta_app_review", status: "approved" });
    expect((await publishState()).state).toBe("ready");
    const audits = await t.run(async (ctx) => (await ctx.db.query("auditEvents").collect()).filter((e) => e.action === "admin.platform_approval").map((e) => e.summary));
    expect(audits).toEqual(["Meta App Review: Not submitted → Submitted, in review.", "Meta App Review: Submitted, in review → Approved (Advanced Access)."]);
  });

  it("the setup guide is staff-only and shows env names with configured/missing, never values", async () => {
    const t = setup();
    const owner = await asNewUser(t, "not-staff@example.com");
    await expect(owner.client.query(api.platformSetup.guide, {})).rejects.toThrow();
    const ops = await asNewUser(t, "ops@example.com");
    const guide = await ops.client.query(api.platformSetup.guide, {});
    expect(guide.redirectUrl).toBe("https://climbos.app/api/oauth/callback");
    expect(guide.platforms.map((p) => p.id)).toEqual(["meta", "linkedin", "x", "google"]);
    const meta = guide.platforms[0]!;
    expect(meta.env.find((e) => e.name === "META_APP_ID")?.configured).toBe(true);
    expect(meta.env.find((e) => e.name === "INSTAGRAM_APP_ID")?.configured).toBe(false);
    expect(meta.steps.some((s) => s.includes("https://climbos.app/api/oauth/callback"))).toBe(true);
    const google = guide.platforms[3]!;
    expect(google.ready).toBe(false);
    const serialized = JSON.stringify(guide);
    for (const value of ["meta-app-secret-value", "li-member-secret", "li-pages-secret", "x-secret"]) expect(serialized).not.toContain(value);
  });

  it("ClimbOS staff see 'Testing mode' before Meta App Review; customers stay gated", async () => {
    const t = setup();
    stubProviders(META_ROUTES);
    for (const [email, name, expected] of [
      ["ops@example.com", "Staff Test Co", "testing_access"],
      ["customer@example.com", "Customer Co", "approval_needed"],
    ] as const) {
      const { owner, slug } = await workspace(t, email, name);
      await connectViaOAuth(owner, slug, "facebook_pages");
      await owner.client.action(api.connectionActions.chooseAccount, { slug, provider: "facebook_pages", accountId: "111" });
      const item = (await owner.client.query(api.connections.list, { slug })).items.find((i) => i.provider === "facebook_pages")!;
      const publish = item.capabilities.find((c) => c.capability === "facebook_pages.publish_post")!;
      expect(publish.state).toBe(expected);
      if (expected === "testing_access") expect(publish.reason).toContain("testing mode");
    }
  });
});
