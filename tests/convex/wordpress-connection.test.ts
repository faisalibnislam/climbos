import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

const httpsRequestMock = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:dns/promises")>()),
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));
vi.mock("node:https", () => ({ request: httpsRequestMock }));

import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("WordPress connection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    httpsRequestMock.mockReset();
  });

  function respondWithWordPress(canEdit: boolean) {
    httpsRequestMock.mockImplementation((_url: URL, options: Record<string, unknown>, callback: (response: Readable & { statusCode: number; headers: Record<string, string> }) => void) => {
      const req = new EventEmitter() as EventEmitter & { end: () => void; destroy: (error: Error) => void };
      req.end = () => {
        const response = Readable.from([JSON.stringify({ id: 5, name: "Site Editor", slug: "editor", capabilities: { edit_posts: canEdit } })]) as Readable & { statusCode: number; headers: Record<string, string> };
        response.statusCode = 200;
        response.headers = { "content-type": "application/json" };
        callback(response);
      };
      req.destroy = (error) => req.emit("error", error);
      expect(options.lookup).toBeTypeOf("function");
      return req;
    });
  }

  it("checks and stores an Application Password encrypted, without exposing post creation as available", async () => {
    const t = setup();
    const owner = await asNewUser(t, "wordpress-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "WordPress Co" });
    respondWithWordPress(true);

    const result = await owner.client.action(api.connectionActions.connectWordPress, {
      slug,
      siteUrl: "https://example.com",
      username: "editor",
      applicationPassword: "abcd efgh ijkl mnop",
    });
    expect(result.ok).toBe(true);
    const [, requestOptions] = httpsRequestMock.mock.calls[0] as [URL, Record<string, unknown>];
    expect(new Headers(requestOptions.headers as HeadersInit).get("authorization")).toMatch(/^Basic /);
    const lookup = requestOptions.lookup as (hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => void;
    const resolved = await new Promise<unknown[]>((resolve, reject) => lookup("example.com", { all: true }, (...args) => args[0] ? reject(args[0]) : resolve(args.slice(1))));
    expect(resolved).toEqual([[{ address: "93.184.216.34", family: 4 }]]);

    const item = (await owner.client.query(api.connections.list, { slug })).items.find((connection) => connection.provider === "wordpress");
    expect(item?.connection).toMatchObject({ status: "connected", externalAccountId: "https://example.com" });
    expect(item?.capabilities.find((capability) => capability.capability === "wordpress.create_draft")?.state).toBe("ready");

    const stored = await t.run(async (ctx) => {
      const connection = await ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", orgId).eq("provider", "wordpress")).first();
      return connection ? ctx.db.query("connectionSecrets").withIndex("by_connection", (q) => q.eq("connectionId", connection._id)).first() : null;
    });
    expect(stored?.kind).toBe("api_key");
    expect(stored?.ciphertext).not.toContain("abcdefghijklmnop");
  });

  it("does not store credentials when the account cannot edit posts", async () => {
    const t = setup();
    const owner = await asNewUser(t, "wordpress-readonly@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Read Only Site" });
    respondWithWordPress(false);

    const result = await owner.client.action(api.connectionActions.connectWordPress, {
      slug,
      siteUrl: "https://example.com",
      username: "reader",
      applicationPassword: "abcd efgh ijkl mnop",
    });
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("permission") });
    const item = (await owner.client.query(api.connections.list, { slug })).items.find((connection) => connection.provider === "wordpress");
    expect(item?.connection).toBeNull();
  });
});
