/** Offline export/check only. This module has no model client, network or execution adapter. */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";
import { z } from "zod";
import { ENGINE_VERSION, growthPlaysSpec } from "../../shared/agents/specs";
import { selectStrategyQualityCases } from "./cases";
import { offlineInput } from "./offlineInput";
import { replayFocusedStrategy } from "./replay";
import { lintAgentOutput } from "../../shared/agents/runtime";


const { values, positionals } = parseArgs({ allowPositionals: true, options: { cases: { type: "string" }, out: { type: "string" }, file: { type: "string" }, dir: { type: "string" } } });
const command = positionals[0];
if (command !== "prepare" && command !== "check" && command !== "replay") {
  console.log("Offline strategy review; never calls a model.\n\npnpm strategy:review prepare [--cases livoform,mac-app] [--out /tmp/climbos-strategy-review]\npnpm strategy:review check --cases mac-app --file /absolute/path/to/saved-output.json\npnpm strategy:review replay --file /absolute/path/to/saved-focused-14.json\npnpm strategy:review replay --dir /absolute/path/to/cache-directory\n\nCheck validates the contract, not strategic quality. A human reviewer must assess the separate review questions.");
  process.exit(command ? 1 : 0);
}
try {
  if (command === "replay") {
    if (Boolean(values.file) === Boolean(values.dir)) throw new Error("Replay requires exactly one --file or --dir. Directories select saved *-focused-14.json records only.");
    const files = values.file ? [resolve(values.file)] : readdirSync(resolve(values.dir!)).filter(name => name.endsWith("-focused-14.json")).sort().map(name => resolve(values.dir!, name));
    if (!files.length) throw new Error("No saved focused strategy records found.");
    const results = files.map(file => {
      try { return { file, ...replayFocusedStrategy(JSON.parse(readFileSync(file, "utf8"))) }; }
      catch { return { file, status: "uncheckable", reason: "Invalid JSON or unreadable file.", editorialReview: "not_assessed", modelCalls: 0, externalActions: 0 }; }
    });
    console.log(JSON.stringify({ limitation: "Current deterministic contracts against frozen evidence and clocks. Historical assessments are retained, not rerated. A contract pass does not establish originality, useful advice, current platform policy, or business results.", results }, null, 2));
    if (results.some(result => result.status !== "contract_passed")) process.exitCode = 1;
  } else {
    const cases = selectStrategyQualityCases(values.cases);
    const spec = growthPlaysSpec();
    if (command === "prepare") {
      const out = resolve(values.out || `${tmpdir()}/climbos-strategy-review`);
      mkdirSync(out, { recursive: true });
      for (const item of cases) {
        const dir = resolve(out, item.id);
        mkdirSync(dir, { recursive: true });
        writeFileSync(resolve(dir, "generation.json"), JSON.stringify({ engineVersion: ENGINE_VERSION, caseId: item.id, input: offlineInput(item), schema: z.toJSONSchema(spec.schema), limitation: "Frozen public/synthetic evidence only. Not a full production research or job run." }, null, 2));
        writeFileSync(resolve(dir, "review.json"), JSON.stringify({ caseId: item.id, questions: item.reviewQuestions, decision: "not_reviewed", observations: [], limitation: "Keep this file separate from generation inputs. Evaluate specific strategy, creative mechanisms, industry judgment, native social ideas and honest uncertainty. Schema/lint passes are not evidence of expert reasoning or business results." }, null, 2));
      }
      console.log(`Prepared ${cases.length} local review packs in ${out}. No model calls made; all editorial reviews remain pending.`);
    } else {
      if (cases.length !== 1 || !values.file) throw new Error("Check needs one case (--cases mac-app) and --file pointing to a saved JSON output.");
      const result = spec.schema.safeParse(JSON.parse(readFileSync(resolve(values.file), "utf8")));
      if (!result.success) {
        console.log(JSON.stringify({ caseId: cases[0].id, schema: "failed", issues: result.error.issues, editorialReview: "not_assessed" }, null, 2));
        process.exitCode = 1;
      } else {
        const input = offlineInput(cases[0]);
        const issues = lintAgentOutput(spec, input, result.data, input.precomputedResearch, input.timingContext?.now);
        console.log(JSON.stringify({ caseId: cases[0].id, schema: "passed", issues, editorialReview: "not_assessed", limitation: "No model or provider call was made. These deterministic checks cannot establish strategic quality." }, null, 2));
        if (issues.some((issue) => issue.severity === "error")) process.exitCode = 1;
      }
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Offline review failed.");
  process.exitCode = 1;
}
