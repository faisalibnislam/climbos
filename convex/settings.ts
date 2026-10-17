import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { CURRENT_ENTITLEMENTS } from "../shared/economics";
import { ROLE_DESCRIPTIONS, sha256Hex } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { roleValidator } from "./schema";
import { audit } from "./lib/audit";
import { latestSubscription } from "./lib/access";
import { appError, assertSameOrg, requireOrgAccess, requireUser } from "./lib/tenancy";

/* ---------------- Team ---------------- */

export const team = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role, user } = await requireOrgAccess(ctx, { slug }, "view");
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .take(100);
    const sub = await latestSubscription(ctx, org._id);
    const planKey = sub?.planKey ?? "basic";
    const seatLimit = CURRENT_ENTITLEMENTS.plans[planKey].seats;
    const rows = [];
    for (const m of members) {
      if (m.status === "removed") continue;
      const u = m.userId ? await ctx.db.get(m.userId) : null;
      rows.push({
        id: m._id,
        name: u?.name ?? null,
        email: u?.email ?? m.invitedEmail ?? null,
        role: m.role,
        status: m.status,
        isYou: m.userId === user._id,
        inviteExpiresAt: m.inviteExpiresAt ?? null,
      });
    }
    return {
      canManage: ["owner", "admin"].includes(role),
      yourRole: role,
      seatLimit,
      seatsUsed: rows.length,
      roles: Object.entries(ROLE_DESCRIPTIONS).map(([key, description]) => ({ key, description })),
      members: rows,
    };
  },
});

export const invite = mutation({
  args: { slug: v.string(), email: v.string(), role: roleValidator },
  handler: async (ctx, { slug, email, role }) => {
    const { org, user, role: myRole } = await requireOrgAccess(ctx, { slug }, "manage_team");
    if (org.kind === "demo") throw appError("FORBIDDEN", "Demo workspaces can't invite people.");
    if (role === "owner" && myRole !== "owner") throw appError("FORBIDDEN", "Only an owner can invite another owner.");
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw appError("INVALID", "Enter a valid email address.");
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .take(100);
    const sub = await latestSubscription(ctx, org._id);
    const seatLimit = CURRENT_ENTITLEMENTS.plans[sub?.planKey ?? "basic"].seats;
    const active = members.filter((m) => m.status !== "removed");
    if (active.length >= seatLimit) throw appError("LIMIT_REACHED", `Your plan includes ${seatLimit} seat${seatLimit === 1 ? "" : "s"}. Upgrade to add more people.`);
    if (active.some((m) => m.invitedEmail === clean)) throw appError("INVALID", "That person already has an invitation.");
    const tokenBytes = crypto.getRandomValues(new Uint8Array(24));
    const token = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, "0")).join("");
    await ctx.db.insert("memberships", {
      orgId: org._id,
      role,
      status: "invited",
      invitedEmail: clean,
      inviteTokenHash: await sha256Hex(token),
      invitedBy: user._id,
      inviteExpiresAt: Date.now() + 7 * 86_400_000,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.notifications.sendInvitation, { orgId: org._id, to: clean, inviterName: user.name ?? user.email ?? "A teammate", role, token });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "team.invited", summary: `Invited a ${role}.` });
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx);
    if (user.isAnonymous || !user.email) throw appError("FORBIDDEN", "Sign in with your email to accept the invitation.");
    const hash = await sha256Hex(token);
    const invite = await ctx.db
      .query("memberships")
      .withIndex("by_invite_token", (q) => q.eq("inviteTokenHash", hash))
      .unique();
    if (!invite || invite.status !== "invited" || (invite.inviteExpiresAt ?? 0) < Date.now()) {
      throw appError("NOT_FOUND", "This invitation is invalid or has expired. Ask for a new one.");
    }
    if (invite.invitedEmail !== user.email.toLowerCase()) {
      throw appError("FORBIDDEN", "This invitation was sent to a different email address. Sign in with that address to accept it.");
    }
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", invite.orgId).eq("userId", user._id))
      .first();
    if (existing && existing.status === "active") {
      await ctx.db.patch(invite._id, { status: "removed", inviteTokenHash: undefined });
    } else {
      await ctx.db.patch(invite._id, { userId: user._id, status: "active", inviteTokenHash: undefined });
    }
    const org = await ctx.db.get(invite.orgId);
    await audit(ctx, { orgId: invite.orgId, actorType: "user", actorId: user._id, action: "team.joined", summary: `Joined as ${invite.role}.` });
    return { slug: org?.slug ?? "" };
  },
});

export const changeRole = mutation({
  args: { slug: v.string(), membershipId: v.id("memberships"), role: roleValidator },
  handler: async (ctx, { slug, membershipId, role }) => {
    const { org, user, role: myRole } = await requireOrgAccess(ctx, { slug }, "manage_team");
    const m = assertSameOrg(await ctx.db.get(membershipId), org._id, "member");
    if ((role === "owner" || m.role === "owner") && myRole !== "owner") throw appError("FORBIDDEN", "Only an owner can change owner access.");
    if (m.role === "owner" && role !== "owner") {
      const owners = (
        await ctx.db
          .query("memberships")
          .withIndex("by_org", (q) => q.eq("orgId", org._id))
          .take(100)
      ).filter((x) => x.role === "owner" && x.status === "active");
      if (owners.length <= 1) throw appError("INVALID", "A workspace needs at least one owner.");
    }
    await ctx.db.patch(m._id, { role });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "team.role_changed", subjectType: "membership", subjectId: m._id, summary: `Role changed to ${role}.` });
  },
});

export const removeMember = mutation({
  args: { slug: v.string(), membershipId: v.id("memberships") },
  handler: async (ctx, { slug, membershipId }) => {
    const { org, user, role: myRole } = await requireOrgAccess(ctx, { slug }, "manage_team");
    const m = assertSameOrg(await ctx.db.get(membershipId), org._id, "member");
    if (m.role === "owner" && myRole !== "owner") throw appError("FORBIDDEN", "Only an owner can remove an owner.");
    if (m.userId === user._id && m.role === "owner") {
      const owners = (
        await ctx.db
          .query("memberships")
          .withIndex("by_org", (q) => q.eq("orgId", org._id))
          .take(100)
      ).filter((x) => x.role === "owner" && x.status === "active");
      if (owners.length <= 1) throw appError("INVALID", "You're the only owner. Add another owner first.");
    }
    await ctx.db.patch(m._id, { status: "removed", inviteTokenHash: undefined });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "team.removed", subjectType: "membership", subjectId: m._id, summary: "Removed a member." });
  },
});

/* ---------------- Policies ---------------- */

export const policies = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const p = await ctx.db
      .query("autonomyPolicies")
      .withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true))
      .first();
    const sub = await latestSubscription(ctx, org._id);
    const plan = CURRENT_ENTITLEMENTS.plans[sub?.planKey ?? "basic"];
    return {
      canManage: ["owner", "admin"].includes(role),
      allowedModes: org.kind === "demo" ? (["copilot", "review", "bounded_autopilot"] as const) : plan.autonomyModes,
      policy: p
        ? {
            version: p.version,
            mode: p.mode,
            approvalRoles: p.approvalRoles,
            allowRecurringPostsUnderCalendar: p.allowRecurringPostsUnderCalendar,
            allowAdPauseRules: p.allowAdPauseRules,
            maxMonthlyAdSpend: p.maxMonthlyAdSpendMinor / 100,
            currency: p.currency,
            approvalTtlHours: p.approvalTtlHours,
          }
        : null,
      emergencyStop: org.emergencyStop?.active ? { at: org.emergencyStop.at } : null,
    };
  },
});

export const updatePolicy = mutation({
  args: {
    slug: v.string(),
    mode: v.union(v.literal("copilot"), v.literal("review"), v.literal("bounded_autopilot")),
    allowRecurringPostsUnderCalendar: v.boolean(),
    allowAdPauseRules: v.boolean(),
    maxMonthlyAdSpend: v.number(),
    approvalTtlHours: v.number(),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "manage_policies");
    const p = await ctx.db
      .query("autonomyPolicies")
      .withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true))
      .first();
    if (!p) throw appError("NOT_FOUND", "Policy not found.");
    const sub = await latestSubscription(ctx, org._id);
    const plan = CURRENT_ENTITLEMENTS.plans[sub?.planKey ?? "basic"];
    if (org.kind !== "demo" && !plan.autonomyModes.includes(args.mode)) {
      throw appError("PAYMENT_REQUIRED", `${plan.name} doesn't include this approval mode. Upgrade to use it.`);
    }
    if (!(args.maxMonthlyAdSpend >= 0) || args.maxMonthlyAdSpend > 1_000_000) throw appError("INVALID", "Enter a monthly ad budget between 0 and 1,000,000.");
    const ttl = Math.max(1, Math.min(24 * 14, Math.round(args.approvalTtlHours)));
    await ctx.db.patch(p._id, { active: false });
    const { _id: _omit, _creationTime: _ct, ...rest } = p;
    await ctx.db.insert("autonomyPolicies", {
      ...rest,
      version: p.version + 1,
      mode: args.mode,
      allowRecurringPostsUnderCalendar: args.allowRecurringPostsUnderCalendar,
      allowAdPauseRules: args.allowAdPauseRules,
      maxMonthlyAdSpendMinor: Math.round(args.maxMonthlyAdSpend * 100),
      approvalTtlHours: ttl,
      createdBy: user._id,
      createdAt: Date.now(),
      active: true,
    });
    // Approvals were bound to the old policy version: they no longer authorize execution.
    const approved = await ctx.db
      .query("approvals")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "approved"))
      .take(300);
    for (const a of approved) if (a.subjectType !== "strategy") await ctx.db.patch(a._id, { status: "invalidated", invalidatedReason: "Approval rules changed" });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "policy.updated", summary: `Approval rules updated to v${p.version + 1} (${args.mode}). Existing approvals need to be renewed.` });
  },
});

/* ---------------- Activity ---------------- */

export const activity = query({
  args: { slug: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { slug, paginationOpts }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const page = await ctx.db
      .query("auditEvents")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .paginate(paginationOpts);
    return { ...page, page: page.page.map((e) => ({ id: e._id, actorType: e.actorType, action: e.action, summary: e.summary, createdAt: e.createdAt })) };
  },
});

export const usage = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const events = await ctx.db
      .query("usageEvents")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id).gt("createdAt", Date.now() - 31 * 86_400_000))
      .take(3000);
    const byRole = new Map<string, { calls: number; inputTokens: number; outputTokens: number; costMicros: number }>();
    const byModel = new Map<string, { calls: number; costMicros: number }>();
    for (const e of events) {
      const r = byRole.get(e.role ?? "system") ?? { calls: 0, inputTokens: 0, outputTokens: 0, costMicros: 0 };
      r.calls += e.type === "model_call" ? 1 : 0;
      r.inputTokens += e.inputTokens;
      r.outputTokens += e.outputTokens;
      r.costMicros += e.costMicros;
      byRole.set(e.role ?? "system", r);
      const m = byModel.get(e.model ?? e.provider) ?? { calls: 0, costMicros: 0 };
      m.calls += 1;
      m.costMicros += e.costMicros;
      byModel.set(e.model ?? e.provider, m);
    }
    return {
      byRole: [...byRole.entries()].map(([role, v]) => ({ role, ...v })),
      byModel: [...byModel.entries()].map(([model, v]) => ({ model, ...v })),
      totalCostMicros: events.reduce((s, e) => s + e.costMicros, 0),
      events: events.length,
    };
  },
});

/* ---------------- Preferences ---------------- */

export const preferences = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const p = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    return { digest: p?.digest ?? "weekly", usageAlerts: p?.usageAlerts ?? true, email: user.email ?? null, name: user.name ?? null };
  },
});

export const updatePreferences = mutation({
  args: { digest: v.union(v.literal("daily"), v.literal("weekly"), v.literal("off")), usageAlerts: v.boolean(), name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const p = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (p) await ctx.db.patch(p._id, { digest: args.digest, usageAlerts: args.usageAlerts });
    else await ctx.db.insert("userPreferences", { userId: user._id, digest: args.digest, usageAlerts: args.usageAlerts });
    if (args.name !== undefined) await ctx.db.patch(user._id, { name: args.name.trim().slice(0, 80) || undefined });
  },
});

/* ---------------- Privacy: export and deletion ---------------- */

export const requestExport = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "export");
    const id = await ctx.db.insert("privacyRequests", { orgId: org._id, kind: "export", status: "pending", requestedBy: user._id, createdAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.settings.runExport, { requestId: id });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "privacy.export_requested", summary: "Workspace export requested." });
    return id;
  },
});

export const exportData = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const take = <T>(p: Promise<T[]>) => p;
    const org = await ctx.db.get(orgId);
    const business = await take(ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(5));
    const facts = business[0] ? await ctx.db.query("businessFacts").withIndex("by_business", (q) => q.eq("businessId", business[0]._id)).take(500) : [];
    const strategies = await ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(50);
    const artifacts = await ctx.db.query("artifacts").withIndex("by_org_updated", (q) => q.eq("orgId", orgId)).take(2000);
    const versions = [];
    for (const a of artifacts.slice(0, 500)) {
      versions.push(...(await ctx.db.query("artifactVersions").withIndex("by_artifact", (q) => q.eq("artifactId", a._id)).take(20)));
    }
    const audits = await ctx.db.query("auditEvents").withIndex("by_org_created", (q) => q.eq("orgId", orgId)).order("desc").take(2000);
    const metrics = await ctx.db.query("metricDaily").withIndex("by_org_date", (q) => q.eq("orgId", orgId)).take(10_000);
    const connections = await ctx.db.query("connections").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(100);
    const strip = <T extends Record<string, unknown>>(rows: T[]) => rows.map(({ _creationTime: _c, ...r }) => r);
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        note: "ClimbOS workspace export. Connector secrets are never exported.",
        workspace: org ? { name: org.name, slug: org.slug, timezone: org.timezone, currency: org.currency } : null,
        business: strip(business),
        facts: strip(facts),
        strategies: strip(strategies),
        artifacts: strip(artifacts),
        artifactVersions: strip(versions),
        metrics: strip(metrics),
        connections: connections.map((c) => ({ provider: c.provider, status: c.status, accountLabel: c.accountLabel, scopes: c.scopes })),
        activity: strip(audits),
      },
      null,
      2,
    );
  },
});

export const runExport = internalAction({
  args: { requestId: v.id("privacyRequests") },
  handler: async (ctx, { requestId }) => {
    const req = await ctx.runQuery(internal.settings.getPrivacyRequest, { requestId });
    if (!req) return;
    await ctx.runMutation(internal.settings.setPrivacyStatus, { requestId, status: "running" });
    const json = await ctx.runQuery(internal.settings.exportData, { orgId: req.orgId });
    const storageId = await ctx.storage.store(new Blob([json], { type: "application/json" }));
    await ctx.runMutation(internal.settings.setPrivacyStatus, { requestId, status: "done", resultStorageId: storageId });
  },
});

export const getPrivacyRequest = internalQuery({
  args: { requestId: v.id("privacyRequests") },
  handler: async (ctx, { requestId }) => ctx.db.get(requestId),
});

export const setPrivacyStatus = internalMutation({
  args: { requestId: v.id("privacyRequests"), status: v.union(v.literal("running"), v.literal("done"), v.literal("failed")), resultStorageId: v.optional(v.id("_storage")), note: v.optional(v.string()) },
  handler: async (ctx, { requestId, status, resultStorageId, note }) => {
    await ctx.db.patch(requestId, { status, resultStorageId, note, completedAt: status === "done" || status === "failed" ? Date.now() : undefined });
  },
});

export const privacyRequests = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "export");
    const rows = await ctx.db
      .query("privacyRequests")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(20);
    return Promise.all(
      rows.map(async (r) => ({ id: r._id, kind: r.kind, status: r.status, createdAt: r.createdAt, completedAt: r.completedAt ?? null, url: r.resultStorageId ? await ctx.storage.getUrl(r.resultStorageId) : null, note: r.note ?? null })),
    );
  },
});

/** Delete a contact everywhere (suppression is kept as a hash so they're never emailed again). */
export const deleteContact = mutation({
  args: { slug: v.string(), email: v.string() },
  handler: async (ctx, { slug, email }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    const emailHash = await sha256Hex(email.trim().toLowerCase());
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_org_email", (q) => q.eq("orgId", org._id).eq("emailHash", emailHash))
      .take(10);
    for (const c of contacts) {
      const consents = await ctx.db
        .query("consentRecords")
        .withIndex("by_org_contact", (q) => q.eq("orgId", org._id).eq("contactId", c._id))
        .take(50);
      for (const r of consents) await ctx.db.delete(r._id);
      await ctx.db.delete(c._id);
    }
    const existing = await ctx.db
      .query("suppressions")
      .withIndex("by_org_email", (q) => q.eq("orgId", org._id).eq("emailHash", emailHash))
      .first();
    if (!existing) await ctx.db.insert("suppressions", { orgId: org._id, emailHash, reason: "deletion", source: "privacy request", createdAt: Date.now() });
    await ctx.db.insert("privacyRequests", { orgId: org._id, kind: "delete_contact", status: "done", subject: emailHash.slice(0, 12), requestedBy: user._id, createdAt: Date.now(), completedAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "privacy.contact_deleted", summary: `Deleted ${contacts.length} contact record(s); address suppressed.` });
    return { deleted: contacts.length };
  },
});

/**
 * Delete a workspace: content, facts, metrics, connections and secrets are
 * removed in batches. Financial records (orders, subscriptions) and the audit
 * trail are retained as required for accounting, with personal fields minimized.
 */
export const deleteWorkspace = mutation({
  args: { slug: v.string(), confirmName: v.string() },
  handler: async (ctx, { slug, confirmName }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "delete_workspace");
    if (confirmName.trim() !== org.name) throw appError("INVALID", "Type the workspace name exactly to confirm.");
    await ctx.db.patch(org._id, { deletedAt: Date.now(), emergencyStop: { active: true, at: Date.now(), by: user._id, reason: "Workspace deleted" } });
    await ctx.db.insert("privacyRequests", { orgId: org._id, kind: "delete_workspace", status: "running", requestedBy: user._id, createdAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.settings.purgeWorkspaceBatch, { orgId: org._id });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "workspace.deleted", summary: "Workspace deletion started." });
  },
});

/** Tables purged by an index whose first field is orgId (children are removed with their parents). */
const PURGE_BY_ORG: { table: string; index: string }[] = [
  { table: "artifacts", index: "by_org_updated" },
  { table: "approvals", index: "by_org_status" },
  { table: "actionCards", index: "by_org_status" },
  { table: "chatMessages", index: "by_org_created" },
  { table: "metricDaily", index: "by_org_date" },
  { table: "revenueEvents", index: "by_org_occurred" },
  { table: "touches", index: "by_org_customer" },
  { table: "platformClaims", index: "by_org_platform_date" },
  { table: "forecastRuns", index: "by_org_created" },
  { table: "connectionCapabilities", index: "by_org" },
  { table: "connections", index: "by_org" },
  { table: "contacts", index: "by_org" },
  { table: "experiments", index: "by_org" },
  { table: "campaigns", index: "by_org" },
  { table: "strategies", index: "by_org" },
  { table: "goals", index: "by_org_status" },
  { table: "businesses", index: "by_org" },
  { table: "workflowRuns", index: "by_org_created" },
  { table: "memberships", index: "by_org" },
];

export const purgeWorkspaceBatch = internalMutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    let removed = 0;
    const BATCH = 150;
    for (const { table, index } of PURGE_BY_ORG) {
      if (removed >= BATCH) break;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = await (ctx.db.query(table as never) as any).withIndex(index, (q: any) => q.eq("orgId", orgId)).take(BATCH - removed);
      for (const r of rows) {
        if (table === "artifacts") {
          const versions = await ctx.db.query("artifactVersions").withIndex("by_artifact", (q) => q.eq("artifactId", r._id)).take(100);
          for (const ver of versions) {
            if (ver.imageStorageId) await ctx.storage.delete(ver.imageStorageId).catch(() => undefined);
            await ctx.db.delete(ver._id);
          }
        }
        if (table === "businesses") {
          for (const f of await ctx.db.query("businessFacts").withIndex("by_business", (q) => q.eq("businessId", r._id)).take(500)) await ctx.db.delete(f._id);
          for (const f of await ctx.db.query("factSources").withIndex("by_business", (q) => q.eq("businessId", r._id)).take(500)) await ctx.db.delete(f._id);
          for (const b of await ctx.db.query("brandProfiles").withIndex("by_business", (q) => q.eq("businessId", r._id)).take(10)) await ctx.db.delete(b._id);
        }
        if (table === "forecastRuns") {
          for (const b of await ctx.db.query("backtestRuns").withIndex("by_forecast", (q) => q.eq("forecastRunId", r._id)).take(10)) await ctx.db.delete(b._id);
        }
        if (table === "connections") {
          for (const sec of await ctx.db.query("connectionSecrets").withIndex("by_connection", (q) => q.eq("connectionId", r._id)).take(10)) await ctx.db.delete(sec._id);
        }
        if (table === "contacts") {
          for (const c of await ctx.db.query("consentRecords").withIndex("by_org_contact", (q) => q.eq("orgId", orgId).eq("contactId", r._id)).take(50)) await ctx.db.delete(c._id);
        }
        if (table === "workflowRuns") {
          // Step outputs contain generated content; run cost records stay in usageEvents for accounting.
          for (const st of await ctx.db.query("workflowSteps").withIndex("by_run", (q) => q.eq("runId", r._id)).take(100)) await ctx.db.delete(st._id);
        }
        await ctx.db.delete(r._id);
        removed++;
      }
    }
    if (removed > 0) {
      await ctx.scheduler.runAfter(0, internal.settings.purgeWorkspaceBatch, { orgId });
      return;
    }
    const req = await ctx.db
      .query("privacyRequests")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .first();
    if (req && req.kind === "delete_workspace") await ctx.db.patch(req._id, { status: "done", completedAt: Date.now(), note: "Billing records, usage costs and the audit trail are retained for accounting." });
  },
});
