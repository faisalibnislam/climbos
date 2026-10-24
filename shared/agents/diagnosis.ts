/**
 * Diagnosis in code (expansion cycle 2; Rumelt BK01 Ch 5 diagnosis and Ch 8
 * chain links; Book 14 §3). The owner's own funnel numbers decide which link
 * is weakest; the model only explains it and names a competing explanation.
 * Run 4 showed a model-written decision made plans worse, so the choice is
 * made here, deterministically, and is "unknown" when the numbers aren't there.
 *
 * Decision books (2026-10-20):
 * - Counts are read as Beta posteriors (Downey Ch 4; Kochenderfer §4.2): a
 *   small sample below a reference isn't evidence it is below, so verdicts
 *   need 90% posterior probability (references.ts DECISION_THRESHOLDS).
 * - Diagnosis is a set of competing hypotheses with observations, support,
 *   conflicts and the measurement that would tell them apart. The weakest
 *   link is an observation, not a proven cause (Hernán & Robins Ch 1, 7):
 *   the lowest rate isn't automatically the most valuable fix, so each
 *   link's customers per +1 point is shown and the owner compares evidence,
 *   cost and delay.
 * - Inputs are checked before reading: counts must nest, the period must
 *   cover the sales cycle, and the SaaS reference depends on the signup
 *   model. Contradictions return a resolution task, not a confident plan.
 */
import type { BindingConstraint } from "./decision";
import { betaPosterior, probBelow, probLess, type BetaPosterior } from "../analysis/bayes";
import { REFERENCES, DECISION_THRESHOLDS, conversionReference, type ReferenceRule, type SignupKind } from "./references";

/** The owner's last-period funnel (all optional; counts over `periodDays`). */
export interface OwnerFunnel {
  periodDays?: number;
  /** People who saw the offer (site visitors, profile views, walk-bys). */
  visitors?: number;
  /** Signups, trials, leads or inquiries. */
  leads?: number;
  /** Leads who reached first value: got the result they came for (booked, attended, first report used), not just finished setup. */
  activated?: number;
  /**
   * What the owner counted as "activated" (blog research BRP-07, Elena Verna: activation is value
   * received, not setup finished). "setup" or "unknown" makes the activation link a weaker reading.
   */
  activationKind?: "value" | "habit" | "setup" | "unknown";
  /** New paying customers (or completed paid jobs). */
  newCustomers?: number;
  /** For SaaS: what a signup is (free plan, trial without card, trial with card). Picks the reference; unknown means none. */
  signupKind?: SignupKind;
}

export interface DiagnosisContext {
  funnel?: OwnerFunnel | null;
  /** Monthly churn as a share (owner-reported or measured). */
  monthlyChurn?: number | null;
  /** Most new customers a month the business can take. */
  newCustomersPerMonth?: number | null;
  /** Library business types (for which reference ranges apply). */
  types?: string[];
  /** Typical days from lead to purchase; a shorter period can't show purchases yet. */
  salesCycleDays?: number;
}

export interface StageReading {
  stage: "reach" | "lead" | "activation" | "purchase" | "retention" | "capacity";
  /** e.g. "12 of 100 leads reached first value". */
  observed: string;
  rate: number | null;
  /** Reference range and its grade, when one exists; null means no reliable benchmark. */
  reference: string | null;
  verdict: "weak" | "watch" | "ok" | "unknown";
  /** 90% credible range of the true rate (uniform prior), when counts were given. */
  likely?: { low: number; high: number };
  /** P(true rate < the reference's low end), when a reference applies. */
  probBelowReference?: number;
  /** The period is shorter than the sales cycle: purchases are still arriving. */
  immature?: boolean;
  referenceId?: string;
}

export interface Hypothesis {
  constraint: BindingConstraint;
  /** What the numbers show: an observation, not a cause. */
  observation: string;
  /** P(this link is the weaker of the competing measured links); null when not computable. */
  probability: number | null;
  support: string[];
  against: string[];
  /** The measurement that would tell this hypothesis apart from the others. */
  discriminate: string;
}

export interface NextMeasurement {
  /** One next question or measurement action, selected from the missing inputs. */
  action: string;
  reason: string;
  priority: "decision_critical" | "useful";
}

export interface Diagnosis {
  /** The binding constraint, or unknown when the owner's numbers can't tell. */
  constraint: BindingConstraint | "unknown";
  /** measured: from the owner's numbers; partial: some links missing; none: no numbers. */
  basis: "measured" | "partial" | "none";
  readings: StageReading[];
  /** The other explanation the plan must rule in or out. */
  competing: string;
  /** What to measure next when the diagnosis is weak or unknown. */
  missing: string[];
  /** One highest-priority next measurement, to avoid overwhelming the owner with every gap at once. */
  nextMeasurement?: NextMeasurement;
  /**
   * supported: one link is the weaker with ≥80% probability (still an observation, not a cause);
   * ambiguous: two links compete; insufficient_evidence: too few numbers;
   * conflicting_inputs: the counts contradict each other (resolve first).
   * Absent on diagnoses saved before 2026-10-20.
   */
  status?: "supported" | "ambiguous" | "insufficient_evidence" | "conflicting_inputs";
  hypotheses?: Hypothesis[];
  /** Contradictions in the owner's numbers, each a task to resolve before planning on them. */
  conflicts?: string[];
  /** New customers a month gained per +1 percentage point at each measured link, other rates held (illustrative arithmetic, not an attainable lift). */
  leverage?: { stage: StageReading["stage"]; perPoint: number }[];
  /** Rules used, with versions (references.ts). */
  rules?: string[];
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const r2 = (x: number) => Math.round(x * 100) / 100;
const SAAS = new Set(["b2b_saas", "b2c_saas", "ai_product", "developer_tools", "enterprise_software"]);
const T = DECISION_THRESHOLDS;
/** Screening threshold only; reaching it is not evidence that capacity is binding. */
const CAPACITY_WATCH_RATIO = 0.8;

const COMPETING: Record<BindingConstraint | "unknown", string> = {
  demand: "The few who arrive may be the wrong people (positioning or targeting), not too few people.",
  activation: "Signups may be the wrong fit (traffic quality or promise mismatch) rather than the product being hard to start.",
  conversion: "Price or packaging may block the purchase rather than the product failing to show value.",
  offer: "Buyers may not understand the offer (communication) rather than not wanting it.",
  positioning: "The product may not deliver the promised value rather than being described poorly.",
  retention: "Customers may leave for budget or seasonality reasons rather than weak recurring value; some loss is normal at any size.",
  delivery: "Demand may exceed capacity only at peak times; scheduling or pricing could free room.",
  economics: "Costs may be misallocated rather than the model being unprofitable.",
  unknown: "Without the owner's funnel numbers any constraint is a guess.",
};

/** The measurement that separates a hypothesis from its rival. */
const DISCRIMINATE: Partial<Record<BindingConstraint, string>> = {
  activation: "Ask 5–10 recent signups who didn't reach first value what stopped them, and check where they came from: wrong-fit traffic points to targeting, right-fit people stalling points to onboarding.",
  conversion: "Ask activated people who didn't buy why not, and record the reason (price, package, timing, trust) for each.",
  demand: "Compare lead quality by source for a week: if the right people convert well, more of them helps; if not, fix targeting first.",
  retention: "List the last 10–20 cancellations by reason and month (failed payment, early, near renewal).",
  delivery: "Count turned-away or delayed jobs for two weeks.",
};

/** Read the funnel. Capacity and retention override; otherwise competing links are compared on posteriors. */
export function diagnose(ctx: DiagnosisContext): Diagnosis {
  const f = ctx.funnel ?? {};
  const days = f.periodDays && f.periodDays > 0 ? f.periodDays : 30;
  const perMonth = (n: number) => (n * 30) / days;
  const readings: StageReading[] = [];
  const missing: string[] = [];
  const conflicts: string[] = [];
  const rules: string[] = [`${T.id}@${T.version}`];
  const saas = (ctx.types ?? []).some((t) => SAAS.has(t));
  const immature = ctx.salesCycleDays !== undefined && ctx.salesCycleDays > days;

  // 0. Do the counts nest? Contradictions are resolved before anything is read from them.
  const gt = (a: number | undefined, b: number | undefined) => a !== undefined && b !== undefined && a > b;
  if (gt(f.leads, f.visitors)) conflicts.push(`${f.leads} leads but only ${f.visitors} visitors: check what each counts (visitors may be one channel only).`);
  if (gt(f.activated, f.leads)) conflicts.push(`${f.activated} reached first value but only ${f.leads} leads: one of the two counts is off.`);
  if (gt(f.newCustomers, f.leads) && f.leads !== undefined) conflicts.push(`${f.newCustomers} new customers but only ${f.leads} leads: some buyers may skip the lead step, or a count is off.`);
  if (gt(f.newCustomers, f.activated) && !gt(f.newCustomers, f.leads)) conflicts.push(`${f.newCustomers} paid but only ${f.activated} reached first value: either people pay before first value (then first value isn't on the path to paying) or a count is off.`);
  for (const [k, n] of Object.entries({ visitors: f.visitors, leads: f.leads, activated: f.activated, newCustomers: f.newCustomers })) if (n !== undefined && !(Number.isFinite(n) && n >= 0)) conflicts.push(`${k} must be a count of zero or more.`);
  if (ctx.newCustomersPerMonth !== undefined && ctx.newCustomersPerMonth !== null && !(Number.isFinite(ctx.newCustomersPerMonth) && ctx.newCustomersPerMonth >= 0)) conflicts.push("Capacity must be a number of zero or more new customers a month.");

  // Capacity binds before anything else: more demand can't be served.
  const cap = ctx.newCustomersPerMonth;
  if (cap !== undefined && cap !== null && Number.isFinite(cap) && cap >= 0) {
    if (cap === 0) {
      readings.push({ stage: "capacity", observed: "no capacity for new customers (owner reported a limit of 0 per month)", rate: null, reference: null, verdict: "weak" });
    } else if (f.newCustomers !== undefined && Number.isFinite(f.newCustomers) && f.newCustomers >= 0) {
      const monthly = perMonth(f.newCustomers);
      const use = monthly / cap;
      readings.push({
        stage: "capacity",
        observed: `${Math.round(monthly * 10) / 10} new customers a month against room for ${cap}`,
        rate: use,
        reference: null,
        verdict: use >= 1 ? "weak" : use >= CAPACITY_WATCH_RATIO ? "watch" : "ok",
      });
    }
  }
  // Retention: only against a reference that exists (SaaS).
  if (ctx.monthlyChurn !== undefined && ctx.monthlyChurn !== null) {
    const ref = REFERENCES.saasChurn;
    if (saas) rules.push(`${ref.id}@${ref.version}`);
    readings.push({ stage: "retention", observed: `${pct(ctx.monthlyChurn)} of customers leave each month`, rate: ctx.monthlyChurn, reference: saas ? ref.text : null, verdict: saas ? (ctx.monthlyChurn > (ref.high ?? ref.low) ? "weak" : "ok") : "unknown", ...(saas ? { referenceId: ref.id } : {}) });
  }

  // Funnel links the owner measured, read as posteriors.
  const posts: Partial<Record<StageReading["stage"], BetaPosterior>> = {};
  const link = (stage: StageReading["stage"], num: number | undefined, den: number | undefined, label: string, ref?: ReferenceRule | null, isPurchase = false) => {
    if (num === undefined || den === undefined || !(den > 0) || num < 0 || num > den) return null;
    const post = betaPosterior(Math.round(num), Math.round(den));
    posts[stage] = post;
    const rate = num / den;
    const pBelow = ref ? probBelow(post, ref.low) : undefined;
    const late = isPurchase && immature;
    const verdict: StageReading["verdict"] = !ref || late || pBelow === undefined ? "unknown" : pBelow >= T.weakAt ? "weak" : 1 - pBelow >= T.weakAt ? "ok" : "unknown";
    if (ref) rules.push(`${ref.id}@${ref.version}`);
    const r: StageReading = { stage, observed: `${num} of ${den} ${label}`, rate, reference: ref?.text ?? null, verdict, likely: { low: post.low, high: post.high }, ...(pBelow !== undefined ? { probBelowReference: r2(pBelow) } : {}), ...(late ? { immature: true } : {}), ...(ref ? { referenceId: ref.id } : {}) };
    readings.push(r);
    return r;
  };
  const lead = link("lead", f.leads, f.visitors, "visitors became leads or signups");
  const act = link("activation", f.activated, f.leads, "leads reached first value");
  const buyFromActive = gt(f.newCustomers, f.activated) ? null : link("purchase", f.newCustomers, f.activated, "activated leads paid", undefined, true);
  // Overall lead → paid has a reference for SaaS by signup model; it tells whether activation × purchase is weak at all.
  const saasRef = saas ? conversionReference(f.signupKind) : null;
  const overall = f.newCustomers !== undefined && f.leads && !gt(f.newCustomers, f.leads) ? f.newCustomers / f.leads : null;
  const overallReading = !buyFromActive && overall !== null ? link("purchase", f.newCustomers, f.leads, "leads paid", saasRef, true) : null;

  if (f.visitors === undefined) missing.push("visitors in the period");
  if (f.leads === undefined) missing.push("signups or leads");
  if (f.activated === undefined) missing.push("how many reached first value");
  if (f.newCustomers === undefined) missing.push("new paying customers");
  if (saas && !saasRef && overall !== null) missing.push("whether a signup is a free plan, a trial without a card, or a trial with a card (picks the reference)");
  if (immature) missing.push(`a period of at least ${ctx.salesCycleDays} days (one sales cycle), so recent leads have had time to buy`);

  const capR = readings.find((r) => r.stage === "capacity");
  const retR = readings.find((r) => r.stage === "retention");
  const measuredLinks = [lead, act, buyFromActive].filter(Boolean).length + (overallReading ? 1 : 0);
  // A setup count isn't value received: it can't make the diagnosis "measured" on its own (BRP-07).
  const setupCount = f.activated !== undefined && (f.activationKind === "setup" || f.activationKind === "unknown");
  if (setupCount) missing.push("a first-value event (the count given is setup or unclear, not value received)");
  const basis: Diagnosis["basis"] = measuredLinks >= 2 && !setupCount && !conflicts.length ? "measured" : measuredLinks >= 1 || capR || retR ? "partial" : "none";

  const nextMeasurement: NextMeasurement | undefined = conflicts.length
    ? undefined
    : f.newCustomers === undefined
      ? { action: `Count new paying customers in the same ${days}-day period (include zero if there were none).`, reason: "This is the outcome the growth plan needs to explain; without it, the system cannot tell whether the business is gaining customers.", priority: "decision_critical" }
      : saas && !saasRef && overall !== null
        ? { action: "Confirm whether a signup is a free plan, a trial without a card, or a trial with a card.", reason: "That choice changes which comparison range, if any, is appropriate.", priority: "decision_critical" }
        : setupCount
          ? { action: "Count how many leads reached first customer value, not just how many finished setup.", reason: "Setup completion can hide whether customers actually received the product's promised value.", priority: "decision_critical" }
          : f.activated === undefined && f.leads !== undefined
            ? { action: "Count how many leads reached first customer value in the same period.", reason: "This separates an onboarding or product-value problem from a purchase problem.", priority: "useful" }
            : f.leads === undefined && f.visitors !== undefined
              ? { action: `Count how many of those ${f.visitors} visitors became leads or signups.`, reason: "This shows whether the offer turns existing attention into a real buying conversation.", priority: "useful" }
              : f.visitors === undefined && f.leads !== undefined
                ? { action: "Count how many people saw the offer in the same period (for example, relevant site visitors or profile views).", reason: "A lead count without the number of people who saw the offer cannot show whether the business needs more reach.", priority: "useful" }
                : immature
                  ? { action: `Wait until the measurement period covers at least ${ctx.salesCycleDays} days, then compare the same funnel counts again.`, reason: "Some recent leads may still be deciding, so a shorter period can undercount purchases.", priority: "useful" }
                  : missing.length
                    ? { action: `Confirm ${missing[0]}.`, reason: "This is the next unresolved input in the current diagnosis.", priority: "useful" }
                    : undefined;

  // Customers a month per +1 point at each link (other rates held): shows the lowest rate isn't automatically the biggest lever.
  const leverage: NonNullable<Diagnosis["leverage"]> = [];
  const down = (stage: "lead" | "activation" | "purchase") => (stage === "lead" ? (act && buyFromActive ? act.rate! * buyFromActive.rate! : overall) : stage === "activation" ? (buyFromActive?.rate ?? null) : 1);
  if (lead && f.visitors) {
    const d = down("lead");
    if (d !== null) leverage.push({ stage: "lead", perPoint: r2(perMonth(f.visitors) * 0.01 * d) });
  }
  if (act && f.leads && buyFromActive) leverage.push({ stage: "activation", perPoint: r2(perMonth(f.leads) * 0.01 * buyFromActive.rate!) });
  if (buyFromActive && f.activated !== undefined) leverage.push({ stage: "purchase", perPoint: r2(perMonth(f.activated) * 0.01) });

  const hyp = (constraint: BindingConstraint, observation: string, probability: number | null, support: string[], against: string[]): Hypothesis => ({ constraint, observation, probability, support, against, discriminate: DISCRIMINATE[constraint] ?? "Collect one more period of the same counts." });
  const out = (constraint: Diagnosis["constraint"], status: NonNullable<Diagnosis["status"]>, hypotheses: Hypothesis[]): Diagnosis => ({
    constraint,
    basis,
    readings,
    competing: COMPETING[constraint],
    missing,
    ...(status !== "supported" && nextMeasurement ? { nextMeasurement } : {}),
    status,
    hypotheses,
    ...(conflicts.length ? { conflicts } : {}),
    ...(leverage.length ? { leverage } : {}),
    rules: [...new Set(rules)],
  });

  if (conflicts.length) {
    missing.unshift(...conflicts.map((c) => `Resolve: ${c}`));
    return out("unknown", "conflicting_inputs", []);
  }
  if (capR?.verdict === "weak") return out("delivery", "supported", [hyp("delivery", capR.observed, null, [capR.rate === null ? "The owner reported no capacity for additional customers." : "Recent customer volume reached or exceeded the owner's stated monthly limit."], [COMPETING.delivery])]);
  if (retR?.verdict === "weak") return out("retention", "supported", [hyp("retention", retR.observed, null, [`Above the ${REFERENCES.saasChurn.text}.`], [COMPETING.retention])]);

  // Is lead → paid weak at all? Only with a reference for this signup model, and only on posterior evidence.
  const weakOverall = overallReading && saasRef ? (overallReading.verdict === "weak" ? true : overallReading.verdict === "ok" ? false : null) : null;
  // Activation vs purchase-from-activated: which is weaker, with what probability?
  if (act && buyFromActive && weakOverall !== false) {
    const pAct = probLess(posts.activation!, posts.purchase!);
    const a = hyp("activation", `${act.observed} (${pct(act.rate!)})`, r2(pAct), [`P(activation is the weaker link) = ${r2(pAct)}.`], [COMPETING.activation]);
    const c = hyp("conversion", `${buyFromActive.observed} (${pct(buyFromActive.rate!)})`, r2(1 - pAct), [`P(purchase is the weaker link) = ${r2(1 - pAct)}.`], [COMPETING.conversion]);
    if (buyFromActive.immature) {
      missing.push("purchases from recent leads (the period is shorter than the sales cycle)");
      return out("unknown", "insufficient_evidence", [a, c]);
    }
    // Material too: with huge counts a half-point gap is "certain" but not a reason to pick one link (Kochenderfer Ex 19.3).
    const material = Math.abs(act.rate! - buyFromActive.rate!) / Math.max(act.rate!, buyFromActive.rate!, 1e-9) >= T.materialGap;
    if (material && pAct >= T.preferAt) return out("activation", "supported", [a, c]);
    if (material && 1 - pAct >= T.preferAt) return out("conversion", "supported", [c, a]);
    if (!material) missing.push("nothing: the two links convert within 10% of each other, so neither is clearly the weak one; compare the cost and evidence of fixing each");
    missing.push("more leads through both steps: the two links can't be told apart yet");
    return out("unknown", "ambiguous", pAct >= 0.5 ? [a, c] : [c, a]);
  }
  if (weakOverall === true) {
    // The lead → paid rate is weak, but without a first-value count it can't say which link (Kochenderfer Ch 6: a missing count that could flip the choice must be measured first).
    return out("unknown", "ambiguous", [
      hyp("activation", `${f.newCustomers} of ${f.leads} leads paid; first-value count missing`, null, ["Lead → paid is below the reference."], ["Unmeasured: could equally be purchase."]),
      hyp("conversion", `${f.newCustomers} of ${f.leads} leads paid; first-value count missing`, null, ["Lead → paid is below the reference."], ["Unmeasured: could equally be activation."]),
    ]);
  }
  // Downstream fine and few people arriving: demand.
  if (f.visitors !== undefined && f.leads !== undefined && weakOverall === false && perMonth(f.visitors) < 1000)
    return out("demand", "supported", [hyp("demand", `${Math.round(perMonth(f.visitors))} visitors a month; lead → paid is at or above the reference`, null, ["Downstream converts normally."], [COMPETING.demand])]);
  return out("unknown", "insufficient_evidence", []);
}

/** The diagnosis as the plays and plan agents read it. */
export function diagnosisBrief(d: Diagnosis): string {
  const reading = (r: StageReading) =>
    `- ${r.stage}: ${r.observed}${r.rate !== null && r.stage !== "capacity" && r.stage !== "retention" ? ` (${pct(r.rate)}${r.likely ? `, likely ${pct(r.likely.low)}–${pct(r.likely.high)}` : ""})` : ""}${r.reference ? `; reference ${r.reference}` : "; no reliable benchmark"}${r.immature ? "; period shorter than the sales cycle, purchases still arriving" : ""}${r.verdict === "weak" ? " → weak" : r.verdict === "watch" ? " → near owner-stated capacity; leave room for normal variation" : ""}`;
  const lever = d.leverage?.length ? [`Customers a month per +1 point at each link (arithmetic only; which change is attainable is unknown): ${d.leverage.map((l) => `${l.stage} +${l.perPoint}`).join(", ")}. The lowest rate isn't automatically the best fix: compare evidence, cost and delay.`] : [];
  if (d.status === "conflicting_inputs")
    return [`DIAGNOSIS (computed from the owner's numbers): the counts contradict each other, so no constraint is named. Resolve first:`, ...(d.conflicts ?? []).map((c) => `- ${c}`), "The first step must be checking these counts. Keep plays cheap and reversible until they're consistent."].join("\n");
  if (d.constraint === "unknown") {
    const hyps = d.hypotheses?.length ? [`Competing hypotheses (none established): ${d.hypotheses.map((h) => `${h.constraint}${h.probability !== null ? ` (P weaker ${h.probability})` : ""}`).join(" vs ")}. To tell them apart: ${d.hypotheses[0].discriminate}`] : [];
    const next = d.nextMeasurement ? [`NEXT MEASUREMENT (${d.nextMeasurement.priority === "decision_critical" ? "needed before a firm decision" : "most useful next"}): ${d.nextMeasurement.action} Why: ${d.nextMeasurement.reason}`] : [];
    return [`DIAGNOSIS (computed from the owner's numbers): not enough evidence to name the binding constraint.`, ...d.readings.map(reading), ...hyps, ...lever, ...next, "Use this as the first measurement step; keep plays cheap and reversible until the diagnosis is supported."].join("\n");
  }
  const alt = d.hypotheses?.slice(1).filter((h) => h.probability !== null);
  return [
    `DIAGNOSIS (computed from the owner's numbers, ${d.basis}): the numbers point to ${d.constraint} as the weakest link. This is an observation about where people drop, not a proven cause.`,
    ...d.readings.map(reading),
    ...(alt?.length ? [`Alternative still possible: ${alt.map((h) => `${h.constraint} (P weaker ${h.probability})`).join(", ")}.`] : []),
    ...lever,
    `Competing explanation to check first: ${d.competing}${d.hypotheses?.[0] ? ` How: ${d.hypotheses[0].discriminate}` : ""}`,
    `The bankable play must work on this constraint (or say in notDoing why not). Don't add demand above it.`,
  ].join("\n");
}

/** Which constraint a play works on, from its own words (for the fit check). */
export function playStage(text: string): BindingConstraint {
  const t = text.toLowerCase();
  if (/\b(onboard\w*|activat\w*|first value|setup|set-up|getting started|aha|empty state|time to value)\b/.test(t)) return "activation";
  if (/\b(churn\w*|retention|retain\w*|renewal|win-?back|cancel\w*|re-?engage\w*|repeat purchase|loyalty)\b/.test(t)) return "retention";
  if (/\b(price increase|raise (?:the |our )?prices?|increase (?:the |our )?prices?|reprice|repricing)\b/.test(t)) return "economics";
  if (/\b(waitlist|capacity|hire|hiring|scheduling|selectiv\w*|fully booked)\b/.test(t)) return "delivery";
  if (/\b(checkout|pricing page|trial[- ]to[- ]paid|upgrade|paywall|plan page|sales call|proposal|close rate)\b/.test(t)) return "conversion";
  if (/\b(package|bundle|offer|guarantee|tier)\b/.test(t)) return "offer";
  if (/\b(positioning|homepage message|headline|comparison page|alternatives? page)\b/.test(t)) return "positioning";
  return "demand";
}

/**
 * The plays must work on the computed constraint: when it's activation,
 * conversion, retention or delivery, at least one play (the bankable one
 * first) must target it rather than only adding people at the top.
 * Only for a supported diagnosis: an ambiguous one mustn't force a single link.
 */
export function lintDiagnosisFit(plays: { name?: string; kind?: string; oneLiner?: string; mechanic?: string; firstActionToday?: string; test?: string }[], d: Diagnosis | undefined) {
  if (!d || d.basis === "none" || (d.status && d.status !== "supported") || !["activation", "conversion", "retention", "delivery"].includes(d.constraint)) return [];
  const hits = plays.some((p) => playStage(`${p.name ?? ""} ${p.oneLiner ?? ""} ${p.mechanic ?? ""} ${p.firstActionToday ?? ""} ${p.test ?? ""}`) === d.constraint);
  return hits ? [] : [{ severity: "error" as const, rule: "diagnosis_fit", message: `The owner's numbers show ${d.constraint} is the weak link, but no play works on it. Make the bankable play fix ${d.constraint} first; adding people at the top would feed the leak.`, path: "plays" }];
}

/** The owner's measured rates by stage, for sizing tests on real baselines (plan experiment lint). */
export function funnelRatesOf(d: Diagnosis | undefined): { lead?: number; activation?: number; purchase?: number } | undefined {
  if (!d) return undefined;
  const out: { lead?: number; activation?: number; purchase?: number } = {};
  for (const r of d.readings) if (r.rate !== null && (r.stage === "lead" || r.stage === "activation" || r.stage === "purchase")) out[r.stage] = r.rate;
  return Object.keys(out).length ? out : undefined;
}
