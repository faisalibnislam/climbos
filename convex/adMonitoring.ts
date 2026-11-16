import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { approvalHash, can, canonicalJson, checkApprovalForExecution, sha256Hex } from "../shared/policy";
import { campaignApprovalScope } from "../shared/policy/campaignScope";
import { campaignBudgetProblem } from "../shared/policy/campaignBudget";
import { googleMonitorSpend, metaMonitorSpend, spendMonitorWindow, SPEND_MONITOR_ACTION, SPEND_MONITOR_FRESH_MS, SPEND_MONITOR_INTERVAL_MS } from "../shared/acquisition/spendMonitor";
import { getCampaignMetrics, getCampaignState, getCustomerSettings, GOOGLE_ADS_SCOPE, SET_CAMPAIGN_STATUS_ACTION as GOOGLE_PAUSE, setCampaignStatus as pauseGoogle } from "../shared/integrations/googleAds";
import { getAccountSpendCapUsage, getCampaign, getInsights, SET_META_CAMPAIGN_STATUS_ACTION as META_PAUSE, setCampaignStatus as pauseMeta } from "../shared/integrations/metaAds";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { audit } from "./lib/audit";
import { notifyOwners } from "./lib/notify";

type Context = { campaign: Doc<"campaigns">; org: Doc<"organizations">; connection: Doc<"connections"> | null; policy: Doc<"autonomyPolicies"> | null; approval: Doc<"approvals"> | null; contentHash: string; termsHash: string; durationHours: number };
function accessToken(value: string | undefined): string {
  try {
    const token: unknown = value ? JSON.parse(value).accessToken : undefined;
    if (typeof token === "string" && token.trim()) return token;
  } catch { /* Never expose credential text through a JSON parsing error. */ }
  throw new Error("The ad account credentials are unavailable. Reconnect the account.");
}
async function context(ctx: QueryCtx | MutationCtx, campaignId: Id<"campaigns">): Promise<Context | null> {
  const c = await ctx.db.get(campaignId);
  if (!c) return null;
  const org = await ctx.db.get(c.orgId);
  if (!org || org.deletedAt) return null;
  const linkedConnection = c.connectionId ? await ctx.db.get(c.connectionId) : null;
  const connection = linkedConnection?.orgId === c.orgId ? linkedConnection : null;
  const policy = await ctx.db.query("autonomyPolicies").withIndex("by_org_active", q => q.eq("orgId", c.orgId).eq("active", true)).first();
  const linkedApproval = c.monitorApprovalId ? await ctx.db.get(c.monitorApprovalId) : null;
  const approval = linkedApproval?.orgId === c.orgId && linkedApproval.subjectType === "campaign_monitor" && linkedApproval.subjectId === c._id ? linkedApproval : null;
  const artifact = c.artifactId ? await ctx.db.get(c.artifactId) : null;
  if (c.artifactId) assertSameOrg(artifact, c.orgId, "campaign content");
  const contentHash = await sha256Hex(canonicalJson({ version: 1, name: c.name, channel: c.channel, artifactId: c.artifactId, artifactVersion: artifact?.currentVersionId, stopRules: c.stopRules, intervalMs: SPEND_MONITOR_INTERVAL_MS }));
  const durationHours = Math.max(1, Math.min(336, policy?.approvalTtlHours ?? 24));
  const termsHash = await sha256Hex(canonicalJson({ contentHash, scope: campaignApprovalScope(c, connection?.externalAccountId), policyVersion: policy?.version, durationHours }));
  return { campaign: c, org, connection, policy, approval, contentHash, termsHash, durationHours };
}
function eligibility(cx: Context): string | null {
  const { campaign: c, connection, policy, org } = cx;
  if (c.status !== "active") return "Spend monitoring is available for a running campaign.";
  const budget = campaignBudgetProblem(c);
  if (budget) return budget;
  if (!c.externalId || !c.startDate) return "The live campaign identity and approved start date are required.";
  if (!policy?.allowAdPauseRules) return "An owner must allow spend-limit pauses in Policies first.";
  const provider = c.channel === "google_search_ad" ? "google_ads" : c.channel === "meta_ad" ? "meta_ads" : null;
  if (!provider || !connection || connection.orgId !== c.orgId || connection.provider !== provider || connection.status !== "connected" || !connection.externalAccountId) return "Reconnect the exact campaign account first.";
  if (!(org.kind === "demo" && connection.isFixture)) {
    if (connection.isFixture) return "A fixture connection cannot monitor a real workspace.";
    const scopes = provider === "google_ads" ? [GOOGLE_ADS_SCOPE] : ["ads_read", "ads_management"];
    if (scopes.some(scope => !connection.scopes.includes(scope))) return "The connection needs reporting and campaign-pause permissions.";
  }
  return null;
}
async function authorizationProblem(ctx: QueryCtx | MutationCtx, cx: Context): Promise<string | null> {
  const a = cx.approval;
  const c = cx.campaign;
  if (!a || a.orgId !== c.orgId || a.subjectType !== "campaign_monitor" || a.subjectId !== c._id || a.actionKind !== SPEND_MONITOR_ACTION) return "This monitor has no matching campaign approval.";
  const eligible = eligibility(cx);
  if (eligible) return eligible;
  const member = a.decidedBy ? await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", c.orgId).eq("userId", a.decidedBy!)).unique() : null;
  if (!member || member.status !== "active" || !can(member.role, "approve")) return "The approving member no longer has permission. Review the monitor again.";
  const fleet = await ctx.db.query("fleetControls").withIndex("by_key", q => q.eq("key", "global")).unique();
  const check = await checkApprovalForExecution({ approval: a, current: { orgId: c.orgId, subjectType: "campaign_monitor", subjectId: c._id, actionKind: SPEND_MONITOR_ACTION, contentHash: cx.contentHash, scope: campaignApprovalScope(c, cx.connection?.externalAccountId), policyVersion: cx.policy!.version, expiresAt: a.expiresAt }, now: Date.now(), emergencyStop: Boolean(cx.org.emergencyStop?.active || fleet?.emergencyStop), capabilityReady: true });
  return check.ok ? null : check.message;
}
async function stopWithReason(ctx: MutationCtx, cx: Context, reason: string) {
  await ctx.db.patch(cx.campaign._id, { monitorNextAt: undefined, monitorCheckStartedAt: undefined, monitorStatus: "needs_review", monitorMessage: reason });
  if (cx.approval?.status === "approved" && cx.approval.executionStartedAt === undefined) await ctx.db.patch(cx.approval._id, { status: "invalidated", invalidatedReason: reason });
  await audit(ctx, { orgId: cx.org._id, actorType: "system", action: "campaign.monitor_stopped", subjectType: "campaign", subjectId: cx.campaign._id, summary: reason });
  await notifyOwners(ctx, cx.org._id, `Spend monitor needs review: ${reason}`, "content?tab=ads");
}

export const view = query({
  args: { slug: v.string(), campaignId: v.id("campaigns") },
  handler: async (ctx, { slug, campaignId }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    assertSameOrg(await ctx.db.get(campaignId), org._id, "campaign");
    const cx = (await context(ctx, campaignId))!;
    const c = cx.campaign;
    const pending = cx.approval?.executionStartedAt !== undefined && cx.approval.executionFinishedAt === undefined;
    const approvalProblem = cx.approval && !["disabled", "paused"].includes(c.monitorStatus ?? "") && !pending ? await authorizationProblem(ctx, cx) : null;
    return { canApprove: can(role, "approve"), isDemo: org.kind === "demo", termsHash: cx.termsHash, durationHours: cx.durationHours, thresholdMinor: campaignBudgetProblem(c) ? null : c.budgetEnvelopeMinor, currency: c.currency, startDate: c.startDate ?? null, accountId: cx.connection?.externalAccountId ?? null, campaignExternalId: c.externalId ?? null, reason: eligibility(cx), approvalProblem, status: pending ? "pause_pending" as const : c.monitorStatus ?? "disabled" as const, message: c.monitorMessage ?? null, checkedAt: c.monitorCheckedAt ?? null, spendMinor: c.monitorSpendMinor ?? null, timeZone: c.monitorTimeZone ?? null, windowStart: c.monitorWindowStart ?? null, windowEnd: c.monitorWindowEnd ?? null, nextAt: c.monitorNextAt ?? null, expiresAt: cx.approval?.expiresAt ?? null, pending, canReconcile: pending || c.monitorStatus === "uncertain" };
  },
});

export const configure = mutation({
  args: { slug: v.string(), campaignId: v.id("campaigns"), enabled: v.boolean(), expectedTermsHash: v.optional(v.string()) },
  handler: async (ctx, { slug, campaignId, enabled, expectedTermsHash }): Promise<void> => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    assertSameOrg(await ctx.db.get(campaignId), org._id, "campaign");
    const cx = (await context(ctx, campaignId))!;
    if (cx.approval?.executionStartedAt !== undefined && cx.approval.executionFinishedAt === undefined || cx.campaign.monitorStatus === "uncertain") throw appError("INVALID", "A pause result is unresolved. Check the provider result before changing this monitor.");
    if (enabled) {
      const problem = eligibility(cx);
      if (problem) throw appError("INVALID", problem);
      if (expectedTermsHash !== cx.termsHash) throw appError("INVALID", "The campaign or policy changed. Review the updated monitor terms.");
      if (org.emergencyStop?.active) throw appError("PAUSED", "All activity is paused. Check campaign pause results first.");
      if (cx.approval?.status === "approved" && !await authorizationProblem(ctx, cx)) return;
    }
    if (cx.approval?.status === "approved") await ctx.db.patch(cx.approval._id, { status: "invalidated", invalidatedReason: enabled ? "Replaced by a newly reviewed monitor" : "Monitor disabled by owner" });
    if (!enabled) {
      await ctx.db.patch(campaignId, { monitorNextAt: undefined, monitorCheckStartedAt: undefined, monitorStatus: "disabled", monitorMessage: "Monitoring stopped. This does not change the live campaign." });
    } else {
      const now = Date.now();
      const binding = { orgId: org._id, subjectType: "campaign_monitor" as const, subjectId: campaignId, actionKind: SPEND_MONITOR_ACTION, contentHash: cx.contentHash, scope: campaignApprovalScope(cx.campaign, cx.connection!.externalAccountId), policyVersion: cx.policy!.version, expiresAt: now + cx.durationHours * 3_600_000 };
      const approvalId = await ctx.db.insert("approvals", { ...binding, title: `Pause ${cx.campaign.name} at its approved total`, approvalHash: await approvalHash(binding), status: "approved", costEstimateMicros: 0, decidedBy: user._id, decidedAt: now, createdAt: now });
      await ctx.db.patch(campaignId, { monitorApprovalId: approvalId, monitorNextAt: now, monitorCheckStartedAt: undefined, monitorStatus: "waiting", monitorMessage: "Waiting for the first provider spend check.", monitorSpendMinor: undefined, monitorCheckedAt: undefined });
      await ctx.scheduler.runAfter(0, internal.adMonitoring.checkSpend, { campaignId });
    }
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: enabled ? "campaign.monitor_approved" : "campaign.monitor_disabled", subjectType: "campaign", subjectId: campaignId, summary: enabled ? `Approved a spend-limit pause for this exact campaign/account and total, valid for ${cx.durationHours} hours. Provider reporting and pause delays can exceed the planned budget.` : "Disabled future spend checks; no live campaign change." });
  },
});

export const tick = internalMutation({ args: {}, handler: async (ctx): Promise<number> => {
  const due = await ctx.db.query("campaigns").withIndex("by_monitor_due", q => q.gt("monitorNextAt", 0).lte("monitorNextAt", Date.now())).take(20);
  for (const c of due) await ctx.scheduler.runAfter(0, internal.adMonitoring.checkSpend, { campaignId: c._id });
  return due.length;
} });

export const claimCheck = internalMutation({ args: { campaignId: v.id("campaigns") }, handler: async (ctx, { campaignId }): Promise<Context | null> => {
  const cx = await context(ctx, campaignId);
  if (!cx || !cx.campaign.monitorNextAt || cx.campaign.monitorNextAt > Date.now() || cx.approval?.executionStartedAt !== undefined) return null;
  const problem = await authorizationProblem(ctx, cx);
  if (problem) { await stopWithReason(ctx, cx, problem); return null; }
  const now = Date.now();
  await ctx.db.patch(campaignId, { monitorCheckStartedAt: now, monitorNextAt: now + SPEND_MONITOR_INTERVAL_MS, monitorStatus: "checking" });
  return { ...cx, campaign: { ...cx.campaign, monitorCheckStartedAt: now } };
} });

export const observe = internalMutation({
  args: { campaignId: v.id("campaigns"), approvalId: v.id("approvals"), checkStartedAt: v.number(), spendMinor: v.optional(v.number()), timeZone: v.optional(v.string()), error: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Context | null> => {
    const cx = await context(ctx, args.campaignId);
    if (!cx || cx.campaign.monitorApprovalId !== args.approvalId || cx.campaign.monitorCheckStartedAt !== args.checkStartedAt || cx.approval?.executionStartedAt !== undefined) return null;
    const problem = await authorizationProblem(ctx, cx);
    if (problem) { await stopWithReason(ctx, cx, problem); return null; }
    const c = cx.campaign;
    let error = args.error;
    if (!error && (Date.now() - args.checkStartedAt > SPEND_MONITOR_FRESH_MS || args.checkStartedAt > Date.now() || !Number.isSafeInteger(args.spendMinor) || args.spendMinor! < 0 || !args.timeZone)) error = "The spend check was incomplete or took too long. No pause decision was made.";
    if (error) {
      await ctx.db.patch(c._id, { monitorStatus: "needs_review", monitorMessage: error.slice(0, 300), monitorCheckedAt: Date.now(), monitorSpendMinor: undefined, monitorCheckStartedAt: undefined, monitorNextAt: cx.org.kind === "demo" ? undefined : Date.now() + SPEND_MONITOR_INTERVAL_MS });
      if (c.monitorMessage !== error.slice(0, 300)) {
        await audit(ctx, { orgId: c.orgId, actorType: "system", action: "campaign.monitor_read_failed", subjectType: "campaign", subjectId: c._id, summary: error });
        await notifyOwners(ctx, c.orgId, `Spend check needs attention: ${error}`, "content?tab=ads");
      }
      return null;
    }
    const window = spendMonitorWindow(c.startDate, args.timeZone!, args.checkStartedAt);
    const breached = args.spendMinor! >= c.budgetEnvelopeMinor;
    await ctx.db.patch(c._id, { monitorStatus: breached ? "pause_pending" : "below_limit", monitorMessage: breached ? "The reported spend reached the approved total. Requesting a pause; outcome not yet confirmed." : "Reported spend is below the approved total. Provider reporting may lag.", monitorCheckedAt: Date.now(), monitorSpendMinor: args.spendMinor, monitorWindowStart: window.startDate, monitorWindowEnd: window.endDate, monitorTimeZone: args.timeZone, monitorCheckStartedAt: undefined, ...(breached ? { monitorNextAt: undefined } : {}) });
    if (!breached) return null;
    await ctx.db.patch(cx.approval!._id, { executionStartedAt: Date.now() });
    await audit(ctx, { orgId: c.orgId, actorType: "system", action: "campaign.monitor_pause_claimed", subjectType: "campaign", subjectId: c._id, summary: `Reported ${args.spendMinor} minor units (${c.currency}) for ${window.startDate}–${window.endDate}, at or above the approved ${c.budgetEnvelopeMinor}. Claimed one pause attempt.` });
    return cx;
  },
});

export const finishPause = internalMutation({
  args: { campaignId: v.id("campaigns"), approvalId: v.id("approvals"), status: v.union(v.literal("verified"), v.literal("failed"), v.literal("uncertain")), message: v.string(), reconciled: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<boolean> => {
    const c = await ctx.db.get(args.campaignId);
    const a = await ctx.db.get(args.approvalId);
    if (!c || !a || c.monitorApprovalId !== a._id || a.orgId !== c.orgId || a.subjectType !== "campaign_monitor" || a.subjectId !== c._id || a.actionKind !== SPEND_MONITOR_ACTION || a.executionStartedAt === undefined || (a.executionFinishedAt !== undefined && !args.reconciled)) return false;
    if (args.reconciled && c.monitorStatus === "paused") return false;
    if (args.reconciled) {
      await requireOrgAccess(ctx, { orgId: c.orgId }, "approve");
      if (Date.now() - a.executionStartedAt < SPEND_MONITOR_FRESH_MS || !["pause_pending", "uncertain"].includes(c.monitorStatus ?? "")) throw appError("INVALID", "This pause is not ready for reconciliation.");
    }
    const connection = c.connectionId ? await ctx.db.get(c.connectionId) : null;
    const matches = a.scope.connectionId === c.connectionId && a.scope.externalCampaignId === c.externalId && a.scope.externalAccountId === connection?.externalAccountId && connection?.orgId === c.orgId && connection.provider === (c.channel === "google_search_ad" ? "google_ads" : "meta_ads");
    const status = matches ? args.status : "uncertain";
    const message = matches ? args.message : "Campaign/account changed while pausing. Check the originally approved provider campaign; its result is unknown here.";
    await ctx.db.insert("actionReceipts", { orgId: c.orgId, campaignId: c._id, provider: c.channel === "google_search_ad" ? "google_ads" : "meta_ads", action: args.reconciled ? "reconcile_monitor_pause" : "monitor_pause", idempotencyKey: `${a._id}:${args.reconciled ? "reconcile" : "pause"}`, status, externalId: a.scope.externalCampaignId, summary: message.slice(0, 400), createdAt: Date.now(), ...(status === "verified" ? { verifiedAt: Date.now() } : {}) });
    await ctx.db.patch(a._id, { status: status === "verified" ? "consumed" : "invalidated", executionFinishedAt: Date.now(), ...(status !== "verified" ? { invalidatedReason: message.slice(0, 300) } : {}) });
    await ctx.db.patch(c._id, { monitorNextAt: undefined, monitorStatus: status === "verified" ? "paused" : status === "failed" ? "needs_review" : "uncertain", monitorMessage: message.slice(0, 300), ...(matches && status === "verified" ? { status: "paused" as const } : status === "uncertain" ? { status: "uncertain" as const } : {}) });
    await audit(ctx, { orgId: c.orgId, actorType: "system", action: `campaign.monitor_pause.${status}`, subjectType: "campaign", subjectId: c._id, summary: message });
    await notifyOwners(ctx, c.orgId, message, "content?tab=ads");
    return status === "verified";
  },
});

export const checkSpend = internalAction({ args: { campaignId: v.id("campaigns") }, handler: async (ctx, { campaignId }): Promise<void> => {
  const cx: Context | null = await ctx.runMutation(internal.adMonitoring.claimCheck, { campaignId });
  if (!cx) return;
  const c = cx.campaign;
  const connection = cx.connection!;
  const check = { campaignId, approvalId: cx.approval!._id, checkStartedAt: c.monitorCheckStartedAt! };
  let claimed = false;
  try {
    if (cx.org.kind === "demo" || connection.isFixture) throw new Error("Demo monitor only: no live spend is read and no real pause is sent.");
    if (connection.expiresAt && connection.expiresAt < Date.now() + SPEND_MONITOR_FRESH_MS) {
      const refreshed = await ctx.runAction(internal.connectionActions.refreshAccessToken, { connectionId: connection._id });
      if (!refreshed.ok) throw new Error("Reconnect the ad account before spend monitoring can continue.");
    }
    const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: connection._id });
    const token = accessToken(secret?.value);
    let timeZone: string;
    let spendMinor: number;
    const auth = { accessToken: token, developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "", customerId: connection.externalAccountId! };
    if (c.channel === "google_search_ad") {
      if (!auth.developerToken) throw new Error("Google Ads reporting is not configured on ClimbOS.");
      const account = await getCustomerSettings(auth);
      if (!account.ok || account.data.currencyCode !== c.currency) throw new Error("The Google account currency could not be verified against this approval.");
      timeZone = account.data.timeZone;
      const window = spendMonitorWindow(c.startDate, timeZone, check.checkStartedAt);
      const report = await getCampaignMetrics({ ...auth, campaignId: c.externalId!, ...window, maxPages: 2 });
      if (!report.ok) throw new Error("Google spend could not be read. Check the account connection and platform reporting.");
      spendMinor = googleMonitorSpend({ rows: report.data.items, truncated: report.data.truncated, campaignId: c.externalId!, currency: c.currency, ...window });
    } else {
      const account = await getAccountSpendCapUsage({ accessToken: token, adAccountId: connection.externalAccountId! });
      if (!account.ok || account.data.currency !== c.currency) throw new Error("The Meta account currency could not be verified against this approval.");
      timeZone = account.data.timeZone ?? "";
      const window = spendMonitorWindow(c.startDate, timeZone, check.checkStartedAt);
      const report = await getInsights({ accessToken: token, adAccountId: connection.externalAccountId!, since: window.startDate, until: window.endDate, level: "campaign", maxPages: 5 });
      if (!report.ok) throw new Error("Meta spend could not be read. Check the account connection and platform reporting.");
      spendMinor = metaMonitorSpend({ rows: report.data.items, truncated: report.data.truncated, campaignId: c.externalId!, currency: c.currency, ...window });
    }
    const approved: Context | null = await ctx.runMutation(internal.adMonitoring.observe, { ...check, spendMinor, timeZone });
    if (!approved) return;
    claimed = true;
    // The durable owner approval is revalidated by observe immediately before this adapter attestation.
    const approval = { approvedBy: String(approved.approval!.decidedBy), approvedAt: Date.now(), targetId: c.externalId!, value: "PAUSED" };
    const result = c.channel === "google_search_ad"
      ? await pauseGoogle({ ...auth, campaignId: c.externalId!, status: "PAUSED", approval: { ...approval, kind: GOOGLE_PAUSE } })
      : await pauseMeta({ accessToken: token, campaignId: c.externalId!, status: "PAUSED", approval: { ...approval, kind: META_PAUSE } });
    await ctx.runMutation(internal.adMonitoring.finishPause, { campaignId, approvalId: check.approvalId, status: result.status, message: result.status === "verified" ? "Spend-limit pause confirmed by the ad platform. Reporting and billing may still include delayed spend." : "The spend-limit pause was not confirmed. Check the campaign in the ad platform; no automatic retry will be sent." });
  } catch (error) {
    if (claimed) await ctx.runMutation(internal.adMonitoring.finishPause, { campaignId, approvalId: check.approvalId, status: "uncertain", message: "The pause attempt was interrupted. Check its provider result before any further campaign action." });
    else await ctx.runMutation(internal.adMonitoring.observe, { ...check, error: error instanceof Error ? error.message : "The spend check could not finish." });
  }
} });

export const reconciliationContext = internalQuery({ args: { slug: v.string(), campaignId: v.id("campaigns") }, handler: async (ctx, { slug, campaignId }): Promise<Context> => {
  const { org } = await requireOrgAccess(ctx, { slug }, "approve");
  assertSameOrg(await ctx.db.get(campaignId), org._id, "campaign");
  const cx = (await context(ctx, campaignId))!;
  const a = cx.approval;
  if (!a || a.orgId !== org._id || a.subjectType !== "campaign_monitor" || a.subjectId !== campaignId || a.actionKind !== SPEND_MONITOR_ACTION || a.executionStartedAt === undefined || Date.now() - a.executionStartedAt < SPEND_MONITOR_FRESH_MS || !["pause_pending", "uncertain"].includes(cx.campaign.monitorStatus ?? "")) throw appError("INVALID", "Wait for the pause attempt to finish before checking its result.");
  if (!cx.connection || cx.connection.orgId !== org._id || cx.connection.status !== "connected" || cx.connection.provider !== (cx.campaign.channel === "google_search_ad" ? "google_ads" : "meta_ads") || a.scope.connectionId !== cx.connection._id || a.scope.externalAccountId !== cx.connection.externalAccountId || a.scope.externalCampaignId !== cx.campaign.externalId) throw appError("INVALID", "The approved account changed. Check the original campaign in the ad platform.");
  return cx;
} });

/** Reconciliation only reads; an ACTIVE result never retries or restarts a write. */
export const reconcilePause = action({ args: { slug: v.string(), campaignId: v.id("campaigns") }, handler: async (ctx, args): Promise<{ paused: boolean }> => {
  const cx: Context = await ctx.runQuery(internal.adMonitoring.reconciliationContext, args);
  if (cx.org.kind === "demo" || cx.connection!.isFixture) throw appError("UNAVAILABLE", "Demo campaigns have no live pause result.");
  const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: cx.connection!._id });
  const token = accessToken(secret?.value);
  const c = cx.campaign;
  const result = c.channel === "google_search_ad"
    ? await getCampaignState({ accessToken: token, developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "", customerId: cx.connection!.externalAccountId!, campaignId: c.externalId! })
    : await getCampaign({ accessToken: token, campaignId: c.externalId! });
  if (!result.ok || !result.data || result.data.status !== "PAUSED") return { paused: false };
  const reportedId = "campaignId" in result.data ? result.data.campaignId : result.data.id;
  if (reportedId !== c.externalId) return { paused: false };
  // Recheck permission and exact destination after the provider read as well.
  await ctx.runQuery(internal.adMonitoring.reconciliationContext, args);
  const paused: boolean = await ctx.runMutation(internal.adMonitoring.finishPause, { campaignId: c._id, approvalId: cx.approval!._id, status: "verified", message: "A read-only provider check confirmed this campaign is paused. No new pause request was sent.", reconciled: true });
  return { paused };
} });
