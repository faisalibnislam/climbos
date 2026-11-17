import { createHash } from "node:crypto";
import type { AgentInput, AgentSpec } from "../../shared/agents/types";

/** Local evaluation identity only; never an execution approval or proof of output quality. */
export function evaluationIdentity<T>(caseId: string, variant: string, name: string, engine: string, sourceHash: string, spec: AgentSpec<T>, input: AgentInput): string {
  // Functions are represented by the selected source fingerprint; include every
  // serializable spec option so routing/revision/rubric changes cannot reuse a run.
  const { schema: _schema, lint: _lint, ...configuration } = spec;
  void _schema; void _lint;
  return createHash("sha256").update(JSON.stringify({ version: 1, caseId, variant, name, engine, sourceHash, configuration, input })).digest("hex");
}

/** Reject stale and legacy records before any paid request or overwrite. */
export function assertReusableEvaluation(saved: { evaluationIdentity?: string; result?: unknown }, expected: string): void {
  if (!saved.result) throw new Error("Saved evaluation failed or is incomplete; choose a new variant to retry. Original evidence is preserved.");
  if (!saved.evaluationIdentity || saved.evaluationIdentity !== expected) throw new Error("Saved evaluation does not match this code, configuration and input. Choose a new variant; do not relabel historical evidence as a current run.");
}
