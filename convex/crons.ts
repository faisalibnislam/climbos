import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Recover jobs whose action died: model steps fail, provider writes become "uncertain".
crons.interval("recover stuck runs", { minutes: 5 }, internal.engine.recoverStuckRuns, {});
// Reprocess Polar webhooks that failed (bounded attempts).
crons.interval("retry failed webhooks", { minutes: 15 }, internal.billing.retryFailedWebhooks, {});
// Authoritative subscription reconciliation with Polar.
crons.daily("reconcile billing", { hourUTC: 4, minuteUTC: 10 }, internal.billing.reconcileAll, {});
crons.daily("team cleanup", { hourUTC: 4, minuteUTC: 40 }, internal.team.cleanup, {});
crons.daily("renew complimentary packages", { hourUTC: 4, minuteUTC: 20 }, internal.admin.renewComps, {});
// Retention: raw scrape payloads 30 days; previews 30 days; demo workspaces 7 days.
crons.daily("purge raw research", { hourUTC: 5, minuteUTC: 0 }, internal.maintenance.purgeExpiredSources, {});
crons.daily("purge previews", { hourUTC: 5, minuteUTC: 15 }, internal.preview.purgeExpired, {});
crons.daily("expire demos", { hourUTC: 5, minuteUTC: 30 }, internal.demo.expireDemos, {});
crons.daily("retention: detailed activity", { hourUTC: 5, minuteUTC: 45 }, internal.maintenance.purgeOldActivity, {});
// Sync connected analytics/revenue sources.
crons.daily("sync connections", { hourUTC: 6, minuteUTC: 0 }, internal.maintenance.syncAll, {});
// Token expiry: mark connections needing action before they break.
crons.daily("check token expiry", { hourUTC: 6, minuteUTC: 30 }, internal.maintenance.checkExpiry, {});
// Social autopilot: plan next week for each enabled workspace (Thursday 9:00 local or later).
crons.interval("autopilot planning", { minutes: 60 }, internal.autopilot.tick, {});
crons.interval("outbound: send due emails", { minutes: 5 }, internal.outboundSending.dispatch, {});
crons.interval("outbound: read replies and bounces", { minutes: 15 }, internal.mailbox.checkReplies, {});
// One-tap approvals: a daily email of drafts waiting for the owner.
crons.daily("approvals waiting", { hourUTC: 14, minuteUTC: 0 }, internal.emailActions.sendApprovalEmails, {});
// Owner digests at the frequency each user selected.
crons.daily("digests", { hourUTC: 13, minuteUTC: 0 }, internal.maintenance.sendDigests, {});

export default crons;
