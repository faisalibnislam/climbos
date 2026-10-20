/**
 * Three confidence judgments per play, kept apart (cycle 2): evidence that the
 * problem is real, evidence that this fix works, and evidence for the forecast.
 * A single "85% confidence" hides that a plan can be sure onboarding is broken,
 * unsure this repair helps, and unable to forecast revenue. Computed in code
 * from the diagnosis and the play's own sources, never written by the model.
 */
import type { Diagnosis } from "./diagnosis";
import { playStage } from "./diagnosis";
import type { Economics, PlayLike } from "./economics";
import { forecastBasis } from "./provenance";

export type EvidenceLevel = "strong" | "some" | "weak";

export interface PlayConfidence {
  problem: EvidenceLevel;
  fix: EvidenceLevel;
  forecast: EvidenceLevel;
  why: { problem: string; fix: string; forecast: string };
}

type ConfPlay = PlayLike & { name?: string; oneLiner?: string; mechanic?: string; firstActionToday?: string; test?: string; model?: { steps?: { source?: string }[] } & PlayLike["model"] };

export function playConfidence(play: ConfPlay, economics: Economics, diagnosis?: Diagnosis | null): PlayConfidence {
  // Problem: do the owner's numbers show this play's target is the weak link?
  const stage = playStage(`${play.name ?? ""} ${play.oneLiner ?? ""} ${play.mechanic ?? ""} ${play.firstActionToday ?? ""} ${play.test ?? ""}`);
  let problem: EvidenceLevel = "weak";
  let pWhy = "No funnel numbers show this is the weak link yet.";
  if (diagnosis && diagnosis.constraint !== "unknown" && diagnosis.basis !== "none") {
    if (stage === diagnosis.constraint) {
      problem = diagnosis.basis === "measured" ? "strong" : "some";
      pWhy = `Your numbers show ${diagnosis.constraint} is the weak link${diagnosis.basis === "measured" ? "" : " (some numbers missing)"}.`;
    } else pWhy = `Your numbers point to ${diagnosis.constraint}; this play works on ${stage}.`;
  }
  // Fix: what the play's funnel rates rest on.
  const sources = (play.model?.steps ?? []).map((s) => s.source ?? "assumption");
  const weakSource = (s: string) => s === "assumption" || s === "planned" || s === "unlabelled";
  let fix: EvidenceLevel = "weak";
  let fWhy = "Its rates are assumptions to test.";
  if (sources.length && sources.every((s) => s === "owner")) {
    fix = "strong";
    fWhy = "Its rates come from your own results.";
  } else if (sources.length && !sources.some(weakSource)) {
    fix = "some";
    fWhy = "Its rates come from research or benchmarks, not your own results.";
  } else if (sources.some((s) => !weakSource(s))) {
    fWhy = "Some rates are sourced; the rest are assumptions to test.";
  }
  // Forecast: sourced estimate vs scenario, and whether what a customer is worth is known.
  let forecast: EvidenceLevel = "weak";
  let cWhy = "A scenario on assumed inputs, not a forecast.";
  if (play.model?.steps?.length) {
    const b = forecastBasis(play as PlayLike & { model: NonNullable<PlayLike["model"]> }, economics).customers;
    if (b.kind === "sourced_estimate" && !(economics.assumed ?? []).length) {
      forecast = fix === "strong" ? "strong" : "some";
      cWhy = fix === "strong" ? "Built on your own results and numbers." : "Built on sourced inputs; your results will firm it up.";
    } else if (b.kind === "sourced_estimate") cWhy = "Sourced rates, but what a customer is worth is assumed.";
  }
  return { problem, fix, forecast, why: { problem: pWhy, fix: fWhy, forecast: cWhy } };
}
