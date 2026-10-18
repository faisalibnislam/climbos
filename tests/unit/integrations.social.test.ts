import { describe, expect, it } from "vitest";
import * as linkedin from "../../shared/integrations/linkedin";
import {
  buildAuthorizationUrl,
  buildCodeExchangeRequest,
  buildRefreshRequest,
  buildRevocationRequest,
  OAUTH_PROVIDERS,
  parseTokenResponse,
  scopesFor,
} from "../../shared/integrations/oauth";
import { LINKEDIN_API_VERSION } from "../../shared/integrations/registry";
import type { ApprovedAction, FetchLike } from "../../shared/integrations/types";
import * as x from "../../shared/integrations/x";

/** LinkedIn + X: OAuth builders, publishers and the X length guard. Fetch is scripted; nothing real is called. */

type Responder = Response | Error | ((call: Call) => Response);
interface Route {
  match: string;
  method?: string;
  respond: Responder;
}
interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function scripted(routes: Route[]): { fetchImpl: FetchLike; calls: Call[] } {
  const queue = [...routes];
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const method = init?.method ?? "GET";
    const call: Call = { url, method, headers: (init?.headers ?? {}) as Record<string, string>, body: typeof init?.body === "string" ? init.body : undefined };
    calls.push(call);
    const idx = queue.findIndex((r) => url.includes(r.match) && (!r.method || r.method === method));
    if (idx < 0) throw new Error(`Unexpected ${method} ${url}`);
    const [route] = queue.splice(idx, 1);
    if (!route) throw new Error("unreachable");
    if (route.respond instanceof Error) throw route.respond;
    return typeof route.respond === "function" ? route.respond(call) : route.respond;
  };
  return { fetchImpl, calls };
}

const NOW = Date.UTC(2026, 9, 18, 12);
function approval(kind: string, targetId: string, value: string): ApprovedAction {
  return { kind, targetId, value, approvedBy: "owner@biz.example", approvedAt: NOW - 60_000 };
}

describe("OAuth: LinkedIn and X", () => {
  it("LinkedIn: no PKCE, space-separated scopes, secret in the body", () => {
    const url = new URL(
      buildAuthorizationUrl({ provider: OAUTH_PROVIDERS.linkedin, clientId: "li-id", redirectUri: "https://app.example/api/oauth/callback", scopes: scopesFor(["linkedin.read_profile", "linkedin.publish_post"]), state: "s".repeat(32) }),
    );
    expect(url.origin + url.pathname).toBe("https://www.linkedin.com/oauth/v2/authorization");
    expect(url.searchParams.get("scope")).toBe("openid profile w_member_social");
    expect(url.searchParams.has("code_challenge")).toBe(false);

    const ex = buildCodeExchangeRequest({ provider: OAUTH_PROVIDERS.linkedin, clientId: "li-id", clientSecret: "li-secret", code: "c1", redirectUri: "https://app.example/cb" });
    expect(ex.url).toBe("https://www.linkedin.com/oauth/v2/accessToken");
    expect(ex.headers.Authorization).toBeUndefined();
    expect(new URLSearchParams(ex.body).get("client_secret")).toBe("li-secret");

    const rv = buildRevocationRequest({ provider: OAUTH_PROVIDERS.linkedin, token: "t", clientId: "li-id", clientSecret: "li-secret" });
    expect(rv?.url).toBe("https://www.linkedin.com/oauth/v2/revoke");
    expect(new URLSearchParams(rv?.body).get("token")).toBe("t");
    expect(buildRevocationRequest({ provider: OAUTH_PROVIDERS.linkedin, token: "t" })).toBeNull();
  });

  it("X: PKCE required; token, refresh and revoke use HTTP Basic, never the secret in the body", () => {
    const base = { provider: OAUTH_PROVIDERS.x, clientId: "x-id", redirectUri: "https://app.example/cb", scopes: scopesFor(["x.read_profile", "x.publish_post"]), state: "s".repeat(32) };
    expect(() => buildAuthorizationUrl(base)).toThrow(/PKCE/);
    const url = new URL(buildAuthorizationUrl({ ...base, codeChallenge: "chal" }));
    expect(url.origin + url.pathname).toBe("https://x.com/i/oauth2/authorize");
    expect(url.searchParams.get("scope")).toBe("users.read tweet.read tweet.write offline.access");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");

    const basic = `Basic ${btoa("x-id:x-secret")}`;
    const ex = buildCodeExchangeRequest({ provider: OAUTH_PROVIDERS.x, clientId: "x-id", clientSecret: "x-secret", code: "c1", redirectUri: "https://app.example/cb", codeVerifier: "v".repeat(43) });
    expect(ex.url).toBe("https://api.x.com/2/oauth2/token");
    expect(ex.headers.Authorization).toBe(basic);
    const exBody = new URLSearchParams(ex.body);
    expect(exBody.get("code_verifier")).toBe("v".repeat(43));
    expect(exBody.has("client_secret")).toBe(false);
    expect(() => buildCodeExchangeRequest({ provider: OAUTH_PROVIDERS.x, clientId: "x-id", clientSecret: "x-secret", code: "c1", redirectUri: "https://app.example/cb" })).toThrow();

    const rf = buildRefreshRequest({ provider: OAUTH_PROVIDERS.x, clientId: "x-id", clientSecret: "x-secret", refreshToken: "r1" });
    expect(rf.headers.Authorization).toBe(basic);
    expect(new URLSearchParams(rf.body).get("grant_type")).toBe("refresh_token");
    expect(new URLSearchParams(rf.body).has("client_secret")).toBe(false);

    const rv = buildRevocationRequest({ provider: OAUTH_PROVIDERS.x, token: "t", clientId: "x-id", clientSecret: "x-secret" });
    expect(rv?.url).toBe("https://api.x.com/2/oauth2/revoke");
    expect(rv?.headers.Authorization).toBe(basic);
    expect(new URLSearchParams(rv?.body).get("token_type_hint")).toBe("access_token");

    // Other providers keep the secret in the body.
    expect(buildRefreshRequest({ provider: OAUTH_PROVIDERS.google, clientId: "g", clientSecret: "gs", refreshToken: "r" }).headers.Authorization).toBeUndefined();
  });

  it("parses X tokens with a rotating refresh token and expiry", () => {
    const parsed = parseTokenResponse({ token_type: "bearer", expires_in: 7200, access_token: "a2", scope: "tweet.write users.read tweet.read offline.access", refresh_token: "r2" }, NOW);
    expect(parsed.ok && parsed.token).toMatchObject({ accessToken: "a2", refreshToken: "r2", expiresAt: NOW + 7_200_000 });
    expect(parsed.ok && parsed.token.scopes).toContain("offline.access");
  });
});

describe("linkedin", () => {
  const post: linkedin.LinkedInPostInput = { authorUrn: "urn:li:person:abc123", text: "New gear (just in) for #climbing fans_ see https://shop.example.com/new" };

  it("escapes little-text reserved characters but keeps hashtags, and round-trips", () => {
    const lt = linkedin.toLittleText(post.text);
    expect(lt).toBe("New gear \\(just in\\) for #climbing fans\\_ see https://shop.example.com/new");
    expect(linkedin.fromLittleText(lt)).toBe(post.text);
    expect(linkedin.fromLittleText("Hi {hashtag|\\#|climbing}")).toBe("Hi #climbing");
    expect(linkedin.toLittleText("a#b @me")).toBe("a\\#b \\@me");
  });

  it("probes the member via OIDC userinfo", async () => {
    const { fetchImpl } = scripted([{ match: "/v2/userinfo", respond: json(200, { sub: "abc123", name: "Sam Lee" }) }]);
    const me = await linkedin.getMember({ accessToken: "t", fetchImpl });
    expect(me.ok && me.data).toEqual({ id: "abc123", personUrn: "urn:li:person:abc123", name: "Sam Lee" });
  });

  it("publishes with versioned headers, reads the post back and verifies", async () => {
    const value = await linkedin.linkedInApprovalValue(post);
    let sent: Record<string, unknown> = {};
    const { fetchImpl, calls } = scripted([
      {
        match: "/rest/posts",
        method: "POST",
        respond: (c) => {
          sent = JSON.parse(c.body ?? "{}") as Record<string, unknown>;
          return new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:7001" } });
        },
      },
      { match: "/rest/posts/urn%3Ali%3Ashare%3A7001", respond: () => json(200, { id: "urn:li:share:7001", commentary: sent.commentary, lifecycleState: "PUBLISHED" }) },
    ]);
    const res = await linkedin.publishPost({ accessToken: "t", fetchImpl, post, approval: approval(linkedin.PUBLISH_LINKEDIN_ACTION, post.authorUrn, value), now: NOW });
    expect(res).toMatchObject({ status: "verified", externalId: "urn:li:share:7001" });
    expect(calls[0]?.headers["LinkedIn-Version"]).toBe(LINKEDIN_API_VERSION);
    expect(calls[0]?.headers["X-Restli-Protocol-Version"]).toBe("2.0.0");
    expect(sent).toMatchObject({
      author: post.authorUrn,
      visibility: "PUBLIC",
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    });
  });

  it("read-back 404 or 403 → uncertain (not failed), and the post id is kept", async () => {
    const value = await linkedin.linkedInApprovalValue(post);
    for (const status of [404, 403]) {
      const { fetchImpl } = scripted([
        { match: "/rest/posts", method: "POST", respond: new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:7002" } }) },
        { match: "/rest/posts/urn", respond: json(status, { message: "nope", status }) },
      ]);
      const res = await linkedin.publishPost({ accessToken: "t", fetchImpl, post, approval: approval(linkedin.PUBLISH_LINKEDIN_ACTION, post.authorUrn, value), now: NOW });
      expect(res).toMatchObject({ status: "uncertain", externalId: "urn:li:share:7002", retryable: false });
    }
  });

  it("refuses stale approvals before any call; 401 → reconnect; 429 → retryable; 5xx → uncertain", async () => {
    const stale = await linkedin.linkedInApprovalValue({ ...post, text: "old" });
    const none = scripted([]);
    expect((await linkedin.publishPost({ accessToken: "t", fetchImpl: none.fetchImpl, post, approval: approval(linkedin.PUBLISH_LINKEDIN_ACTION, post.authorUrn, stale), now: NOW })).status).toBe("failed");
    expect(none.calls).toHaveLength(0);

    const value = await linkedin.linkedInApprovalValue(post);
    const ok = approval(linkedin.PUBLISH_LINKEDIN_ACTION, post.authorUrn, value);
    const r401 = await linkedin.publishPost({ accessToken: "t", fetchImpl: scripted([{ match: "/rest/posts", respond: json(401, { message: "expired" }) }]).fetchImpl, post, approval: ok, now: NOW });
    expect(r401).toMatchObject({ status: "failed", retryable: false });
    expect(r401.providerMessage).toMatch(/Reconnect LinkedIn/);
    expect(await linkedin.publishPost({ accessToken: "t", fetchImpl: scripted([{ match: "/rest/posts", respond: json(429, { message: "slow down" }) }]).fetchImpl, post, approval: ok, now: NOW })).toMatchObject({ status: "failed", retryable: true });
    expect(await linkedin.publishPost({ accessToken: "t", fetchImpl: scripted([{ match: "/rest/posts", respond: json(503, { message: "down" }) }]).fetchImpl, post, approval: ok, now: NOW })).toMatchObject({ status: "uncertain", retryable: false });
  });

  it("image posts: upload first, then reference content.media.id; a failed upload posts nothing", async () => {
    const imgPost = { ...post, imageUrl: "https://cdn.example.com/a.png", altText: "A red shoe" };
    const value = await linkedin.linkedInApprovalValue(imgPost);
    let sent: Record<string, unknown> = {};
    const { fetchImpl, calls } = scripted([
      { match: "cdn.example.com/a.png", respond: new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { "content-type": "image/png" } }) },
      { match: "/rest/images?action=initializeUpload", method: "POST", respond: json(200, { value: { uploadUrl: "https://www.linkedin.com/dms-uploads/up1", image: "urn:li:image:I1" } }) },
      { match: "/dms-uploads/up1", method: "PUT", respond: new Response(null, { status: 201 }) },
      {
        match: "/rest/posts",
        method: "POST",
        respond: (c) => {
          sent = JSON.parse(c.body ?? "{}") as Record<string, unknown>;
          return new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:7003" } });
        },
      },
      { match: "/rest/posts/urn", respond: () => json(200, { id: "urn:li:share:7003", commentary: sent.commentary }) },
    ]);
    const res = await linkedin.publishPost({ accessToken: "t", fetchImpl, post: imgPost, approval: approval(linkedin.PUBLISH_LINKEDIN_ACTION, post.authorUrn, value), now: NOW });
    expect(res.status).toBe("verified");
    expect(sent.content).toEqual({ media: { id: "urn:li:image:I1", altText: "A red shoe" } });
    expect(calls.map((c) => c.method)).toEqual(["GET", "POST", "PUT", "POST", "GET"]);

    const failing = scripted([{ match: "cdn.example.com/a.png", respond: new Response("x", { status: 200, headers: { "content-type": "text/html" } }) }]);
    const bad = await linkedin.publishPost({ accessToken: "t", fetchImpl: failing.fetchImpl, post: imgPost, approval: approval(linkedin.PUBLISH_LINKEDIN_ACTION, post.authorUrn, value), now: NOW });
    expect(bad.status).toBe("failed");
    expect(bad.providerMessage).toMatch(/Nothing was posted/);
    expect(failing.calls.some((c) => c.url.includes("/rest/posts"))).toBe(false);
  });

  it("rejects too-long text, bad author ids and private image URLs", () => {
    expect(linkedin.validateLinkedInPost({ ...post, text: "a".repeat(3001) }).join(" ")).toMatch(/3000/);
    expect(linkedin.validateLinkedInPost({ ...post, authorUrn: "abc" }).length).toBeGreaterThan(0);
    expect(linkedin.validateLinkedInPost({ ...post, imageUrl: "https://192.168.0.2/a.png" }).length).toBeGreaterThan(0);
  });
});

describe("x", () => {
  const post: x.XPostInput = { userId: "42", text: "Fresh stock is in: https://shop.example.com/new #climbing" };

  it("weighted length guard: URLs = 23, emoji/CJK = 2, refuses over 280 before any call", async () => {
    expect(x.xWeightedLength(`hi https://example.com/${"a".repeat(200)}`)).toBe(3 + 23);
    expect(x.xWeightedLength("日本😀")).toBe(6);
    expect(x.validateXPost({ userId: "42", text: "a".repeat(280) })).toEqual([]);
    const long = { userId: "42", text: "日".repeat(141) };
    expect(x.validateXPost(long).join(" ")).toMatch(/282\/280/);

    const none = scripted([]);
    const res = await x.publishTweet({ accessToken: "t", fetchImpl: none.fetchImpl, post: long, approval: approval(x.PUBLISH_X_ACTION, "42", await x.xApprovalValue(long)), now: NOW });
    expect(res).toMatchObject({ status: "failed", retryable: false });
    expect(res.providerMessage).toMatch(/Shorten it/);
    expect(none.calls).toHaveLength(0);
  });

  it("probes /2/users/me", async () => {
    const { fetchImpl, calls } = scripted([{ match: "/2/users/me", respond: json(200, { data: { id: "42", username: "climbco", name: "Climb Co" } }) }]);
    const me = await x.getMe({ accessToken: "tok", fetchImpl });
    expect(me.ok && me.data).toEqual({ id: "42", username: "climbco", name: "Climb Co" });
    expect(calls[0]?.headers.Authorization).toBe("Bearer tok");
  });

  it("publishes, then verifies by read-back even when X rewrites links to t.co", async () => {
    const value = await x.xApprovalValue(post);
    const { fetchImpl, calls } = scripted([
      { match: "/2/tweets", method: "POST", respond: json(201, { data: { id: "1001", text: post.text } }) },
      { match: "/2/tweets/1001", respond: json(200, { data: { id: "1001", text: "Fresh stock is in: https://t.co/abc #climbing" } }) },
    ]);
    const res = await x.publishTweet({ accessToken: "t", fetchImpl, post, approval: approval(x.PUBLISH_X_ACTION, "42", value), now: NOW });
    expect(res).toMatchObject({ status: "verified", externalId: "1001" });
    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({ text: post.text });
    expect(x.sameXText("Tom &amp; Jerry", "Tom & Jerry")).toBe(true);
  });

  it("maps 401 → reconnect, 403 → failed with X's reason, 429 → retryable, 5xx → uncertain", async () => {
    const ok = approval(x.PUBLISH_X_ACTION, "42", await x.xApprovalValue(post));
    const run = (r: Response) => x.publishTweet({ accessToken: "t", fetchImpl: scripted([{ match: "/2/tweets", respond: r }]).fetchImpl, post, approval: ok, now: NOW });
    const r401 = await run(json(401, { title: "Unauthorized", status: 401 }));
    expect(r401).toMatchObject({ status: "failed", retryable: false });
    expect(r401.providerMessage).toMatch(/Reconnect X/);
    const r403 = await run(json(403, { title: "Forbidden", detail: "You are not allowed to create a Tweet with duplicate content.", status: 403 }));
    expect(r403).toMatchObject({ status: "failed", retryable: false });
    expect(r403.providerMessage).toMatch(/duplicate content/);
    const reset = String(Math.floor(NOW / 1000) + 60);
    const r429 = await run(json(429, { title: "Too Many Requests" }, { "x-rate-limit-reset": reset }));
    expect(r429).toMatchObject({ status: "failed", retryable: true, retryAfterMs: 60_000 });
    expect(await run(json(503, { title: "Service Unavailable" }))).toMatchObject({ status: "uncertain", retryable: false });
  });

  it("read-back failure after a 201 is uncertain with the id kept; reconcile finds it", async () => {
    const value = await x.xApprovalValue(post);
    const { fetchImpl } = scripted([
      { match: "/2/tweets", method: "POST", respond: json(201, { data: { id: "1002", text: post.text } }) },
      { match: "/2/tweets/1002", respond: json(500, { title: "oops" }) },
    ]);
    expect(await x.publishTweet({ accessToken: "t", fetchImpl, post, approval: approval(x.PUBLISH_X_ACTION, "42", value), now: NOW })).toMatchObject({ status: "uncertain", externalId: "1002" });

    const timeline = scripted([{ match: "/2/users/42/tweets", respond: json(200, { data: [{ id: "1003", text: "Fresh stock is in: https://t.co/z #climbing" }] }) }]);
    expect(await x.reconcileTweet({ accessToken: "t", fetchImpl: timeline.fetchImpl, userId: "42", text: post.text, sinceMs: NOW - 60_000 })).toMatchObject({ outcome: "found", externalId: "1003" });
    const empty = scripted([{ match: "/2/users/42/tweets", respond: json(200, { meta: { result_count: 0 } }) }]);
    expect((await x.reconcileTweet({ accessToken: "t", fetchImpl: empty.fetchImpl, userId: "42", text: post.text, sinceMs: NOW - 60_000 })).outcome).toBe("not_found");
  });
});
