import { describe, expect, it, vi } from "vitest";
import { normalizeWordPressSiteUrl, probeWordPressCredentials } from "@shared/integrations/wordpress";

const credentials = { siteUrl: "https://example.com/", username: "editor", applicationPassword: "abcd efgh ijkl mnop" };
const userResponse = (capabilities: Record<string, unknown> = { edit_posts: true }) => new Response(JSON.stringify({ id: 7, name: "Site Editor", slug: "editor", capabilities }), { status: 200, headers: { "content-type": "application/json" } });

describe("WordPress connection probe", () => {
  it("accepts a public HTTPS site and normalizes its base path", () => {
    expect(normalizeWordPressSiteUrl("https://example.com/blog/" )).toBe("https://example.com/blog");
    expect(normalizeWordPressSiteUrl("http://example.com")).toBeNull();
    expect(normalizeWordPressSiteUrl("https://example.com/?redirect=evil")).toBeNull();
    expect(normalizeWordPressSiteUrl("https://localhost")).toBeNull();
    expect(normalizeWordPressSiteUrl("https://user:pass@example.com")).toBeNull();
  });

  it("probes the current account over HTTPS and requires edit_posts", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => userResponse());
    const result = await probeWordPressCredentials({ ...credentials, siteUrl: "https://example.com/blog/" }, {
      fetchImpl,
      resolveHost: async () => ["93.184.216.34"],
    });
    expect(result).toEqual({ ok: true, siteUrl: "https://example.com/blog", userId: 7, accountName: "Site Editor" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.com/blog/wp-json/wp/v2/users/me?context=edit&_fields=id%2Cname%2Cslug%2Ccapabilities");
    expect(init.redirect).toBe("manual");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("authorization")).toMatch(/^Basic /);
    expect(Buffer.from(new Headers(init.headers).get("authorization")!.slice(6), "base64").toString()).toBe("editor:abcdefghijklmnop");
  });

  it("rejects private DNS results before sending the credential", async () => {
    const fetchImpl = vi.fn(async () => userResponse());
    const result = await probeWordPressCredentials(credentials, { fetchImpl, resolveHost: async () => ["127.0.0.1"] });
    expect(result).toEqual({ ok: false, reason: "unsafe_host" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not follow redirects or store an account that cannot edit posts", async () => {
    const redirected = await probeWordPressCredentials(credentials, {
      resolveHost: async () => ["93.184.216.34"],
      fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://other.example/wp-json/" } }),
    });
    expect(redirected).toEqual({ ok: false, reason: "unsupported" });

    const readonly = await probeWordPressCredentials(credentials, {
      resolveHost: async () => ["93.184.216.34"],
      fetchImpl: async () => userResponse({ read: true, edit_posts: false }),
    });
    expect(readonly).toEqual({ ok: false, reason: "permission" });
  });
});
