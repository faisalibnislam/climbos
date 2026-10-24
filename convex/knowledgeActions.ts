"use node";

import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { v } from "convex/values";
import registry from "../docs/growth-intelligence/source_registry.json";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { extractPageContent, isPathAllowed, safeFetchPage } from "../shared/integrations/website";
import { sourceFreshness } from "../shared/knowledge/freshness";

const MAX_SOURCE_CHARS = 24_000;

function diffLines(before: string, after: string) {
  const oldLines = [...new Set(before.split(/\n+/).map((s) => s.trim()).filter(Boolean))];
  const newLines = [...new Set(after.split(/\n+/).map((s) => s.trim()).filter(Boolean))];
  return {
    removedPassages: oldLines.filter((line) => !new Set(newLines).has(line)).slice(0, 20).map((line) => line.slice(0, 500)),
    addedPassages: newLines.filter((line) => !new Set(oldLines).has(line)).slice(0, 20).map((line) => line.slice(0, 500)),
  };
}

/** Fetches one manually requested source, records a bounded hash diff, and never promotes content. */
export const refreshSource = internalAction({
  args: { sourceId: v.id("growthKnowledgeSources"), scheduled: v.optional(v.boolean()) },
  handler: async (ctx, { sourceId, scheduled }) => {
    const source = await ctx.runMutation(internal.knowledge.markChecking, { sourceId, scheduled });
    if (!source) return { skipped: true };
    const registrySource = registry.sources.find((candidate) => candidate.registry_id === source.registryId);
    const checkedAt = Date.now();
    if (!registrySource) {
      await ctx.runMutation(internal.knowledge.finishRefresh, { sourceId, status: "failed", checkedAt, lastError: "Source ID is absent from the checked-in registry." });
      return { status: "failed" };
    }
    const url = new URL(registrySource.url);
    const resolveHost = async (hostname: string) => (await lookup(hostname, { all: true, verbatim: true })).map(({ address }) => address);
    try {
      const robots = await safeFetchPage({ url: `${url.origin}/robots.txt`, resolveHost, maxBytes: 128_000, timeoutMs: 10_000 });
      if (robots.status !== 404 && (!robots.ok || robots.status < 200 || robots.status >= 300)) {
        await ctx.runMutation(internal.knowledge.finishRefresh, { sourceId, status: "failed", checkedAt, lastError: `Robots policy could not be checked (HTTP ${robots.status || "network error"}); fetch stopped.` });
        return { status: "failed" };
      }
      if (robots.status !== 404 && !isPathAllowed(robots.body, "ClimbOSBot", `${url.pathname}${url.search}`)) {
        await ctx.runMutation(internal.knowledge.finishRefresh, { sourceId, status: "blocked_by_robots", checkedAt, lastError: "robots.txt disallows this path." });
        return { status: "blocked_by_robots" };
      }
      const response = await safeFetchPage({
        url: registrySource.url, resolveHost, maxBytes: 400_000, timeoutMs: 15_000,
        allowRedirect: (_from, to) => {
          const target = new URL(to);
          return target.origin === url.origin && isPathAllowed(robots.body, "ClimbOSBot", `${target.pathname}${target.search}`);
        },
        ...(source.etag ? { ifNoneMatch: source.etag } : {}),
        ...(source.lastModified ? { ifModifiedSince: source.lastModified } : {}),
      });
      const freshness = sourceFreshness(registrySource, checkedAt);
      const cadenceDays = source.reviewCadenceDays ?? freshness.cadenceDays ?? 0;
      const nextCheckAt = cadenceDays > 0 ? checkedAt + cadenceDays * 24 * 60 * 60 * 1000 : undefined;
      if (response.notModified) {
        await ctx.runMutation(internal.knowledge.finishRefresh, { sourceId, status: "unchanged", checkedAt, nextCheckAt, etag: response.etag, lastModified: response.lastModified, source: { url: registrySource.url, title: registrySource.title } });
        return { status: "unchanged" };
      }
      if (!response.ok || response.truncated || new URL(response.finalUrl).hostname !== url.hostname) {
        const reason = !response.ok ? response.error ?? `HTTP ${response.status}` : response.truncated ? "Page exceeded the safe content limit." : "Cross-host redirect is not accepted for registry refresh.";
        await ctx.runMutation(internal.knowledge.finishRefresh, { sourceId, status: "failed", checkedAt, lastError: reason });
        return { status: "failed" };
      }
      if (!/^(text\/html|text\/plain)(;|$)/i.test(response.contentType)) {
        await ctx.runMutation(internal.knowledge.finishRefresh, { sourceId, status: "failed", checkedAt, lastError: `Unsupported content type: ${response.contentType || "missing"}.` });
        return { status: "failed" };
      }
      const extracted = response.contentType.toLowerCase().startsWith("text/html")
        ? extractPageContent(response.body, registrySource.url, { maxTextChars: MAX_SOURCE_CHARS, maxHtmlChars: 400_000 }).text
        : response.body;
      const contentText = extracted.trim().slice(0, MAX_SOURCE_CHARS);
      if (!contentText) {
        await ctx.runMutation(internal.knowledge.finishRefresh, { sourceId, status: "failed", checkedAt, lastError: "No readable text was extracted." });
        return { status: "failed" };
      }
      const contentHash = createHash("sha256").update(contentText).digest("hex");
      const common = { source: { url: registrySource.url, title: registrySource.title }, checkedAt, nextCheckAt, etag: response.etag, lastModified: response.lastModified, contentHash, contentText };
      if (!source.contentHash || !source.contentText) {
        await ctx.runMutation(internal.knowledge.finishRefresh, { sourceId, status: "baseline_set", ...common });
        return { status: "baseline_set" };
      }
      if (source.contentHash === contentHash) {
        await ctx.runMutation(internal.knowledge.finishRefresh, { sourceId, status: "unchanged", ...common });
        return { status: "unchanged" };
      }
      const { removedPassages, addedPassages } = diffLines(source.contentText, contentText);
      await ctx.runMutation(internal.knowledge.finishRefresh, {
        sourceId, status: "update_pending", ...common,
        proposal: {
          previousHash: source.contentHash, currentHash: contentHash, removedPassages, addedPassages,
          claimScopes: registrySource.records.map((record) => record.claim_scope).slice(0, 30),
        },
      });
      return { status: "update_pending" };
    } catch (error) {
      await ctx.runMutation(internal.knowledge.finishRefresh, { sourceId, status: "failed", checkedAt, lastError: error instanceof Error ? error.message.slice(0, 500) : "Source check failed." });
      return { status: "failed" };
    }
  },
});
