import { v } from "convex/values";
import { METER_LABELS, type MeterKey } from "../shared/economics/entitlements";
import { usageFractions } from "../shared/economics/ledger";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { sha256Hex } from "../shared/policy";
import { digestEmail, invitationEmail, usageAlertEmail } from "./lib/emailTemplates";
import { currentPeriod, ledgerOf } from "./lib/periods";

const THRESHOLDS = [0.7, 0.9, 1] as const;

/** After every reconciliation: alert owners/admins once per threshold per meter per period. */
export const checkUsageAlerts = internalMutation({
  args: { periodId: v.id("usagePeriods") },
  handler: async (ctx, { periodId }) => {
    const period = await ctx.db.get(periodId);
    if (!period || period.source === "demo") return;
    const org = await ctx.db.get(period.orgId);
    if (!org) return;
    const f = usageFractions(ledgerOf(period));
    const crossed: { key: string; label: string; percent: number }[] = [];
    const check = (key: string, label: string, fraction: number) => {
      for (const t of THRESHOLDS) {
        const tag = `${key}:${t}`;
        if (fraction >= t && !period.alertsSent.includes(tag)) crossed.push({ key: tag, label, percent: Math.round(t * 100) });
      }
    };
    check("wallet", "AI work capacity", f.wallet);
    for (const [k, frac] of Object.entries(f.meters)) {
      if (period.meterCaps[k as MeterKey] > 0) check(k, METER_LABELS[k as MeterKey], frac);
    }
    if (crossed.length === 0) return;
    await ctx.db.patch(period._id, { alertsSent: [...period.alertsSent, ...crossed.map((c) => c.key)] });
    // One email per check: the highest threshold crossed for the most-used limit.
    const top = crossed.sort((a, b) => b.percent - a.percent)[0];
    await ctx.db.insert("auditEvents", {
      orgId: org._id,
      actorType: "system",
      action: "usage.alert",
      summary: `${top.label} reached ${top.percent}% of this month's limit.`,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.notifications.sendUsageAlert, {
      orgId: org._id,
      meterLabel: top.label,
      percent: top.percent,
    });
  },
});

export const recipientsFor = internalQuery({
  args: { orgId: v.id("organizations"), purpose: v.union(v.literal("usage"), v.literal("digest")), cadence: v.optional(v.string()) },
  handler: async (ctx, { orgId, purpose, cadence }) => {
    const org = await ctx.db.get(orgId);
    if (!org) return { orgName: "", slug: "", emails: [] as string[] };
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(50);
    const emails: string[] = [];
    for (const m of members) {
      if (m.status !== "active" || !m.userId || !["owner", "admin"].includes(m.role)) continue;
      const user = await ctx.db.get(m.userId);
      if (!user?.email || user.isAnonymous) continue;
      const prefs = await ctx.db
        .query("userPreferences")
        .withIndex("by_user", (q) => q.eq("userId", m.userId!))
        .unique();
      if (purpose === "usage" && prefs && !prefs.usageAlerts) continue;
      if (purpose === "digest") {
        const pref = prefs?.digest ?? "weekly";
        if (pref === "off") continue;
        if (pref === "weekly" && cadence !== "weekly") continue;
      }
      emails.push(user.email);
    }
    return { orgName: org.name, slug: org.slug, emails };
  },
});

export const sendUsageAlert = internalAction({
  args: { orgId: v.id("organizations"), meterLabel: v.string(), percent: v.number() },
  handler: async (ctx, args) => {
    const { orgName, slug, emails } = await ctx.runQuery(internal.notifications.recipientsFor, { orgId: args.orgId, purpose: "usage" });
    const url = `${process.env.SITE_URL ?? "https://climbos.app"}/app/${slug}/settings/billing`;
    const mail = usageAlertEmail({ orgName, percent: args.percent, meter: args.meterLabel, url });
    for (const to of emails) {
      await ctx.runAction(internal.notifications.sendPlatformEmail, { orgId: args.orgId, to, template: "usage_alert", ...mail });
    }
  },
});

export const sendInvitation = internalAction({
  args: { orgId: v.id("organizations"), to: v.string(), inviterName: v.string(), role: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    const { orgName } = await ctx.runQuery(internal.notifications.recipientsFor, { orgId: args.orgId, purpose: "usage" });
    const url = `${process.env.SITE_URL ?? "https://climbos.app"}/invite/${args.token}`;
    const mail = invitationEmail({ orgName, inviterName: args.inviterName, role: args.role, url });
    await ctx.runAction(internal.notifications.sendPlatformEmail, { orgId: args.orgId, to: args.to, template: "invitation", ...mail });
  },
});

export const sendDigest = internalAction({
  args: { orgId: v.id("organizations"), cadence: v.string(), lines: v.array(v.string()) },
  handler: async (ctx, args) => {
    const { orgName, slug, emails } = await ctx.runQuery(internal.notifications.recipientsFor, { orgId: args.orgId, purpose: "digest", cadence: args.cadence });
    if (emails.length === 0 || args.lines.length === 0) return;
    const url = `${process.env.SITE_URL ?? "https://climbos.app"}/app/${slug}/today`;
    const mail = digestEmail({ orgName, lines: args.lines, url, cadence: args.cadence });
    for (const to of emails) {
      await ctx.runAction(internal.notifications.sendPlatformEmail, { orgId: args.orgId, to, template: "digest", ...mail });
    }
  },
});

export const logEmail = internalMutation({
  args: {
    orgId: v.optional(v.id("organizations")),
    template: v.string(),
    toHash: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("suppressed")),
    resendId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("emailLog", { ...args, createdAt: Date.now() });
    if (args.orgId && args.status === "sent") {
      const period = await currentPeriod(ctx, args.orgId);
      if (period) {
        await ctx.db.patch(period._id, {
          meterUsed: { ...period.meterUsed, transactionalEmails: period.meterUsed.transactionalEmails + 1 },
        });
      }
    }
  },
});

export const isSuppressed = internalQuery({
  args: { toHash: v.string() },
  handler: async (ctx, { toHash }) =>
    Boolean(
      await ctx.db
        .query("platformSuppressions")
        .withIndex("by_email", (q) => q.eq("emailHash", toHash))
        .first(),
    ),
});

/** ClimbOS platform mail via Resend. Never used for customer marketing. */
export const sendPlatformEmail = internalAction({
  args: {
    orgId: v.optional(v.id("organizations")),
    to: v.string(),
    template: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const toHash = await sha256Hex(args.to.trim().toLowerCase());
    if (await ctx.runQuery(internal.notifications.isSuppressed, { toHash })) {
      await ctx.runMutation(internal.notifications.logEmail, { orgId: args.orgId, template: args.template, toHash, status: "suppressed" });
      return { status: "suppressed" as const };
    }
    const key = process.env.AUTH_RESEND_KEY;
    if (!key) {
      await ctx.runMutation(internal.notifications.logEmail, { orgId: args.orgId, template: args.template, toHash, status: "failed" });
      return { status: "not_configured" as const };
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `${args.template}:${toHash}:${Math.floor(Date.now() / 60_000)}` },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "ClimbOS <hello@climbos.app>",
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    await ctx.runMutation(internal.notifications.logEmail, {
      orgId: args.orgId as Id<"organizations"> | undefined,
      template: args.template,
      toHash,
      status: res.ok ? "sent" : "failed",
      resendId: json.id,
    });
    return { status: res.ok ? ("sent" as const) : ("failed" as const) };
  },
});

/** Resend delivery webhooks: bounces/complaints become platform suppressions. */
export const applyResendEvent = internalMutation({
  args: { type: v.string(), resendId: v.optional(v.string()), toHashes: v.array(v.string()) },
  handler: async (ctx, { type, resendId, toHashes }) => {
    const status =
      type === "email.delivered" ? "delivered" : type === "email.bounced" ? "bounced" : type === "email.complained" ? "complained" : null;
    if (resendId && status) {
      const log = await ctx.db
        .query("emailLog")
        .withIndex("by_resend", (q) => q.eq("resendId", resendId))
        .first();
      if (log) await ctx.db.patch(log._id, { status });
    }
    if (status === "bounced" || status === "complained") {
      for (const emailHash of toHashes) {
        const exists = await ctx.db
          .query("platformSuppressions")
          .withIndex("by_email", (q) => q.eq("emailHash", emailHash))
          .first();
        if (!exists) {
          await ctx.db.insert("platformSuppressions", {
            emailHash,
            reason: status === "bounced" ? "bounce" : "complaint",
            createdAt: Date.now(),
          });
        }
      }
    }
  },
});
