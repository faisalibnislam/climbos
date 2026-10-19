/**
 * Free, offline: what a real run's source tags look like after ClimbOS's checks.
 *   TMPDIR=/private/tmp/claude-501/ npx tsx bench/provenance-report.mts [results-file]
 */
import { readFileSync, readdirSync } from "node:fs";
import { economicsSources, playInputs } from "../shared/agents/provenance";
import { growthPlaysSpec, strategySpec } from "../shared/agents/specs";
import { factsBlock } from "../shared/ai/tasks";
import { lockedNumbers, type Economics } from "../shared/agents/economics";

const file = process.argv[2] ?? `bench/results/${readdirSync("bench/results").filter((f) => f.endsWith("provenance-e2e.json")).sort().pop()}`;
const rows = JSON.parse(readFileSync(file, "utf8")) as { outs: Record<string, { ok: boolean; costMicros: number; ms: number; error?: string; output?: Record<string, unknown> }> }[];
const cache = JSON.parse(readFileSync("bench/cache/formkit.json", "utf8"));
const brief = [`BUSINESS: Formkit (https://formkit.app)`, `SUMMARY: ${cache.profile.oneLineSummary}`, factsBlock(cache.profile.facts)].join("\n");
const facts = cache.profile.facts.map((f: { statement: string }) => f.statement);

for (const r of rows) {
  for (const [arm, o] of Object.entries(r.outs)) {
    console.log(`\n## ${arm}: ${o.ok ? "ok" : `ERROR ${o.error}`} · $${(o.costMicros / 1e6).toFixed(3)} · ${Math.round(o.ms / 1000)}s`);
    if (!o.ok || !o.output) continue;
    const out = o.output as { economics: Economics; plays: { name: string; kind: string; unit: string; horizonDays: number; model: never }[]; researchSources?: string[] };
    const tally: Record<string, number> = {};
    const unverified: string[] = [];
    const downgraded: string[] = [];
    const econ = economicsSources(out.economics);
    for (const k of ["revenue", "margin", "churn"] as const) {
      const t = econ[k];
      tally[`${t.source}${t.check ? `/${t.check}` : ""}`] = (tally[`${t.source}${t.check ? `/${t.check}` : ""}`] ?? 0) + 1;
      if (t.source === "research" && t.check !== "source_verified") unverified.push(`economics.${k} → ${t.ref} (${t.check})`);
      if (t.source === "assumption" && t.ref.startsWith("Not confirmed by you")) downgraded.push(`economics.${k}`);
    }
    for (const p of out.plays) {
      for (const row of playInputs(p as never, out.economics).filter((x) => !["revenue", "margin", "churn", "ownerHour"].includes(x.key))) {
        const key = `${row.tag.source}${row.tag.check ? `/${row.tag.check}` : ""}`;
        tally[key] = (tally[key] ?? 0) + 1;
        if (row.tag.source === "research" && row.tag.check !== "source_verified") unverified.push(`${p.name} · ${row.label} → ${row.tag.ref} (${row.tag.check})`);
        if (row.tag.source === "assumption" && row.tag.ref.startsWith("Not confirmed by you")) downgraded.push(`${p.name} · ${row.label}`);
      }
    }
    const verifiedQuotes: string[] = [];
    for (const p of out.plays as { name: string; model: { steps: { name: string; source?: string; quote?: string; check?: string }[] } }[]) for (const st of p.model?.steps ?? []) if (st.check === "source_verified") verifiedQuotes.push(`${p.name} · ${st.name}: "${st.quote}"`);
    console.log("Sources/checks:", JSON.stringify(tally));
    console.log(`Research pages returned by search: ${out.researchSources?.length ?? 0}`);
    console.log(`Verified on page (${verifiedQuotes.length}):`, verifiedQuotes.slice(0, 6));
    console.log(`Research not verified (${unverified.length}):`, unverified.slice(0, 12));
    console.log(`"Owner" tags not confirmed → assumption (${downgraded.length}):`, downgraded);
    // Unsupported claims in the text: numbers not traceable to inputs, citations to pages not read.
    const playsIn = { task: "", brief, facts, untrustedContext: (out.researchSources ?? []).join("\n") };
    const playIssues = growthPlaysSpec().lint!({ portfolioNote: (out as { portfolioNote?: string }).portfolioNote ?? "", economics: out.economics, plays: out.plays } as never, playsIn);
    // The plan writer was given the locked totals (computed by code) and the channel scorecard.
    const locked = lockedNumbers({ economics: out.economics, plays: out.plays as never });
    const planIssues = strategySpec().lint!(out as never, { task: `${locked}\n${JSON.stringify(out.plays)}\n${JSON.stringify((out as { channels?: unknown }).channels ?? [])}`, brief, facts, untrustedContext: (out.researchSources ?? []).join("\n") });
    // Funnel text that cites a source while the tag says assumption (prose and tags disagree).
    const mismatch: string[] = [];
    for (const p of out.plays as { name: string; funnel?: string[]; model?: { steps?: { source?: string }[] } }[]) {
      const cited = (p.funnel ?? []).filter((l) => /\[[^\]]*\.[a-z]{2,}[^\]]*,\s*[ABC]\]/i.test(l)).length;
      const researchTags = (p.model?.steps ?? []).filter((st) => st.source === "research").length;
      if (cited > researchTags) mismatch.push(`${p.name}: ${cited} funnel lines cite a page (grade A–C), ${researchTags} rate tags say research`);
    }
    console.log(`Prose vs tags (${mismatch.length}):`, mismatch);
    const pick = (xs: { rule: string; severity: string; path?: string; message: string }[]) => xs.filter((x) => x.severity === "error" && ["invented_fact", "citation", "provenance"].includes(x.rule)).map((x) => `${x.rule} @ ${x.path}: ${x.message.slice(0, 110)}`);
    const unsupported = [...pick(playIssues), ...pick(planIssues)];
    console.log(`Unsupported-claim lint findings (${unsupported.length}; research notes not saved, so an upper bound):`);
    for (const u of unsupported.slice(0, 15)) console.log("  -", u);
  }
}
