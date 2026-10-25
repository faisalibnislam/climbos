/**
 * Three confidence judgments per play, kept apart (cycle 2): evidence that the
 * problem is real, evidence that this fix works, and evidence for the forecast.
 * A single "85% confidence" hides that a plan can be sure onboarding is broken,
 * unsure this repair helps, and unable to forecast revenue. Computed in code
 * from the diagnosis and the play's own sources, never written by the model.
 *
 * Decision books (2026-10-20; Hernán & Robins Ch 1–3, Kohavi Ch 2 and 11):
 * a rate observed while a play ran describes what happened, not that the play
 * caused it. "Strong" fix evidence needs a comparison (a randomized or random
 * holdout outcome for this play); the owner's own rates make it "some". An
 * ambiguous diagnosis gives "some" problem evidence to each competing link.
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

export function playConfidence(play: ConfPlay, economics: Economics, diagnosis?: Diagnosis | null, opts: { comparativeEvidence?: boolean } = {}): PlayConfidence {
  // Problem: do the owner's numbers show this play's target is the weak link?
  const stage = playStage(`${play.name ?? ""} ${play.oneLiner ?? ""} ${play.mechanic ?? ""} ${play.firstActionToday ?? ""} ${play.test ?? ""}`);
  let problem: EvidenceLevel = "weak";
  let pWhy = "No funnel numbers show this is the weak link yet.";
  if (diagnosis?.status === "conflicting_inputs") pWhy = "Your numbers contradict each other; resolve them first.";
  else if (diagnosis && diagnosis.constraint === "unknown" && diagnosis.status === "ambiguous" && diagnosis.hypotheses?.some((h) => h.constraint === stage)) {
    problem = "some";
    pWhy = `Your numbers make ${stage} one of the competing weak links, not yet the clear one.`;
  } else if (diagnosis && diagnosis.constraint !== "unknown" && diagnosis.basis !== "none") {
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
  if (opts.comparativeEvidence) {
    fix = "strong";
    fWhy = "A comparison with people who didn't get it showed a difference.";
  } else if (sources.length && sources.every((s) => s === "owner")) {
    fix = "some";
    fWhy = "Its rates come from your own results, but without a comparison group they show what happened, not that this change caused it.";
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
    const ownRates = sources.length > 0 && sources.every((s) => s === "owner");
    if (b.kind === "sourced_estimate" && !(economics.assumed ?? []).length) {
      forecast = ownRates ? "strong" : "some";
      cWhy = ownRates
        ? "Built on your own results and numbers."
        : b.unchecked.some((input) => input.includes("source fit to this business unverified"))
          ? "A source quote matches, but its fit to this business is not established; compare with your results before treating it as a forecast."
          : b.unchecked.length
            ? "Some source inputs are not fully checked; compare them with your results before treating this as a forecast."
          : "Built on sourced inputs; your results will firm it up.";
    } else if (b.kind === "sourced_estimate") cWhy = "Sourced rates, but what a customer is worth is assumed.";
  }
  return { problem, fix, forecast, why: { problem: pWhy, fix: fWhy, forecast: cWhy } };
}
