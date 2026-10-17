import { v } from "convex/values";
import { sha256Hex } from "../shared/policy";
import { mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Agent tokens let external AI agents (Claude Desktop, Claude Code, ChatGPT…)
 * use this workspace through the ClimbOS MCP server, as the person who made
 * the token and within the scopes they ticked. Nothing publishes, sends or
 * changes settings over MCP without the owner's tap in ClimbOS.
 */

const scope = v.union(v.literal("read"), v.literal("draft"), v.literal("request_approval"));

export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, user, role } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = await ctx.db
      .query("agentTokens")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();
    return {
      canManage: ["owner", "admin"].includes(role),
      mcpUrl: `${process.env.SITE_URL ?? "https://climbos.app"}/api/mcp`,
      tokens: rows
        .filter((t) => !t.revokedAt && (t.userId === user._id || ["owner", "admin"].includes(role)))
        .map((t) => ({ id: t._id, name: t.name, prefix: t.prefix, scopes: t.scopes, lastUsedAt: t.lastUsedAt ?? null, expiresAt: t.expiresAt, createdAt: t.createdAt, mine: t.userId === user._id })),
    };
  },
});

/** Create a token. The full token is returned once and never stored. */
export const create = mutation({
  args: { slug: v.string(), name: v.string(), scopes: v.array(scope), days: v.number() },
  handler: async (ctx, { slug, name, scopes, days }) => {
    const { org, user, role } = await requireOrgAccess(ctx, { slug }, "edit");
    if (scopes.includes("request_approval") && !["owner", "admin", "reviewer"].includes(role)) throw appError("FORBIDDEN", "Only people who can approve can let an agent request approvals.");
    const live = await ctx.db
      .query("agentTokens")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();
    if (live.filter((t) => !t.revokedAt && t.userId === user._id).length >= 10) throw appError("LIMIT_REACHED", "You have 10 agent tokens. Revoke one first.");
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = `climb_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
    const finalScopes = [...new Set(["read" as const, ...scopes])];
    const id = await ctx.db.insert("agentTokens", {
      orgId: org._id,
      userId: user._id,
      name: name.trim().slice(0, 60) || "Agent",
      tokenHash: await sha256Hex(token),
      prefix: token.slice(0, 12),
      scopes: finalScopes,
      expiresAt: Date.now() + Math.max(1, Math.min(365, Math.round(days))) * 86_400_000,
      createdAt: Date.now(),
    });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "agent_token.created", subjectType: "agentToken", subjectId: id, summary: `Created agent token "${name}" (${finalScopes.join(", ")}).` });
    return { token };
  },
});

export const revoke = mutation({
  args: { slug: v.string(), tokenId: v.id("agentTokens") },
  handler: async (ctx, { slug, tokenId }) => {
    const { org, user, role } = await requireOrgAccess(ctx, { slug }, "view");
    const t = assertSameOrg(await ctx.db.get(tokenId), org._id, "token");
    if (t.userId !== user._id && !["owner", "admin"].includes(role)) throw appError("FORBIDDEN", "You can only revoke your own tokens.");
    await ctx.db.patch(t._id, { revokedAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "agent_token.revoked", subjectType: "agentToken", subjectId: t._id, summary: `Revoked agent token "${t.name}".` });
  },
});
