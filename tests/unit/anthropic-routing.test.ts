import { describe, expect, it, vi } from "vitest";
import { BUILT_IN_ROUTE, routeModelKey, runModel } from "../../shared/ai/modelChoice";
import { ADVANCED_SLOT, STANDARD_SLOT, ROUTE_VERSION, routeModels, draftsFor, expertEscalationModel, phaseTokenLimits } from "../../shared/agents/routes";
import { currentRateVersion, getRateVersion, modelCallCostUsd } from "../../shared/economics/rates";
import { socialSpec } from "../../shared/agents/specs";
import { planJob } from "../../convex/lib/jobPlans";

describe("Haiku/Sonnet default policy", () => {
  it("uses Sonnet from the first strategy/copy draft and through review; routine work uses Haiku", () => {
    for (const id of ["growth_plays", "growth_strategy", "channel_fit", "social_posts", "seo_brief", "business_model_check"]) {
      const slots = routeModels(id);
      expect(routeModelKey(BUILT_IN_ROUTE, slots.research)).toBe("claude-haiku-5.5");
      for (const model of [slots.draft, slots.critic, slots.revise!]) expect(routeModelKey(BUILT_IN_ROUTE, model)).toBe("claude-sonnet-5.5");
      expect(draftsFor(id)).toBe(1);
      expect(expertEscalationModel(id, "expert")).toBeUndefined();
    }
    expect(routeModelKey(BUILT_IN_ROUTE, routeModels("prospecting").draft)).toBe("claude-haiku-5.5");
  });
  it("keeps stored provider routes and legacy phase policy unchanged", () => {
    const old = { standard: "gpt-6-luna", advanced: "gpt-6.1-sol", source: "default" as const };
    const models = routeModels("growth_strategy", "basic", "legacy-openai");
    expect(runModel({ modelRoute: old }, models.draft)).toBe("gpt-6-luna");
    expect(draftsFor("growth_strategy", "basic", "legacy-openai")).toBe(2);
    expect(expertEscalationModel("growth_strategy", "expert", "legacy-openai")).toBe(ADVANCED_SLOT);
    expect(routeModelKey({ ...BUILT_IN_ROUTE, standard: "claude-sonnet-5.5" }, STANDARD_SLOT)).toBe("claude-sonnet-5.5");
    expect(BUILT_IN_ROUTE.policy).toBe(ROUTE_VERSION);
  });
  it("reduces oversized output reservations without removing review", () => {
    expect(phaseTokenLimits("social_posts", { research: 24000, draft: 32000, critic: 16000 })).toEqual({ research: 8000, draft: 12000, critic: 6000 });
    expect(phaseTokenLimits("growth_plays", { research: 24000, draft: 40000, critic: 16000 }).draft).toBe(32000);
  });
  it("quotes the same quantity-sized output room that the social worker uses", () => {
    const single = socialSpec(["instagram"], { outputItems: 1 });
    const batch = socialSpec(["instagram"], { outputItems: 6 });
    vi.stubEnv("CLIMBOS_ENGINE", "v2");
    const quote = planJob("content_social", { quantity: 6, channel: "instagram" });
    vi.unstubAllEnvs();
    expect(single.maxTokens.draft).toBe(12000);
    expect(batch.maxTokens.draft).toBeGreaterThan(single.maxTokens.draft);
    expect(batch.maxTokens.draft).toBeLessThanOrEqual(32000);
    expect(quote.steps.some((step) => step.kind === "model" && step.outputBudget === batch.maxTokens.draft)).toBe(true);
    expect(batch.maxRevisions).toBe(single.maxRevisions);
  });
  it("meters Haiku's long-context tier including cache input, without rewriting old rates", () => {
    const now = currentRateVersion(new Date("2026-11-09T12:00:00Z"));
    expect(now.id).toBe("anthropic-2026-11-09");
    const h = now.models["claude-haiku-5.5"];
    expect(modelCallCostUsd(h, { inputTokens: 100000, outputTokens: 1000 })).toBeCloseTo(0.0105);
    expect(modelCallCostUsd(h, { inputTokens: 100001, outputTokens: 1000 })).toBeCloseTo(0.0525005);
    expect(modelCallCostUsd(h, { inputTokens: 1, cacheReadTokens: 100000, outputTokens: 1000 })).toBeCloseTo(0.0075005);
    expect(getRateVersion("verified-2026-10-17").models["claude-haiku-5.5"].longContext).toBeUndefined();
    expect(currentRateVersion(new Date("2027-01-02")).models["claude-haiku-5.5"].longContext).toBeDefined();
  });
});
