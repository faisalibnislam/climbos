/**
 * Diagnosis in code (expansion cycle 2; Rumelt BK01 Ch 5 diagnosis and Ch 8
 * chain links; Book 14 §3). The owner's own funnel numbers decide which link
 * is weakest; the model only explains it and names a competing explanation.
 * Run 4 showed a model-written decision made plans worse, so the choice is
 * made here, deterministically, and is "unknown" when the numbers aren't there.
 */
import type { BindingConstraint } from "./decision";

/** The owner's last-period funnel (all optional; counts over `periodDays`). */
export interface OwnerFunnel {
  periodDays?: number;
  /** People who saw the offer (site visitors, profile views, walk-bys). */
  visitors?: number;
  /** Signups, trials, leads or inquiries. */
  leads?: number;
  /** Leads who reached first value (activated, booked, attended, completed setup). */
  activated?: number;
  /** New paying customers (or completed paid jobs). */
  newCustomers?: number;
}

export interface DiagnosisContext {
  funnel?: OwnerFunnel | null;
  /** Monthly churn as a share (owner-reported or measured). */
  monthlyChurn?: number | null;
  /** Most new customers a month the business can take. */
  newCustomersPerMonth?: number | null;
  /** Library business types (for which reference ranges apply). */
  types?: string[];
}

export interface StageReading {
  stage: "reach" | "lead" | "activation" | "purchase" | "retention" | "capacity";
  /** e.g. "12 of 100 leads reached first value". */
  observed: string;
  rate: number | null;
  /** Reference range and its grade, when one exists; null means no reliable benchmark. */
  reference: string | null;
  verdict: "weak" | "ok" | "unknown";
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
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const SAAS = new Set(["b2b_saas", "b2c_saas", "ai_product", "developer_tools", "enterprise_software"]);

/** Practitioner ranges from skills/growth-plays/reference/base-rates.md (grade C). Only these are used as references. */
const REF = {
  trialToPaid: { low: 0.15, high: 0.25, text: "15–25% trial (no card) → paid, practitioner range, grade C" },
  freeToPaid: { low: 0.02, high: 0.05, text: "2–5% free user → paid, practitioner range, grade C" },
  saasChurn: { low: 0.03, high: 0.07, text: "3–7% monthly churn for small-business SaaS, practitioner range, grade C" },
};

const COMPETING: Record<BindingConstraint | "unknown", string> = {
  demand: "The few who arrive may be the wrong people (positioning or targeting), not too few people.",
  activation: "Signups may be the wrong fit (traffic quality or promise mismatch) rather than the product being hard to start.",
  conversion: "Price or packaging may block the purchase rather than the product failing to show value.",
  offer: "Buyers may not understand the offer (communication) rather than not wanting it.",
  positioning: "The product may not deliver the promised value rather than being described poorly.",
  retention: "Customers may leave for budget or seasonality reasons rather than weak recurring value.",
  delivery: "Demand may exceed capacity only at peak times; scheduling or pricing could free room.",
  economics: "Costs may be misallocated rather than the model being unprofitable.",
  unknown: "Without the owner's funnel numbers any constraint is a guess.",
};

/** Read the funnel. Weakest measured link wins; capacity and retention override when they bind. */
export function diagnose(ctx: DiagnosisContext): Diagnosis {
  const f = ctx.funnel ?? {};
  const days = f.periodDays && f.periodDays > 0 ? f.periodDays : 30;
  const perMonth = (n: number) => (n * 30) / days;
  const readings: StageReading[] = [];
  const missing: string[] = [];
  const saas = (ctx.types ?? []).some((t) => SAAS.has(t));

  // Capacity binds before anything else: more demand can't be served.
  const cap = ctx.newCustomersPerMonth;
  if (cap && f.newCustomers !== undefined) {
    const use = perMonth(f.newCustomers) / cap;
    readings.push({ stage: "capacity", observed: `${Math.round(perMonth(f.newCustomers))} new customers a month against room for ${cap}`, rate: use, reference: null, verdict: use >= 0.8 ? "weak" : "ok" });
  }
  // Retention: only against a reference that exists (SaaS).
  if (ctx.monthlyChurn !== undefined && ctx.monthlyChurn !== null) {
    readings.push({ stage: "retention", observed: `${pct(ctx.monthlyChurn)} of customers leave each month`, rate: ctx.monthlyChurn, reference: saas ? REF.saasChurn.text : null, verdict: saas ? (ctx.monthlyChurn > REF.saasChurn.high ? "weak" : "ok") : "unknown" });
  }
  // Funnel links the owner measured.
  const link = (stage: StageReading["stage"], num: number | undefined, den: number | undefined, label: string, ref?: { low: number; text: string }) => {
    if (num === undefined || den === undefined || !(den > 0)) return null;
    const rate = num / den;
    const r: StageReading = { stage, observed: `${num} of ${den} ${label}`, rate, reference: ref?.text ?? null, verdict: ref ? (rate < ref.low ? "weak" : "ok") : "unknown" };
    readings.push(r);
    return r;
  };
  const lead = link("lead", f.leads, f.visitors, "visitors became leads or signups");
  const act = link("activation", f.activated, f.leads, "leads reached first value");
  const buyFromActive = link("purchase", f.newCustomers, f.activated, "activated leads paid");
  // Overall lead → paid has a reference for SaaS trials; it tells whether activation × purchase is weak at all.
  const overall = f.newCustomers !== undefined && f.leads ? f.newCustomers / f.leads : null;
  if (!buyFromActive && overall !== null) link("purchase", f.newCustomers, f.leads, "leads paid", saas ? REF.trialToPaid : undefined);

  if (f.visitors === undefined) missing.push("visitors in the period");
  if (f.leads === undefined) missing.push("signups or leads");
  if (f.activated === undefined) missing.push("how many reached first value");
  if (f.newCustomers === undefined) missing.push("new paying customers");

  const capR = readings.find((r) => r.stage === "capacity");
  const retR = readings.find((r) => r.stage === "retention");
  const measuredLinks = [lead, act, buyFromActive].filter(Boolean).length + (overall !== null && !buyFromActive ? 1 : 0);
  const basis: Diagnosis["basis"] = measuredLinks >= 2 ? "measured" : measuredLinks === 1 || capR || retR ? "partial" : "none";
  const out = (constraint: Diagnosis["constraint"]): Diagnosis => ({ constraint, basis, readings, competing: COMPETING[constraint], missing });

  if (capR?.verdict === "weak") return out("delivery");
  if (retR?.verdict === "weak") return out("retention");
  // Lead → paid is weak (or unreferenced): blame the weaker of activation and purchase-from-activated.
  const weakOverall = saas && overall !== null ? overall < REF.trialToPaid.low : null;
  if (act && buyFromActive && weakOverall !== false) return out(act.rate! <= buyFromActive.rate! ? "activation" : "conversion");
  if (weakOverall === true) return out(act ? "activation" : "conversion");
  // Downstream fine and few people arriving: demand.
  if (f.visitors !== undefined && f.leads !== undefined && weakOverall === false && perMonth(f.visitors) < 1000) return out("demand");
  return out("unknown");
}

/** The diagnosis as the plays and plan agents read it. */
export function diagnosisBrief(d: Diagnosis): string {
  if (d.constraint === "unknown")
    return `DIAGNOSIS (computed from the owner's numbers): not enough numbers to name the binding constraint${d.missing.length ? ` (missing: ${d.missing.join(", ")})` : ""}. Include a first step that measures these, and keep plays cheap and reversible until they're known.`;
  return [
    `DIAGNOSIS (computed from the owner's numbers, ${d.basis}): the binding constraint is ${d.constraint}.`,
    ...d.readings.map((r) => `- ${r.stage}: ${r.observed}${r.rate !== null && r.stage !== "capacity" && r.stage !== "retention" ? ` (${pct(r.rate)})` : ""}${r.reference ? `; reference ${r.reference}` : "; no reliable benchmark"}${r.verdict === "weak" ? " → weak" : ""}`),
    `Competing explanation to check first: ${d.competing}`,
    `The bankable play must work on this constraint (or say in notDoing why not). Don't add demand above it.`,
  ].join("\n");
}

/** Which constraint a play works on, from its own words (for the fit check). */
export function playStage(text: string): BindingConstraint {
  const t = text.toLowerCase();
  if (/\b(onboard\w*|activat\w*|first value|setup|set-up|getting started|aha|empty state|time to value)\b/.test(t)) return "activation";
  if (/\b(churn\w*|retention|retain\w*|renewal|win-?back|cancel\w*|re-?engage\w*|repeat purchase|loyalty)\b/.test(t)) return "retention";
  if (/\b(waitlist|capacity|hire|hiring|scheduling|selectiv\w*|raise (?:the )?price|price increase|fully booked)\b/.test(t)) return "delivery";
  if (/\b(checkout|pricing page|trial[- ]to[- ]paid|upgrade|paywall|plan page|sales call|proposal|close rate)\b/.test(t)) return "conversion";
  if (/\b(package|bundle|offer|guarantee|tier)\b/.test(t)) return "offer";
  if (/\b(positioning|homepage message|headline|comparison page|alternatives? page)\b/.test(t)) return "positioning";
  return "demand";
}

/**
 * The plays must work on the computed constraint: when it's activation,
 * conversion, retention or delivery, at least one play (the bankable one
 * first) must target it rather than only adding people at the top.
 */
export function lintDiagnosisFit(plays: { name?: string; kind?: string; oneLiner?: string; mechanic?: string; firstActionToday?: string; test?: string }[], d: Diagnosis | undefined) {
  if (!d || d.basis === "none" || !["activation", "conversion", "retention", "delivery"].includes(d.constraint)) return [];
  const hits = plays.some((p) => playStage(`${p.name ?? ""} ${p.oneLiner ?? ""} ${p.mechanic ?? ""} ${p.firstActionToday ?? ""} ${p.test ?? ""}`) === d.constraint);
  return hits ? [] : [{ severity: "error" as const, rule: "diagnosis_fit", message: `The owner's numbers show ${d.constraint} is the weak link, but no play works on it. Make the bankable play fix ${d.constraint} first; adding people at the top would feed the leak.`, path: "plays" }];
}
