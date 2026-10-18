import { describe, expect, it } from "vitest";
import { CREDIT_EXAMPLES, currentRateVersion, microsToCredits } from "../../shared/economics";
import { estimateRun } from "../../convex/engine";
import { planJob, type JobKind } from "../../convex/lib/jobPlans";

/** The pricing page's "what things cost" table must match the live worst-case estimates. */
describe("credit examples", () => {
  it("match the engine's estimates", () => {
    process.env.CLIMBOS_ENGINE = "v2";
    const rates = currentRateVersion();
    const actual = CREDIT_EXAMPLES.map((e) => {
      if (e.kind === "image") return { ...e, basic: microsToCredits(Math.ceil(rates.services.imageAttempt * 1_000_000)) };
      const cost = (mode: "basic" | "expert") => microsToCredits(estimateRun(planJob(e.kind as JobKind, { quantity: 3, images: 0 }, { mode }).steps, rates.id, { repair: false }).costMicros);
      return { ...e, basic: cost("basic"), ...(e.expert !== undefined ? { expert: cost("expert") } : {}) };
    });
    delete process.env.CLIMBOS_ENGINE;
    expect(CREDIT_EXAMPLES).toEqual(actual);
  });
});
