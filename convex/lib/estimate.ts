import { getRateVersion, stressedDeliveryCostMicros, usdToMicrosCeil } from "../../shared/economics";
import { VIDEO_ROUTE, worstCaseStepMicros } from "../../shared/ai/models";
import type { Doc } from "../_generated/dataModel";

/* Pure cost estimate for a planned run (no Convex runtime imports), so tool
   descriptions and the evaluation harness can use it outside the engine. */

export interface PlannedStep {
  kind: "model" | "research" | "image" | "provider_write" | "compute";
  role?: Doc<"workflowSteps">["role"];
  modelKey?: string;
  inputBudget?: number;
  outputBudget?: number;
  webSearches?: number;
  scrapeCredits?: number;
  imageAttempts?: number;
  /** AI video seconds (Veo), priced per second. */
  videoSeconds?: number;
}

/**
 * Worst-case µUSD estimate for a plan of steps. v1 single-call jobs also
 * reserve one repair of the costliest model step; Engine v2 agents reserve
 * each revision round separately when it starts, so they pass repair: false.
 */
export function estimateRun(steps: PlannedStep[], rateVersionId: string, opts: { repair?: boolean } = {}) {
  const rates = getRateVersion(rateVersionId);
  let ai = 0;
  let image = 0;
  let research = 0;
  let maxModelStep = 0;
  let modelSteps = 0;
  for (const s of steps) {
    if (s.kind === "model" && s.modelKey) {
      const c = worstCaseStepMicros(s.modelKey as never, s.inputBudget ?? 0, s.outputBudget ?? 0, rates);
      ai += c;
      maxModelStep = Math.max(maxModelStep, c);
      modelSteps++;
    }
    if (s.webSearches) research += usdToMicrosCeil(s.webSearches * rates.services.searchCall);
    if (s.scrapeCredits) research += usdToMicrosCeil(s.scrapeCredits * rates.services.scrapeCredit);
    if (s.imageAttempts) image += usdToMicrosCeil(s.imageAttempts * rates.services.imageAttempt);
    if (s.videoSeconds) image += usdToMicrosCeil(s.videoSeconds * VIDEO_ROUTE.perSecondUsd);
  }
  const repair = opts.repair === false ? 0 : maxModelStep;
  const costMicros = ai + repair + image + research;
  const topupCostMicros = stressedDeliveryCostMicros({
    aiMicros: ai + repair,
    imageMicros: image,
    researchMicros: research,
    modelSteps: modelSteps + 1,
  });
  return { costMicros, topupCostMicros, modelSteps };
}
