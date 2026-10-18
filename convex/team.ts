import { v } from "convex/values";
import { microsToCredits } from "../shared/economics";
import { sha256Hex } from "../shared/policy";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { accountWorkspaces, seatState } from "./lib/accounts";
import { audit } from "./lib/audit";
import { currentPeriod } from "./lib/periods";
import { appError, assertSameOrg, requireOrgAccess, requireUser } from "./lib/tenancy";

/**
 * Teams (owner decisions 18 Oct 2026): agencies run many workspaces on one
 * account; people join by email or invite link; per-workspace credit caps and
 * an approval limit for big jobs; comments with @mentions, assignments,
 * presence and in-app notices.
 */

const subjectType = v.union(v.literal("artifact"), v.literal("card"), v.literal("run"), v.literal("strategy"), v.literal("campaign"));
type SubjectType = "artifact" | "card" | "run" | "strategy" | "campaign";

async function notify(ctx: MutationCtx, n: { userId: Id<"users">; orgId: Id<"organizations">; kind: Doc<"notices">["kind"]; text: string; href: string }) {
  await ctx.db.insert("notices", { ...n, text: n.text.slice(0, 240), createdAt: Date.now() });
}

/* ---------------- account overview (agency) ---------------- */

/** All of the account's workspaces with this month's credit use, caps and people (owners and admins). */
export const accountOverview = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_team");
    if (!org.accountId) return null;
    const account = await ctx.db.get(org.accountId);
    const period = await currentPeriod(ctx, org);
    const workspaces = [];
    const people = new Map<string, { email: string; name: string | null; roles: { workspace: string; role: string; status: string }[] }>();
    for (const w of await accountWorkspaces(ctx, org.accountId)) {
      const usage = period
        ? await ctx.db
            .query("workspaceUsage")
            .withIndex("by_org_period", (q) => q.eq("orgId", w._id).eq("periodId", period._id))
            .unique()
        : null;
      const members = await ctx.db.query("memberships").withIndex("by_org", (q) => q.eq("orgId", w._id)).take(200);
      for (const m of members.filter((x) => x.status !== "removed")) {
        const u = m.userId ? await ctx.db.get(m.userId) : null;
        const email = (u?.email ?? m.invitedEmail ?? "").toLowerCase();
        if (!email) continue;
        const row = people.get(email) ?? { email, name: u?.name ?? null, roles: [] };
        row.roles.push({ workspace: w.name, role: m.role, status: m.status });
        people.set(email, row);
      }
      workspaces.push({
        id: w._id,
        name: w.name,
        slug: w.slug,
        usedCredits: microsToCredits((usage?.spentMicros ?? 0) + (usage?.reservedMicros ?? 0)),
        cap: w.monthlyCreditCap ?? null,
        creditApprovalLimit: w.creditApprovalLimit ?? null,
        members: members.filter((x) => x.status === "active").length,
      });
    }
    const seats = await seatState(ctx, org);
    return { isAccountOwner: account?.ownerUserId === user._id, workspaces, people: [...people.values()], seats: { used: seats.used, limit: seats.limit } };
  },
});

async function requireAccountOwnerFor(ctx: MutationCtx, slug: string, orgId: Id<"organizations">) {
  const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_team");
  const target = await ctx.db.get(orgId);
  if (!target || !org.accountId || target.accountId !== org.accountId) throw appError("NOT_FOUND", "We couldn't find that workspace.");
  const account = await ctx.db.get(org.accountId);
  const ownerHere = await ctx.db.query("memberships").withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", user._id)).unique();
  if (account?.ownerUserId !== user._id && ownerHere?.role !== "owner") throw appError("FORBIDDEN", "Only the account owner can change this.");
  return { user, target };
}

/** Optional monthly credit cap for one workspace (drawn from the shared balance). */
export const setWorkspaceCap = mutation({
  args: { slug: v.string(), orgId: v.id("organizations"), credits: v.union(v.number(), v.null()) },
  handler: async (ctx, { slug, orgId, credits }) => {
    const { user, target } = await requireAccountOwnerFor(ctx, slug, orgId);
    await ctx.db.patch(orgId, { monthlyCreditCap: credits === null ? undefined : Math.max(0, Math.round(credits)) });
    await audit(ctx, { orgId, actorType: "user", actorId: user._id, action: "team.cap", summary: credits === null ? `Removed the monthly credit cap for ${target.name}.` : `Set ${target.name}'s monthly credit cap to ${Math.round(credits)}.` });
  },
});

/** Jobs above this many credits need an owner or admin to start them (null = no limit). */
export const setCreditApprovalLimit = mutation({
  args: { slug: v.string(), credits: v.union(v.number(), v.null()) },
  handler: async (ctx, { slug, credits }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_policies");
    await ctx.db.patch(org._id, { creditApprovalLimit: credits === null ? undefined : Math.max(1, Math.round(credits)) });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "team.approval_limit", summary: credits === null ? "Anyone who can edit may start any job." : `Jobs over ${Math.round(credits)} credits need an owner or admin.` });
  },
});

/** Ask the workspace's owners and admins to start a job that's over the approval limit. */
export const requestApproval = mutation({
  args: { slug: v.string(), title: v.string(), credits: v.number(), href: v.string() },
  handler: async (ctx, { slug, title, credits, href }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "chat");
    const who = user.name ?? user.email ?? "A teammate";
    let told = 0;
    for (const x of await ctx.db.query("memberships").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(100)) {
      if (x.status === "active" && x.userId && x.userId !== user._id && (x.role === "owner" || x.role === "admin")) {
        await notify(ctx, { userId: x.userId, orgId: org._id, kind: "approval", text: `${who} asks you to start “${title.slice(0, 120)}” (up to ${Math.round(credits)} credits).`, href });
        told++;
      }
    }
    return { told };
  },
});

/* ---------------- invite links ---------------- */

export const inviteLinks = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "manage_team");
    const rows = await ctx.db.query("inviteLinks").withIndex("by_org", (q) => q.eq("orgId", org._id)).order("desc").take(20);
    return rows.map((r) => ({ id: r._id, role: r.role, uses: r.uses, maxUses: r.maxUses, expiresAt: r.expiresAt, active: !r.revokedAt && r.expiresAt > Date.now() && r.uses < r.maxUses }));
  },
});

/** A shareable link anyone can use to join with a role (seat limits still apply). The token is shown once. */
export const createInviteLink = mutation({
  args: { slug: v.string(), role: v.union(v.literal("admin"), v.literal("editor"), v.literal("reviewer"), v.literal("viewer")), days: v.number(), maxUses: v.number() },
  handler: async (ctx, { slug, role, days, maxUses }) => {
    const { org, user, role: myRole } = await requireOrgAccess(ctx, { slug }, "manage_team");
    if (org.kind === "demo") throw appError("FORBIDDEN", "Demo workspaces can't invite people.");
    if (role === "admin" && myRole !== "owner") throw appError("FORBIDDEN", "Only an owner can share an admin link.");
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = `l_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
    await ctx.db.insert("inviteLinks", {
      orgId: org._id,
      role,
      tokenHash: await sha256Hex(token),
      createdBy: user._id,
      expiresAt: Date.now() + Math.max(1, Math.min(30, Math.round(days))) * 86_400_000,
      maxUses: Math.max(1, Math.min(50, Math.round(maxUses))),
      uses: 0,
      createdAt: Date.now(),
    });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "team.link_created", summary: `Created an invite link for ${role}s.` });
    return { token };
  },
});

export const revokeInviteLink = mutation({
  args: { slug: v.string(), linkId: v.id("inviteLinks") },
  handler: async (ctx, { slug, linkId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_team");
    const link = assertSameOrg(await ctx.db.get(linkId), org._id, "link");
    await ctx.db.patch(link._id, { revokedAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "team.link_revoked", summary: "Revoked an invite link." });
  },
});

/** Join with an invite link (called from /invite/[token] via settings.acceptInvite). */
export async function acceptInviteLink(ctx: MutationCtx, user: Doc<"users">, token: string): Promise<{ slug: string } | null> {
  if (!token.startsWith("l_")) return null;
  const hash = await sha256Hex(token);
  const row = await ctx.db
    .query("inviteLinks")
    .withIndex("by_token", (q) => q.eq("tokenHash", hash))
    .first();
  if (!row) return null;
  if (row.revokedAt || row.expiresAt < Date.now() || row.uses >= row.maxUses) throw appError("NOT_FOUND", "This invite link has expired. Ask for a new one.");
  const org = await ctx.db.get(row.orgId);
  if (!org || org.deletedAt) throw appError("NOT_FOUND", "That workspace no longer exists.");
  const existing = await ctx.db.query("memberships").withIndex("by_org_user", (q) => q.eq("orgId", org._id).eq("userId", user._id)).first();
  if (existing?.status === "active") return { slug: org.slug };
  const seats = await seatState(ctx, org);
  const email = user.email?.toLowerCase() ?? "";
  if (!seats.emails.has(email) && seats.used >= seats.limit) throw appError("LIMIT_REACHED", "This workspace has no free seats. Ask its owner to upgrade.");
  if (existing) await ctx.db.patch(existing._id, { status: "active", role: row.role, userId: user._id, inviteTokenHash: undefined });
  else await ctx.db.insert("memberships", { orgId: org._id, userId: user._id, role: row.role, status: "active", invitedBy: row.createdBy, createdAt: Date.now() });
  await ctx.db.patch(row._id, { uses: row.uses + 1 });
  await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "team.joined", summary: `Joined as ${row.role} with an invite link.` });
  await notify(ctx, { userId: row.createdBy, orgId: org._id, kind: "system", text: `${user.name ?? user.email ?? "Someone"} joined ${org.name} as ${row.role}.`, href: `/app/${org.slug}/settings/team` });
  return { slug: org.slug };
}

/* ---------------- comments, mentions, assignments ---------------- */

async function membersOf(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">) {
  const rows = await ctx.db.query("memberships").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(200);
  const out = [];
  for (const m of rows.filter((x) => x.status === "active" && x.userId)) {
    const u = await ctx.db.get(m.userId!);
    if (u) out.push({ id: u._id, name: u.name ?? u.email ?? "Teammate", email: u.email ?? null, role: m.role });
  }
  return out;
}

/** People to @mention or assign. */
export const members = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    return membersOf(ctx, org._id);
  },
});

export const comments = query({
  args: { slug: v.string(), subjectType, subjectId: v.string() },
  handler: async (ctx, { slug, subjectType: st, subjectId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = await ctx.db.query("comments").withIndex("by_subject", (q) => q.eq("orgId", org._id).eq("subjectType", st).eq("subjectId", subjectId)).take(200);
    const out = [];
    for (const c of rows.filter((x) => !x.deletedAt)) {
      const a = await ctx.db.get(c.authorId);
      out.push({ id: c._id, body: c.body, author: a?.name ?? a?.email ?? "Teammate", mine: c.authorId === user._id, createdAt: c.createdAt, edited: Boolean(c.editedAt) });
    }
    return out;
  },
});

/** Add a comment; "@Name" mentions notify those people. */
export const addComment = mutation({
  args: { slug: v.string(), subjectType, subjectId: v.string(), body: v.string(), href: v.string(), title: v.string() },
  handler: async (ctx, { slug, subjectType: st, subjectId, body, href, title }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "chat");
    const text = body.trim().slice(0, 4000);
    if (!text) throw appError("INVALID", "Write something first.");
    const people = await membersOf(ctx, org._id);
    const mentions = people.filter((p) => p.id !== user._id && (text.includes(`@${p.name}`) || (p.email && text.includes(`@${p.email}`)))).map((p) => p.id);
    await ctx.db.insert("comments", { orgId: org._id, subjectType: st, subjectId, authorId: user._id, body: text, mentions, createdAt: Date.now() });
    const who = user.name ?? user.email ?? "A teammate";
    for (const m of mentions) await notify(ctx, { userId: m, orgId: org._id, kind: "mention", text: `${who} mentioned you on “${title}”: ${text.slice(0, 120)}`, href });
    // Everyone assigned to this work hears about new comments too.
    const assigned = await ctx.db.query("assignments").withIndex("by_subject", (q) => q.eq("orgId", org._id).eq("subjectType", st).eq("subjectId", subjectId)).take(20);
    for (const a of assigned) if (a.assigneeId !== user._id && !mentions.includes(a.assigneeId) && !a.doneAt) await notify(ctx, { userId: a.assigneeId, orgId: org._id, kind: "comment", text: `${who} commented on “${title}”.`, href });
  },
});

export const deleteComment = mutation({
  args: { slug: v.string(), commentId: v.id("comments") },
  handler: async (ctx, { slug, commentId }) => {
    const { org, user, role } = await requireOrgAccess(ctx, { slug }, "chat");
    const c = assertSameOrg(await ctx.db.get(commentId), org._id, "comment");
    if (c.authorId !== user._id && role !== "owner" && role !== "admin") throw appError("FORBIDDEN", "You can only delete your own comments.");
    await ctx.db.patch(c._id, { deletedAt: Date.now() });
  },
});

export const assignment = query({
  args: { slug: v.string(), subjectType, subjectId: v.string() },
  handler: async (ctx, { slug, subjectType: st, subjectId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const a = await ctx.db.query("assignments").withIndex("by_subject", (q) => q.eq("orgId", org._id).eq("subjectType", st).eq("subjectId", subjectId)).order("desc").first();
    if (!a || a.doneAt) return null;
    const u = await ctx.db.get(a.assigneeId);
    return { id: a._id, assigneeId: a.assigneeId, name: u?.name ?? u?.email ?? "Teammate" };
  },
});

export const assign = mutation({
  args: { slug: v.string(), subjectType, subjectId: v.string(), assigneeId: v.union(v.id("users"), v.null()), title: v.string(), href: v.string() },
  handler: async (ctx, { slug, subjectType: st, subjectId, assigneeId, title, href }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const open = await ctx.db.query("assignments").withIndex("by_subject", (q) => q.eq("orgId", org._id).eq("subjectType", st).eq("subjectId", subjectId)).take(20);
    for (const a of open) if (!a.doneAt) await ctx.db.patch(a._id, { doneAt: Date.now() });
    if (!assigneeId) return;
    const member = await ctx.db.query("memberships").withIndex("by_org_user", (q) => q.eq("orgId", org._id).eq("userId", assigneeId)).unique();
    if (member?.status !== "active") throw appError("INVALID", "That person isn't on this workspace.");
    await ctx.db.insert("assignments", { orgId: org._id, subjectType: st, subjectId, title: title.slice(0, 160), href, assigneeId, assignedBy: user._id, createdAt: Date.now() });
    if (assigneeId !== user._id) await notify(ctx, { userId: assigneeId, orgId: org._id, kind: "assigned", text: `${user.name ?? user.email ?? "A teammate"} assigned you “${title}”.`, href });
  },
});

/** Work assigned to me in this workspace. */
export const myAssignments = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = await ctx.db.query("assignments").withIndex("by_assignee", (q) => q.eq("assigneeId", user._id)).order("desc").take(50);
    return rows.filter((a) => a.orgId === org._id && !a.doneAt).map((a) => ({ id: a._id, title: a.title, href: a.href, createdAt: a.createdAt }));
  },
});

/* ---------------- presence ---------------- */

export const heartbeat = mutation({
  args: { slug: v.string(), path: v.string() },
  handler: async (ctx, { slug, path }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "view");
    const row = await ctx.db.query("presence").withIndex("by_user_org", (q) => q.eq("userId", user._id).eq("orgId", org._id)).first();
    if (row) await ctx.db.patch(row._id, { path: path.slice(0, 200), lastSeen: Date.now() });
    else await ctx.db.insert("presence", { orgId: org._id, userId: user._id, path: path.slice(0, 200), lastSeen: Date.now() });
  },
});

/** Teammates on this page (or the whole workspace) in the last 75 seconds. */
export const here = query({
  args: { slug: v.string(), path: v.optional(v.string()), now: v.number() },
  handler: async (ctx, { slug, path, now }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = path
      ? await ctx.db.query("presence").withIndex("by_org_path", (q) => q.eq("orgId", org._id).eq("path", path)).take(50)
      : (await ctx.db.query("presence").withIndex("by_org_path", (q) => q.eq("orgId", org._id)).take(200));
    const out = [];
    for (const p of rows.filter((x) => x.userId !== user._id && now - x.lastSeen < 75_000)) {
      const u = await ctx.db.get(p.userId);
      out.push({ id: p.userId, name: u?.name ?? u?.email ?? "Teammate", path: p.path });
    }
    return out;
  },
});

/* ---------------- notices (the bell) ---------------- */

export const myNotices = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db.query("notices").withIndex("by_user_created", (q) => q.eq("userId", user._id)).order("desc").take(30);
    return { unread: rows.filter((r) => !r.readAt).length, items: rows.map((r) => ({ id: r._id, kind: r.kind, text: r.text, href: r.href, read: Boolean(r.readAt), createdAt: r.createdAt })) };
  },
});

export const markNoticesRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db.query("notices").withIndex("by_user_created", (q) => q.eq("userId", user._id)).order("desc").take(50);
    for (const r of rows) if (!r.readAt) await ctx.db.patch(r._id, { readAt: Date.now() });
  },
});

/** Daily: drop presence older than a day and notices older than 60 days. */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    for (const p of await ctx.db.query("presence").take(2000)) if (now - p.lastSeen > 86_400_000) await ctx.db.delete(p._id);
    for (const n of await ctx.db.query("notices").take(5000)) if (now - n.createdAt > 60 * 86_400_000) await ctx.db.delete(n._id);
  },
});

export type { SubjectType };
