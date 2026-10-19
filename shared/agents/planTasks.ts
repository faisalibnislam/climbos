/**
 * The growth-plays and plan tasks, shared by the plan job and the bench so
 * the evaluation runs exactly what production runs.
 */
import { CLIMBOS_ENGINES } from "./capacity";
import { fitJson, reportDropped } from "./context";
import { DECISION_FIELDS } from "./decision";
import { capsHint, PLAN_CAPS, PLAYS_CAPS } from "./wordCaps";

const INTEL = "BUSINESS INTELLIGENCE (researched earlier; competitors, customer language, objections, gaps):";

/** S5 flag: replaces the skill's fixed portfolio shape with a focused decision (REQ-STRAT-04/05, REQ-OUT-03/04). */
export const DECISION_CONTRACT = `DECISION CONTRACT (overrides the skill's portfolio shape): choose the smallest set of plays (1 to 4) that attacks the binding constraint. Often that's one primary motion, one supporting move and any necessary maintenance. Fixing the offer, conversion, retention or capacity can outrank new acquisition when that's the constraint. Use creative plays only when the mechanism fits this business; novelty and channel count earn nothing. If the plays can't reach the goal, don't stretch the numbers: ClimbOS shows the gap, and the plan names the constraint and the options.`;

export function playsTask(o: { scorecard: string; insights: string; horizonDays?: number; engines?: string; decisionContract?: boolean }): string {
  const h = o.horizonDays || 90;
  return `${o.decisionContract ? `${DECISION_CONTRACT} Choose this business's growth plays for the goal, within the stated budget and the owner's time. ${DECISION_FIELDS}` : "Choose this business's growth-plays portfolio for the goal, within the stated budget and the owner's time: one bankable play, one or two creative-but-proven plays (a proven mechanic on a non-obvious audience, asset or moment for THIS business), and at most one capped moonshot."} Go beyond social posts and email whenever something else would move the goal more. Give every play's model from cited base rates: weekly reach and each step's most-likely rate, each with the low and high of the cited range (ClimbOS computes the P10/P50/P90 forecast from them; don't write forecasts). Tag where every number comes from: owner (only a number the owner actually gave in the brief or facts), research (a page you read; give its exact URL and copy the sentence that states the number into quote), benchmark (name it), planned (spend or hours you propose within the owner's limits) or assumption; never dress an assumption up as research. ClimbOS loads cited pages and checks the quotes. Give each a test with kill and scale rules and a first action for today. Be ambitious: together the plays must credibly move the goal within ${h} days (a real volume engine with weekly numbers, run by ClimbOS where it can), not just validate assumptions, and each play must be a distinct move. Rates come from the evidence; volume comes from engines ClimbOS can run. If even an ambitious plan can't reach the goal, say so plainly: ClimbOS shows the owner the gap. Keep each play card short and plain. Fill economics (revenue per customer per month, contribution margin, monthly churn, each tagged with its source) and each play's model; ClimbOS computes customers, cost per customer and payback from them and sends back plays that lose money. ${capsHint(PLAYS_CAPS)}${o.scorecard}\n\n${o.engines ?? CLIMBOS_ENGINES}\n\n${INTEL}\n${o.insights}`;
}

export function planTask(o: { locked: string; plays: unknown | null; scorecard: string; insights: string; horizonDays?: number; engines?: string }): string {
  const h = o.horizonDays || 90;
  const plays = o.plays ? ` Build it around these growth plays (keep them as chosen; make channels, phases, the week-one checklist, North Star and measurement serve them):\n${reportDropped("plan plays", fitJson(o.plays, 32_000, "plays"))}` : "";
  return `${o.locked ? `${o.locked}\n\n` : ""}Create the ${h}-day growth plan for the goal, within the stated budget and the owner's time.${plays}${o.scorecard}\nList strong channels left for later in notDoing, with the reason. Write for a busy owner: short sentences, no repeated thresholds; put the numbers where they're used. ${capsHint(PLAN_CAPS)}\n\n${o.engines ?? CLIMBOS_ENGINES}\n\n${INTEL}\n${o.insights}`;
}
