"use node";

import { v } from "convex/values";
import { getRateVersion } from "../shared/economics";
import { treatmentPrompt, type Treatment } from "../shared/visuals/treatments";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { editImage } from "./ai/providers";
import { r2Configured, r2Key, r2Put, r2SignedUrl } from "./lib/r2";

/** Run one metered image treatment and save the result as a new library image. */
export const run = internalAction({
  args: { runId: v.id("workflowRuns"), assetId: v.id("assets"), treatment: v.string(), scene: v.optional(v.string()), userId: v.id("users") },
  handler: async (ctx, { runId, assetId, treatment, scene, userId }) => {
    const src = await ctx.runQuery(internal.assets.source, { assetId });
    const job = await ctx.runQuery(internal.jobWrites.jobContext, { runId });
    if (!src || !job) return;
    const step = await ctx.runMutation(internal.engine.beginStep, { runId, index: 0, kind: "image", label: "Edit image", role: "creative_director" });
    if (!step.proceed) {
      await ctx.runMutation(internal.engine.finishRun, { runId, status: "failed", userMessage: "This edit couldn't start." });
      return;
    }
    let attempted = false;
    try {
      const url = src.r2Key ? await r2SignedUrl(src.r2Key, 600) : src.storageId ? await ctx.storage.getUrl(src.storageId) : null;
      const res = url ? await fetch(url) : null;
      if (!res?.ok) {
        await ctx.runMutation(internal.engine.failStep, { stepId: step.stepId!, error: "source image unavailable" });
        await ctx.runMutation(internal.engine.finishRun, { runId, status: "failed", userMessage: "We couldn't read the original image." });
        return;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const rates = getRateVersion(job.run.rateVersionId);
      const out = await editImage(treatmentPrompt(treatment as Treatment, scene), { bytes, mimeType: src.mime }, rates);
      attempted = true;
      await ctx.runMutation(internal.engine.recordUsage, {
        stepId: step.stepId!,
        records: [{ type: "image_attempt", provider: "google", model: "gemini-3.1-flash-lite-image", inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: 1, costMicros: out.costMicros, estimated: true }],
      });
      if (!out.ok) {
        await ctx.runMutation(internal.engine.failStep, { stepId: step.stepId!, error: out.message });
        await ctx.runMutation(internal.engine.finishRun, { runId, status: "failed", userMessage: out.message, meters: { imageAttempts: 1 } });
        return;
      }
      let stored: { storageId?: import("./_generated/dataModel").Id<"_storage">; r2Key?: string };
      if (r2Configured()) {
        const key = r2Key(src.orgId, "images", out.mimeType.split("/")[1] ?? "png");
        await r2Put(key, out.bytes, out.mimeType);
        stored = { r2Key: key };
      } else {
        stored = { storageId: await ctx.storage.store(new Blob([out.bytes as BlobPart], { type: out.mimeType })) };
      }
      const label = treatment === "sample_data" ? `${src.label} (sample data)` : treatment === "clean_background" ? `${src.label} (studio)` : `${src.label} (${scene ?? "scene"})`;
      const newId = await ctx.runMutation(internal.assets.insertAsset, {
        orgId: src.orgId,
        kind: "edited",
        source: "edit",
        view: src.view ?? "other",
        ...stored,
        mime: out.mimeType,
        label,
        sourceUrl: src.sourceUrl,
        product: src.product,
        parentAssetId: assetId,
        illustrative: treatment === "sample_data",
        createdBy: userId,
      });
      await ctx.runMutation(internal.engine.completeStep, { stepId: step.stepId!, output: JSON.stringify(newId) });
      await ctx.runMutation(internal.engine.finishRun, { runId, status: "verified", output: JSON.stringify({ assetId: newId }), meters: { imageAttempts: 1, deliveredImages: 1 } });
    } catch (e) {
      // Network or storage error: never leave the run "working" forever.
      await ctx.runMutation(internal.engine.failStep, { stepId: step.stepId!, error: (e as Error).message?.slice(0, 300) ?? "edit failed" });
      await ctx.runMutation(internal.engine.finishRun, { runId, status: "failed", userMessage: "The edit didn't finish. Try again.", ...(attempted ? { meters: { imageAttempts: 1 } } : {}) });
    }
  },
});
