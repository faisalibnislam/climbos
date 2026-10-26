import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Recover jobs whose action died: model steps fail, provider writes become "uncertain".
crons.interval("recover stuck runs", { minutes: 5 }, internal.engine.recoverStuckRuns, {});
// Reprocess Polar webhooks that failed (bounded attempts).
crons.interval("retry failed webhooks", { minutes: 15 }, internal.billing.retryFailedWebhooks, {});
// Authoritative subscription reconciliation with Polar.
crons.daily("reconcile billing", { hourUTC: 4, minuteUTC: 10 }, internal.billing.reconcileAll, {});
crons.daily("delete businesses past their restore window", { hourUTC: 4, minuteUTC: 40 }, internal.settings.purgeExpiredRemovals, {});
crons.daily("team cleanup", { hourUTC: 4, minuteUTC: 40 }, internal.team.cleanup, {});
// Hourly, renewing a little before each month ends, so a comp never has a gap without credits.
crons.interval("renew complimentary packages", { minutes: 60 }, internal.admin.renewComps, {});
// Staff dashboard snapshot (paged reads; the page itself reads one row).
crons.interval("refresh staff dashboard", { minutes: 30 }, internal.admin.refreshDashboard, {});
// Retention: raw scrape payloads 30 days; previews 30 days; demo workspaces 7 days.
crons.daily("purge raw research", { hourUTC: 5, minuteUTC: 0 }, internal.maintenance.purgeExpiredSources, {});
crons.daily("purge expired tenant research cache", { hourUTC: 5, minuteUTC: 5 }, internal.engine.purgeExpiredResearchCache, {});
crons.daily("purge previews", { hourUTC: 5, minuteUTC: 15 }, internal.preview.purgeExpired, {});
crons.daily("purge website audit screenshots", { hourUTC: 5, minuteUTC: 17 }, internal.maintenance.purgeWebsiteAuditScreenshots, {});
crons.daily("purge link click dedupe", { hourUTC: 5, minuteUTC: 20 }, internal.links.pruneClickIps, {});
crons.daily("expire demos", { hourUTC: 5, minuteUTC: 30 }, internal.demo.expireDemos, {});
crons.daily("retention: detailed activity", { hourUTC: 5, minuteUTC: 45 }, internal.maintenance.purgeOldActivity, {});
crons.daily("retention: push outbox", { hourUTC: 5, minuteUTC: 50 }, internal.push.cleanupOutbox, {});
// Sync connected analytics/revenue sources.
crons.daily("sync connections", { hourUTC: 6, minuteUTC: 0 }, internal.maintenance.syncAll, {});
// Token expiry: mark connections needing action before they break.
crons.daily("check token expiry", { hourUTC: 6, minuteUTC: 30 }, internal.maintenance.checkExpiry, {});
// Social autopilot: plan next week for each enabled workspace (Thursday 9:00 local or later).
crons.interval("autopilot planning", { minutes: 60 }, internal.autopilot.tick, {});
// Scheduled custom-agent runs only prepare reviewable action cards; engine budgets still apply.
crons.interval("scheduled specialist profiles", { minutes: 15 }, internal.customAgents.runScheduled, {});
crons.interval("outbound: send due emails", { minutes: 5 }, internal.outboundSending.dispatch, {});
crons.interval("push notifications", { minutes: 2 }, internal.push.fanout, {});
crons.interval("status sample", { minutes: 5 }, internal.status.sample, {});
crons.interval("booking reminders", { minutes: 15 }, internal.bookings.sendReminders, {});
crons.interval("webhook deliveries", { minutes: 1 }, internal.webhooks.deliverDue, {});
crons.interval("connected products sync", { minutes: 15 }, internal.airlyActions.syncAll, {});
// Self-improvement loop 2: refresh first-party rates every Sunday night.
// Self-improvement loop 1: re-read each business's own site weekly.
crons.weekly("site watch", { dayOfWeek: "monday", hourUTC: 6, minuteUTC: 0 }, internal.siteWatchActions.weekly, {});
// Self-improvement loop 3: propose playbook rules from recent reviews (tested/approved in /ops).
crons.weekly("engine lab proposals", { dayOfWeek: "tuesday", hourUTC: 2, minuteUTC: 0 }, internal.engineLabActions.proposeWeekly, {});
crons.weekly("learn from results", { dayOfWeek: "sunday", hourUTC: 23, minuteUTC: 0 }, internal.learning.recompute, {});
crons.interval("outbound: read replies and bounces", { minutes: 15 }, internal.mailbox.checkReplies, {});
// One-tap approvals: a daily email of drafts waiting for the owner.
crons.daily("approvals waiting", { hourUTC: 14, minuteUTC: 0 }, internal.emailActions.sendApprovalEmails, {});
// Owner digests at the frequency each user selected.
crons.daily("digests", { hourUTC: 13, minuteUTC: 0 }, internal.maintenance.sendDigests, {});
// Competitor watch: Monday mornings, before the weekly report.
crons.weekly("competitor watch", { dayOfWeek: "monday", hourUTC: 7, minuteUTC: 0 }, internal.competitors.weekly, {});
crons.daily("refresh due competitor research", { hourUTC: 8, minuteUTC: 15 }, internal.competitorDiscovery.refreshDue, {});
// Recheck only previously fetched sources due under the registry cadence; changes remain staff-review proposals.
crons.daily("refresh due growth knowledge sources", { hourUTC: 8, minuteUTC: 30 }, internal.knowledgeRefreshCron.refreshDue, {});

export default crons;
