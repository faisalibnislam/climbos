import { v } from "convex/values";
import { CURRENT_ENTITLEMENTS, creditsToMicros, microsToCredits, packageOf, TOPUP_VALID_DAYS } from "../shared/economics";
import { mergeLiveConfig, type LiveConfig } from "../shared/economics/liveConfig";
import { subscriptionAccess } from "../shared/billing";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { reopenFailedRun } from "./engine";
import { latestSubscription } from "./lib/access";
import { accountWorkspaces } from "./lib/accounts";
import { audit } from "./lib/audit";
import { getLiveConfig } from "./lib/config";
import { creditBalance, topupPool } from "./lib/credits";
import { currentPeriod, grantSubscriptionPeriod } from "./lib/periods";
import { requireStaff, staffPowers, staffRoleOf, SUPPORT_GRANT_LIMIT, type StaffRole } from "./lib/staff";
import { appError, operatorEmails, optionalUser } from "./lib/tenancy";

/**
 * ClimbOS admin panel (owner decision 18 Oct 2026): staff search accounts and
 * workspaces, manage packages and credits, change plans and feature locks
 * live, read the business dashboard and open a read-only view of a
 * workspace. Every action is audited; support views are shown to the user.
 */

const DAY = 86_400_000;
type Ctx = QueryCtx | MutationCtx;

async function accountSummary(ctx: Ctx, account: Doc<"accounts">) {
  const owner = await ctx.db.get(account.ownerUserId);
  const workspaces = await accountWorkspaces(ctx, account._id);
  const first = workspaces[0];
  const sub = first ? await latestSubscription(ctx, first) : null;
  const period = first ? await currentPeriod(ctx, first) : null;
  const balance = first ? await creditBalance(ctx, first, period) : null;
  const access = sub ? subscriptionAccess(sub, Date.now()) : null;
  return {
    id: account._id,
    name: account.name,
    ownerEmail: owner?.email ?? null,
    ownerName: owner?.name ?? null,
    createdAt: account.createdAt,
    suspended: Boolean(account.suspendedAt),
    package: sub && access === "full" ? { name: CURRENT_ENTITLEMENTS.plans[sub.planKey].name, comp: Boolean(sub.comp), until: sub.comp?.until ?? sub.currentPeriodEnd } : null,
    credits: balance?.available ?? 0,
    workspaces: workspaces.map((w) => ({ id: w._id, name: w.name, slug: w.slug })),
  };
}

/* ---------------- who am I ---------------- */

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await optionalUser(ctx);
    const role = await staffRoleOf(ctx, user);
    return role ? { role, powers: staffPowers(role), email: user?.email ?? null } : null;
  },
});

/* ---------------- business dashboard ---------------- */

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "read");
    const now = Date.now();
    const users = (await ctx.db.query("users").order("desc").take(10_000)).filter((u) => !u.isAnonymous);
    const accounts = await ctx.db.query("accounts").order("desc").take(10_000);
    const subs = await ctx.db.query("subscriptions").take(10_000);
    const active = subs.filter((s) => subscriptionAccess(s, now) === "full");
    const paying = active.filter((s) => !s.comp);
    const orders = (await ctx.db.query("orders").order("desc").take(5_000)).filter((o) => o.createdAt > now - 30 * DAY);
    const revenueMinor = orders.filter((o) => o.status === "paid" || o.status === "partially_refunded").reduce((s, o) => s + o.amountMinor - (o.taxMinor ?? 0) - (o.refundedMinor ?? 0), 0);
    const usage = (await ctx.db.query("usageEvents").order("desc").take(30_000)).filter((e) => e.createdAt > now - 30 * DAY);
    const aiCostMicros = usage.reduce((s, e) => s + e.costMicros, 0);
    const mrrUsd = paying.reduce((s, x) => s + CURRENT_ENTITLEMENTS.plans[x.planKey].priceUsd, 0);
    const byPackage: Record<string, number> = {};
    for (const s of paying) byPackage[CURRENT_ENTITLEMENTS.plans[s.planKey].name] = (byPackage[CURRENT_ENTITLEMENTS.plans[s.planKey].name] ?? 0) + 1;
    // Funnel: signed up → workspace → research done → plan built → paying.
    // Customer workspaces only (demos excluded).
    const customerOrgs = new Set((await ctx.db.query("organizations").withIndex("by_kind_created", (q) => q.eq("kind", "customer")).take(10_000)).filter((o) => !o.deletedAt).map((o) => o._id));
    const businesses = (await ctx.db.query("businesses").take(10_000)).filter((b) => customerOrgs.has(b.orgId));
    const strategies = (await ctx.db.query("strategies").take(10_000)).filter((s) => customerOrgs.has(s.orgId));
    const orgsWithPlan = new Set(strategies.map((s) => s.orgId));
    const signupsByDay: { day: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const start = new Date(now - i * DAY);
      start.setUTCHours(0, 0, 0, 0);
      const end = start.getTime() + DAY;
      signupsByDay.push({ day: start.toISOString().slice(0, 10), count: users.filter((u) => u._creationTime >= start.getTime() && u._creationTime < end).length });
    }
    return {
      users: users.length,
      signups7d: users.filter((u) => u._creationTime > now - 7 * DAY).length,
      signups30d: users.filter((u) => u._creationTime > now - 30 * DAY).length,
      accounts: accounts.length,
      paying: paying.length,
      comps: active.length - paying.length,
      byPackage,
      mrrUsd,
      revenue30dUsd: revenueMinor / 100,
      aiCost30dUsd: aiCostMicros / 1_000_000,
      grossMargin30d: revenueMinor > 0 ? (revenueMinor / 100 - aiCostMicros / 1_000_000) / (revenueMinor / 100) : null,
      creditsUsed30d: microsToCredits(aiCostMicros),
      funnel: [
        { step: "Signed up", count: users.length },
        { step: "Created a workspace", count: accounts.length },
        { step: "Research done", count: businesses.filter((b) => b.researchStatus === "done" || b.researchStatus === "partial" || b.researchStatus === "owner_supplied").length },
        { step: "Plan built", count: orgsWithPlan.size },
        { step: "Paying", count: paying.length },
      ],
      signupsByDay,
    };
  },
});

/* ---------------- accounts and workspaces ---------------- */

export const searchAccounts = query({
  args: { q: v.optional(v.string()) },
  handler: async (ctx, { q }) => {
    await requireStaff(ctx, "read");
    const needle = (q ?? "").trim().toLowerCase();
    const accounts = await ctx.db.query("accounts").order("desc").take(1_000);
    const rows = [];
    for (const a of accounts) {
      if (rows.length >= 50) break;
      const s = await accountSummary(ctx, a);
      const hay = [s.name, s.ownerEmail, s.ownerName, ...s.workspaces.flatMap((w) => [w.name, w.slug])].join(" ").toLowerCase();
      if (!needle || hay.includes(needle)) rows.push(s);
    }
    return rows;
  },
});

export const accountDetail = query({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, { accountId }) => {
    await requireStaff(ctx, "read");
    const account = await ctx.db.get(accountId);
    if (!account) return null;
    const summary = await accountSummary(ctx, account);
    const workspaces = await accountWorkspaces(ctx, accountId);
    const first = workspaces[0];
    const period = first ? await currentPeriod(ctx, first) : null;
    const pool = await topupPool(ctx, { _id: first?._id ?? (accountId as unknown as Id<"organizations">), accountId });
    const subs = await ctx.db.query("subscriptions").withIndex("by_account", (q) => q.eq("accountId", accountId)).order("desc").take(10);
    const orders = await ctx.db.query("orders").withIndex("by_account", (q) => q.eq("accountId", accountId)).order("desc").take(20);
    const ws = [];
    for (const w of workspaces) {
      const members = await ctx.db.query("memberships").withIndex("by_org", (q) => q.eq("orgId", w._id)).take(100);
      const people = [];
      for (const m of members.filter((m) => m.status !== "removed")) {
        const u = m.userId ? await ctx.db.get(m.userId) : null;
        people.push({ email: u?.email ?? m.invitedEmail ?? null, role: m.role, status: m.status });
      }
      const runs = await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", w._id)).order("desc").take(15);
      ws.push({
        id: w._id,
        name: w.name,
        slug: w.slug,
        suspended: Boolean(w.suspendedAt),
        monthlyCreditCap: w.monthlyCreditCap ?? null,
        onboardingStep: w.onboardingStep,
        people,
        runs: runs.map((r) => ({ id: r._id, title: r.title, kind: r.kind, status: r.status, credits: microsToCredits(r.actualMicros), error: r.error ?? null, userMessage: r.userMessage ?? null, createdAt: r.createdAt, canRetry: r.status === "failed" && Boolean(r.resumeWith) })),
      });
    }
    const auditRows = first ? await ctx.db.query("auditEvents").withIndex("by_org_created", (q) => q.eq("orgId", first._id)).order("desc").take(30) : [];
    return {
      ...summary,
      suspendedReason: account.suspendedReason ?? null,
      period: period ? { source: period.source, endsAt: period.endsAt, monthlyTotal: microsToCredits(period.walletCapMicros), monthlyUsed: microsToCredits(period.walletSpentMicros + period.walletReservedMicros) } : null,
      topupLots: pool.lots.map((l) => ({ id: l._id, key: l.topupKey, left: microsToCredits(l.remainingMicros ?? 0), expiresAt: l.expiresAt ?? null })),
      subscriptions: subs.map((s) => ({ id: s._id, plan: CURRENT_ENTITLEMENTS.plans[s.planKey].name, status: s.status, access: subscriptionAccess(s, Date.now()), comp: s.comp ? { until: s.comp.until, reason: s.comp.reason } : null, currentPeriodEnd: s.currentPeriodEnd })),
      orders: orders.map((o) => ({ id: o._id, product: o.productKey, status: o.status, amountMinor: o.amountMinor, currency: o.currency, createdAt: o.createdAt })),
      workspaces: ws,
      audit: auditRows.map((a) => ({ id: a._id, action: a.action, summary: a.summary, actorType: a.actorType, createdAt: a.createdAt })),
    };
  },
});

async function auditAccount(ctx: MutationCtx, accountId: Id<"accounts">, staffId: Id<"users">, action: string, summary: string) {
  const first = (await accountWorkspaces(ctx, accountId))[0];
  await audit(ctx, { orgId: first?._id, actorType: "operator", actorId: staffId, action: `admin.${action}`, subjectType: "account", subjectId: accountId, summary });
}

export const suspendAccount = mutation({
  args: { accountId: v.id("accounts"), suspend: v.boolean(), reason: v.optional(v.string()) },
  handler: async (ctx, { accountId, suspend, reason }) => {
    const { user } = await requireStaff(ctx, "manage_accounts");
    const now = Date.now();
    await ctx.db.patch(accountId, suspend ? { suspendedAt: now, suspendedReason: reason?.slice(0, 200) } : { suspendedAt: undefined, suspendedReason: undefined });
    for (const w of await accountWorkspaces(ctx, accountId)) await ctx.db.patch(w._id, { suspendedAt: suspend ? now : undefined });
    await auditAccount(ctx, accountId, user._id, suspend ? "suspend" : "unsuspend", suspend ? `Account suspended by ClimbOS${reason ? `: ${reason.slice(0, 200)}` : "."}` : "Account suspension lifted by ClimbOS.");
  },
});

export const suspendWorkspace = mutation({
  args: { orgId: v.id("organizations"), suspend: v.boolean() },
  handler: async (ctx, { orgId, suspend }) => {
    const { user } = await requireStaff(ctx, "manage_accounts");
    await ctx.db.patch(orgId, { suspendedAt: suspend ? Date.now() : undefined });
    await audit(ctx, { orgId, actorType: "operator", actorId: user._id, action: suspend ? "admin.workspace_suspended" : "admin.workspace_unsuspended", summary: suspend ? "Workspace suspended by ClimbOS." : "Workspace suspension lifted by ClimbOS." });
  },
});

export const deleteWorkspace = mutation({
  args: { orgId: v.id("organizations"), confirmSlug: v.string() },
  handler: async (ctx, { orgId, confirmSlug }) => {
    const { user } = await requireStaff(ctx, "manage_accounts");
    const org = await ctx.db.get(orgId);
    if (!org || org.slug !== confirmSlug) throw appError("INVALID", "Type the workspace's slug to confirm.");
    await ctx.db.patch(orgId, { deletedAt: Date.now() });
    await audit(ctx, { orgId, actorType: "operator", actorId: user._id, action: "admin.workspace_deleted", summary: `Workspace "${org.name}" deleted by ClimbOS.` });
  },
});

export const transferAccount = mutation({
  args: { accountId: v.id("accounts"), newOwnerEmail: v.string() },
  handler: async (ctx, { accountId, newOwnerEmail }) => {
    const { user } = await requireStaff(ctx, "manage_accounts");
    const email = newOwnerEmail.trim().toLowerCase();
    const next = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!next) throw appError("INVALID", "That person needs a ClimbOS login first.");
    const account = await ctx.db.get(accountId);
    if (!account) throw appError("NOT_FOUND", "Account not found.");
    if (await ctx.db.query("accounts").withIndex("by_owner", (q) => q.eq("ownerUserId", next._id)).first()) throw appError("INVALID", "That person already owns an account.");
    for (const w of await accountWorkspaces(ctx, accountId)) {
      const members = await ctx.db.query("memberships").withIndex("by_org", (q) => q.eq("orgId", w._id)).take(200);
      for (const m of members) if (m.userId === account.ownerUserId && m.role === "owner") await ctx.db.patch(m._id, { role: "admin" });
      const theirs = members.find((m) => m.userId === next._id);
      if (theirs) await ctx.db.patch(theirs._id, { role: "owner", status: "active" });
      else await ctx.db.insert("memberships", { orgId: w._id, userId: next._id, role: "owner", status: "active", createdAt: Date.now() });
    }
    await ctx.db.patch(accountId, { ownerUserId: next._id });
    await auditAccount(ctx, accountId, user._id, "transfer", `Account ownership transferred to ${email} by ClimbOS.`);
  },
});

export const setWorkspaceCap = mutation({
  args: { orgId: v.id("organizations"), credits: v.union(v.number(), v.null()) },
  handler: async (ctx, { orgId, credits }) => {
    const { user } = await requireStaff(ctx, "manage_accounts");
    await ctx.db.patch(orgId, { monthlyCreditCap: credits === null ? undefined : Math.max(0, Math.round(credits)) });
    await audit(ctx, { orgId, actorType: "operator", actorId: user._id, action: "admin.workspace_cap", summary: credits === null ? "Monthly credit cap removed by ClimbOS." : `Monthly credit cap set to ${credits} by ClimbOS.` });
  },
});

/* ---------------- packages and credits ---------------- */

async function grantCompPeriod(ctx: MutationCtx, sub: Doc<"subscriptions">, start: number, end: number) {
  const first = sub.accountId ? (await accountWorkspaces(ctx, sub.accountId))[0] : null;
  await grantSubscriptionPeriod(ctx, {
    orgId: first?._id ?? sub.orgId,
    accountId: sub.accountId,
    planKey: sub.planKey,
    entitlementVersionId: sub.entitlementVersionId,
    periodStart: start,
    periodEnd: end,
    polarOrderId: `comp:${sub._id}:${start}`,
    polarSubscriptionId: sub.polarSubscriptionId,
  });
}

/** Give an account a package for free (support, partners, the owner's own testing). Renews monthly until it ends. */
export const compPackage = mutation({
  args: { accountId: v.id("accounts"), planKey: v.union(v.literal("starter"), v.literal("pro")), months: v.number(), reason: v.string() },
  handler: async (ctx, { accountId, planKey, months, reason }) => {
    const { user } = await requireStaff(ctx, "grant");
    if (!(months >= 1 && months <= 36)) throw appError("INVALID", "Comp between 1 and 36 months.");
    const first = (await accountWorkspaces(ctx, accountId))[0];
    if (!first) throw appError("INVALID", "This account has no workspace yet.");
    const now = Date.now();
    const subId = await ctx.db.insert("subscriptions", {
      orgId: first._id,
      accountId,
      comp: { until: now + months * 30 * DAY, by: user._id, reason: reason.slice(0, 200) || "Complimentary" },
      polarSubscriptionId: `comp:${accountId}:${now}`,
      productId: "comp",
      planKey,
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodStart: now,
      currentPeriodEnd: now + 30 * DAY,
      entitlementVersionId: CURRENT_ENTITLEMENTS.id,
      rateVersionId: CURRENT_ENTITLEMENTS.rateVersionId,
      sourceModifiedAt: now,
      updatedAt: now,
    });
    await grantCompPeriod(ctx, (await ctx.db.get(subId))!, now, now + 30 * DAY);
    await auditAccount(ctx, accountId, user._id, "comp", `${CURRENT_ENTITLEMENTS.plans[planKey].name} given free for ${months} month${months === 1 ? "" : "s"} by ClimbOS (${reason.slice(0, 120)}).`);
  },
});

export const endComp = mutation({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, { subscriptionId }) => {
    const { user } = await requireStaff(ctx, "grant");
    const sub = await ctx.db.get(subscriptionId);
    if (!sub?.comp) throw appError("INVALID", "That isn't a complimentary package.");
    const now = Date.now();
    await ctx.db.patch(sub._id, { status: "canceled", endedAt: now, cancelAtPeriodEnd: false, updatedAt: now });
    const first = sub.accountId ? (await accountWorkspaces(ctx, sub.accountId))[0] : null;
    const period = first ? await currentPeriod(ctx, first) : null;
    if (period?.source === "subscription") await ctx.db.patch(period._id, { endsAt: now, updatedAt: now });
    if (sub.accountId) await auditAccount(ctx, sub.accountId, user._id, "comp_ended", "Complimentary package ended by ClimbOS.");
  },
});

/** Daily: roll complimentary packages into their next month (fresh credits) until they end. */
export const renewComps = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let renewed = 0;
    for (const sub of await ctx.db.query("subscriptions").take(5_000)) {
      if (!sub.comp || sub.status !== "active" || sub.currentPeriodEnd > now) continue;
      if (sub.comp.until <= now) {
        await ctx.db.patch(sub._id, { status: "canceled", endedAt: now, updatedAt: now });
        continue;
      }
      const start = sub.currentPeriodEnd;
      const end = start + 30 * DAY;
      await ctx.db.patch(sub._id, { currentPeriodStart: start, currentPeriodEnd: end, updatedAt: now });
      await grantCompPeriod(ctx, (await ctx.db.get(sub._id))!, start, end);
      renewed++;
    }
    return renewed;
  },
});

export const grantCredits = mutation({
  args: { accountId: v.id("accounts"), credits: v.number(), reason: v.string() },
  handler: async (ctx, { accountId, credits, reason }) => {
    const { user, role } = await requireStaff(ctx, "grant_small");
    const n = Math.round(credits);
    if (!(n >= 1 && n <= 100_000)) throw appError("INVALID", "Grant between 1 and 100,000 credits.");
    if (role === "support" && n > SUPPORT_GRANT_LIMIT) throw appError("FORBIDDEN", `Support can grant up to ${SUPPORT_GRANT_LIMIT} credits at a time.`);
    const first = (await accountWorkspaces(ctx, accountId))[0];
    if (!first) throw appError("INVALID", "This account has no workspace yet.");
    const now = Date.now();
    const micros = creditsToMicros(n);
    await ctx.db.insert("creditPurchases", { orgId: first._id, accountId, polarOrderId: `grant:${user._id}:${now}`, topupKey: "grant", deliveryCostMicros: micros, creditsMicros: micros, remainingMicros: micros, expiresAt: now + TOPUP_VALID_DAYS * DAY, status: "active", createdAt: now });
    await auditAccount(ctx, accountId, user._id, "credits_granted", `${n.toLocaleString("en-US")} credits added by ClimbOS (${reason.slice(0, 120) || "support"}). They last 12 months.`);
  },
});

export const removeCredits = mutation({
  args: { accountId: v.id("accounts"), credits: v.number(), reason: v.string() },
  handler: async (ctx, { accountId, credits, reason }) => {
    const { user } = await requireStaff(ctx, "grant");
    let left = creditsToMicros(Math.max(0, Math.round(credits)));
    const first = (await accountWorkspaces(ctx, accountId))[0];
    if (!first) throw appError("INVALID", "This account has no workspace yet.");
    // Top-ups first (latest expiry first), then this month's credits (never below what's used or held).
    const pool = await topupPool(ctx, first);
    for (const lot of [...pool.lots].reverse()) {
      if (left <= 0) break;
      const take = Math.min(left, lot.remainingMicros ?? 0);
      await ctx.db.patch(lot._id, { remainingMicros: (lot.remainingMicros ?? 0) - take });
      left -= take;
    }
    const period = await currentPeriod(ctx, first);
    if (left > 0 && period) {
      const floor = period.walletSpentMicros + period.walletReservedMicros;
      const nextCap = Math.max(floor, period.walletCapMicros - left);
      left -= period.walletCapMicros - nextCap;
      await ctx.db.patch(period._id, { walletCapMicros: nextCap, updatedAt: Date.now() });
    }
    await auditAccount(ctx, accountId, user._id, "credits_removed", `${Math.round(credits - left / 10_000).toLocaleString("en-US")} credits removed by ClimbOS (${reason.slice(0, 120) || "adjustment"}).`);
  },
});

/* ---------------- jobs and read-only view ---------------- */

export const retryRun = mutation({
  args: { runId: v.id("workflowRuns") },
  handler: async (ctx, { runId }) => {
    const { user } = await requireStaff(ctx, "retry");
    const run = await ctx.db.get(runId);
    const org = run ? await ctx.db.get(run.orgId) : null;
    if (!run || !org) throw appError("NOT_FOUND", "Job not found.");
    await reopenFailedRun(ctx, run, org);
    await audit(ctx, { orgId: org._id, actorType: "operator", actorId: user._id, action: "admin.run_retried", subjectType: "run", subjectId: runId, summary: `ClimbOS support retried "${run.title}" from where it stopped.` });
  },
});

/** Start a 30-minute read-only view of a workspace. Logged in the workspace's activity so the owner can see it. */
export const startViewAs = mutation({
  args: { orgId: v.id("organizations"), reason: v.string() },
  handler: async (ctx, { orgId, reason }) => {
    const { user } = await requireStaff(ctx, "view_as");
    const org = await ctx.db.get(orgId);
    if (!org || org.deletedAt) throw appError("NOT_FOUND", "Workspace not found.");
    const now = Date.now();
    const existing = await ctx.db.query("staffViews").withIndex("by_staff_org", (q) => q.eq("staffUserId", user._id).eq("orgId", orgId)).first();
    if (existing) await ctx.db.patch(existing._id, { expiresAt: now + 30 * 60_000 });
    else await ctx.db.insert("staffViews", { staffUserId: user._id, orgId, expiresAt: now + 30 * 60_000, createdAt: now });
    await audit(ctx, { orgId, actorType: "operator", actorId: user._id, action: "support.viewed", summary: `ClimbOS support (${user.name ?? user.email ?? "staff"}) opened a read-only view of this workspace: ${reason.slice(0, 160) || "support request"}.` });
    return { slug: org.slug };
  },
});

/* ---------------- live plans and feature locks ---------------- */

export const config = query({
  args: {},
  handler: async (ctx) => {
    const { role } = await requireStaff(ctx, "read");
    const row = await ctx.db.query("appConfig").withIndex("by_key", (q) => q.eq("key", "live")).unique();
    return { config: await getLiveConfig(ctx), updatedAt: row?.updatedAt ?? null, canEditFeatures: role !== "support", canEditMoney: role === "owner" };
  },
});

const MONEY_KEYS: (keyof LiveConfig)[] = ["packageCredits", "topupCredits", "freeCredits"];

export const setConfig = mutation({
  args: { value: v.string() },
  handler: async (ctx, { value }) => {
    const current = await getLiveConfig(ctx);
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw appError("INVALID", "That settings file isn't valid.");
    }
    const next = mergeLiveConfig(parsed);
    const changed = (Object.keys(next) as (keyof LiveConfig)[]).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(current[k]));
    if (!changed.length) return { changed: [] };
    const { user } = await requireStaff(ctx, changed.some((k) => MONEY_KEYS.includes(k)) ? "money" : "features");
    const row = await ctx.db.query("appConfig").withIndex("by_key", (q) => q.eq("key", "live")).unique();
    const now = Date.now();
    if (row) await ctx.db.patch(row._id, { value: JSON.stringify(next), updatedBy: user._id, updatedAt: now });
    else await ctx.db.insert("appConfig", { key: "live", value: JSON.stringify(next), updatedBy: user._id, updatedAt: now });
    await audit(ctx, { actorType: "operator", actorId: user._id, action: "admin.config", summary: `Live settings changed: ${changed.join(", ")}.` });
    return { changed };
  },
});

/* ---------------- staff ---------------- */

export const staffList = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "read");
    const rows = await ctx.db.query("staff").take(200);
    return [
      ...operatorEmails().map((email) => ({ id: null as Id<"staff"> | null, email, role: "owner" as StaffRole, fixed: true })),
      ...rows.filter((r) => !operatorEmails().includes(r.email)).map((r) => ({ id: r._id, email: r.email, role: r.role, fixed: false })),
    ];
  },
});

export const setStaff = mutation({
  args: { email: v.string(), role: v.union(v.literal("owner"), v.literal("admin"), v.literal("support"), v.literal("remove")) },
  handler: async (ctx, { email, role }) => {
    const { user } = await requireStaff(ctx, "staff");
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw appError("INVALID", "Enter a valid email address.");
    if (operatorEmails().includes(clean)) throw appError("INVALID", "That owner is set in the server settings.");
    const row = await ctx.db.query("staff").withIndex("by_email", (q) => q.eq("email", clean)).first();
    if (role === "remove") {
      if (row) await ctx.db.delete(row._id);
    } else if (row) await ctx.db.patch(row._id, { role });
    else await ctx.db.insert("staff", { email: clean, role, addedBy: user._id, createdAt: Date.now() });
    await audit(ctx, { actorType: "operator", actorId: user._id, action: "admin.staff", summary: role === "remove" ? `Removed ${clean} from ClimbOS staff.` : `${clean} is now ClimbOS ${role}.` });
  },
});

/** Package names and credit amounts for the comp picker. */
export const packages = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "read");
    const config = await getLiveConfig(ctx);
    return (["starter", "pro"] as const).map((k) => ({ key: k, name: CURRENT_ENTITLEMENTS.plans[k].name, credits: config.packageCredits[packageOf(k)] }));
  },
});
