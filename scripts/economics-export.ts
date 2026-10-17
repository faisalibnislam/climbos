/**
 * Export the economics calculator as CSV (and print the margin gate).
 * Usage: pnpm econ:export [--rates <versionId>] [--out <file.csv>]
 */
import { writeFileSync } from "node:fs";
import { CURRENT_ROUTING, currentRateVersion, economicsCsv, getRateVersion, marginGuard, ROUTING_RESEARCH_2026_10_17 } from "../shared/economics";

const args = process.argv.slice(2);
const ratesArg = args[args.indexOf("--rates") + 1];
const outArg = args.includes("--out") ? args[args.indexOf("--out") + 1] : "climbos-economics.csv";
const rates = args.includes("--rates") ? getRateVersion(ratesArg) : currentRateVersion();
const routing = rates.id.startsWith("research") ? ROUTING_RESEARCH_2026_10_17 : CURRENT_ROUTING;
const csv = economicsCsv({ rates, routing });
writeFileSync(outArg, csv);
const guard = marginGuard({ rates, routing });
console.log(`Rate version: ${rates.id} · routing: ${routing.id}`);
console.log(`Wrote ${outArg} (${csv.trim().split("\n").length - 1} plan/profile rows)`);
console.log(guard.ok ? "Margin gate: PASS (all plans ≥ 30% normally and under stress)" : `Margin gate: FAIL ${JSON.stringify(guard.failures)}`);
process.exit(guard.ok ? 0 : 1);
