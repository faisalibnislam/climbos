"use node";

import { v } from "convex/values";
import { getRateVersion } from "../shared/economics";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { generateImage } from "./ai/providers";
import { r2Configured, r2Key, r2Put } from "./lib/r2";

/** Make one image from a post's visual brief (two tries) and attach it to the post for review. */
export const run = internalAction({
  args: { runId: v.id("workflowRuns"), artifactId: v.id("artifacts"), userId: v.id("users") },
  handler: async (ctx, { runId, artifactId, userId }) => {
    const src = await ctx.runQuery(internal.postVisuals.imageJob, { artifactId });
    const job = await ctx.runQuery(internal.jobWrites.jobContext, { runId });
    if (!src || !job) return;
    if ("error" in src) {
      await ctx.runMutation(internal.engine.finishRun, { runId, status: "failed", userMessage: src.error });
      return;
    }
    const step = await ctx.runMutation(internal.engine.beginStep, { runId, index: 0, kind: "image", label: "Create image", role: "creative_director" });
    if (!step.proceed) {
      await ctx.runMutation(internal.engine.finishRun, { runId, status: "failed", userMessage: "This image couldn't start." });
      return;
    }
    let attempts = 0;
    try {
      const rates = getRateVersion(job.run.rateVersionId);
      const cover = src.format === "carousel" || src.format === "document" ? "the cover image of a slide post" : src.format === "story" ? "a vertical 9:16 story image" : "a social post image";
      const prompt = `${cover[0]!.toUpperCase()}${cover.slice(1)} for ${src.businessName ?? "a small business"} on ${src.channel}: ${src.brief.slice(0, 1500)}. Illustration only: clean, modern, soft natural light, no text, no logos, no real people's faces, no fake product screenshots, no charts or numbers.`;
      let stored: { storageId?: Id<"_storage">; r2Key?: string; mime: string } | null = null;
      let failure = "The image didn't come out. Try again.";
      for (let a = 0; a < 2 && !stored; a++) {
        attempts++;
        const img = await generateImage(prompt, rates);
        await ctx.runMutation(internal.engine.recordUsage, {
          stepId: step.stepId!,
          records: [{ type: "image_attempt", provider: "google", model: "gemini-3.1-flash-lite-image", inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: 1, costMicros: img.costMicros, providerMicros: img.providerMicros, estimated: true }],
        });
        if (img.ok) {
          if (r2Configured()) {
            const key = r2Key(src.orgId, "images", img.mimeType.split("/")[1] ?? "png");
            await r2Put(key, img.bytes, img.mimeType);
            stored = { r2Key: key, mime: img.mimeType };
          } else {
            stored = { storageId: await ctx.storage.store(new Blob([img.bytes as BlobPart], { type: img.mimeType })), mime: img.mimeType };
          }
        } else {
          failure = img.message;
          if (img.kind === "provider_unavailable") break;
        }
      }
      if (!stored) {
        await ctx.runMutation(internal.engine.failStep, { stepId: step.stepId!, error: failure.slice(0, 300) });
        await ctx.runMutation(internal.engine.finishRun, { runId, status: "failed", userMessage: failure, meters: { imageAttempts: attempts } });
        return;
      }
      const { attached } = await ctx.runMutation(internal.postVisuals.attachImage, { artifactId, userId, storageId: stored.storageId, r2Key: stored.r2Key, mime: stored.mime });
      await ctx.runMutation(internal.engine.completeStep, { stepId: step.stepId!, output: JSON.stringify(stored.r2Key ? `r2:${stored.r2Key}` : stored.storageId) });
      await ctx.runMutation(internal.engine.finishRun, {
        runId,
        status: "verified",
        output: JSON.stringify({ artifactId, attached }),
        meters: { imageAttempts: attempts, deliveredImages: 1 },
        ...(attached ? {} : { userMessage: "The post changed while the image was made, so it was saved to your image library instead." }),
      });
    } catch (e) {
      // Network or storage error: never leave the run "working" forever.
      await ctx.runMutation(internal.engine.failStep, { stepId: step.stepId!, error: (e as Error).message?.slice(0, 300) ?? "image failed" });
      await ctx.runMutation(internal.engine.finishRun, { runId, status: "failed", userMessage: "The image didn't finish. Try again.", ...(attempts ? { meters: { imageAttempts: attempts } } : {}) });
    }
  },
});
