import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { contentHash } from "../../shared/policy";
import { asNewUser, makePaid, setup, type T } from "./helpers";

/** Publishing lifecycle fixes: retries after failure, long schedules, blocked publishes, state guards and images. */

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function workspace(t: T, email = "owner@flow.example") {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Flow Co" });
  await makePaid(t, orgId);
  return { owner, slug, orgId: orgId as Id<"organizations"> };
}
type W = Awaited<ReturnType<typeof workspace>>;

async function connectLinkedIn(t: T, w: W) {
  return t.mutation(internal.connections.storeConnection, {
    orgId: w.orgId,
    userId: w.owner.userId,
    provider: "linkedin",
    secret: JSON.stringify({ accessToken: "li-token" }),
    secretKind: "oauth",
    scopes: ["openid", "profile", "w_member_social"],
    expiresAt: Date.now() + 60 * 86_400_000,
    accountLabel: "Sam Lee",
    externalAccountId: "urn:li:person:abc123",
  });
}

async function draft(t: T, orgId: Id<"organizations">, channel: Doc<"artifacts">["channel"], body = "Hello from Flow Co.") {
  return t.run(async (ctx) => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first()) as Doc<"businesses">;
    const now = Date.now();
    const artifactId = await ctx.db.insert("artifacts", { orgId, businessId: business._id, kind: "social_post", channel, title: `${channel} post`, status: "in_review", currentVersion: 1, createdAt: now, updatedAt: now });
    const versionId = await ctx.db.insert("artifactVersions", { orgId, artifactId, version: 1, body, hashtags: [], claimFactIds: [], unsupportedClaims: [], contentHash: await contentHash({ body, hashtags: [], channel }), createdAt: now });
    await ctx.db.patch(artifactId, { currentVersionId: versionId });
    return artifactId;
  });
}

/** LinkedIn stub: the first `failures` posts get a 401, later ones succeed and read back. */
function linkedInStub(failures: number) {
  let posts = 0;
  let commentary = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      if ((init?.method ?? "GET") === "POST" && url === "https://api.linkedin.com/rest/posts") {
        posts++;
        if (posts <= failures) return json(401, { message: "expired" });
        commentary = (JSON.parse(String(init?.body ?? "{}")) as { commentary: string }).commentary;
        return new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:77" } });
      }
      if (url.startsWith("https://api.linkedin.com/rest/posts/")) return json(200, { id: "urn:li:share:77", commentary });
      throw new Error(`Unexpected ${url}`);
    }),
  );
  return { posts: () => posts };
}

const run = (t: T) => t.finishAllScheduledFunctions(vi.runAllTimers);

describe("publishing lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-10-20T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("after a failed attempt, approving again and publishing makes a new attempt (never stuck sending)", async () => {
    const t = setup();
    const w = await workspace(t);
    await connectLinkedIn(t, w);
    const artifactId = await draft(t, w.orgId, "linkedin");
    const stub = linkedInStub(1);
    const c = w.owner.client;

    await c.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    await c.mutation(api.content.publishNow, { slug: w.slug, artifactId });
    await run(t);
    let view = await c.query(api.content.get, { slug: w.slug, artifactId });
    expect(view.status).toBe("failed");
    expect(view.lastPublishError?.message).toMatch(/Reconnect LinkedIn/);

    await c.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    expect((await c.query(api.content.get, { slug: w.slug, artifactId })).lastPublishError).toBeNull();
    await c.mutation(api.content.publishNow, { slug: w.slug, artifactId });
    await run(t);
    view = await c.query(api.content.get, { slug: w.slug, artifactId });
    expect(view.status).toBe("published");
    expect(view.receipts.map((r) => r.status).sort()).toEqual(["failed", "verified"]);
    expect(stub.posts()).toBe(2);

    // Repeating the same approval never posts twice.
    await t.action(internal.publish.publishArtifact, { artifactId });
    expect(stub.posts()).toBe(2);
  });

  it("rechecks risky claims after an owner edits a draft instead of clearing the flags", async () => {
    const t = setup();
    const w = await workspace(t, "claim-review@flow.example");
    const artifactId = await draft(t, w.orgId, "facebook");

    await w.owner.client.mutation(api.content.edit, {
      slug: w.slug,
      artifactId,
      body: "We guarantee a 2x faster result for every customer.",
      hashtags: [],
    });

    const updated = await w.owner.client.query(api.content.get, { slug: w.slug, artifactId });
    expect(updated.current?.unsupportedClaims).toEqual(expect.arrayContaining([
      expect.stringMatching(/guarantee/i),
    ]));
    expect(updated.status).toBe("in_review");

    await w.owner.client.mutation(api.content.edit, {
      slug: w.slug,
      artifactId,
      body: "A result designed for your team.",
      hashtags: [],
    });
    const corrected = await w.owner.client.query(api.content.get, { slug: w.slug, artifactId });
    expect(corrected.current?.unsupportedClaims).toEqual([]);
  });

  it("preserves the structured copy brief and its approval hash through owner edits", async () => {
    const t = setup();
    const w = await workspace(t, "copy-brief@flow.example");
    const artifactId = await draft(t, w.orgId, "facebook");
    const copyBrief = {
      reader: "Local service owners", situation: "They need qualified bookings", awarenessStage: "problem_aware", relationshipStage: "unknown",
      objective: "Request a consultation", offerFactIds: [], problemJob: "Choose a provider", trigger: "An active need", centralIdea: "Make the next step clear",
      objection: "Unknown", proofFactIds: [], prohibitedClaims: [], channel: "facebook", format: "single image", deliveryContext: "Organic post",
      brandVoice: "Clear and practical", approvedExamples: [], cta: "Ask for details", afterAction: "Reply to the inquiry", trackingMetric: "Qualified inquiries",
      trackingMethod: "Unknown", supportingFactIds: [], supportingSourceUrls: [], unknowns: ["Availability"],
    };
    await t.run(async (ctx) => {
      const artifact = await ctx.db.get(artifactId);
      const version = await ctx.db.get(artifact!.currentVersionId!);
      const nextHash = await contentHash({ body: version!.body, hashtags: version!.hashtags, channel: artifact!.channel, copyBrief });
      await ctx.db.patch(version!._id, { copyBrief, contentHash: nextHash });
    });

    await w.owner.client.mutation(api.content.edit, { slug: w.slug, artifactId, body: "An edited draft with its strategy context.", hashtags: [] });
    const updated = await w.owner.client.query(api.content.get, { slug: w.slug, artifactId });
    expect(updated.current?.copyBrief).toEqual(copyBrief);
    const versions = await t.run(async (ctx) => ctx.db.query("artifactVersions").withIndex("by_artifact", (q) => q.eq("artifactId", artifactId)).collect());
    expect(versions).toHaveLength(2);
    expect(versions[1]?.copyBrief).toEqual(copyBrief);
    expect(versions[0]?.contentHash).not.toBe(versions[1]?.contentHash);
  });

  it("a repeat call on an already-attempted approval settles the post instead of leaving it sending", async () => {
    const t = setup();
    const w = await workspace(t);
    await connectLinkedIn(t, w);
    const artifactId = await draft(t, w.orgId, "linkedin");
    linkedInStub(1);
    const c = w.owner.client;
    await c.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    await c.mutation(api.content.publishNow, { slug: w.slug, artifactId });
    await run(t);
    // Force it back to "publishing" with the same approval (e.g. a duplicate timer).
    await t.run(async (ctx) => ctx.db.patch(artifactId, { status: "publishing" }));
    await t.action(internal.publish.publishArtifact, { artifactId });
    expect((await c.query(api.content.get, { slug: w.slug, artifactId })).status).toBe("failed");
  });

  it("scheduling past the approval lifetime keeps the approval until the post goes out", async () => {
    const t = setup();
    const w = await workspace(t);
    await connectLinkedIn(t, w);
    const artifactId = await draft(t, w.orgId, "linkedin");
    linkedInStub(0);
    const c = w.owner.client;
    await c.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    const when = Date.now() + 10 * 86_400_000;
    await c.mutation(api.content.schedule, { slug: w.slug, artifactId, when });
    const approval = await t.run(async (ctx) => ctx.db.get((await ctx.db.get(artifactId))!.approvalId!));
    expect(approval!.expiresAt).toBeGreaterThan(when);
    await run(t);
    const done = await c.query(api.content.get, { slug: w.slug, artifactId });
    expect(done.receipts[0]?.summary ?? done.lastPublishError?.message).toMatch(/Accepted by LinkedIn/);
    expect(done.status).toBe("published");
  });

  it("a blocked publish records why, tells approvers and never stays sending", async () => {
    const t = setup();
    const w = await workspace(t);
    const connectionId = await connectLinkedIn(t, w);
    const artifactId = await draft(t, w.orgId, "linkedin");
    const c = w.owner.client;
    await c.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    await c.mutation(api.content.publishNow, { slug: w.slug, artifactId });
    await t.run(async (ctx) => ctx.db.patch(connectionId, { status: "action_required" }));
    await run(t);
    const view = await c.query(api.content.get, { slug: w.slug, artifactId });
    expect(view.status).toBe("approved");
    expect(view.lastPublishError?.message).toMatch(/isn't connected/);
    const notices = await t.run(async (ctx) => ctx.db.query("notices").collect());
    expect(notices.some((n) => /wasn't posted/.test(n.text))).toBe(true);
  });

  it("an approval made before connecting must be renewed before publishing", async () => {
    const t = setup();
    const w = await workspace(t);
    const artifactId = await draft(t, w.orgId, "linkedin");
    const c = w.owner.client;
    await c.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    expect((await c.query(api.content.get, { slug: w.slug, artifactId })).approvalProblem).toBeNull();
    await connectLinkedIn(t, w);
    const view = await c.query(api.content.get, { slug: w.slug, artifactId });
    expect(view.approvalProblem).toMatch(/before this account was connected/);
    await expect(c.mutation(api.content.publishNow, { slug: w.slug, artifactId })).rejects.toThrow(/Approve it again/);
    await c.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    expect((await c.query(api.content.get, { slug: w.slug, artifactId })).approvalProblem).toBeNull();
  });

  it("guards states: no deciding or editing while uncertain, no re-approving a live approval, no archiving mid-send", async () => {
    const t = setup();
    const w = await workspace(t);
    const artifactId = await draft(t, w.orgId, "linkedin");
    const c = w.owner.client;
    await c.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    await expect(c.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" })).rejects.toThrow(/already approved/);

    await t.run(async (ctx) => ctx.db.patch(artifactId, { status: "uncertain" }));
    await expect(c.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" })).rejects.toThrow(/posted first/);
    await expect(c.mutation(api.content.edit, { slug: w.slug, artifactId, body: "New text", hashtags: [] })).rejects.toThrow(/posted first/);
    await expect(c.mutation(api.content.archive, { slug: w.slug, artifactId })).rejects.toThrow(/posted first/);

    await t.run(async (ctx) => ctx.db.patch(artifactId, { status: "publishing" }));
    await expect(c.mutation(api.content.archive, { slug: w.slug, artifactId })).rejects.toThrow(/sent right now/);

    await t.run(async (ctx) => ctx.db.patch(artifactId, { status: "published" }));
    await expect(c.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "reject" })).rejects.toThrow(/current state/);
  });

  it("adds a library image to a post; Instagram posts need one before approval", async () => {
    const t = setup();
    const w = await workspace(t);
    const other = await workspace(t, "other@flow.example");
    const artifactId = await draft(t, w.orgId, "instagram");
    const c = w.owner.client;
    await expect(c.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" })).rejects.toThrow(/need an image/);

    const asset = async (orgId: Id<"organizations">) =>
      t.run(async (ctx) => {
        const storageId = await ctx.storage.store(new Blob(["png"], { type: "image/png" }));
        return ctx.db.insert("assets", { orgId, kind: "product_photo", source: "store", storageId, mime: "image/png", label: "Mug", createdAt: Date.now() });
      });
    const foreign = await asset(other.orgId);
    await expect(c.mutation(api.content.edit, { slug: w.slug, artifactId, body: "Hello from Flow Co.", hashtags: [], altText: "A mug", imageAssetId: foreign })).rejects.toThrow(/couldn't find that image/);

    const mine = await asset(w.orgId);
    const res = await c.mutation(api.content.edit, { slug: w.slug, artifactId, body: "Hello from Flow Co.", hashtags: [], altText: "A mug", imageAssetId: mine });
    expect(res.changed).toBe(true);
    const view = await c.query(api.content.get, { slug: w.slug, artifactId });
    expect(view.current?.imageUrl).toBeTruthy();
    expect(view.current?.imageLabel).toBe("Your product photo");
    await c.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    expect((await c.query(api.content.get, { slug: w.slug, artifactId })).status).toBe("approved");
  });

  it("the content list's All view leaves out archived items", async () => {
    const t = setup();
    const w = await workspace(t);
    const keep = await draft(t, w.orgId, "linkedin");
    const gone = await draft(t, w.orgId, "x");
    await w.owner.client.mutation(api.content.archive, { slug: w.slug, artifactId: gone });
    const all = await w.owner.client.query(api.content.list, { slug: w.slug, paginationOpts: { numItems: 50, cursor: null } });
    expect(all.page.map((a) => a.id)).toContain(keep);
    expect(all.page.map((a) => a.id)).not.toContain(gone);
    const archived = await w.owner.client.query(api.content.list, { slug: w.slug, status: "archived", paginationOpts: { numItems: 50, cursor: null } });
    expect(archived.page.map((a) => a.id)).toEqual([gone]);
  });
});
