import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordArtifactDecision } from "../../convex/lib/approvals";
import { api, internal } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { approvalHash, contentHash } from "../../shared/policy";
import { asNewUser, makePaid, setup, type T } from "./helpers";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) }));

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

const authorizationChanges = ["revoked_approval", "paused_workspace", "changed_policy", "removed_approver", "revoked_connection", "changed_account", "missing_scope", "ended_package"] as const;

async function preparedClaim(t: T, artifactId: Id<"artifacts">) {
  const c = (await t.query(internal.publish.publishContext, { artifactId }))!;
  const secret = await t.query(internal.connections.getSecret, { connectionId: c.connection!._id });
  return { artifactId, versionId: c.version!._id, approvalId: c.approval!._id, approvalHash: c.approval!.approvalHash,
    connectionId: c.connection!._id, connectionUpdatedAt: c.connection!.updatedAt, secretId: secret?.secretId,
    idempotencyKey: c.idempotencyKey, provider: "linkedin", action: "linkedin.publish_post" };
}

async function changeAuthorization(t: T, w: W, args: Awaited<ReturnType<typeof preparedClaim>>, change: typeof authorizationChanges[number]) {
  await t.run(async ctx => {
    if (change === "revoked_approval") await ctx.db.patch(args.approvalId, { status: "invalidated" });
    if (change === "paused_workspace") await ctx.db.patch(w.orgId, { emergencyStop: { active: true, at: Date.now(), by: w.owner.userId } });
    if (change === "changed_policy") {
      const policy = (await ctx.db.query("autonomyPolicies").withIndex("by_org_active", q => q.eq("orgId", w.orgId).eq("active", true)).first())!;
      await ctx.db.patch(policy._id, { version: policy.version + 1 });
    }
    if (change === "removed_approver") {
      const member = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", w.orgId).eq("userId", w.owner.userId)).unique())!;
      await ctx.db.patch(member._id, { role: "viewer" });
    }
    if (change === "revoked_connection") await ctx.db.patch(args.connectionId, { status: "revoked" });
    if (change === "changed_account") await ctx.db.patch(args.connectionId, { externalAccountId: "urn:li:person:different" });
    if (change === "missing_scope") await ctx.db.patch(args.connectionId, { scopes: ["openid", "profile"] });
    if (change === "ended_package") for (const sub of await ctx.db.query("subscriptions").collect()) await ctx.db.patch(sub._id, { status: "canceled", currentPeriodEnd: Date.now() - 1 });
  });
}

describe("publishing lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-10-20T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(authorizationChanges)("refuses the final send claim after %s changes during preparation", async change => {
    const t = setup(); const w = await workspace(t);
    const connectionId = await connectLinkedIn(t, w);
    const artifactId = await draft(t, w.orgId, "linkedin");
    await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    const args = await preparedClaim(t, artifactId);
    await changeAuthorization(t, w, args, change);
    expect(await t.mutation(internal.publish.beginReceipt, args)).toMatchObject({ blocked: expect.any(String) });
    expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toHaveLength(0);
    expect(connectionId).toBe(args.connectionId);
  });

  it.each(authorizationChanges)("does not publish when %s changes during the actual link check", async change => {
    const t = setup(); const w = await workspace(t);
    await connectLinkedIn(t, w);
    const artifactId = await draft(t, w.orgId, "linkedin", "Learn more: https://flow.example/guide");
    await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    const args = await preparedClaim(t, artifactId);
    const stub = linkedInStub(0); const providerFetch = globalThis.fetch;
    let checked = false;
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      if (String(input) === "https://flow.example/guide") {
        checked = true;
        await changeAuthorization(t, w, args, change);
        return new Response("A useful guide", { status: 200 });
      }
      return providerFetch(input, init);
    }));
    await t.action(internal.publish.publishArtifact, { artifactId });
    expect(checked).toBe(true);
    expect(stub.posts()).toBe(0);
    expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toHaveLength(0);
    expect((await t.run(ctx => ctx.db.get(artifactId)))?.status).toBe("in_review");
  });

  it("requires fresh approval for a legacy account-less binding and retains unchanged account approvals", async () => {
    const t = setup(); const w = await workspace(t);
    await connectLinkedIn(t, w);
    const artifactId = await draft(t, w.orgId, "linkedin");
    await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    const args = await preparedClaim(t, artifactId);
    await t.run(async ctx => {
      const ap = (await ctx.db.get(args.approvalId))!;
      const scope = { ...ap.scope, externalAccountId: undefined };
      const hash = await approvalHash({ orgId: ap.orgId, subjectType: ap.subjectType, subjectId: ap.subjectId, actionKind: ap.actionKind, contentHash: ap.contentHash, scope, policyVersion: ap.policyVersion, expiresAt: ap.expiresAt });
      await ctx.db.patch(ap._id, { scope, approvalHash: hash });
    });
    const review = await w.owner.client.query(api.content.get, { slug: w.slug, artifactId });
    expect(review.approvalProblem).toMatch(/provider account/);
    expect(review.canApprove).toBe(true);
    await expect(w.owner.client.mutation(api.content.publishNow, { slug: w.slug, artifactId })).rejects.toThrow(/provider account/);
    await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    const fresh = await preparedClaim(t, artifactId);
    const first = await t.mutation(internal.publish.beginReceipt, fresh);
    expect(first).toMatchObject({ existingStatus: null, receiptId: expect.any(String) });
    expect((await t.run(ctx => ctx.db.get(artifactId)))?.status).toBe("publishing");
    await expect(w.owner.client.mutation(api.content.edit, { slug: w.slug, artifactId, body: "Changed", hashtags: [] })).rejects.toThrow(/can't be edited/);
    expect(await t.mutation(internal.publish.beginReceipt, fresh)).toMatchObject({ existingStatus: "uncertain" });
    expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toHaveLength(1);
  });

  it("does not let a concurrent worker's refusal undo a claimed send", async () => {
    const t = setup(); const w = await workspace(t);
    await connectLinkedIn(t, w);
    const artifactId = await draft(t, w.orgId, "linkedin");
    await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    await t.run(ctx => ctx.db.patch(artifactId, { status: "publishing" }));
    const args = await preparedClaim(t, artifactId);
    await t.mutation(internal.publish.beginReceipt, args);
    const claimed = await t.run(ctx => ctx.db.get(artifactId));
    await t.mutation(internal.publish.blockPublish, { artifactId, expected: { versionId: args.versionId, approvalId: args.approvalId, approvalHash: args.approvalHash, status: "publishing", scheduledFor: null }, reason: "A late worker saw changed access", backTo: "in_review" });
    expect(await t.run(ctx => ctx.db.get(artifactId))).toEqual(claimed);
    expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toHaveLength(1);
  });

  it.each(["invalid_json", "missing_token", "non_string_token", "unreadable"] as const)("returns credential preparation failures to review without a send: %s", async change => {
    const t = setup(); const w = await workspace(t);
    const connectionId = await connectLinkedIn(t, w);
    const artifactId = await draft(t, w.orgId, "linkedin");
    await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    await t.run(ctx => ctx.db.patch(artifactId, { status: "publishing" }));
    if (change === "unreadable") await t.run(async ctx => {
      const secret = (await ctx.db.query("connectionSecrets").withIndex("by_connection", q => q.eq("connectionId", connectionId)).first())!;
      await ctx.db.patch(secret._id, { ciphertext: "invalid" });
    });
    else await t.mutation(internal.connections.rotateSecret, { connectionId, secret: change === "invalid_json" ? "{" : JSON.stringify(change === "non_string_token" ? { accessToken: 42 } : {}), expiresAt: Date.now() + 86_400_000 });
    const stub = linkedInStub(0);
    await t.action(internal.publish.publishArtifact, { artifactId });
    const result = await t.run(ctx => ctx.db.get(artifactId));
    expect(["approved", "in_review"]).toContain(result?.status);
    expect(result?.lastPublishError?.message).toMatch(/credentials|access token/);
    expect(stub.posts()).toBe(0);
    expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toHaveLength(0);
  });

  it("rejects a replaced secret even when its connection timestamp has not changed", async () => {
    const t = setup(); const w = await workspace(t);
    await connectLinkedIn(t, w);
    const artifactId = await draft(t, w.orgId, "linkedin");
    await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    const args = await preparedClaim(t, artifactId);
    await t.mutation(internal.connections.rotateSecret, { connectionId: args.connectionId, secret: JSON.stringify({ accessToken: "new-token" }), expiresAt: Date.now() + 86_400_000 });
    expect((await t.run(ctx => ctx.db.get(args.connectionId)))?.updatedAt).toBe(args.connectionUpdatedAt);
    expect(await t.mutation(internal.publish.beginReceipt, args)).toMatchObject({ blocked: expect.stringMatching(/credentials changed/) });
    const refreshed = await preparedClaim(t, artifactId);
    expect(await t.mutation(internal.publish.beginReceipt, refreshed)).toMatchObject({ existingStatus: null });
  });

  it.each(["edited", "reapproved", "rescheduled"] as const)("leaves %s work intact when an old preparation finishes", async change => {
    const t = setup(); const w = await workspace(t);
    await connectLinkedIn(t, w);
    const artifactId = await draft(t, w.orgId, "linkedin", "Learn more: https://flow.example/guide");
    await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    const stub = linkedInStub(0); const providerFetch = globalThis.fetch;
    let changed: Doc<"artifacts"> | null = null;
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      if (String(input) !== "https://flow.example/guide") return providerFetch(input, init);
      if (change === "rescheduled") await w.owner.client.mutation(api.content.schedule, { slug: w.slug, artifactId, when: Date.now() + 86_400_000 });
      else {
        await w.owner.client.mutation(api.content.edit, { slug: w.slug, artifactId, body: "The owner's new version.", hashtags: [] });
        if (change === "reapproved") await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
      }
      changed = await t.run(ctx => ctx.db.get(artifactId));
      return new Response("A useful guide", { status: 200 });
    }));
    await t.action(internal.publish.publishArtifact, { artifactId });
    expect(changed).not.toBeNull();
    expect(await t.run(ctx => ctx.db.get(artifactId))).toEqual(changed);
    expect(stub.posts()).toBe(0);
    expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toHaveLength(0);
  });

  it.each(["off", "always_ask", "trust_reset", "new_topic", "removed_channel", "skipped_slot", "review_policy", "unchanged"] as const)("rechecks automatic authority at sending: %s", async change => {
    const t = setup(); const w = await workspace(t);
    await connectLinkedIn(t, w);
    await w.owner.client.mutation(api.orgs.setAutonomy, { slug: w.slug, mode: "bounded_autopilot" });
    const artifactId = await draft(t, w.orgId, "linkedin");
    const { settingsId, slotId } = await t.run(async ctx => {
      const now = Date.now();
      const settingsId = await ctx.db.insert("autopilotSettings", { orgId: w.orgId, enabled: true, mode: "auto", channels: [{ channel: "linkedin", postsPerWeek: 1 }], postingHours: [], alwaysAskTopics: [], imagesPerWeek: 0, trust: [], updatedBy: w.owner.userId, createdAt: now, updatedAt: now });
      await ctx.db.patch(artifactId, { scheduledFor: now });
      const a = (await ctx.db.get(artifactId))!;
      await recordArtifactDecision(ctx, { org: (await ctx.db.get(w.orgId))!, artifact: a, version: (await ctx.db.get(a.currentVersionId!))!, decision: "approve" });
      await ctx.db.patch(artifactId, { status: "scheduled" });
      const slotId = await ctx.db.insert("calendarSlots", { orgId: w.orgId, weekOf: "2026-10-19", channel: "linkedin", day: 2, slotAt: now, pillar: "Education", purpose: "Help", format: "text", idea: "Guide", angle: "Useful", hookDraft: "Hello", callToAction: "Read", needsOwner: false, status: "scheduled", artifactId, routing: { decision: "auto", reasons: ["Passed"] }, createdAt: now, updatedAt: now });
      return { settingsId, slotId };
    });
    const args = await preparedClaim(t, artifactId);
    await t.run(async ctx => {
      if (change === "off") await ctx.db.patch(settingsId, { enabled: false });
      if (change === "always_ask") await ctx.db.patch(settingsId, { mode: "always_ask" });
      if (change === "trust_reset") await ctx.db.patch(settingsId, { mode: "trust_ladder", trust: [] });
      if (change === "new_topic") await ctx.db.patch(settingsId, { alwaysAskTopics: ["Flow Co"] });
      if (change === "removed_channel") await ctx.db.patch(settingsId, { channels: [] });
      if (change === "skipped_slot") await ctx.db.patch(slotId, { status: "skipped" });
      if (change === "review_policy") {
        const policy = (await ctx.db.query("autonomyPolicies").withIndex("by_org_active", q => q.eq("orgId", w.orgId).eq("active", true)).first())!;
        await ctx.db.patch(policy._id, { mode: "review" });
      }
    });
    const result = await t.mutation(internal.publish.beginReceipt, args);
    expect(result).toMatchObject(change === "unchanged" ? { existingStatus: null } : { blocked: expect.any(String) });
    expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toHaveLength(change === "unchanged" ? 1 : 0);
  });

  it.each(["foreign_connection", "foreign_approval", "foreign_version", "foreign_business", "wrong_action", "wrong_key", "expired", "removed_requester", "future_schedule"] as const)("rejects invalid final send bindings: %s", async change => {
    const t = setup(); const w = await workspace(t); const other = await workspace(t, "other@flow.example");
    await connectLinkedIn(t, w); const otherConnection = await connectLinkedIn(t, other);
    const artifactId = await draft(t, w.orgId, "linkedin"); const otherArtifact = await draft(t, other.orgId, "linkedin");
    await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    await other.owner.client.mutation(api.content.decide, { slug: other.slug, artifactId: otherArtifact, decision: "approve" });
    const args = await preparedClaim(t, artifactId); const foreign = await preparedClaim(t, otherArtifact);
    if (change === "foreign_connection") args.connectionId = otherConnection;
    if (change === "foreign_approval") args.approvalId = foreign.approvalId;
    if (change === "foreign_version") args.versionId = foreign.versionId;
    if (change === "wrong_action") args.action = "x.publish_post";
    if (change === "wrong_key") args.idempotencyKey = foreign.idempotencyKey;
    if (change === "expired") await t.run(ctx => ctx.db.patch(args.approvalId, { expiresAt: Date.now() - 1 }));
    if (change === "foreign_business") await t.run(async ctx => ctx.db.patch(artifactId, { businessId: (await ctx.db.get(otherArtifact))!.businessId }));
    if (change === "future_schedule") {
      await w.owner.client.mutation(api.content.schedule, { slug: w.slug, artifactId, when: Date.now() + 86_400_000 });
      Object.assign(args, await preparedClaim(t, artifactId));
      const scheduled = await t.run(ctx => ctx.db.get(artifactId));
      await t.action(internal.publish.publishArtifact, { artifactId });
      expect(await t.run(ctx => ctx.db.get(artifactId))).toEqual(scheduled);
    }
    expect(await t.mutation(internal.publish.beginReceipt, { ...args, ...(change === "removed_requester" ? { requestedBy: other.owner.userId } : {}) })).toMatchObject({ blocked: expect.any(String) });
    expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toHaveLength(0);
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

  it("blocks an approved post when its link is unsafe and never calls the social provider", async () => {
    const t = setup();
    const w = await workspace(t, "unsafe-link@flow.example");
    await connectLinkedIn(t, w);
    const artifactId = await draft(t, w.orgId, "linkedin", "Book here: https://127.0.0.1/private");
    const stub = linkedInStub(0);

    await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    await w.owner.client.mutation(api.content.publishNow, { slug: w.slug, artifactId });
    await run(t);

    const view = await w.owner.client.query(api.content.get, { slug: w.slug, artifactId });
    expect(view.status).toBe("approved");
    expect(view.lastPublishError?.message).toMatch(/could not be safely confirmed/i);
    expect(view.receipts).toHaveLength(0);
    expect(stub.posts()).toBe(0);
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
    const supportingFactId = await t.run(async (ctx) => {
      const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", w.orgId)).first())!;
      return ctx.db.insert("businessFacts", { orgId: w.orgId, businessId: business._id, category: "audience", statement: "Customers book through the website.", confidence: "high", reviewState: "confirmed", provenance: "owner_supplied", sourceIds: [], createdAt: Date.now(), updatedAt: Date.now() });
    });
    const copyBrief = {
      reader: "Local service owners", situation: "They need qualified bookings", awarenessStage: "problem_aware", relationshipStage: "unknown",
      objective: "Request a consultation", offerFactIds: [supportingFactId], problemJob: "Choose a provider", trigger: "An active need", centralIdea: "Make the next step clear",
      objection: "Unknown", proofFactIds: [], prohibitedClaims: [], channel: "facebook", format: "single image", deliveryContext: "Organic post",
      brandVoice: "Clear and practical", approvedExamples: [], cta: "Ask for details", afterAction: "Reply to the inquiry", trackingMetric: "Qualified inquiries",
      trackingMethod: "Unknown", supportingFactIds: [supportingFactId], supportingSourceUrls: ["https://example.com/trends/dated-format"],
      trendEvidence: { sourceUrl: "https://example.com/trends/dated-format", observationDate: "2026-10-20", observation: "The source reports a dated format example.", retrievedAt: Date.parse("2026-10-21T12:00:00Z") }, unknowns: ["Availability"],
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
    expect(updated.facts).toContainEqual(expect.objectContaining({ id: supportingFactId, statement: "Customers book through the website." }));
    const versions = await t.run(async (ctx) => ctx.db.query("artifactVersions").withIndex("by_artifact", (q) => q.eq("artifactId", artifactId)).collect());
    expect(versions).toHaveLength(2);
    expect(versions[1]?.copyBrief).toEqual(copyBrief);
    expect(versions[0]?.contentHash).not.toBe(versions[1]?.contentHash);
  });

  it("keeps offer terms attached through edits and blocks approval of mismatched customer copy", async () => {
    const t = setup();
    const w = await workspace(t, "offer-copy-approval@flow.example");
    const artifactId = await draft(t, w.orgId, "facebook");
    const offerTermsSnapshot = [{
      playName: "First-time service offer",
      recommendation: "recommend_promotion",
      currency: "USD",
      allowedPrices: [100, 80],
      allowedDiscountPercentages: [20],
      allowedMechanisms: ["discount"],
      urgencyClaim: null,
      eligibleAudience: "First-time quote requesters",
    }];
    await t.run(async (ctx) => {
      const artifact = await ctx.db.get(artifactId);
      const version = await ctx.db.get(artifact!.currentVersionId!);
      const snapshotHash = await contentHash({
        body: version!.body,
        hashtags: version!.hashtags,
        channel: artifact!.channel,
        approvedOfferTermsSnapshot: offerTermsSnapshot,
        offerPlayNameSnapshot: "First-time service offer",
      });
      await ctx.db.patch(version!._id, {
        approvedOfferTermsSnapshot: offerTermsSnapshot,
        offerPlayNameSnapshot: "First-time service offer",
        contentHash: snapshotHash,
      });
    });

    await w.owner.client.mutation(api.content.edit, {
      slug: w.slug,
      artifactId,
      body: "First-time quote requesters: save 40% today and pay $60 USD.",
      hashtags: [],
    });
    const editedVersion = await t.run(async (ctx) => {
      const artifact = await ctx.db.get(artifactId);
      return ctx.db.get(artifact!.currentVersionId!);
    });
    expect(editedVersion?.approvedOfferTermsSnapshot).toEqual(offerTermsSnapshot);
    expect(editedVersion?.offerPlayNameSnapshot).toBe("First-time service offer");
    await expect(w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" })).rejects.toThrow(/doesn't match the offer terms approved with its plan/i);

    await w.owner.client.mutation(api.content.edit, {
      slug: w.slug,
      artifactId,
      body: "First-time quote requesters: save 20% and pay $80 USD.",
      hashtags: [],
    });
    await w.owner.client.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    expect((await w.owner.client.query(api.content.get, { slug: w.slug, artifactId })).status).toBe("approved");
  });

  it("shows only same-business evidence sources on the artifact review screen", async () => {
    const t = setup();
    const w = await workspace(t, "fact-source-review@flow.example");
    const artifactId = await draft(t, w.orgId, "facebook");
    const foreign = await workspace(t, "foreign-fact-source@flow.example");
    const factId = await t.run(async (ctx) => {
      const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", w.orgId)).first())!;
      const foreignBusiness = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", foreign.orgId)).first())!;
      const localSourceId = await ctx.db.insert("factSources", {
        orgId: w.orgId,
        businessId: business._id,
        kind: "website",
        url: "https://flow.example/pricing",
        title: "Pricing page",
        excerpt: "Plans are billed monthly.",
        fetchedAt: Date.now() - 1_000,
        status: "ok",
        expiresAt: Date.now() + 60_000,
      });
      const foreignSourceId = await ctx.db.insert("factSources", {
        orgId: foreign.orgId,
        businessId: foreignBusiness._id,
        kind: "website",
        url: "https://private.example/secret",
        fetchedAt: Date.now(),
        status: "ok",
        expiresAt: Date.now() + 60_000,
      });
      const id = await ctx.db.insert("businessFacts", {
        orgId: w.orgId,
        businessId: business._id,
        category: "pricing",
        statement: "Plans are billed monthly.",
        confidence: "high",
        reviewState: "confirmed",
        provenance: "researched",
        sourceIds: [localSourceId, foreignSourceId],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const artifact = await ctx.db.get(artifactId);
      const version = await ctx.db.get(artifact!.currentVersionId!);
      await ctx.db.patch(version!._id, { claimFactIds: [id] });
      return id;
    });

    const view = await w.owner.client.query(api.content.get, { slug: w.slug, artifactId });
    expect(view.facts).toContainEqual(expect.objectContaining({
      id: factId,
      category: "pricing",
      confidence: "high",
      provenance: "researched",
      sources: [expect.objectContaining({ url: "https://flow.example/pricing", expired: false })],
    }));
    expect(JSON.stringify(view.facts)).not.toContain("private.example");
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

  it("binds a scheduled approval to its exact time and rejects a later unapproved time change", async () => {
    const t = setup();
    const w = await workspace(t, "schedule-scope@flow.example");
    await connectLinkedIn(t, w);
    const artifactId = await draft(t, w.orgId, "linkedin");
    const stub = linkedInStub(0);
    const c = w.owner.client;
    await c.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });

    const firstTime = Date.now() + 2 * 86_400_000;
    const secondTime = firstTime + 86_400_000;
    await c.mutation(api.content.schedule, { slug: w.slug, artifactId, when: firstTime });
    const firstApproval = await t.run(async (ctx) => ctx.db.get((await ctx.db.get(artifactId))!.approvalId!));
    expect(firstApproval!.scope.scheduledFor).toBe(firstTime);

    await c.mutation(api.content.schedule, { slug: w.slug, artifactId, when: secondTime });
    const secondApproval = await t.run(async (ctx) => ctx.db.get((await ctx.db.get(artifactId))!.approvalId!));
    expect(secondApproval!.scope.scheduledFor).toBe(secondTime);
    expect(secondApproval!.approvalHash).not.toBe(firstApproval!.approvalHash);

    // A timer for the old time cannot publish a post that was rescheduled.
    await t.action(internal.publish.scheduledPublish, { artifactId, expectedScheduledFor: firstTime });
    expect((await c.query(api.content.get, { slug: w.slug, artifactId })).status).toBe("scheduled");
    expect(stub.posts()).toBe(0);

    // Even a direct schedule mutation cannot reuse the approval for the old timestamp.
    await t.run(async (ctx) => ctx.db.patch(artifactId, { scheduledFor: secondTime + 1 }));
    await expect(c.mutation(api.content.publishNow, { slug: w.slug, artifactId })).rejects.toThrow(/scheduled time changed after approval/i);
    expect(stub.posts()).toBe(0);
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
