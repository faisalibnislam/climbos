"use node";

import { v } from "convex/values";
import { currentRateVersion } from "../shared/economics";
import { PreviewSnapshotSchema, PreviewIdeasSchema, systemPrompt, untrusted, type PreviewSnapshot } from "../shared/ai/tasks";
import { isVerbatimPageQuote } from "../shared/preview/evidence";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { callModel, modelProviderConfigured } from "./ai/providers";
import { researchWebsite } from "./ai/research";

const ROLE_LABEL: Record<string, string> = {
  ceo: "AI CEO",
  cmo: "AI CMO",
  cso: "AI CSO",
  seo_specialist: "AI SEO Specialist",
  social_media_manager: "AI Social Media Manager",
  ads_manager: "AI Ads Manager",
  customer_success_manager: "AI Customer Success Manager",
  creative_director: "AI Creative Director",
};

/**
 * Anonymous landing-page preview: one public page, the two cheapest routes,
 * tight output caps. Never stores page text beyond the derived facts, never
 * follows instructions on the page, and stops at the per-preview cost cap.
 */
export const run = internalAction({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const p = await ctx.runQuery(internal.preview.getInternal, { token });
    if (!p || p.status !== "queued") return;
    const rates = currentRateVersion();
    const fail = async (message: string) => {
      await ctx.runMutation(internal.preview.update, { token, patch: { status: "failed", error: message } });
    };
    if (!modelProviderConfigured("gpt-6-luna")) {
      await fail("OpenAI isn't configured for live previews yet. Explore the full demo in the meantime.");
      return;
    }

    await ctx.runMutation(internal.preview.update, { token, patch: { status: "reading", stepKey: "reading", stepStatus: "running" } });
    const research = await researchWebsite(p.website, 0).catch(() => null);
    const page = research?.pages[0];
    if (!page || page.status !== "ok" || page.text.trim().length < 80) {
      await ctx.runMutation(internal.preview.update, { token, patch: { stepKey: "reading", stepStatus: "failed" } });
      await fail(
        page?.status === "blocked_by_robots"
          ? "This website asks automated visitors not to read it, so we didn't. Create an account to describe your business instead."
          : "We couldn't read that website. Check the address, or create an account and describe your business in a few sentences.",
      );
      return;
    }
    await ctx.runMutation(internal.preview.update, { token, patch: { status: "understanding", stepKey: "reading", stepStatus: "done", addCostMicros: 5_000 } });
    await ctx.runMutation(internal.preview.update, { token, patch: { stepKey: "understanding", stepStatus: "running" } });

    const content = untrusted(page.url, page.text, 10_000);
    const profileRes = await callModel(
      {
        modelKey: "gpt-6-luna",
        system: systemPrompt("data_analyst"),
        user: `TASK: From this single public web page, write a short factual profile: name, one-line summary, audience, category and up to 6 facts with sourceUrl set to "${page.url}". Only use what the page says. Also return initialFinding: either null, or one cautious, useful website observation with an exact verbatim evidenceQuote copied from this page, whyItMayMatter, and one low-risk firstStep. Choose null if no clear, important issue or opportunity is directly supported by the page. The observation may interpret the quote, so it is a hypothesis to check, not a verified business problem. Do not infer customer behavior, conversion rates, demand, performance, or missing content that this page text cannot establish.\n\n${content}`,
        schema: PreviewSnapshotSchema,
        inputBudget: 4_000,
        outputBudget: 1_200,
        deadlineMs: 45_000,
      },
      rates,
    );
    if (!profileRes.ok) {
      await ctx.runMutation(internal.preview.update, { token, patch: { stepKey: "understanding", stepStatus: "failed", addCostMicros: profileRes.costMicros } });
      await fail("Our AI had trouble with that page. Try again in a minute, or explore the demo.");
      return;
    }
    const profile = profileRes.output as PreviewSnapshot;
    const initialFinding = profile.initialFinding && isVerbatimPageQuote(profile.initialFinding.evidenceQuote, page.text)
      ? { ...profile.initialFinding, sourceUrl: page.url }
      : null;
    await ctx.runMutation(internal.preview.update, {
      token,
      patch: {
        status: "planning",
        stepKey: "understanding",
        stepStatus: "done",
        addCostMicros: profileRes.costMicros,
        business: { name: profile.name.slice(0, 80), summary: profile.oneLineSummary.slice(0, 240), audience: profile.audience.slice(0, 200), category: profile.category.slice(0, 80) },
        facts: profile.facts.slice(0, 6).map((f) => ({ statement: f.statement.slice(0, 220), sourceUrl: page.url, confidence: f.confidence, category: f.category })),
        initialFinding,
        firstValueReady: true,
      },
    });
    await ctx.runMutation(internal.preview.update, { token, patch: { stepKey: "planning", stepStatus: "running" } });

    const ideasRes = await callModel(
      {
        modelKey: "gpt-6-luna",
        system: systemPrompt("cmo"),
        user: `TASK: Suggest exactly 3 concrete, low-risk growth ideas for this business and goal. Each idea names the channel, why it fits (grounded in the facts), a first step, and which role would own it. No made-up numbers or promises.\n\nGOAL: ${p.goal}\nBUSINESS: ${JSON.stringify({ name: profile.name, summary: profile.oneLineSummary, audience: profile.audience, facts: profile.facts.map((f) => f.statement) }).slice(0, 3000)}`,
        schema: PreviewIdeasSchema,
        inputBudget: 2_500,
        outputBudget: 900,
        deadlineMs: 45_000,
      },
      rates,
    );
    if (!ideasRes.ok) {
      await ctx.runMutation(internal.preview.update, { token, patch: { stepKey: "planning", stepStatus: "failed", addCostMicros: ideasRes.costMicros } });
      await fail("We understood your business but couldn't draft ideas just now. Create an account to get your full plan.");
      return;
    }
    const ideas = (ideasRes.output as { ideas: { title: string; channel: string; why: string; firstStep: string; role: string }[] }).ideas
      .slice(0, 3)
      .map((i) => ({ ...i, title: i.title.slice(0, 120), why: i.why.slice(0, 300), firstStep: i.firstStep.slice(0, 200), role: ROLE_LABEL[i.role] ?? "AI CMO" }));
    await ctx.runMutation(internal.preview.update, { token, patch: { status: "done", stepKey: "planning", stepStatus: "done", ideas, addCostMicros: ideasRes.costMicros } });
  },
});
