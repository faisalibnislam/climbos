import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { contentHash, sha256Hex } from "../../shared/policy";
import { asNewUser, makePaid, setup, type T } from "./helpers";

/** LinkedIn and X direct publishing through the real executor, with provider HTTP mocked. Nothing real is called. */

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };

/** Route-based fetch stub; `calls` records every request. */
function stubFetch(handler: (c: Call) => Response) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const c: Call = { url: String(input), method: init?.method ?? "GET", headers: (init?.headers ?? {}) as Record<string, string>, body: typeof init?.body === "string" ? init.body : undefined };
      calls.push(c);
      return handler(c);
    }),
  );
  return calls;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function workspace(t: T, paid = true) {
  const owner = await asNewUser(t, "owner@social.example");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Climb Co" });
  if (paid) await makePaid(t, orgId);
  return { owner, slug, orgId: orgId as Id<"organizations"> };
}

async function connect(t: T, w: Awaited<ReturnType<typeof workspace>>, provider: "linkedin" | "x", secret: { accessToken: string; refreshToken?: string }, expiresAt: number) {
  return t.mutation(internal.connections.storeConnection, {
    orgId: w.orgId,
    userId: w.owner.userId,
    provider,
    secret: JSON.stringify(secret),
    secretKind: "oauth",
    scopes: provider === "linkedin" ? ["openid", "profile", "w_member_social"] : ["tweet.read", "tweet.write", "users.read", "offline.access"],
    expiresAt,
    accountLabel: provider === "linkedin" ? "Sam Lee" : "@climbco",
    externalAccountId: provider === "linkedin" ? "urn:li:person:abc123" : "42",
  });
}

async function draft(t: T, orgId: Id<"organizations">, channel: "linkedin" | "x", body: string) {
  return t.run(async (ctx) => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first()) as Doc<"businesses">;
    const now = Date.now();
    const artifactId = await ctx.db.insert("artifacts", { orgId, businessId: business._id, kind: "social_post", channel, title: `${channel} post`, status: "in_review", currentVersion: 1, createdAt: now, updatedAt: now });
    const hashtags = ["climbing"];
    const versionId = await ctx.db.insert("artifactVersions", {
      orgId,
      artifactId,
      version: 1,
      body,
      hashtags,
      claimFactIds: [],
      unsupportedClaims: [],
      contentHash: await contentHash({ body, hashtags, channel }),
      createdAt: now,
    });
    await ctx.db.patch(artifactId, { currentVersionId: versionId });
    return artifactId;
  });
}

async function setTrend(t: T, artifactId: Id<"artifacts">, observationDate: string) {
  await t.run(async (ctx) => {
    const a = (await ctx.db.get(artifactId))!;
    const v = (await ctx.db.get(a.currentVersionId!))!;
    const copyBrief = {
      reader: "Local climbers", situation: "Choosing a route", awarenessStage: "unknown", relationshipStage: "unknown",
      objective: "Useful discussion", offerFactIds: [], problemJob: "Choose a route", trigger: "A format example", centralIdea: "Route preparation",
      objection: "Unknown", proofFactIds: [], prohibitedClaims: [], channel: a.channel, format: "text", deliveryContext: "Organic",
      brandVoice: "Helpful", approvedExamples: [], cta: "Read", afterAction: "Unknown", trackingMetric: "Qualified visits", trackingMethod: "Unknown",
      supportingFactIds: [], supportingSourceUrls: ["https://example.com/format"], unknowns: [],
      trendEvidence: { sourceUrl: "https://example.com/format", observationDate, observation: "Source reports a format example." },
    };
    await ctx.db.patch(v._id, { copyBrief, contentHash: await contentHash({ body: v.body, hashtags: v.hashtags, channel: a.channel, copyBrief }) });
  });
}

async function publish(t: T, w: Awaited<ReturnType<typeof workspace>>, artifactId: Id<"artifacts">) {
  await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
  await w.owner.client.mutation(api.content.publishNow, { slug: w.slug, artifactId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return w.owner.client.query(api.content.get, { slug: w.slug, artifactId });
}

describe("LinkedIn and X publishing", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-10-20T09:00:00Z"));
    process.env.LINKEDIN_CLIENT_ID = "li-id";
    process.env.LINKEDIN_CLIENT_SECRET = "li-secret";
    process.env.X_CLIENT_ID = "x-id";
    process.env.X_CLIENT_SECRET = "x-secret";
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    for (const k of ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "X_CLIENT_ID", "X_CLIENT_SECRET"]) delete process.env[k];
  });

  it("refuses stale trend approval without creating an approval or provider request", async () => {
    const t = setup(); const w = await workspace(t);
    const id = await draft(t, w.orgId, "linkedin", "An original route preparation idea.");
    await setTrend(t, id, "2026-09-01");
    const calls = stubFetch(() => json(500, {}));
    await expect(w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId: id, decision: "approve" })).rejects.toThrow(/30-day/);
    expect(await t.run((ctx) => ctx.db.query("approvals").withIndex("by_subject", q => q.eq("subjectType", "artifact").eq("subjectId", id)).collect())).toHaveLength(0);
    expect(calls).toHaveLength(0);
    await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId: id, decision: "reject" });
  });

  it("returns an actionable refusal for stale trend approval from email", async () => {
    const t = setup(); const w = await workspace(t);
    const id = await draft(t, w.orgId, "linkedin", "An original route preparation idea.");
    await setTrend(t, id, "2026-09-01");
    const token = "c".repeat(48);
    await t.run(async ctx => {
      await ctx.db.insert("actionTokens", { tokenHash: await sha256Hex(token), orgId: w.orgId, userId: w.owner.userId, kind: "approve_post", subjectId: id, expiresAt: Date.now() + 3_600_000, createdAt: Date.now() });
    });
    const result = await t.mutation(api.emailActions.consume, { token });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/30-day/);
    expect((await t.run(ctx => ctx.db.get(id)))?.status).toBe("in_review");
  });

  it("refuses a schedule beyond the trend window while preserving the current approval", async () => {
    const t = setup(); const w = await workspace(t);
    await connect(t, w, "linkedin", { accessToken: "li-token" }, Date.now() + 60 * 86_400_000);
    const id = await draft(t, w.orgId, "linkedin", "An original route preparation idea.");
    await setTrend(t, id, "2026-09-21");
    await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId: id, decision: "approve" });
    await expect(w.owner.client.mutation(api.content.schedule, { slug: w.slug, artifactId: id, when: Date.now() + 2 * 86_400_000 })).rejects.toThrow(/30-day/);
    const a = await t.run(ctx => ctx.db.get(id));
    expect(a?.status).toBe("approved");
    expect(a?.scheduledFor).toBeUndefined();
  });

  it("returns an approved draft to review when its trend expires before execution", async () => {
    const t = setup(); const w = await workspace(t);
    await connect(t, w, "linkedin", { accessToken: "li-token" }, Date.now() + 60 * 86_400_000);
    const id = await draft(t, w.orgId, "linkedin", "An original route preparation idea.");
    await setTrend(t, id, "2026-09-21");
    await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId: id, decision: "approve" });
    vi.setSystemTime(Date.now() + 2 * 86_400_000);
    const calls = stubFetch(() => json(500, {}));
    await t.action(internal.publish.publishArtifact, { artifactId: id });
    const a = await t.run(ctx => ctx.db.get(id));
    expect(a?.status).toBe("in_review");
    expect(a?.lastPublishError?.message).toMatch(/30-day/);
    expect(calls).toHaveLength(0);
    expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toHaveLength(0);
  });

  it("publishes an approved LinkedIn post, verifies it on read-back and writes one receipt", async () => {
    const t = setup();
    const w = await workspace(t);
    await connect(t, w, "linkedin", { accessToken: "li-token" }, Date.now() + 60 * 86_400_000);
    const artifactId = await draft(t, w.orgId, "linkedin", "Our new routes open Saturday (all levels).");
    let commentary = "";
    const calls = stubFetch((c) => {
      if (c.method === "POST" && c.url === "https://api.linkedin.com/rest/posts") {
        commentary = (JSON.parse(c.body ?? "{}") as { commentary: string }).commentary;
        return new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:9001" } });
      }
      if (c.url.startsWith("https://api.linkedin.com/rest/posts/urn%3Ali%3Ashare%3A9001")) return json(200, { id: "urn:li:share:9001", commentary });
      throw new Error(`Unexpected ${c.method} ${c.url}`);
    });

    const res = await publish(t, w, artifactId);
    expect(res.status).toBe("published");
    expect(res.receipts).toHaveLength(1);
    expect(res.receipts[0]).toMatchObject({ provider: "linkedin", action: "linkedin.publish_post", status: "verified", externalId: "urn:li:share:9001" });
    expect(commentary).toBe("Our new routes open Saturday \\(all levels\\).\n\n#climbing");
    expect(calls[0]?.headers.Authorization).toBe("Bearer li-token");

    // Same version again: idempotent, no second post.
    await t.action(internal.publish.publishArtifact, { artifactId });
    expect((await w.owner.client.query(api.content.get, { slug: w.slug, artifactId })).receipts).toHaveLength(1);
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });

  it("renews an expired X token (Basic auth, rotated refresh token) before posting", async () => {
    const t = setup();
    const w = await workspace(t);
    const connectionId = await connect(t, w, "x", { accessToken: "old-access", refreshToken: "old-refresh" }, Date.now() - 1000);
    const artifactId = await draft(t, w.orgId, "x", "Fresh stock is in.");
    const calls = stubFetch((c) => {
      if (c.url === "https://api.x.com/2/oauth2/token") return json(200, { token_type: "bearer", expires_in: 7200, access_token: "new-access", refresh_token: "new-refresh", scope: "tweet.read tweet.write users.read offline.access" });
      if (c.method === "POST" && c.url === "https://api.x.com/2/tweets") return json(201, { data: { id: "1700", text: "Fresh stock is in.\n\n#climbing" } });
      if (c.url.startsWith("https://api.x.com/2/tweets/1700")) return json(200, { data: { id: "1700", text: "Fresh stock is in.\n\n#climbing" } });
      throw new Error(`Unexpected ${c.method} ${c.url}`);
    });

    const res = await publish(t, w, artifactId);
    expect(res.status).toBe("published");
    expect(res.receipts[0]).toMatchObject({ provider: "x", status: "verified", externalId: "1700" });
    const refresh = calls.find((c) => c.url.endsWith("/oauth2/token"))!;
    expect(refresh.headers.Authorization).toBe(`Basic ${btoa("x-id:x-secret")}`);
    expect(new URLSearchParams(refresh.body).get("refresh_token")).toBe("old-refresh");
    expect(calls.find((c) => c.url === "https://api.x.com/2/tweets")?.headers.Authorization).toBe("Bearer new-access");
    const stored = await t.query(internal.connections.getSecret, { connectionId });
    expect(JSON.parse(stored!.value)).toEqual({ accessToken: "new-access", refreshToken: "new-refresh" });
  });

  it("refuses an X post over 280 weighted characters without calling X", async () => {
    const t = setup();
    const w = await workspace(t);
    await connect(t, w, "x", { accessToken: "a", refreshToken: "r" }, Date.now() + 3_600_000);
    const artifactId = await draft(t, w.orgId, "x", "日".repeat(141));
    const calls = stubFetch((c) => {
      throw new Error(`Unexpected ${c.method} ${c.url}`);
    });
    const res = await publish(t, w, artifactId);
    expect(res.status).toBe("failed");
    expect(res.receipts[0]).toMatchObject({ status: "failed" });
    expect(res.receipts[0]?.summary).toMatch(/\/280 characters on X/);
    expect(calls).toHaveLength(0);
  });

  it("stays behind the paid gate", async () => {
    const t = setup();
    const w = await workspace(t, false);
    await connect(t, w, "linkedin", { accessToken: "li-token" }, Date.now() + 86_400_000);
    const artifactId = await draft(t, w.orgId, "linkedin", "Hello");
    await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    await expect(w.owner.client.mutation(api.content.publishNow, { slug: w.slug, artifactId })).rejects.toThrow(/package/);
  });

  it("Connections shows LinkedIn/X as sign-in only when the app keys are set", async () => {
    const t = setup();
    const w = await workspace(t);
    const on = await w.owner.client.query(api.connections.list, { slug: w.slug });
    expect(on.items.find((i) => i.provider === "linkedin")?.connectMethod).toBe("oauth_linkedin");
    expect(on.items.find((i) => i.provider === "x")?.connectMethod).toBe("oauth_x");
    delete process.env.X_CLIENT_ID;
    const off = await w.owner.client.query(api.connections.list, { slug: w.slug });
    const xItem = off.items.find((i) => i.provider === "x");
    expect(xItem?.connectMethod).toBe("none");
    expect(xItem?.capabilities.some((c) => c.capability === "x.manual_export")).toBe(true);
  });
});
