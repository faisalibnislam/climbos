import { z } from "zod";
import type { FunctionReference } from "convex/server";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { microsToCredits } from "../../shared/economics";
import { estimateJobMicros, planJob } from "./jobPlans";
import { CalcToolInput, calculate } from "../../shared/analysis/decisions";

/**
 * Climb AI's tools: one registry for the in-app side panel and the MCP server.
 * Every tool calls the same public ClimbOS function the UI uses, through a
 * caller that carries the person's own identity, so permissions, approval
 * binding, metering and audit are identical to clicking in the app.
 *
 * Risk tiers:
 * - read:    looks things up. Runs straight away.
 * - draft:   prepares work (drafts, plans, screenshots) that nothing publishes. Runs straight away.
 * - confirm: publishes, schedules, approves, spends or changes settings. Always waits for a tap.
 * - ui:      moves or highlights the owner's screen (in-app only).
 */

export type Risk = "read" | "draft" | "confirm" | "ui";

export interface Caller {
  query: <F extends FunctionReference<"query">>(fn: F, args: F["_args"]) => Promise<F["_returnType"]>;
  mutation: <F extends FunctionReference<"mutation">>(fn: F, args: F["_args"]) => Promise<F["_returnType"]>;
}

export interface ClimbTool<I extends z.ZodType = z.ZodType> {
  name: string;
  title: string;
  description: string;
  risk: Risk;
  input: I;
  /** Validates the semantic result before it is passed back to the model. */
  output?: z.ZodType;
  /** Plain-English summary of what will happen (shown on confirmation cards), in the workspace's timezone. */
  summarize?: (input: z.infer<I>, ctx?: { timeZone?: string }) => string;
  /** Narration while it runs, e.g. "Looking at your drafts". */
  doing: string;
  run?: (c: Caller, slug: string, input: z.infer<I>) => Promise<unknown>;
  /** Pure tools (no workspace data): the same function runs here, in MCP and in the evaluation harness. */
  local?: (input: z.infer<I>) => unknown;
}

const artifactId = z.string().describe("Draft id (from list_drafts or the screen selection)");
const CHANNELS = ["instagram", "facebook", "linkedin", "x", "tiktok", "pinterest", "youtube"] as const;

function short(s: unknown, n = 280): string {
  return typeof s === "string" ? (s.length > n ? `${s.slice(0, n)}…` : s) : "";
}

const tool = <I extends z.ZodType>(t: ClimbTool<I>) => t as unknown as ClimbTool;

const CalcOutputSchema = z.union([
  z.object({ error: z.string() }),
  z.object({ price: z.number(), totalCost: z.number(), contribution: z.number(), contributionMargin: z.number().nullable(), markupOnCost: z.number().nullable(), costBoundary: z.string(), meetsTarget: z.boolean().nullable(), notes: z.array(z.string()) }),
  z.object({ floor: z.number(), marginAtStated: z.number().nullable(), gap: z.number().nullable(), notes: z.array(z.string()) }),
  z.object({ controlRate: z.number(), treatmentRate: z.number(), absoluteChange: z.number(), relativeChange: z.number().nullable(), pValue: z.number(), method: z.enum(["fisher_exact", "two_proportion_z"]), verdict: z.enum(["no_reliable_difference", "difference_detected", "too_early"]), differenceInterval: z.tuple([z.number(), z.number()]), practical: z.enum(["worth_acting", "harmful", "flat", "small_but_real", "inconclusive"]).optional(), notes: z.array(z.string()) }),
  z.object({ expected: z.array(z.number()), chiSquare: z.number(), pValue: z.number(), mismatch: z.boolean(), warning: z.boolean(), overArm: z.number().nullable(), checklist: z.array(z.string()), notes: z.array(z.string()) }),
  z.object({ perArm: z.number(), total: z.number(), weeks: z.number().nullable(), notes: z.array(z.string()) }),
  z.object({ change: z.number(), relativeChange: z.number().nullable(), label: z.literal("observed"), notes: z.array(z.string()) }),
]);
const DraftListOutputSchema = z.array(z.object({ id: z.string(), title: z.string(), channel: z.string(), kind: z.string(), status: z.string(), scheduledFor: z.string().nullable() }));
const DraftReadOutputSchema = z.object({ id: z.string(), title: z.string(), channel: z.string(), status: z.string(), scheduledFor: z.string().nullable(), version: z.number().optional(), headline: z.string().nullable().optional(), body: z.string().optional(), callToAction: z.string().nullable().optional(), hashtags: z.array(z.string()).optional(), image: z.string().nullable().optional(), unsupportedClaims: z.array(z.string()).optional() });
const HttpUrlSchema = z.string().url().refine((value) => {
  return isHttpUrl(value);
}, "Expected an HTTP(S) URL");
const ImageListOutputSchema = z.object({ website: z.string().nullable(), images: z.array(z.object({ id: z.string(), kind: z.string(), view: z.string().nullable(), label: z.string(), product: z.json().nullable() })) });
const InboxOutputSchema = z.object({ open: z.number().int().nonnegative(), items: z.array(z.object({ id: z.string(), kind: z.string(), from: z.string(), email: z.string().nullable(), text: z.string(), status: z.string(), hasDraftReply: z.boolean() })) });
const PipelineOutputSchema = z.object({ totals: z.object({ open: z.number(), wonValue: z.number(), pipelineValue: z.number(), currency: z.string() }), deals: z.array(z.object({ name: z.string(), company: z.string().nullable(), stage: z.string(), value: z.number().nullable(), currency: z.string(), nextStep: z.string().nullable(), nextStepAt: z.string().nullable(), source: z.string() })) });
const CompetitorsOutputSchema = z.object({ watching: z.array(z.object({ name: z.string(), url: HttpUrlSchema })), changes: z.array(z.json()) });
const LinksOutputSchema = z.object({ weekTotal: z.number(), links: z.array(z.object({ label: z.string(), url: HttpUrlSchema, clicks: z.number(), week: z.number() })) });
const OverviewOutputSchema = z.object({ business: z.json(), goal: z.json(), plan: z.json(), waitingForApproval: z.array(z.object({ id: z.string(), title: z.string(), channel: z.string() })), approvalsCount: z.number(), next: z.array(z.json()), recentJobs: z.array(z.object({ id: z.string(), title: z.string(), status: z.string() })), paused: z.boolean() });
const PlanOutputSchema = z.object({ goal: z.json(), plan: z.json().optional(), status: z.string().optional(), summary: z.string().optional(), diagnosis: z.string().optional(), northStar: z.json().optional(), plays: z.array(z.json()).optional(), weekOne: z.array(z.string()).optional(), channels: z.array(z.object({ name: z.string(), priority: z.number(), status: z.string() })).optional(), experiments: z.array(z.object({ name: z.string(), status: z.string() })).optional() });
const AutopilotOutputSchema = z.object({ settings: z.json(), trust: z.array(z.json()), connected: z.array(z.string()), weeks: z.array(z.object({ weekOf: z.string(), theme: z.string().optional(), slots: z.array(z.object({ id: z.string(), channel: z.string(), when: z.string(), idea: z.string(), status: z.string(), draftId: z.string().nullable() })) })) });
const JobOutputSchema = z.object({ id: z.string(), title: z.string(), kind: z.string(), status: z.string(), roles: z.array(z.string()), brief: z.string().nullable(), createdAt: z.number(), updatedAt: z.number(), estimateMicros: z.number(), actualMicros: z.number(), userMessage: z.string().nullable(), isFixture: z.boolean(), engine: z.string().nullable(), output: z.string().nullable(), steps: z.array(z.object({ label: z.string(), status: z.string(), role: z.string().nullable(), kind: z.string() })), artifacts: z.array(z.object({ id: z.string(), title: z.string(), channel: z.string(), status: z.string(), kind: z.string() })) });
const ProspectOutputSchema = z.object({ status: z.string(), icp: z.string().nullable(), prospects: z.array(z.object({ id: z.string(), company: z.string(), why: z.string(), stage: z.string(), fit: z.json(), timing: z.json() })), emails: z.array(z.object({ day: z.number(), subject: z.string() })), bookingPage: z.string().nullable(), upcomingCalls: z.array(z.object({ name: z.string(), company: z.string().nullable(), when: z.string() })), pipeline: z.json() });
const WeeklyReportOutputSchema = z.object({ weekStart: z.number(), weekEnd: z.number(), headline: z.string(), lines: z.array(z.object({ key: z.string(), label: z.string(), value: z.number(), change: z.number().nullable() })), next: z.array(z.string()), competitors: z.array(z.object({ name: z.string(), summary: z.string(), sourceUrls: z.array(HttpUrlSchema).optional(), observedAt: z.number().optional() })).optional() });
const RunIdOutputSchema = z.object({ runId: z.string() });
const CampaignStartOutputSchema = z.object({ campaignId: z.string(), pausedSending: z.boolean() });
const SavedDraftOutputSchema = z.object({ saved: z.literal(true), note: z.string() });
const OkOutputSchema = z.object({ ok: z.boolean() });

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** URL-bearing fields from tools must not smuggle script, data, or credential URLs into either agent surface. */
function validateToolUrls(value: unknown, path = "tool result"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateToolUrls(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const urlField = key.toLowerCase() === "website" || /urls?$/i.test(key);
    if (urlField && child !== null) {
      const values = Array.isArray(child) ? child : [child];
      if (values.some((item) => typeof item !== "string" || !isHttpUrl(item))) {
        throw new Error(`The tool returned an unsafe URL in ${path}.${key}.`);
      }
    } else {
      validateToolUrls(child, `${path}.${key}`);
    }
  }
}

/** Validate and bound tool results before they re-enter the model context as untrusted data. */
export function encodeToolOutput(output: unknown, maxChars = 7_800, outputSchema?: z.ZodType): string {
  let normalized: unknown;
  try {
    const encoded = JSON.stringify(output ?? { ok: true }, (_key, value: unknown) => {
      if (typeof value === "number" && !Number.isFinite(value)) throw new Error("non-finite number");
      if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") throw new Error("non-JSON value");
      return value;
    });
    if (typeof encoded !== "string") throw new Error("empty result");
    normalized = JSON.parse(encoded);
  } catch {
    throw new Error("The tool returned data that cannot be safely passed to the agent.");
  }
  const checked = z.json().safeParse(normalized);
  if (!checked.success) throw new Error("The tool returned data that cannot be safely passed to the agent.");
  validateToolUrls(checked.data);
  const semantic = outputSchema?.safeParse(checked.data);
  if (semantic && !semantic.success) throw new Error("The tool returned data that did not match its output contract.");
  // Escape '<' so untrusted tool text cannot close the surrounding trust boundary.
  const safe = JSON.stringify(semantic?.success ? semantic.data : checked.data).replace(/</g, "\\u003c");
  if (safe.length <= maxChars) return safe;
  const previewChars = Math.max(0, maxChars - 100);
  return JSON.stringify({ truncated: true, preview: safe.slice(0, previewChars), note: "Tool result exceeded the context limit; preview only." });
}

/** A time as the owner reads it: in the workspace's timezone (UTC if it's unknown). */
export function localTime(ms: number, timeZone = "UTC"): string {
  const fmt = (tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(ms));
  try {
    return fmt(timeZone);
  } catch {
    return fmt("UTC");
  }
}

export const CLIMB_TOOLS: ClimbTool[] = [
  /* ---------------- read ---------------- */
  tool({
    name: "calculate",
    title: "Calculate",
    description:
      "Exact maths for money and test questions: margin (contribution and margin at a price under listed costs), price_floor (lowest price for a target margin vs stated willingness to pay), compare_rates (two conversion rates: percentage points, relative change, p-value, verdict), sample_ratio (does an A/B split match its plan), sample_size (visitors and weeks a test needs), before_after (an observed change and what else changed). Use it instead of doing the arithmetic yourself, and say what the result can't show.",
    risk: "read",
    doing: "Working out the numbers",
    input: CalcToolInput,
    output: CalcOutputSchema,
    local: calculate,
    run: async (_c, _slug, input) => calculate(input),
  }),
  tool({
    name: "get_overview",
    title: "Workspace overview",
    description: "Today's state: goal, plan status, drafts waiting for approval, what the team is working on, recent jobs and next steps.",
    risk: "read",
    doing: "Checking today's overview",
    input: z.object({}),
    output: OverviewOutputSchema,
    run: async (c, slug) => {
      const t = await c.query(api.workspace.today, { slug });
      return {
        business: t.business,
        goal: t.goal,
        plan: t.strategy ? { status: t.strategy.status, version: t.strategy.version, summary: short(t.strategy.summary, 400) } : null,
        waitingForApproval: t.approvals.map((a) => ({ id: a.id, title: a.title, channel: a.channel })),
        approvalsCount: t.approvalsCount,
        next: t.next,
        recentJobs: t.recent.slice(0, 8).map((r) => ({ id: r.id, title: r.title, status: r.status })),
        paused: Boolean(t.emergencyStop),
      };
    },
  }),
  tool({
    name: "list_drafts",
    title: "List drafts",
    description: "Content items (posts, ads, emails, pages), newest first. Filter by status: in_review (waiting for approval), approved, scheduled, published, draft, failed.",
    risk: "read",
    doing: "Looking at your content",
    input: z.object({ status: z.enum(["draft", "in_review", "approved", "scheduled", "published", "failed"]).optional(), limit: z.number().optional() }),
    output: DraftListOutputSchema,
    run: async (c, slug, i) => {
      const page = await c.query(api.content.list, { slug, status: i.status, paginationOpts: { numItems: Math.min(i.limit ?? 12, 25), cursor: null } });
      return (page.page as { id: string; title: string; channel: string; status: string; scheduledFor?: number | null; kind: string }[]).map((a) => ({ id: a.id, title: a.title, channel: a.channel, kind: a.kind, status: a.status, scheduledFor: a.scheduledFor ? new Date(a.scheduledFor).toISOString() : null }));
    },
  }),
  tool({
    name: "get_draft",
    title: "Read a draft",
    description: "Full text, image, status and approval state of one content item.",
    risk: "read",
    doing: "Reading the draft",
    input: z.object({ artifactId }),
    output: DraftReadOutputSchema,
    run: async (c, slug, i) => {
      const d = await c.query(api.content.get, { slug, artifactId: i.artifactId as Id<"artifacts"> });
      const v = d.current as { body: string; headline: string | null; callToAction: string | null; hashtags: string[]; imageLabel: string | null; unsupportedClaims: string[]; version: number } | null;
      return { id: d.id, title: d.title, channel: d.channel, status: d.status, scheduledFor: d.scheduledFor ? new Date(d.scheduledFor).toISOString() : null, version: v?.version, headline: v?.headline, body: v?.body, callToAction: v?.callToAction, hashtags: v?.hashtags, image: v?.imageLabel, unsupportedClaims: v?.unsupportedClaims };
    },
  }),
  tool({
    name: "get_plan",
    title: "Growth plan",
    description: "The current growth plan: summary, diagnosis, North Star, growth plays with forecasts and tests, channels, experiments, this week's checklist.",
    risk: "read",
    doing: "Reading your growth plan",
    input: z.object({}),
    output: PlanOutputSchema,
    run: async (c, slug) => {
      const p = await c.query(api.workspace.plan, { slug });
      const s = p.strategy;
      if (!s) return { plan: null, goal: p.goal };
      const x = s.expert as { diagnosis?: string; northStar?: unknown; plays?: { name: string; kind: string; oneLiner: string; forecast?: { p10: number; p50: number; p90: number; unit: string } }[]; weekOneChecklist?: string[] } | null;
      return {
        goal: p.goal,
        status: s.status,
        summary: short(s.summary, 600),
        diagnosis: x?.diagnosis,
        northStar: x?.northStar,
        plays: x?.plays?.map((pl) => ({ name: pl.name, kind: pl.kind, oneLiner: pl.oneLiner, forecast: pl.forecast ? `${pl.forecast.p10}–${pl.forecast.p90} ${pl.forecast.unit} (likely ${pl.forecast.p50})` : null })),
        weekOne: x?.weekOneChecklist,
        channels: s.channels.map((ch) => ({ name: ch.name, priority: ch.priority, status: ch.status })),
        experiments: p.experiments.map((e) => ({ name: e.name, status: e.status })),
      };
    },
  }),
  tool({
    name: "get_results",
    title: "Results",
    description: "Business results over the last N days (traffic, leads, sales and what the team attributes to which channel), with data freshness.",
    risk: "read",
    doing: "Checking your results",
    input: z.object({ days: z.number().optional() }),
    run: async (c, slug, i) => c.query(api.analytics.overview, { slug, days: i.days ?? 30 }),
  }),
  tool({
    name: "get_autopilot",
    title: "Social autopilot",
    description: "Autopilot settings, trust ladder per channel, and this and next week's planned posts with their status.",
    risk: "read",
    doing: "Checking autopilot",
    input: z.object({}),
    output: AutopilotOutputSchema,
    run: async (c, slug) => {
      const a = await c.query(api.autopilot.get, { slug });
      return {
        settings: a.settings,
        trust: a.trust.filter((t) => t.streak > 0 || t.unlocked),
        connected: a.connected,
        weeks: a.weeks.map((w) => ({ weekOf: w.weekOf, theme: w.plan?.theme, slots: w.slots.map((s) => ({ id: s.id, channel: s.channel, when: new Date(s.slotAt).toISOString(), idea: short(s.idea, 140), status: s.status, draftId: s.artifact?.id ?? null })) })),
      };
    },
  }),
  tool({
    name: "list_images",
    title: "Image library",
    description: "The workspace's real images: website screenshots, product photos, uploads and AI images (ids, labels, kind).",
    risk: "read",
    doing: "Looking at your images",
    input: z.object({ kind: z.enum(["screenshot", "product_photo", "upload", "ai_image"]).optional() }),
    output: ImageListOutputSchema,
    run: async (c, slug, i) => {
      const l = await c.query(api.assets.list, { slug, kind: i.kind });
      return { website: l.website, images: l.assets.slice(0, 40).map((a) => ({ id: a.id, kind: a.kind, view: a.view, label: a.label, product: a.product })) };
    },
  }),
  tool({
    name: "get_job",
    title: "Job result",
    description: "What one job (run) produced: status, steps, drafts it created, output and cost.",
    risk: "read",
    doing: "Checking that job",
    input: z.object({ runId: z.string() }),
    output: JobOutputSchema,
    run: async (c, slug, i) => {
      const r = await c.query(api.workspace.runDetail, { slug, runId: i.runId as Id<"workflowRuns"> });
      return { ...r, output: r.output ? short(JSON.stringify(r.output), 3000) : null };
    },
  }),

  tool({
    name: "get_prospects",
    title: "Prospects and calls",
    description: "Find-customers status: the ideal customer, prospects (id, company, why, stage, score), the booking page and upcoming calls.",
    risk: "read",
    doing: "Checking your prospects",
    input: z.object({}),
    output: ProspectOutputSchema,
    run: async (c, slug) => {
      const o = await c.query(api.outbound.get, { slug });
      return {
        status: o.campaign?.status ?? "none",
        icp: o.campaign?.icp?.summary ?? null,
        prospects: o.prospects.slice(0, 40).map((p) => ({ id: p.id, company: p.company, why: short(p.why, 140), stage: p.stage, fit: p.fit, timing: p.timing })),
        emails: o.campaign?.sequence.map((s) => ({ day: s.day, subject: s.subject })) ?? [],
        bookingPage: o.page ? `/book/${o.page.slug}` : null,
        upcomingCalls: o.bookings.map((b) => ({ name: b.name, company: b.company, when: new Date(b.startAt).toISOString() })),
        pipeline: o.funnel,
      };
    },
  }),

  tool({
    name: "get_inbox",
    title: "Inbox",
    description: "Open messages that need the owner: email replies to outreach, website chats, landing-page and link-in-bio leads, bookings and reviews (id, from, kind, text, status).",
    risk: "read",
    doing: "Checking your inbox",
    input: z.object({}),
    output: InboxOutputSchema,
    run: async (c, slug) => {
      const items = await c.query(api.inbox.list, { slug, box: "open" });
      return { open: items.length, items: items.slice(0, 25).map((m) => ({ id: m.id, kind: m.kind, from: m.from, email: m.fromEmail, text: short(m.text, 240), status: m.status, hasDraftReply: Boolean(m.suggestedReply) })) };
    },
  }),

  tool({
    name: "get_pipeline",
    title: "Pipeline",
    description: "Everyone the business is talking to, by stage (lead, talking, booked, won, lost), with deal values, next steps and totals.",
    risk: "read",
    doing: "Checking your pipeline",
    input: z.object({}),
    output: PipelineOutputSchema,
    run: async (c, slug) => {
      const p = await c.query(api.crm.list, { slug });
      return { totals: p.totals, deals: p.deals.slice(0, 40).map((d) => ({ name: d.name, company: d.company, stage: d.stage, value: d.value ? d.value / 100 : null, currency: d.currency, nextStep: d.nextStep, nextStepAt: d.nextStepAt ? new Date(d.nextStepAt).toISOString() : null, source: d.source })) };
    },
  }),

  tool({
    name: "get_weekly_report",
    title: "Weekly report",
    description: "This week's (or a past week's) outcomes vs the week before, competitor changes and what needs the owner.",
    risk: "read",
    doing: "Reading the weekly report",
    input: z.object({ weeksAgo: z.number().optional() }),
    output: WeeklyReportOutputSchema,
    run: async (c, slug, i) => c.query(api.reports.weekly, { slug, weeksAgo: i.weeksAgo }),
  }),

  tool({
    name: "get_competitors",
    title: "Competitor watch",
    description: "Competitors being watched and the latest real changes on their sites (prices, offers, features) with what to do about them.",
    risk: "read",
    doing: "Checking your competitors",
    input: z.object({}),
    output: CompetitorsOutputSchema,
    run: async (c, slug) => {
      const o = await c.query(api.competitors.overview, { slug });
      return { watching: o.watches.map((w) => ({ name: w.name, url: w.url })), changes: o.changes.slice(0, 10) };
    },
  }),

  tool({
    name: "get_links",
    title: "Tracked links",
    description: "Tracked short links and their human clicks (total and this week).",
    risk: "read",
    doing: "Checking your link clicks",
    input: z.object({}),
    output: LinksOutputSchema,
    run: async (c, slug) => {
      const l = await c.query(api.links.list, { slug });
      return { weekTotal: l.weekTotal, links: l.links.slice(0, 30).map((x) => ({ label: x.label, url: x.url.split("?")[0], clicks: x.clicks, week: x.week })) };
    },
  }),

  /* ---------------- draft (prepares work, nothing goes live) ---------------- */
  tool({
    name: "find_customers",
    title: "Find customers",
    description: "Research companies that need this business (public web, with evidence) and write the cold emails. Nothing is sent.",
    risk: "draft",
    doing: "Finding customers",
    input: z.object({ who: z.string().optional(), where: z.string().optional(), count: z.number().optional() }),
    output: CampaignStartOutputSchema,
    run: async (c, slug, i) => c.mutation(api.outbound.start, { slug, who: i.who, where: i.where, count: i.count }),
  }),
  tool({
    name: "review_prospects",
    title: "Approve or skip prospects",
    description: "Mark prospects approved (ready to email) or skipped. Only changes the list; nothing is sent.",
    risk: "draft",
    doing: "Updating your prospect list",
    input: z.object({ prospectIds: z.array(z.string()), stage: z.enum(["approved", "skipped"]) }),
    output: OkOutputSchema,
    run: async (c, slug, i) => c.mutation(api.outbound.setStage, { slug, prospectIds: i.prospectIds as Id<"prospects">[], stage: i.stage }),
  }),

  tool({
    name: "create_posts",
    title: "Draft social posts",
    description: "Write social posts for one channel. Use `brief` for the owner's specifics (topic, offer, dates, tone). Optionally build them around real images by id (from list_images). Nothing is published.",
    risk: "draft",
    doing: "Drafting posts",
    input: z.object({ channel: z.enum(CHANNELS), quantity: z.number().min(1).max(6), brief: z.string(), imageIds: z.array(z.string()).optional() }),
    output: RunIdOutputSchema,
    run: async (c, slug, i) => {
      if (i.imageIds?.length) return c.mutation(api.assets.makePosts, { slug, assetIds: i.imageIds as Id<"assets">[], channel: i.channel, brief: i.brief });
      return c.mutation(api.content.generate, { slug, job: "content_social", channel: i.channel, quantity: i.quantity, images: 1, brief: i.brief });
    },
  }),
  tool({
    name: "create_content",
    title: "Draft ads, emails or a web page",
    description: "Draft ads (google_search_ad / meta_ad, created paused), an email sequence (email) or an SEO page (blog). Nothing is published or sent.",
    risk: "draft",
    doing: "Drafting",
    input: z.object({ kind: z.enum(["ads", "email", "seo_page"]), brief: z.string() }),
    output: RunIdOutputSchema,
    run: async (c, slug, i) => c.mutation(api.content.generate, { slug, job: i.kind === "ads" ? "content_ads" : i.kind === "email" ? "content_email" : "content_seo", brief: i.brief }),
  }),
  tool({
    name: "edit_draft",
    title: "Edit a draft",
    description: "Change a draft's text. This saves a new version; any earlier approval no longer applies, so the owner reviews the edit. Pass only the fields to change.",
    risk: "draft",
    doing: "Editing the draft",
    input: z.object({ artifactId, title: z.string().optional(), headline: z.string().optional(), body: z.string().optional(), callToAction: z.string().optional(), hashtags: z.array(z.string()).optional() }),
    output: SavedDraftOutputSchema,
    run: async (c, slug, i) => {
      const d = await c.query(api.content.get, { slug, artifactId: i.artifactId as Id<"artifacts"> });
      const v = d.current as { body: string; headline: string | null; callToAction: string | null; destinationUrl: string | null; hashtags: string[]; altText: string | null } | null;
      await c.mutation(api.content.edit, {
        slug,
        artifactId: i.artifactId as Id<"artifacts">,
        title: i.title,
        headline: i.headline ?? v?.headline ?? undefined,
        body: i.body ?? v?.body ?? "",
        callToAction: i.callToAction ?? v?.callToAction ?? undefined,
        destinationUrl: v?.destinationUrl ?? undefined,
        hashtags: i.hashtags ?? v?.hashtags ?? [],
        altText: v?.altText ?? undefined,
      });
      return { saved: true, note: "Saved as a new version; it needs the owner's approval again." };
    },
  }),
  tool({
    name: "plan_week",
    title: "Plan the week (autopilot)",
    description: "Plan and draft the next week of social posts now (autopilot must be on).",
    risk: "draft",
    doing: "Planning the week",
    input: z.object({}),
    output: z.string(),
    run: async (c, slug) => c.mutation(api.autopilot.planNow, { slug }),
  }),
  tool({
    name: "capture_website",
    title: "Capture website screenshots",
    description: "Take real desktop, mobile and feature screenshots of the business's website (or a given public page) for posts.",
    risk: "draft",
    doing: "Capturing your website",
    input: z.object({ url: z.string().optional() }),
    output: z.string(),
    run: async (c, slug, i) => c.mutation(api.assets.captureWebsite, { slug, url: i.url }),
  }),
  tool({
    name: "collect_product_photos",
    title: "Collect product photos",
    description: "Collect real product photos, names and prices from the business's store.",
    risk: "draft",
    doing: "Collecting product photos",
    input: z.object({}),
    output: z.string(),
    run: async (c, slug) => c.mutation(api.assets.collectProducts, { slug }),
  }),

  /* ---------------- confirm (never without the owner's tap) ---------------- */
  tool({
    name: "refresh_plan",
    title: "Refresh the growth plan",
    description: "Ask the strategist for a new version of the growth plan (it needs the owner's approval before anything changes). Uses credits.",
    risk: "confirm",
    doing: "Asking the strategist for a new plan",
    input: z.object({}),
    summarize: () => `Draft a new version of your growth plan. Uses up to ${microsToCredits(estimateJobMicros(planJob("strategy"))).toLocaleString("en-US")} credits; unused credits are returned.`,
    run: async (c, slug) => c.mutation(api.orgs.generatePlan, { slug }),
  }),
  tool({
    name: "approve_draft",
    title: "Approve a draft",
    description: "Approve a draft's current version. For autopilot posts this schedules them for their planned time.",
    risk: "confirm",
    doing: "Approving",
    input: z.object({ artifactId, note: z.string().optional() }),
    summarize: () => "Approve this draft as it is now. Autopilot posts then go out at their planned time.",
    run: async (c, slug, i) => c.mutation(api.content.decide, { slug, artifactId: i.artifactId as Id<"artifacts">, decision: "approve", note: i.note }),
  }),
  tool({
    name: "send_back_draft",
    title: "Send a draft back",
    description: "Reject a draft's current version with a note for the team.",
    risk: "confirm",
    doing: "Sending it back",
    input: z.object({ artifactId, note: z.string() }),
    summarize: (i) => `Send this draft back with the note: "${i.note}"`,
    run: async (c, slug, i) => c.mutation(api.content.decide, { slug, artifactId: i.artifactId as Id<"artifacts">, decision: "reject", note: i.note }),
  }),
  tool({
    name: "schedule_draft",
    title: "Schedule an approved draft",
    description: "Schedule an approved draft to publish at a time (ISO 8601 with timezone).",
    risk: "confirm",
    doing: "Scheduling",
    input: z.object({ artifactId, when: z.string().refine((s) => Number.isFinite(Date.parse(s)), "Use a full date and time with its offset, like 2026-10-20T09:00:00+01:00.") }),
    summarize: (i, c) => `Schedule it for ${localTime(Date.parse(i.when), c?.timeZone)}.`,
    run: async (c, slug, i) => c.mutation(api.content.schedule, { slug, artifactId: i.artifactId as Id<"artifacts">, when: Date.parse(i.when) }),
  }),
  tool({
    name: "publish_now",
    title: "Publish now",
    description: "Publish an approved draft immediately to its connected account.",
    risk: "confirm",
    doing: "Publishing",
    input: z.object({ artifactId }),
    summarize: () => "Publish this approved post right now.",
    run: async (c, slug, i) => c.mutation(api.content.publishNow, { slug, artifactId: i.artifactId as Id<"artifacts"> }),
  }),
  tool({
    name: "skip_post",
    title: "Skip a planned post",
    description: "Skip an autopilot calendar slot so nothing posts in it.",
    risk: "confirm",
    doing: "Skipping the post",
    input: z.object({ slotId: z.string() }),
    summarize: () => "Skip this planned post. Nothing will go out in that slot.",
    run: async (c, slug, i) => c.mutation(api.autopilot.skipSlot, { slug, slotId: i.slotId as Id<"calendarSlots"> }),
  }),
  tool({
    name: "set_autopilot",
    title: "Change autopilot",
    description: "Turn autopilot on or off, or change its mode, channels and posts per week.",
    risk: "confirm",
    doing: "Updating autopilot",
    input: z.object({ enabled: z.boolean(), mode: z.enum(["always_ask", "trust_ladder", "auto"]), channels: z.array(z.object({ channel: z.enum(CHANNELS), postsPerWeek: z.number().min(0).max(6) })) }),
    summarize: (i) => (i.enabled ? `Autopilot on (${i.mode.replace("_", " ")}): ${i.channels.map((c) => `${c.channel} ${c.postsPerWeek}/week`).join(", ")}.` : "Turn autopilot off. Scheduled posts stay scheduled."),
    run: async (c, slug, i) => {
      const cur = await c.query(api.autopilot.get, { slug });
      return c.mutation(api.autopilot.save, { slug, enabled: i.enabled, mode: i.mode, channels: i.channels, postingHours: cur.settings?.postingHours ?? [], alwaysAskTopics: cur.settings?.alwaysAskTopics ?? [], imagesPerWeek: cur.settings?.imagesPerWeek ?? 1 });
    },
  }),
  tool({
    name: "pause_everything",
    title: "Pause everything",
    description: "Emergency stop: pause all publishing, sending and AI work in this workspace.",
    risk: "confirm",
    doing: "Pausing everything",
    input: z.object({ reason: z.string().optional() }),
    summarize: () => "Pause all activity in this workspace until you resume it.",
    run: async (c, slug, i) => c.mutation(api.workspace.pauseAll, { slug, reason: i.reason }),
  }),

  /* ---------------- ui (in-app only) ---------------- */
  tool({
    name: "go_to",
    title: "Open a screen",
    description: "Open a ClimbOS screen for the owner: today, plan, content, content/<draftId>, autopilot, outbound (find customers), images, results, connections, settings/billing, work/<runId>.",
    risk: "ui",
    doing: "Opening it for you",
    input: z.object({ path: z.string() }),
  }),
  tool({
    name: "highlight",
    title: "Point at something",
    description: "Highlight an element on the owner's current screen by its entity id (from the screen context) to show where something is.",
    risk: "ui",
    doing: "Pointing it out",
    input: z.object({ entityId: z.string(), note: z.string().optional() }),
  }),
];

export function toolByName(name: string) {
  return CLIMB_TOOLS.find((t) => t.name === name);
}

/** Client tool definitions for the model (optionally without UI tools, e.g. for MCP). */
export function climbToolDefs(opts: { ui: boolean }) {
  return CLIMB_TOOLS.filter((t) => opts.ui || t.risk !== "ui").map((t) => {
    const schema = z.toJSONSchema(t.input) as Record<string, unknown>;
    delete schema.$schema;
    return {
      name: t.name,
      description: `${t.description}${t.risk === "confirm" ? " The owner must confirm before this happens; calling it shows them a confirmation." : ""}`,
      input_schema: schema as { type: "object"; properties?: Record<string, unknown> },
    };
  });
}

/** Paths go_to may open (relative to /app/<slug>/). */
export function safeAppPath(path: string): string | null {
  const p = path.replace(/^\/+/, "").replace(/^app\/[^/]+\//, "");
  return /^(today|inbox|plan|content(\/[a-z0-9]+)?|autopilot|outbound|pipeline|reviews|pages|images|reels|results(\/[a-z0-9-]+)?|links|competitors|connections|chat|settings\/(billing|team|activity|notifications|brand|ai|webhooks|profile)|work\/[a-z0-9]+)(\?[a-z=&_0-9-]*)?$/i.test(p) ? p : null;
}
