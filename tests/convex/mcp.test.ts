import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup, type T } from "./helpers";

/** The ClimbOS MCP server: token auth, scoped tools, approvals instead of direct consequential actions. */

async function withToken(t: T, scopes: ("draft" | "request_approval")[]) {
  const owner = await asNewUser(t, `mcp-${scopes.join("-") || "read"}@example.com`);
  const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Agent Co" });
  const { token } = await owner.client.mutation(api.agentTokens.create, { slug, name: "Claude Desktop", scopes, days: 30 });
  return { ...owner, slug, token };
}

const rpc = (t: T, token: string | null, body: unknown) =>
  t.fetch("/mcp", { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

describe("ClimbOS MCP server", () => {
  it("rejects missing and fake tokens", async () => {
    const t = setup();
    expect((await rpc(t, null, { jsonrpc: "2.0", id: 1, method: "initialize" })).status).toBe(401);
    expect((await rpc(t, `climb_${"a".repeat(64)}`, { jsonrpc: "2.0", id: 1, method: "initialize" })).status).toBe(401);
  });

  it("initializes statelessly and lists only the tools the token's scopes allow", async () => {
    const t = setup();
    const w = await withToken(t, []);
    const init = await (await rpc(t, w.token, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } })).json();
    expect(init.result.protocolVersion).toBe("2025-06-18");
    expect(init.result.capabilities.tools).toBeTruthy();
    expect((await rpc(t, w.token, { jsonrpc: "2.0", method: "notifications/initialized" })).status).toBe(202);
    const list = await (await rpc(t, w.token, { jsonrpc: "2.0", id: 2, method: "tools/list" })).json();
    const names: string[] = list.result.tools.map((x: { name: string }) => x.name);
    expect(names).toContain("get_overview");
    expect(names).not.toContain("create_posts"); // needs the draft scope
    expect(names).not.toContain("approve_draft"); // needs request_approval
    expect(names).not.toContain("go_to"); // screen tools are in-app only
    const tool = list.result.tools.find((x: { name: string }) => x.name === "get_overview");
    expect(tool.annotations.readOnlyHint).toBe(true);
    const denied = await (await rpc(t, w.token, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "create_posts", arguments: {} } })).json();
    expect(denied.error.code).toBe(-32602);
  });

  it("consequential tools become an approval card in ClimbOS, never a direct action", async () => {
    const t = setup();
    const w = await withToken(t, ["draft", "request_approval"]);
    const res = await (await rpc(t, w.token, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "pause_everything", arguments: { reason: "test" } } })).json();
    expect(res.result.structuredContent.status).toBe("pending_approval");
    expect(res.result.content[0].text).toMatch(/has not happened yet/);
    const thread = await w.client.query(api.climb.thread, { slug: w.slug });
    expect(thread.at(-1)?.action?.status).toBe("pending");
    expect(thread.at(-1)?.action?.title).toMatch(/requested by Claude Desktop/);
    const paused = await w.client.query(api.workspace.pauseStatus, { slug: w.slug });
    expect(paused.paused).toBe(false); // nothing happened
  });

  it("revoked tokens stop working", async () => {
    const t = setup();
    const w = await withToken(t, []);
    const { tokens } = await w.client.query(api.agentTokens.list, { slug: w.slug });
    await w.client.mutation(api.agentTokens.revoke, { slug: w.slug, tokenId: tokens[0].id });
    expect((await rpc(t, w.token, { jsonrpc: "2.0", id: 1, method: "tools/list" })).status).toBe(401);
  });
});
