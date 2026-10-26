import { v } from "convex/values";
import { currentRateVersion } from "../shared/economics";
import { BUILT_IN_ROUTE, modelOptions, userRoute } from "../shared/ai/modelChoice";
import { query } from "./_generated/server";
import { planJob, maxJobMicros } from "./lib/jobPlans";
import { canChooseModel, defaultModelRoute } from "./lib/modelRoute";
import { optionalUser } from "./lib/tenancy";

const choiceKind = v.union(v.literal("onboarding_research"), v.literal("strategy"), v.literal("content_social"), v.literal("content_ads"), v.literal("content_email"), v.literal("content_seo"));

/**
 * The model selector for the signed-in user. Users an operator hasn't enabled
 * get `canChoose: false` and no options, so no selector is shown and every run
 * uses the operator defaults. Options are cheapest first; only models whose
 * provider key is configured are listed, each with this job's worst-case cost.
 */
export const myModelChoice = query({
  args: { kind: v.optional(choiceKind), aiMode: v.optional(v.union(v.literal("basic"), v.literal("expert"))) },
  handler: async (ctx, { kind, aiMode }) => {
    const user = await optionalUser(ctx);
    if (!user || !(await canChooseModel(ctx, user._id))) return { canChoose: false as const, options: [], defaultModel: null };
    const route = await defaultModelRoute(ctx);
    const plan = kind ? planJob(kind, kind === "onboarding_research" ? { pages: 3 } : {}, { mode: aiMode ?? "basic" }) : null;
    const options = modelOptions(currentRateVersion())
      .filter((o) => o.available)
      .map((o) => ({ ...o, estimateMicros: plan ? maxJobMicros(plan, { route: userRoute(o.key) }) : null }));
    return {
      canChoose: true as const,
      options,
      defaultModel: route.standard,
      defaultEstimateMicros: plan ? maxJobMicros(plan, { route }) : null,
      builtInDefault: BUILT_IN_ROUTE.standard,
    };
  },
});
