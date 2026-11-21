import { wordpressArticleHtml } from "../../shared/integrations/wordpress";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { api, internal } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { contentHash } from "../../shared/policy";
import { asNewUser, makePaid, setup } from "./helpers";

const httpsRequestMock = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:dns/promises")>()),
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));
vi.mock("node:https", () => ({ request: httpsRequestMock }));

type HttpCall = { url: string; method: string; headers: Record<string, string>; body?: string };
const responseData = (status: number, data: unknown) => ({
  status,
  data: JSON.stringify(data),
});

function stubWordPress(handler: (call: HttpCall) => ReturnType<typeof responseData>) {
  const calls: HttpCall[] = [];
  httpsRequestMock.mockImplementation((url: URL, options: Record<string, unknown>, callback: (response: Readable & { statusCode: number; headers: Record<string, string> }) => void) => {
    const call: HttpCall = { url: url.toString(), method: String(options.method ?? "GET"), headers: options.headers as Record<string, string> };
    calls.push(call);
    const req = new EventEmitter() as EventEmitter & { end: (body?: string) => void; destroy: (error: Error) => void };
    req.end = (body) => {
      if (body) call.body = body;
      const result = handler(call);
      const response = Readable.from([result.data]) as Readable & { statusCode: number; headers: Record<string, string> };
      response.statusCode = result.status;
      response.headers = { "content-type": "application/json", "content-length": String(Buffer.byteLength(result.data)) };
      callback(response);
    };
    req.destroy = (error) => req.emit("error", error);
    const lookup = options.lookup as (hostname: string, opts: { all?: boolean }, cb: (...args: unknown[]) => void) => void;
    lookup("example.com", { all: true }, (error, addresses) => {
      if (error) throw error;
      expect(addresses).toEqual([{ address: "93.184.216.34", family: 4 }]);
    });
    return req;
  });
  return calls;
}

async function article(t: ReturnType<typeof setup>, orgId: Id<"organizations">) {
  return t.run(async (ctx) => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first()) as Doc<"businesses">;
    const now = Date.now();
    const body = "# Helpful article\n\nUse **clear language** and [the guide](https://example.com/guide).";
    const artifactId = await ctx.db.insert("artifacts", { orgId, businessId: business._id, kind: "blog_post", channel: "blog", title: "Helpful article", status: "in_review", currentVersion: 1, createdAt: now, updatedAt: now });
    const versionId = await ctx.db.insert("artifactVersions", { orgId, artifactId, version: 1, body, hashtags: [], claimFactIds: [], unsupportedClaims: [], contentHash: await contentHash({ body, hashtags: [], channel: "blog" }), createdAt: now });
    await ctx.db.patch(artifactId, { currentVersionId: versionId });
    return artifactId;
  });
}

describe("WordPress private draft handoff", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-10-25T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    httpsRequestMock.mockReset();
  });

  async function setupConnected() {
    const t = setup();
    const owner = await asNewUser(t, "wordpress-drafts@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Draft Test Co" });
    await makePaid(t, orgId);
    await t.mutation(internal.connections.storeConnection, {
      orgId: orgId as Id<"organizations">,
      userId: owner.userId,
      provider: "wordpress",
      secret: JSON.stringify({ siteUrl: "https://example.com/blog", username: "editor", applicationPassword: "abcdefghijklmnop" }),
      secretKind: "api_key",
      scopes: ["wordpress.users.read_self", "wordpress.posts.edit"],
      accountLabel: "Draft Test Editor",
      externalAccountId: "https://example.com/blog",
      accountType: "wordpress_application_password",
    });
    const artifactId = await article(t, orgId as Id<"organizations">);
    await owner.client.mutation(api.content.decide, { slug, artifactId, decision: "approve" });
    const reviewed = (await owner.client.query(api.content.get, { slug, artifactId })).wordpressDraftReview!;
    return { t, owner, slug, orgId: orgId as Id<"organizations">, artifactId, reviewed };
  }

  it("preserves original, proposed and privately approved copy across recovery and enforces rehearsal permissions", async () => {
    const { t, owner, orgId, slug, artifactId, reviewed } = await setupConnected();
    const args = { slug, artifactId };
    const pageUrl = "https://example.com/blog/services/";
    const original = { versionId: reviewed.versionId, title: reviewed.title };
    await owner.client.mutation(api.wordpressDrafts.startPageRehearsal, { ...args, ...original, pageUrl, sourceRevision: "r17" });
    await owner.client.mutation(api.content.edit, { ...args, title: "Services for teams", body: "Book a product tour.", hashtags: [] });
    const article = await owner.client.query(api.content.get, args);
    const proposed = { ...args, pageUrl, revision: 1, versionId: article.current!.id, title: article.title, decision: "approve" as const };
    const viewer = await asNewUser(t, "viewer@example.com");
    await t.run(ctx => ctx.db.insert("memberships", { orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    await expect(viewer.client.mutation(api.wordpressDrafts.reviewPageRehearsal, proposed)).rejects.toThrow();
    const outsider = await asNewUser(t, "other@example.com");
    const other = await outsider.client.mutation(api.orgs.createWorkspace, { businessName: "Separate tenant" });
    await expect(outsider.client.query(api.wordpressDrafts.pageRehearsal, { ...args, slug: other.slug })).rejects.toThrow();
    await expect(outsider.client.mutation(api.wordpressDrafts.reviewPageRehearsal, { ...proposed, slug: other.slug })).rejects.toThrow();
    await expect(owner.client.mutation(api.wordpressDrafts.reviewPageRehearsal, { ...proposed, pageUrl: "https://other.example/" })).rejects.toThrow();
    await expect(owner.client.mutation(api.wordpressDrafts.reviewPageRehearsal, { ...proposed, ...original })).rejects.toThrow();
    await owner.client.mutation(api.wordpressDrafts.reviewPageRehearsal, proposed);
    await expect(owner.client.mutation(api.wordpressDrafts.reviewPageRehearsal, proposed)).rejects.toThrow();
    const approved = await viewer.client.query(api.wordpressDrafts.pageRehearsal, args);
    expect(approved).toMatchObject({ showing: "approved", revision: 2, sourceRevision: "r17", approved: { id: proposed.versionId, body: "Book a product tour." } });
    await owner.client.mutation(api.content.edit, { ...args, title: "Later proposal", body: "Arrange a demo.", hashtags: [] });
    await owner.client.mutation(api.wordpressDrafts.reviewPageRehearsal, { ...args, pageUrl, revision: 2, ...original, decision: "restore" });
    expect(await viewer.client.query(api.wordpressDrafts.pageRehearsal, args)).toMatchObject({
      revision: 3, showing: "original", baseline: { id: original.versionId, title: original.title, body: expect.stringContaining("clear language") }, approved: approved!.approved,
    });
    expect(await owner.client.query(api.content.get, args)).toMatchObject({ status: "in_review", current: { version: 3, body: "Arrange a demo." } });
    expect(await owner.client.query(api.wordpressDrafts.forArtifact, args)).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
    expect(httpsRequestMock).toHaveBeenCalledTimes(0);
  });

  it("creates a confirmed private draft, reads it back and never marks the ClimbOS article published", async () => {
    const { t, owner, slug, artifactId, reviewed } = await setupConnected();
    const article = await owner.client.query(api.content.get, { slug, artifactId });
    const expectedHtml = wordpressArticleHtml(article.current!.body);
    const calls = stubWordPress((call) => call.method === "POST"
      ? responseData(201, { id: 991, status: "draft", link: "https://example.com/blog/?p=991" })
      : responseData(200, { id: 991, status: "draft", title: { raw: "Helpful article" }, content: { raw: expectedHtml } }));

    const requested = await owner.client.mutation(api.wordpressDrafts.createDraft, { slug, artifactId, reviewed });
    expect(requested.status).toBe("pending");
    await expect(owner.client.mutation(api.content.edit, { slug, artifactId, body: "Changed while the WordPress request was running.", hashtags: [] })).rejects.toThrow(/still running/);
    await vi.advanceTimersByTimeAsync(0);
    await t.finishInProgressScheduledFunctions();

    const drafts = await owner.client.query(api.wordpressDrafts.forArtifact, { slug, artifactId });
    expect(drafts[0]).toMatchObject({ status: "verified", externalPostId: "991", editUrl: "https://example.com/blog/wp-admin/post.php?post=991&action=edit" });
    const postCall = calls.find((call) => call.method === "POST")!;
    expect(postCall.url).toBe("https://example.com/blog/wp-json/wp/v2/posts");
    expect(JSON.parse(postCall.body!).status).toBe("draft");
    expect(JSON.parse(postCall.body!).content).toContain("<h1>Helpful article</h1>");
    expect(new Headers(postCall.headers).get("authorization")).toMatch(/^Basic /);
    expect(calls.some((call) => call.method === "GET" && call.url.includes("/posts/991"))).toBe(true);

    const artifact = await owner.client.query(api.content.get, { slug, artifactId });
    expect(artifact.status).toBe("approved");
    expect(artifact.wordpressDrafts[0]?.status).toBe("verified");
    await owner.client.mutation(api.wordpressDrafts.createDraft, { slug, artifactId, reviewed });
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("allows one worker to claim a request and preserves uncertainty after an interrupted attempt", async () => {
    const { t, owner, slug, artifactId, reviewed } = await setupConnected();
    const args = { slug, artifactId, reviewed };
    const { operationId } = await owner.client.mutation(api.wordpressDrafts.createDraft, args);
    expect(await t.mutation(internal.wordpressDrafts.claimAttempt, { operationId })).toBe(true);
    expect(await t.mutation(internal.wordpressDrafts.claimAttempt, { operationId })).toBe(false);
    await vi.advanceTimersByTimeAsync(120_000);
    await t.finishInProgressScheduledFunctions();
    expect((await owner.client.mutation(api.wordpressDrafts.createDraft, args)).status).toBe("uncertain");
    expect(httpsRequestMock).toHaveBeenCalledTimes(0);
  });

  it("uses the reviewed page headline for the draft while preserving the separate internal name", async () => {
    const { t, owner, slug, artifactId } = await setupConnected();
    const args = { slug, artifactId };
    await owner.client.mutation(api.content.edit, { ...args, title: "Internal QA name", headline: "Public service guide", body: "Contact the service desk.", hashtags: [] });
    await owner.client.mutation(api.content.decide, { ...args, decision: "approve" });
    const reviewed = (await owner.client.query(api.content.get, args)).wordpressDraftReview!;
    expect(reviewed.title).toBe("Public service guide");
    const calls = stubWordPress(call => call.method === "POST" ? responseData(201, { id: 993, status: "draft" }) :
      responseData(200, { id: 993, status: "draft", title: { raw: "Public service guide" }, content: { raw: wordpressArticleHtml("Contact the service desk.") } }));
    await owner.client.mutation(api.wordpressDrafts.createDraft, { ...args, reviewed });
    await vi.advanceTimersByTimeAsync(0);
    await t.finishInProgressScheduledFunctions();
    expect(JSON.parse(calls[0].body!).title).toBe("Public service guide");
    expect((await owner.client.query(api.content.get, args)).title).toBe("Internal QA name");
  });

  it.each(["site", "title", "hash"])("rejects changed %s at confirmation before creating an operation", async field => {
    const { t, owner, slug, artifactId, reviewed } = await setupConnected();
    const stale = { ...reviewed };
    if (field === "site") stale.siteUrl = "https://other.example/blog";
    if (field === "title") stale.title = "Earlier title";
    if (field === "hash") stale.contentHash = "previous draft hash";
    await expect(owner.client.mutation(api.wordpressDrafts.createDraft, { slug, artifactId, reviewed: stale })).rejects.toThrow(/changed/);
    expect(await t.run(ctx => ctx.db.query("wordpressDraftOperations").collect())).toEqual([]);
  });

  it("keeps a saved draft with changed body uncertain and does not retry its creation", async () => {
    const { t, owner, slug, artifactId, reviewed } = await setupConnected();
    const calls = stubWordPress(call => call.method === "POST"
      ? responseData(201, { id: 992, status: "draft" })
      : responseData(200, { id: 992, status: "draft", title: { raw: reviewed.title }, content: { raw: "<p>Changed after save.</p>" } }));
    const args = { slug, artifactId, reviewed };
    await owner.client.mutation(api.wordpressDrafts.createDraft, args);
    await vi.advanceTimersByTimeAsync(0);
    await t.finishInProgressScheduledFunctions();
    expect((await owner.client.mutation(api.wordpressDrafts.createDraft, args)).status).toBe("uncertain");
    expect(calls.filter(call => call.method === "POST")).toHaveLength(1);
  });

  it("does not repeat an uncertain write when WordPress cannot confirm the saved draft", async () => {
    const { t, owner, slug, artifactId, reviewed } = await setupConnected();
    const calls = stubWordPress(() => responseData(302, { location: "https://elsewhere.example" }));
    await owner.client.mutation(api.wordpressDrafts.createDraft, { slug, artifactId, reviewed });
    await vi.advanceTimersByTimeAsync(0);
    await t.finishInProgressScheduledFunctions();
    expect((await owner.client.query(api.wordpressDrafts.forArtifact, { slug, artifactId }))[0]?.status).toBe("uncertain");
    const second = await owner.client.mutation(api.wordpressDrafts.createDraft, { slug, artifactId, reviewed });
    expect(second.status).toBe("uncertain");
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("refuses to create a draft for an edited or unapproved version", async () => {
    const { t, owner, slug, artifactId, reviewed } = await setupConnected();
    const calls = stubWordPress(() => responseData(201, { id: 992, status: "draft" }));
    await t.run(async (ctx) => {
      const artifact = await ctx.db.get(artifactId);
      const current = artifact?.currentVersionId ? await ctx.db.get(artifact.currentVersionId) : null;
      if (artifact && current) await ctx.db.patch(artifact._id, { status: "in_review", currentVersion: 2 });
    });
    await expect(owner.client.mutation(api.wordpressDrafts.createDraft, { slug, artifactId, reviewed })).rejects.toThrow(/approve the current article/i);
    expect(calls).toHaveLength(0);
  });

  it("requires workspace approval permission before queueing any CMS write", async () => {
    const { t, slug, artifactId, reviewed } = await setupConnected();
    const other = await asNewUser(t, "wordpress-outsider@example.com");
    await expect(other.client.mutation(api.wordpressDrafts.createDraft, { slug, artifactId, reviewed })).rejects.toThrow(/couldn't find that workspace/i);
  });
});
