import { readFileSync, readdirSync } from "node:fs";
import { growthPlaysSpec, strategySpec } from "../shared/agents/specs";
import { factsBlock } from "../shared/ai/tasks";
const cache = JSON.parse(readFileSync("bench/cache/formkit.json", "utf8"));
const brief = [`BUSINESS: Formkit (https://formkit.app)`, `SUMMARY: ${cache.profile.oneLineSummary}`, `GOAL: Get more paying customers in the next 90 days (horizon 90 days, ad budget 600 USD/month)`, factsBlock(cache.profile.facts)].join("\n");
const facts = cache.profile.facts.map((f: { statement: string }) => f.statement);
for (const f of readdirSync("bench/results").filter((x) => x.endsWith(".json")).slice(-4)) {
  for (const r of JSON.parse(readFileSync(`bench/results/${f}`, "utf8"))) {
    for (const [arm, o] of Object.entries(r.outs ?? {}) as [string, { output?: Record<string, unknown> }][]) {
      const out = o?.output;
      if (!out?.plays) continue;
      const input = { task: "", brief, facts, untrustedContext: "" };
      const playsIssues = (growthPlaysSpec().lint!({ portfolioNote: out.portfolioNote, plays: out.plays, economics: (out as { economics?: unknown }).economics ?? { revenuePerCustomerMonthUsd: 0, grossMargin: 0, monthsRetained: 0, basis: "" } } as never, input));
      const planIssues = strategySpec().lint!(out as never, input);
      const count = (xs: { rule: string; severity: string }[]) => xs.filter((x) => x.severity === "error").reduce<Record<string, number>>((a, x) => ((a[x.rule] = (a[x.rule] ?? 0) + 1), a), {});
      console.log(f.slice(17, 40), arm, "plays errors", JSON.stringify(count(playsIssues)), "| plan errors", JSON.stringify(count(planIssues)));
    }
  }
}
