import { PlaySchema, PlaysOutputSchema } from "./specs";

// The forecast engine deliberately writes null when it has no forecast basis.
const PersistedPlaySchema = PlaySchema.extend({
  forecastUncertainty: PlaySchema.shape.forecastUncertainty.nullable().optional(),
});

/**
 * Current growth plans carry source tags on their economics. Validate those
 * payloads again at the persistence boundary, where malformed or stale worker
 * output must not become a saved plan. Older plans without source tags remain
 * readable and writable through the compatibility path.
 */
export function assertCurrentExpertGrowthPayload(plays: unknown, economics: unknown): void {
  if (!economics || typeof economics !== "object" || !("sources" in economics)) return;

  // Owner-confirmed margin/churn values can be attached after generation and
  // intentionally have no quotation. Normalize only for validation; preserve
  // the saved payload exactly as supplied.
  const candidate = structuredClone(economics) as { sources?: Record<string, { quote?: string } | undefined> };
  for (const tag of Object.values(candidate.sources ?? {})) {
    if (tag && typeof tag === "object" && tag.quote === undefined) tag.quote = "";
  }

  const economicsResult = PlaysOutputSchema.shape.economics.safeParse(candidate);
  if (!economicsResult.success) {
    const issue = economicsResult.error.issues[0];
    throw new Error(`Invalid current growth-plan economics at ${issue?.path.join(".") || "economics"}: ${issue?.message ?? "invalid value"}`);
  }
  const parsedEconomics = economicsResult.data;
  if (parsedEconomics.revenuePerCustomerMonthUsd < 0 || parsedEconomics.grossMargin < 0 || parsedEconomics.grossMargin > 1 || parsedEconomics.monthlyChurn < 0 || parsedEconomics.monthlyChurn > 1) {
    throw new Error("Invalid current growth-plan economics: revenue must be nonnegative and margin and churn must be between 0 and 1.");
  }

  const playCandidates = Array.isArray(plays) ? structuredClone(plays) as Record<string, unknown>[] : plays;
  if (Array.isArray(playCandidates)) {
    for (const play of playCandidates) {
      if (!play || typeof play !== "object") continue;
      const model = play.model;
      if (!model || typeof model !== "object") continue;
      const fields = model as Record<string, unknown>;
      for (const key of ["reachSource", "spendSource", "hoursSource", "otherSource"]) {
        const tag = fields[key];
        if (tag && typeof tag === "object" && !("quote" in tag)) (tag as Record<string, unknown>).quote = "";
      }
      if (Array.isArray(fields.steps)) {
        for (const step of fields.steps) {
          if (step && typeof step === "object" && !("quote" in step)) (step as Record<string, unknown>).quote = "";
        }
      }
    }
  }

  const playsResult = PersistedPlaySchema.array().safeParse(playCandidates);
  if (!playsResult.success) {
    const issue = playsResult.error.issues[0];
    throw new Error(`Invalid current growth-plan play at ${issue?.path.join(".") || "plays"}: ${issue?.message ?? "invalid value"}`);
  }
}
