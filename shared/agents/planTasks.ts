/**
 * The growth-plays and plan tasks, shared by the plan job and the bench so
 * the evaluation runs exactly what production runs.
 */
import { CLIMBOS_ENGINES } from "./capacity";
import { fitJson, reportDropped } from "./context";
import { capsHint, PLAN_CAPS, PLAYS_CAPS } from "./wordCaps";

const INTEL = "BUSINESS INTELLIGENCE (researched earlier; competitors, customer language, objections, gaps):";

export function playsTask(o: { scorecard: string; insights: string }): string {
  return `Choose this business's growth-plays portfolio for the goal, within the stated budget and the owner's time: one bankable play, one or two creative-but-proven plays (a proven mechanic on a non-obvious audience, asset or moment for THIS business), and at most one capped moonshot. Go beyond social posts and email whenever something else would move the goal more. Give every play's model from cited base rates: weekly reach and each step's most-likely rate, each with the low and high of the cited range (ClimbOS computes the P10/P50/P90 forecast from them; don't write forecasts). Tag where every number comes from: owner (only a number the owner actually gave in the brief or facts), research (a page you read; give its exact URL and copy the sentence that states the number into quote), benchmark (name it), planned (spend or hours you propose within the owner's limits) or assumption; never dress an assumption up as research. ClimbOS loads cited pages and checks the quotes. Give each a test with kill and scale rules and a first action for today. Be ambitious: together the plays must credibly move the goal within 90 days (a real volume engine with weekly numbers), not just validate assumptions. Keep each play card short and plain. Fill economics (revenue per customer per month, contribution margin, monthly churn, each tagged with its source) and each play's model; ClimbOS computes customers, cost per customer and payback from them and sends back plays that lose money. ${capsHint(PLAYS_CAPS)}${o.scorecard}\n\n${CLIMBOS_ENGINES}\n\n${INTEL}\n${o.insights}`;
}

export function planTask(o: { locked: string; plays: unknown | null; scorecard: string; insights: string }): string {
  const plays = o.plays ? ` Build it around these growth plays (keep them as chosen; make channels, phases, the week-one checklist, North Star and measurement serve them):\n${reportDropped("plan plays", fitJson(o.plays, 32_000, "plays"))}` : "";
  return `${o.locked ? `${o.locked}\n\n` : ""}Create the 90-day growth plan for the goal, within the stated budget and the owner's time.${plays}${o.scorecard}\nList strong channels left for later in notDoing, with the reason. Write for a busy owner: short sentences, no repeated thresholds; put the numbers where they're used. ${capsHint(PLAN_CAPS)}\n\n${CLIMBOS_ENGINES}\n\n${INTEL}\n${o.insights}`;
}
