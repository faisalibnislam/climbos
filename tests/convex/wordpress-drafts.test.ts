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
    return { t, owner, slug, orgId: orgId as Id<"organizations">, artifactId };
  }

  it("creates a confirmed private draft, reads it back and never marks the ClimbOS article published", async () => {
    const { t, owner, slug, artifactId } = await setupConnected();
    const calls = stubWordPress((call) => call.method === "POST"
      ? responseData(201, { id: 991, status: "draft", link: "https://example.com/blog/?p=991" })
      : responseData(200, { id: 991, status: "draft", title: { raw: "Helpful article" } }));

    const requested = await owner.client.mutation(api.wordpressDrafts.createDraft, { slug, artifactId });
    expect(requested.status).toBe("pending");
    await expect(owner.client.mutation(api.content.edit, { slug, artifactId, body: "Changed while the WordPress request was running.", hashtags: [] })).rejects.toThrow(/still running/);
    await t.finishAllScheduledFunctions(vi.runAllTimers);

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
    await owner.client.mutation(api.wordpressDrafts.createDraft, { slug, artifactId });
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("does not repeat an uncertain write when WordPress cannot confirm the saved draft", async () => {
    const { t, owner, slug, artifactId } = await setupConnected();
    const calls = stubWordPress(() => responseData(302, { location: "https://elsewhere.example" }));
    await owner.client.mutation(api.wordpressDrafts.createDraft, { slug, artifactId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await owner.client.query(api.wordpressDrafts.forArtifact, { slug, artifactId }))[0]?.status).toBe("uncertain");
    const second = await owner.client.mutation(api.wordpressDrafts.createDraft, { slug, artifactId });
    expect(second.status).toBe("uncertain");
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("refuses to create a draft for an edited or unapproved version", async () => {
    const { t, owner, slug, artifactId } = await setupConnected();
    const calls = stubWordPress(() => responseData(201, { id: 992, status: "draft" }));
    await t.run(async (ctx) => {
      const artifact = await ctx.db.get(artifactId);
      const current = artifact?.currentVersionId ? await ctx.db.get(artifact.currentVersionId) : null;
      if (artifact && current) await ctx.db.patch(artifact._id, { status: "in_review", currentVersion: 2 });
    });
    await expect(owner.client.mutation(api.wordpressDrafts.createDraft, { slug, artifactId })).rejects.toThrow(/approve the current article/i);
    expect(calls).toHaveLength(0);
  });

  it("requires workspace approval permission before queueing any CMS write", async () => {
    const { t, slug, artifactId } = await setupConnected();
    const other = await asNewUser(t, "wordpress-outsider@example.com");
    await expect(other.client.mutation(api.wordpressDrafts.createDraft, { slug, artifactId })).rejects.toThrow(/couldn't find that workspace/i);
  });
});
