/**
 * Free, offline: re-run the plays and plan lint on saved bench outputs and count errors by rule.
 * The task text is rebuilt from the cached Formkit inputs the writers saw (insights, ClimbOS
 * engines, plays, locked numbers). Research notes aren't saved, so counts are an upper bound.
 *   TMPDIR=/private/tmp/claude-501/ npx tsx bench/lint-audit.mts [--samples]
 */
import { readFileSync, readdirSync } from "node:fs";
import { growthPlaysSpec, strategySpec } from "../shared/agents/specs";
import { factsBlock } from "../shared/ai/tasks";
import { CLIMBOS_ENGINES } from "../shared/agents/capacity";
import { lockedNumbers, portfolioP50 } from "../shared/agents/economics";

const samples = process.argv.includes("--samples");
const cache = JSON.parse(readFileSync("bench/cache/formkit.json", "utf8"));
const brief = [`BUSINESS: Formkit (https://formkit.app)`, `SUMMARY: ${cache.profile.oneLineSummary}`, `GOAL: Get more paying customers in the next 90 days (horizon 90 days, ad budget 600 USD/month)`, factsBlock(cache.profile.facts)].join("\n");
const facts = cache.profile.facts.map((f: { statement: string }) => f.statement);
const insights = `BUSINESS INTELLIGENCE:\n${JSON.stringify(cache.insights)}`;
type Issue = { rule: string; severity: string; message: string; path?: string };
const count = (xs: Issue[]) => xs.filter((x) => x.severity === "error").reduce<Record<string, number>>((a, x) => ((a[x.rule] = (a[x.rule] ?? 0) + 1), a), {});

for (const f of readdirSync("bench/results").filter((x) => x.endsWith(".json")).slice(-4)) {
  for (const r of JSON.parse(readFileSync(`bench/results/${f}`, "utf8"))) {
    for (const [arm, o] of Object.entries(r.outs ?? {}) as [string, { output?: Record<string, unknown> }][]) {
      const out = o?.output;
      if (!out?.plays) continue;
      const plays = { portfolioNote: out.portfolioNote, plays: out.plays, economics: (out as { economics?: unknown }).economics ?? { revenuePerCustomerMonthUsd: 0, grossMargin: 0, monthsRetained: 0, basis: "" } };
      let locked = "";
      try {
        locked = lockedNumbers(plays as never);
      } catch {
        // older outputs have no play models
      }
      const constraints = { monthlyAdBudgetUsd: 600 };
      let lockedCustomers: number | undefined;
      try {
        lockedCustomers = portfolioP50(plays as never) || undefined;
      } catch {
        // older outputs
      }
      const playsIn = { task: `${CLIMBOS_ENGINES}\n\n${insights}`, brief, facts, untrustedContext: "", constraints };
      const planIn = { task: `${locked}\n\n${JSON.stringify(plays)}\n\n${CLIMBOS_ENGINES}\n\n${insights}`, brief, facts, untrustedContext: "", constraints: { ...constraints, lockedCustomers } };
      const playsIssues: Issue[] = growthPlaysSpec().lint!(plays as never, playsIn);
      const planIssues: Issue[] = strategySpec().lint!(out as never, planIn);
      console.log(f.slice(17, 40), arm, "plays", JSON.stringify(count(playsIssues)), "| plan", JSON.stringify(count(planIssues)));
      if (samples) for (const i of [...playsIssues, ...planIssues].filter((x) => x.rule === "invented_fact").slice(0, 6)) console.log("   ", i.path, "→", i.message.slice(0, 140));
    }
  }
}
