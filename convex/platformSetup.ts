import { v } from "convex/values";
import { APPROVAL_STATUSES, PLATFORM_APPROVALS, approvalStatus, type PlatformApprovalKey, type PlatformApprovalStatus } from "../shared/integrations/platformApprovals";
import { GUIDES_VERIFIED_AT, SETUP_GUIDES, redirectUrlFor } from "../shared/integrations/setupGuides";
import { mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { getPlatformApprovals, PLATFORM_APPROVALS_KEY } from "./lib/platformApprovals";
import { requireStaff, staffCan } from "./lib/staff";
import { appError } from "./lib/tenancy";

/** Console: per-platform setup guide with live env status (names only) and recorded approvals. */
export const guide = query({
  args: {},
  handler: async (ctx) => {
    const { role } = await requireStaff(ctx, "read");
    const approvals = await getPlatformApprovals(ctx);
    const redirectUrl = redirectUrlFor(process.env.SITE_URL);
    return {
      verifiedAt: GUIDES_VERIFIED_AT,
      redirectUrl,
      siteUrlSet: Boolean(process.env.SITE_URL),
      canEdit: staffCan(role, "operate"),
      platforms: SETUP_GUIDES.map((g) => {
        // Presence only: values never leave the server.
        const env = g.env.map((e) => ({ ...e, configured: Boolean(process.env[e.name]?.trim()) }));
        return {
          ...g,
          steps: g.steps.map((step) => step.replaceAll("{redirectUrl}", redirectUrl)),
          env,
          ready: env.every((e) => e.optional || e.configured),
          approvals: g.approvals.map((key) => {
            const def = PLATFORM_APPROVALS[key];
            const status = approvalStatus(approvals, key);
            return { key, label: def.label, status, statusLabel: def.statusLabels[status], statusLabels: def.statusLabels, pendingNote: def.pendingNote };
          }),
        };
      }),
    };
  },
});

/** Record a provider approval status. It changes what owners see as ready, never any secret. */
export const setApproval = mutation({
  args: { key: v.string(), status: v.string() },
  handler: async (ctx, { key, status }) => {
    const { user } = await requireStaff(ctx, "operate");
    if (!(key in PLATFORM_APPROVALS)) throw appError("INVALID", "Unknown approval.");
    if (!(APPROVAL_STATUSES as readonly string[]).includes(status)) throw appError("INVALID", "Unknown status.");
    const approvalKey = key as PlatformApprovalKey;
    const next = status as PlatformApprovalStatus;
    const current = await getPlatformApprovals(ctx);
    const before = approvalStatus(current, approvalKey);
    if (before === next) return;
    const value = JSON.stringify({ ...current, [approvalKey]: next });
    const row = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", PLATFORM_APPROVALS_KEY))
      .unique();
    const now = Date.now();
    if (row) await ctx.db.patch(row._id, { value, updatedBy: user._id, updatedAt: now });
    else await ctx.db.insert("appConfig", { key: PLATFORM_APPROVALS_KEY, value, updatedBy: user._id, updatedAt: now });
    const def = PLATFORM_APPROVALS[approvalKey];
    await audit(ctx, {
      actorType: "operator",
      actorId: user._id,
      action: "admin.platform_approval",
      subjectType: "platform_approval",
      subjectId: approvalKey,
      summary: `${def.label}: ${def.statusLabels[before]} → ${def.statusLabels[next]}.`,
    });
  },
});
