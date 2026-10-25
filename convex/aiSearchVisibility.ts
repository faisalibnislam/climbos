import { v } from "convex/values";
import { compareAiSearchObservationPeriods, summarizeAiSearchPanel, summarizeAiSearchVisibility, type AiSearchObservation, answerAccuracySummary } from "../shared/aiSearch/visibility";
import { mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { appError, requireOrgAccess } from "./lib/tenancy";
import { searchConsolePropertyMatchesWebsite } from "../shared/integrations/searchConsole";

const MAX_OBSERVATIONS = 500;
const MAX_QUERY = 500;
const MAX_LOCATION = 160;
const MAX_EXCERPT = 6_000;
const MAX_CITATIONS = 30;
const MAX_COMPETITORS = 30;
const MAX_PANEL_QUERIES = 100;
const MAX_PANEL_NAME = 120;
const MAX_INTERVENTION_SUMMARY = 1_000;
const MAX_EXPECTED_SIGNAL = 500;
const MAX_INTERVENTION_PAGES = 20;
const MAX_IMPORTED_REPORT_ROWS = 1_000;

function safeHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString().slice(0, 2_000);
  } catch {
    return null;
  }
}

function labels(items: string[], max: number, label: string): string[] {
  const out = new Map<string, string>();
  for (const item of items) {
    const value = item.trim().replace(/\s+/g, " ");
    if (!value) continue;
    if (value.length > 200) throw appError("INVALID", `${label} entries must be 200 characters or fewer.`);
    const key = value.toLocaleLowerCase();
    if (!out.has(key)) out.set(key, value);
  }
  if (out.size > max) throw appError("INVALID", `Record no more than ${max} ${label.toLowerCase()} per observation.`);
  return [...out.values()];
}

function normalizedPanelKey(provider: string, query: string, location?: string) {
  return `${provider}\u0000${query.trim().toLocaleLowerCase().replace(/\s+/g, " ")}\u0000${location?.trim().toLocaleLowerCase().replace(/\s+/g, " ") ?? ""}`;
}

/** Save an immutable, tenant-owned set of comparable prompts. Create a new panel to change its membership. */
export const createPanel = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    queries: v.array(v.object({
      provider: v.union(v.literal("chatgpt"), v.literal("gemini"), v.literal("perplexity"), v.literal("google_ai_overview"), v.literal("other")),
      query: v.string(),
      location: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const name = args.name.trim().replace(/\s+/g, " ");
    if (!name || name.length > MAX_PANEL_NAME) throw appError("INVALID", `Panel name must be 1–${MAX_PANEL_NAME} characters.`);
    if (!args.queries.length || args.queries.length > MAX_PANEL_QUERIES) throw appError("INVALID", `A panel must contain 1–${MAX_PANEL_QUERIES} queries.`);

    const seen = new Set<string>();
    const queries = args.queries.map((item, index) => {
      const query = item.query.trim().replace(/\s+/g, " ");
      if (!query || query.length > MAX_QUERY) throw appError("INVALID", `Panel queries must contain 1–${MAX_QUERY} characters.`);
      const location = item.location?.trim().replace(/\s+/g, " ");
      if (location && location.length > MAX_LOCATION) throw appError("INVALID", `Location must be ${MAX_LOCATION} characters or fewer.`);
      const key = normalizedPanelKey(item.provider, query, location);
      if (seen.has(key)) throw appError("INVALID", "A panel cannot contain the same provider, question and location twice.");
      seen.add(key);
      return { key: `q${index + 1}`, provider: item.provider, query, ...(location ? { location } : {}) };
    });

    return await ctx.db.insert("aiSearchPanels", {
      orgId: org._id,
      name,
      status: "active",
      queries,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

/** Save a bounded owner-uploaded export from Google's dedicated generative-AI report. */
export const importGoogleAiReport = mutation({
  args: {
    slug: v.string(),
    property: v.string(),
    report: v.union(v.literal("search"), v.literal("discover")),
    dimension: v.union(v.literal("page"), v.literal("date"), v.literal("country"), v.literal("device")),
    rows: v.array(v.object({ dimensionValue: v.string(), impressions: v.number() })),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const connection = await ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", "search_console")).first();
    if (!connection || connection.status !== "connected" || connection.isFixture || connection.externalAccountId !== args.property) {
      throw appError("INVALID", "Select the connected Search Console property before importing its report export.");
    }
    if (!args.rows.length || args.rows.length > MAX_IMPORTED_REPORT_ROWS) throw appError("INVALID", `Import 1–${MAX_IMPORTED_REPORT_ROWS.toLocaleString()} rows at a time.`);
    const deduped = new Map<string, number>();
    for (const row of args.rows) {
      const value = row.dimensionValue.trim();
      if (!value || value.length > 2_000 || !Number.isFinite(row.impressions) || row.impressions < 0) throw appError("INVALID", "Report rows must have a dimension value and non-negative finite impressions.");
      if (args.dimension === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw appError("INVALID", "Date values must use YYYY-MM-DD.");
      if (args.dimension === "page") {
        let url: URL;
        try { url = new URL(value); } catch { throw appError("INVALID", "Every page row must contain a valid public URL."); }
        if (url.username || url.password || !searchConsolePropertyMatchesWebsite(args.property, value)) throw appError("INVALID", "Every page URL must be public and belong to the selected Search Console property.");
      }
      deduped.set(value, (deduped.get(value) ?? 0) + row.impressions);
    }
    if (deduped.size > MAX_IMPORTED_REPORT_ROWS) throw appError("INVALID", "The export contains too many unique rows.");
    const importedAt = Date.now();
    const importId = await ctx.db.insert("googleAiSearchImports", { orgId: org._id, property: args.property, report: args.report, dimension: args.dimension, rowCount: deduped.size, importedAt, importedBy: user._id });
    for (const [dimensionValue, impressions] of deduped) await ctx.db.insert("googleAiSearchRows", { orgId: org._id, importId, dimensionValue, impressions });
    const imports = await ctx.db.query("googleAiSearchImports").withIndex("by_org_imported", (q) => q.eq("orgId", org._id)).order("desc").take(20);
    for (const old of imports.filter((item) => item._id !== importId).slice(2)) {
      const rows = await ctx.db.query("googleAiSearchRows").withIndex("by_import", (q) => q.eq("importId", old._id)).take(MAX_IMPORTED_REPORT_ROWS);
      for (const row of rows) await ctx.db.delete(row._id);
      await ctx.db.delete(old._id);
    }
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "ai_search.google_report_imported", subjectType: "business", subjectId: String(importId), summary: `Imported ${deduped.size} rows from Google's generative-AI Search Console report.` });
    return { importId, rowCount: deduped.size };
  },
});

/** Latest owner-imported Google report; kept separate from owner-observed AI answer samples. */
export const latestGoogleAiReport = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const report = await ctx.db.query("googleAiSearchImports").withIndex("by_org_imported", (q) => q.eq("orgId", org._id)).order("desc").first();
    if (!report) return null;
    const rows = await ctx.db.query("googleAiSearchRows").withIndex("by_import", (q) => q.eq("importId", report._id)).take(MAX_IMPORTED_REPORT_ROWS);
    return { ...report, rows: rows.map(({ _id: _id, _creationTime: _creationTime, orgId: _orgId, importId: _importId, ...row }) => row), note: "Owner-imported Search Console report data. Impressions are Google-reported appearances, not clicks, rankings, exact queries, or business outcomes. Aggregation depends on the selected dimension." };
  },
});

export const listPanels = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const panels = await ctx.db.query("aiSearchPanels")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(100);
    return panels.map(({ _id, name, status, queries, createdAt }) => ({ id: _id, name, status, queryCount: queries.length, createdAt }));
  },
});

/** Record one owner-observed answer. ClimbOS does not claim direct AI-search provider access. */
export const recordObservation = mutation({
  args: {
    slug: v.string(),
    panelId: v.optional(v.id("aiSearchPanels")),
    panelQueryKey: v.optional(v.string()),
    provider: v.union(v.literal("chatgpt"), v.literal("gemini"), v.literal("perplexity"), v.literal("google_ai_overview"), v.literal("other")),
    query: v.string(),
    location: v.optional(v.string()),
    checkedAt: v.number(),
    answerStatus: v.union(v.literal("answered"), v.literal("no_answer"), v.literal("failed")),
    brandMention: v.union(v.literal("yes"), v.literal("no"), v.literal("unknown")),
    sentiment: v.union(v.literal("positive"), v.literal("neutral"), v.literal("negative"), v.literal("mixed"), v.literal("unknown")),
    citedUrls: v.array(v.string()),
    competitorMentions: v.array(v.string()),
    answerExcerpt: v.optional(v.string()),
    accuracy: v.optional(v.union(v.literal("accurate"), v.literal("contains_error"), v.literal("not_checked"))),
    incorrectClaim: v.optional(v.string()),
    correctFact: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const query = args.query.trim().replace(/\s+/g, " ");
    if (!query || query.length > MAX_QUERY) throw appError("INVALID", `Enter a search question (up to ${MAX_QUERY} characters).`);
    if (!Number.isSafeInteger(args.checkedAt) || args.checkedAt > Date.now()) throw appError("INVALID", "The observation date must be valid and cannot be in the future.");
    const location = args.location?.trim().replace(/\s+/g, " ");
    if (location && location.length > MAX_LOCATION) throw appError("INVALID", `Location must be ${MAX_LOCATION} characters or fewer.`);
    if (Boolean(args.panelId) !== Boolean(args.panelQueryKey)) throw appError("INVALID", "Select both a saved panel and one of its queries, or record an ungrouped observation.");
    if (args.panelId && args.panelQueryKey) {
      const panel = await ctx.db.get(args.panelId);
      if (!panel || panel.orgId !== org._id) throw appError("NOT_FOUND", "The selected AI-search panel was not found.");
      const panelQuery = panel.queries.find((item) => item.key === args.panelQueryKey);
      if (!panelQuery || normalizedPanelKey(panelQuery.provider, panelQuery.query, panelQuery.location) !== normalizedPanelKey(args.provider, query, location)) {
        throw appError("INVALID", "The observation must match the saved panel query, provider and location exactly.");
      }
    }
    const cleanedCitations = args.citedUrls.filter((url) => url.trim()).map((raw) => {
      const url = safeHttpUrl(raw);
      if (!url) throw appError("INVALID", "Citations must be valid HTTP or HTTPS page addresses.");
      return url;
    });
    const citedUrls = [...new Set(cleanedCitations)];
    if (citedUrls.length > MAX_CITATIONS) throw appError("INVALID", `Record no more than ${MAX_CITATIONS} cited pages per observation.`);
    const competitorMentions = labels(args.competitorMentions, MAX_COMPETITORS, "Competitor names");
    const answerExcerpt = args.answerExcerpt?.trim();
    if (answerExcerpt && answerExcerpt.length > MAX_EXCERPT) throw appError("INVALID", `Keep the answer excerpt to ${MAX_EXCERPT} characters or fewer.`);
    if (args.answerStatus === "answered" && !answerExcerpt) throw appError("INVALID", "Include a short excerpt of the answer so this observation can be reviewed.");
    if (args.answerStatus !== "answered" && (args.brandMention !== "unknown" || args.sentiment !== "unknown" || citedUrls.length || competitorMentions.length || answerExcerpt)) {
      throw appError("INVALID", "A failed or empty response cannot be counted as an answer, mention, sentiment or citation.");
    }
    if (args.brandMention !== "yes" && args.sentiment !== "unknown") throw appError("INVALID", "Only label sentiment when the answer mentions the business.");
    const accuracy = args.accuracy && args.accuracy !== "not_checked" ? args.accuracy : undefined;
    if (accuracy && args.brandMention !== "yes") throw appError("INVALID", "Only check accuracy when the answer mentions the business.");
    const incorrectClaim = args.incorrectClaim?.trim().replace(/\s+/g, " ");
    const correctFact = args.correctFact?.trim().replace(/\s+/g, " ");
    if ((incorrectClaim || correctFact) && accuracy !== "contains_error") throw appError("INVALID", "Add an incorrect claim and correct fact only when the answer contains an error.");
    if (accuracy === "contains_error") {
      if (!incorrectClaim || !correctFact) throw appError("INVALID", "Quote the incorrect part of the answer and give the correct fact.");
      if (incorrectClaim.length > 300 || correctFact.length > 300) throw appError("INVALID", "Keep the incorrect claim and the correct fact to 300 characters each.");
      if (!answerExcerpt || !answerExcerpt.toLowerCase().replace(/\s+/g, " ").includes(incorrectClaim.toLowerCase())) throw appError("INVALID", "The incorrect claim must be copied from the answer excerpt.");
    }

    const id = await ctx.db.insert("aiSearchObservations", {
      orgId: org._id,
      ...(args.panelId && args.panelQueryKey ? { panelId: args.panelId, panelQueryKey: args.panelQueryKey } : {}),
      provider: args.provider,
      query,
      ...(location ? { location } : {}),
      checkedAt: args.checkedAt,
      answerStatus: args.answerStatus,
      brandMention: args.brandMention,
      sentiment: args.sentiment,
      citedUrls,
      competitorMentions,
      ...(answerExcerpt ? { answerExcerpt } : {}),
      ...(accuracy ? { accuracy } : {}),
      ...(accuracy === "contains_error" ? { incorrectClaim, correctFact } : {}),
      evidenceBasis: "owner_observed",
      enteredBy: user._id,
      enteredAt: Date.now(),
    });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "ai_search.observation_recorded", subjectType: "business", subjectId: String(id), summary: `Recorded an AI-search observation for “${query.slice(0, 80)}”.` });
    return id;
  },
});

/** Keep an owner-reported optimization timeline alongside sampled answers. */
export const recordIntervention = mutation({
  args: {
    slug: v.string(),
    panelId: v.optional(v.id("aiSearchPanels")),
    changedAt: v.number(),
    kind: v.union(v.literal("content"), v.literal("technical_seo"), v.literal("brand_or_entity"), v.literal("off_site"), v.literal("other")),
    summary: v.string(),
    expectedSignal: v.string(),
    pageUrls: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    if (!Number.isSafeInteger(args.changedAt) || args.changedAt > Date.now()) throw appError("INVALID", "The change date must be valid and cannot be in the future.");
    const summary = args.summary.trim().replace(/\s+/g, " ");
    const expectedSignal = args.expectedSignal.trim().replace(/\s+/g, " ");
    if (!summary || summary.length > MAX_INTERVENTION_SUMMARY) throw appError("INVALID", `Describe the change in 1–${MAX_INTERVENTION_SUMMARY} characters.`);
    if (!expectedSignal || expectedSignal.length > MAX_EXPECTED_SIGNAL) throw appError("INVALID", `Describe the signal to watch in 1–${MAX_EXPECTED_SIGNAL} characters.`);
    if (args.pageUrls.length > MAX_INTERVENTION_PAGES) throw appError("INVALID", `Record no more than ${MAX_INTERVENTION_PAGES} affected pages.`);
    const panel = args.panelId ? await ctx.db.get(args.panelId) : null;
    if (args.panelId && (!panel || panel.orgId !== org._id)) throw appError("NOT_FOUND", "The selected AI-search panel was not found.");
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    let siteHost: string | null = null;
    if (business?.website) {
      try { siteHost = new URL(business.website).hostname.toLocaleLowerCase().replace(/^www\./, ""); } catch { /* Invalid legacy values cannot authorize page attribution. */ }
    }
    const pageUrls = [...new Set(args.pageUrls.filter((raw) => raw.trim()).map((raw) => {
      const value = safeHttpUrl(raw);
      if (!value) throw appError("INVALID", "Affected pages must be valid HTTP or HTTPS addresses.");
      const url = new URL(value);
      if (!siteHost || url.hostname.toLocaleLowerCase().replace(/^www\./, "") !== siteHost) {
        throw appError("INVALID", "Affected page addresses must use this workspace's recorded website host.");
      }
      return value;
    }))];
    if (["content", "technical_seo"].includes(args.kind) && pageUrls.length === 0) throw appError("INVALID", "Content and technical SEO changes need at least one affected page URL.");
    const id = await ctx.db.insert("aiSearchInterventions", {
      orgId: org._id,
      ...(args.panelId ? { panelId: args.panelId } : {}),
      changedAt: args.changedAt,
      kind: args.kind,
      summary,
      expectedSignal,
      pageUrls,
      evidenceBasis: "owner_reported",
      enteredBy: user._id,
      enteredAt: Date.now(),
    });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "ai_search.intervention_recorded", subjectType: "business", subjectId: String(id), summary: `Recorded an owner-reported AI-search change: ${summary.slice(0, 80)}.` });
    return id;
  },
});

/** Bounded, descriptive report. Rates describe only recorded samples, never all platform answers. */
export const report = query({
  args: { slug: v.string(), days: v.optional(v.number()), panelId: v.optional(v.id("aiSearchPanels")), compareToPreviousWindow: v.optional(v.boolean()) },
  handler: async (ctx, { slug, days, panelId, compareToPreviousWindow }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const requestedDays = days !== undefined && Number.isFinite(days) ? days : 90;
    const windowDays = Math.max(1, Math.min(365, Math.floor(requestedDays)));
    const now = Date.now();
    const currentSince = now - windowDays * 86_400_000;
    const comparisonSince = currentSince - (compareToPreviousWindow ? windowDays * 86_400_000 : 0);
    const panel = panelId ? await ctx.db.get(panelId) : null;
    if (panelId && (!panel || panel.orgId !== org._id)) throw appError("NOT_FOUND", "The selected AI-search panel was not found.");
    const interventionQuery = panelId
      ? await ctx.db.query("aiSearchInterventions")
        .withIndex("by_org_panel_changed", (q) => q.eq("orgId", org._id).eq("panelId", panelId).gte("changedAt", comparisonSince).lt("changedAt", now + 1))
        .order("desc")
        .take(100)
      : await ctx.db.query("aiSearchInterventions")
        .withIndex("by_org_changed", (q) => q.eq("orgId", org._id).gte("changedAt", comparisonSince).lt("changedAt", now + 1))
        .order("desc")
        .take(100);
    const fetched = panelId
      ? await ctx.db.query("aiSearchObservations")
        .withIndex("by_org_panel_checked", (q) => q.eq("orgId", org._id).eq("panelId", panelId).gte("checkedAt", comparisonSince).lt("checkedAt", now + 1))
        .order("desc")
        .take(MAX_OBSERVATIONS * (compareToPreviousWindow ? 2 : 1) + 1)
      : await ctx.db.query("aiSearchObservations")
        .withIndex("by_org_checked", (q) => q.eq("orgId", org._id).gte("checkedAt", comparisonSince).lt("checkedAt", now + 1))
        .order("desc")
        .take(MAX_OBSERVATIONS * (compareToPreviousWindow ? 2 : 1) + 1);
    const currentFetched = fetched.filter((observation) => observation.checkedAt >= currentSince);
    const baselineFetched = fetched.filter((observation) => observation.checkedAt < currentSince);
    const currentTruncated = currentFetched.length > MAX_OBSERVATIONS;
    const baselineTruncated = baselineFetched.length > MAX_OBSERVATIONS;
    const truncated = currentTruncated || baselineTruncated || fetched.length > MAX_OBSERVATIONS * (compareToPreviousWindow ? 2 : 1);
    const observations = currentFetched.slice(0, MAX_OBSERVATIONS);
    const baselineObservations = compareToPreviousWindow ? baselineFetched.slice(0, MAX_OBSERVATIONS) : [];
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    const summary = summarizeAiSearchVisibility(observations as AiSearchObservation[], business?.website);
    const panelSummary = summarizeAiSearchPanel(observations as AiSearchObservation[], business?.website);
    const accuracy = answerAccuracySummary(observations);
    const comparison = compareToPreviousWindow ? {
      kind: "observed_before_after_change_not_causal" as const,
      baselineWindow: { from: comparisonSince, toExclusive: currentSince },
      currentWindow: { from: currentSince, toExclusive: now + 1 },
      baselineObservationCount: baselineObservations.length,
      currentObservationCount: observations.length,
      truncated: baselineTruncated || currentTruncated,
      queryChanges: compareAiSearchObservationPeriods(
        baselineObservations as AiSearchObservation[],
        observations as AiSearchObservation[],
        business?.website,
      ),
    } : null;
    const panelQueries = panel?.queries.map((item) => {
      const matching = observations.filter((observation) => observation.panelQueryKey === item.key);
      return {
        ...item,
        observationCount: matching.length,
        answered: matching.filter((observation) => observation.answerStatus === "answered").length,
        noAnswer: matching.filter((observation) => observation.answerStatus === "no_answer").length,
        failed: matching.filter((observation) => observation.answerStatus === "failed").length,
        lastCheckedAt: matching.length ? Math.max(...matching.map((observation) => observation.checkedAt)) : null,
        summary: summarizeAiSearchVisibility(matching as AiSearchObservation[], business?.website)[0] ?? null,
      };
    }) ?? null;
    return {
      windowDays,
      observationCount: observations.length,
      truncated,
      panel: panel ? { id: panel._id, name: panel.name, status: panel.status, queryCount: panel.queries.length, queries: panelQueries } : null,
      summary,
      panelSummary,
      accuracy,
      comparison,
      interventions: interventionQuery.map(({ _id, changedAt, kind, summary, expectedSignal, pageUrls, evidenceBasis }) => ({
        id: _id,
        changedAt,
        kind,
        summary,
        expectedSignal,
        pageUrls,
        evidenceBasis,
        ...(compareToPreviousWindow ? { comparisonWindow: changedAt < currentSince ? "baseline" as const : "current" as const } : {}),
      })),
      observations: observations.map(({ _id, panelId: observationPanelId, panelQueryKey, provider, query, location, checkedAt, answerStatus, brandMention, sentiment, citedUrls, competitorMentions, answerExcerpt, enteredAt }) => ({
        id: _id,
        panelId: observationPanelId ?? null,
        panelQueryKey: panelQueryKey ?? null,
        provider,
        query,
        location: location ?? null,
        checkedAt,
        answerStatus,
        brandMention,
        sentiment,
        citedUrls,
        competitorMentions,
        answerExcerpt: answerExcerpt ?? null,
        enteredAt,
        evidenceBasis: "owner_observed" as const,
      })),
      interpretation: [
        "These figures describe owner-recorded samples only; prompts, platform versions, geography and answer variation can change results.",
        "A mention or citation is not evidence that content changes caused visibility or business growth.",
        ...(compareToPreviousWindow ? ["The prior/current comparison is descriptive; it does not isolate the effect of a content change or control for provider, prompt, market, or seasonal changes."] : []),
        "Content readiness and qualified visits, leads or customers are separate measures and are not included in these rates.",
      ],
    };
  },
});
