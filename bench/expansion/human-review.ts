/**
 * Blinded, structured human review for paired expansion benchmark runs.
 * Export the packet to a qualified reviewer; keep the key file private until
 * review is complete. No model calls or external actions are made here.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { GLOBAL_HARD_FAILURES, loadCases, RUBRIC, type ExpansionCase, type RubricKey } from "./cases";
import type { ExpansionRow } from "./run";

export interface ExpansionRun {
  meta: Record<string, unknown>;
  rows: ExpansionRow[];
}

type ScoreFields = Record<RubricKey, number | null>;
type FailureFields = Record<string, boolean | null>;
type EditingEffort = {
  participant: "owner_or_operator" | "independent_reviewer" | null;
  seconds_to_usable: number | null;
  accepted_without_edits: boolean | null;
};

export interface HumanReviewItem {
  item_id: string;
  case_id: string;
  business_type: ExpansionCase["business_type"];
  surface: ExpansionRow["surface"];
  task: string;
  inputs: Record<string, unknown>;
  answer_a: string;
  answer_b: string;
  ratings: {
    answer_a: ScoreFields;
    answer_b: ScoreFields;
    hard_failures_a: FailureFields;
    hard_failures_b: FailureFields;
    editing_effort_a: EditingEffort;
    editing_effort_b: EditingEffort;
    preferred: "A" | "B" | "tie" | null;
    notes: string;
  };
}

export interface HumanReviewPacket {
  version: 1;
  packet_id: string;
  reviewer_id: string;
  editing_effort_instructions: string;
  rubric: typeof RUBRIC;
  hard_failure_definitions: string[];
  items: HumanReviewItem[];
}

export interface HumanReviewKey {
  version: 1;
  packet_id: string;
  content_sha256: string;
  baseline_label: string;
  candidate_label: string;
  mapping: Record<string, { case_id: string; surface: ExpansionRow["surface"]; baseline: "A" | "B" }>;
}

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const labelOf = (run: ExpansionRun, fallback: string) => String(run.meta.label ?? fallback);
const canonical = (value: unknown): unknown => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]))
    : value;

function packetContentHash(packet: HumanReviewPacket): string {
  return digest(JSON.stringify(canonical({
    version: packet.version,
    packet_id: packet.packet_id,
    editing_effort_instructions: packet.editing_effort_instructions,
    rubric: packet.rubric,
    hard_failure_definitions: packet.hard_failure_definitions,
    items: packet.items.map(({ ratings: _ratings, ...item }) => item),
  })));
}

function rowMap(run: ExpansionRun, label: string): Map<string, ExpansionRow> {
  const map = new Map<string, ExpansionRow>();
  for (const row of run.rows) {
    const k = `${row.case_id}|${row.surface}`;
    if (map.has(k)) throw new Error(`${label} run contains duplicate row ${k}`);
    map.set(k, row);
  }
  return map;
}

function blankScores(): ScoreFields {
  return Object.fromEntries(RUBRIC.map(({ key }) => [key, null])) as ScoreFields;
}

function blankEditingEffort(): EditingEffort {
  return { participant: null, seconds_to_usable: null, accepted_without_edits: null };
}

/** Produce a reproducible randomized A/B order; the mapping is stored separately. */
export function createHumanReviewPacket(
  baseline: ExpansionRun,
  candidate: ExpansionRun,
  cases: ExpansionCase[],
  seed: string,
): { packet: HumanReviewPacket; key: HumanReviewKey } {
  if (!seed.trim()) throw new Error("A non-empty randomization seed is required");
  const baselineRows = rowMap(baseline, "baseline");
  const candidateRows = rowMap(candidate, "candidate");
  const caseMap = new Map(cases.map((c) => [c.id, c]));
  const baselineKeys = [...baselineRows.keys()].sort();
  if (baselineKeys.length !== candidateRows.size || baselineKeys.some((k) => !candidateRows.has(k))) {
    throw new Error("Baseline and candidate runs must contain the same case/surface rows");
  }
  for (const k of baselineKeys) if (!caseMap.has(k.split("|")[0])) throw new Error(`Unknown case in run: ${k}`);

  const packetId = digest(JSON.stringify({ baseline: baseline.meta, candidate: candidate.meta, baselineKeys, seed })).slice(0, 20);
  const mapping: HumanReviewKey["mapping"] = {};
  const items = baselineKeys.map((rowKey) => {
    const [caseId, surface] = rowKey.split("|") as [string, ExpansionRow["surface"]];
    const c = caseMap.get(caseId)!;
    const base = baselineRows.get(rowKey)!;
    const next = candidateRows.get(rowKey)!;
    const itemId = digest(`${packetId}|${rowKey}`).slice(0, 16);
    const baselineFirst = Number.parseInt(digest(`${seed}|${rowKey}`).slice(0, 2), 16) % 2 === 0;
    mapping[itemId] = { case_id: caseId, surface, baseline: baselineFirst ? "A" : "B" };
    const aRow = baselineFirst ? base : next;
    const bRow = baselineFirst ? next : base;
    const hardFailures = [...c.hard_failures, ...GLOBAL_HARD_FAILURES];
    return {
      item_id: itemId,
      case_id: caseId,
      business_type: c.business_type,
      surface,
      task: c.task,
      inputs: c.inputs,
      answer_a: aRow.ok ? aRow.response : `[No answer: ${aRow.error ?? "run failed"}]`,
      answer_b: bRow.ok ? bRow.response : `[No answer: ${bRow.error ?? "run failed"}]`,
      ratings: {
        answer_a: blankScores(),
        answer_b: blankScores(),
        hard_failures_a: Object.fromEntries(hardFailures.map((failure) => [failure, null])),
        hard_failures_b: Object.fromEntries(hardFailures.map((failure) => [failure, null])),
        editing_effort_a: blankEditingEffort(),
        editing_effort_b: blankEditingEffort(),
        preferred: null,
        notes: "",
      },
    };
  });
  const packet: HumanReviewPacket = {
    version: 1,
    packet_id: packetId,
    reviewer_id: "",
    editing_effort_instructions: "For each answer, record edit time only when a real participant completes the same business task. Use owner_or_operator for a business owner or staff member responsible for this work, and independent_reviewer for an outside reviewer. Measure seconds from opening the answer until it is usable for the task. Record whether it was accepted unchanged. Leave fields null when not measured. This is participant-reported task effort, not a business outcome.",
    rubric: RUBRIC,
    hard_failure_definitions: [...GLOBAL_HARD_FAILURES],
    items,
  };
  return {
    packet,
    key: { version: 1, packet_id: packetId, content_sha256: packetContentHash(packet), baseline_label: labelOf(baseline, "baseline"), candidate_label: labelOf(candidate, "candidate"), mapping },
  };
}

export interface HumanReviewSummary {
  packet_id: string;
  reviewer_id: string;
  reviewed: number;
  incomplete: number;
  pairwise: { baseline: number; candidate: number; tie: number };
  hard_failures: { baseline: number; candidate: number };
  editing_effort: Record<"baseline" | "candidate", Record<"owner_or_operator" | "independent_reviewer", {
    observations: number;
    incomplete: number;
    median_seconds_to_usable: number | null;
    accepted_without_edits_rate: number | null;
  }>>;
  mean_scores: Record<string, { baseline: number | null; candidate: number | null }>;
  by_business_type: Record<string, { reviewed: number; baseline_preferred: number; candidate_preferred: number; tie: number }>;
}

/** Validate returned review data before applying the hidden arm key. */
export function summarizeHumanReview(packet: HumanReviewPacket, key: HumanReviewKey): HumanReviewSummary {
  if (packet.version !== 1 || key.version !== 1 || packet.packet_id !== key.packet_id) throw new Error("Review packet and private key do not match");
  if (packetContentHash(packet) !== key.content_sha256) throw new Error("Review packet content changed; refusing to apply the private arm key");
  if (!packet.reviewer_id.trim()) throw new Error("reviewer_id is required");
  const itemIds = new Set(packet.items.map((item) => item.item_id));
  if (itemIds.size !== packet.items.length || itemIds.size !== Object.keys(key.mapping).length || [...itemIds].some((id) => !key.mapping[id])) throw new Error("Review items do not match the private key");
  const sums = Object.fromEntries(RUBRIC.map((d) => [d.key, { baseline: 0, candidate: 0, baselineN: 0, candidateN: 0 }])) as Record<RubricKey, { baseline: number; candidate: number; baselineN: number; candidateN: number }>;
  const byType: HumanReviewSummary["by_business_type"] = {};
  let reviewed = 0;
  let incomplete = 0;
  let baselinePreferred = 0;
  let candidatePreferred = 0;
  let ties = 0;
  let baselineFailures = 0;
  let candidateFailures = 0;
  const effortRows: Record<"baseline" | "candidate", Record<EditingEffort["participant"] & string, { seconds: number[]; accepted: number; incomplete: number }>> = {
    baseline: {
      owner_or_operator: { seconds: [], accepted: 0, incomplete: 0 },
      independent_reviewer: { seconds: [], accepted: 0, incomplete: 0 },
    },
    candidate: {
      owner_or_operator: { seconds: [], accepted: 0, incomplete: 0 },
      independent_reviewer: { seconds: [], accepted: 0, incomplete: 0 },
    },
  };
  const caseMap = new Map(loadCases().map((c) => [c.id, c]));
  for (const item of packet.items) {
    const c = caseMap.get(item.case_id);
    if (!c || c.business_type !== item.business_type || c.task !== item.task) throw new Error(`Review item has invalid case context: ${item.item_id}`);
    const expectedFailures = [...c.hard_failures, ...packet.hard_failure_definitions].sort();
    for (const field of [item.ratings.hard_failures_a, item.ratings.hard_failures_b]) {
      if (Object.keys(field).sort().join("\n") !== expectedFailures.join("\n")) throw new Error(`Review item has missing or extra hard-failure checks: ${item.item_id}`);
    }
    const arm = key.mapping[item.item_id].baseline;
    for (const [field, baselineArm] of [["editing_effort_a", arm === "A"], ["editing_effort_b", arm === "B"]] as const) {
      const effort = item.ratings[field];
      if (!effort) continue; // Older review packets predate edit-effort tracking.
      const empty = effort.participant === null && effort.seconds_to_usable === null && effort.accepted_without_edits === null;
      if (empty) continue;
      if (effort.participant === null) {
        if (effort.seconds_to_usable !== null || effort.accepted_without_edits !== null) throw new Error(`Editing effort is missing its participant type: ${item.item_id}`);
        continue;
      }
      if (effort.participant !== "owner_or_operator" && effort.participant !== "independent_reviewer") throw new Error(`Editing effort has an unsupported participant type: ${item.item_id}`);
      if (effort.seconds_to_usable === null || typeof effort.accepted_without_edits !== "boolean") {
        effortRows[baselineArm ? "baseline" : "candidate"][effort.participant].incomplete++;
        continue;
      }
      if (!Number.isFinite(effort.seconds_to_usable) || effort.seconds_to_usable < 0 || effort.seconds_to_usable > 86_400) throw new Error(`Editing effort time must be between zero and 86400 seconds: ${item.item_id}`);
      const side = baselineArm ? "baseline" : "candidate";
      const aggregate = effortRows[side][effort.participant];
      if (!aggregate) throw new Error(`Editing effort has an unsupported participant type: ${item.item_id}`);
      aggregate.seconds.push(effort.seconds_to_usable!);
      aggregate.accepted += Number(effort.accepted_without_edits);
    }
    const baselineScores = arm === "A" ? item.ratings.answer_a : item.ratings.answer_b;
    const candidateScores = arm === "A" ? item.ratings.answer_b : item.ratings.answer_a;
    const baselineHard = arm === "A" ? item.ratings.hard_failures_a : item.ratings.hard_failures_b;
    const candidateHard = arm === "A" ? item.ratings.hard_failures_b : item.ratings.hard_failures_a;
    const completeScores = [...RUBRIC].every((d) => [baselineScores[d.key], candidateScores[d.key]].every((v) => Number.isInteger(v) && v! >= 0 && v! <= 2));
    const failuresComplete = [...Object.values(baselineHard), ...Object.values(candidateHard)].every((v) => typeof v === "boolean");
    const complete = completeScores && failuresComplete && item.ratings.preferred !== null;
    if (!complete) { incomplete++; continue; }
    reviewed++;
    for (const d of RUBRIC) {
      sums[d.key].baseline += baselineScores[d.key]!;
      sums[d.key].candidate += candidateScores[d.key]!;
      sums[d.key].baselineN++;
      sums[d.key].candidateN++;
    }
    const baselineHasFailure = Object.values(baselineHard).some(Boolean);
    const candidateHasFailure = Object.values(candidateHard).some(Boolean);
    baselineFailures += Number(baselineHasFailure);
    candidateFailures += Number(candidateHasFailure);
    const preference = item.ratings.preferred === "tie" ? "tie" : item.ratings.preferred === arm ? "baseline" : "candidate";
    if (preference === "baseline") baselinePreferred++;
    else if (preference === "candidate") candidatePreferred++;
    else ties++;
    const group = byType[item.business_type] ??= { reviewed: 0, baseline_preferred: 0, candidate_preferred: 0, tie: 0 };
    group.reviewed++;
    group[preference === "baseline" ? "baseline_preferred" : preference === "candidate" ? "candidate_preferred" : "tie"]++;
  }
  const median = (values: number[]) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  };
  const effortSummary = Object.fromEntries(([["baseline", effortRows.baseline], ["candidate", effortRows.candidate]] as const).map(([side, groups]) => [side, Object.fromEntries(([["owner_or_operator", groups.owner_or_operator], ["independent_reviewer", groups.independent_reviewer]] as const).map(([participant, values]) => [participant, {
    observations: values.seconds.length,
    incomplete: values.incomplete,
    median_seconds_to_usable: median(values.seconds),
    accepted_without_edits_rate: values.seconds.length ? values.accepted / values.seconds.length : null,
  }]))])) as HumanReviewSummary["editing_effort"];
  return {
    packet_id: packet.packet_id,
    reviewer_id: packet.reviewer_id,
    reviewed,
    incomplete,
    pairwise: { baseline: baselinePreferred, candidate: candidatePreferred, tie: ties },
    hard_failures: { baseline: baselineFailures, candidate: candidateFailures },
    editing_effort: effortSummary,
    mean_scores: Object.fromEntries(RUBRIC.map((d) => [d.key, {
      baseline: sums[d.key].baselineN ? Math.round((sums[d.key].baseline / sums[d.key].baselineN) * 100) / 100 : null,
      candidate: sums[d.key].candidateN ? Math.round((sums[d.key].candidate / sums[d.key].candidateN) * 100) / 100 : null,
    }])),
    by_business_type: byType,
  };
}

function cliArg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const mode = cliArg("mode");
  if (mode === "export") {
    const baselinePath = cliArg("baseline");
    const candidatePath = cliArg("candidate");
    const seed = cliArg("seed");
    const output = cliArg("out");
    if (!baselinePath || !candidatePath || !seed || !output) throw new Error("Usage: pnpm tsx bench/expansion/human-review.ts --mode export --baseline <run.json> --candidate <run.json> --seed <value> --out <packet.json>");
    const result = createHumanReviewPacket(JSON.parse(readFileSync(baselinePath, "utf8")), JSON.parse(readFileSync(candidatePath, "utf8")), loadCases(), seed);
    writeFileSync(output, JSON.stringify(result.packet, null, 2));
    writeFileSync(output.replace(/\.json$/, ".key.json"), JSON.stringify(result.key, null, 2));
    console.log(`Wrote blinded review packet ${output} and private key ${output.replace(/\.json$/, ".key.json")}`);
    return;
  }
  if (mode === "summarize") {
    const packetPath = cliArg("packet");
    const keyPath = cliArg("key");
    const output = cliArg("out");
    if (!packetPath || !keyPath || !output) throw new Error("Usage: pnpm tsx bench/expansion/human-review.ts --mode summarize --packet <reviewed.json> --key <private.key.json> --out <summary.json>");
    const summary = summarizeHumanReview(JSON.parse(readFileSync(packetPath, "utf8")), JSON.parse(readFileSync(keyPath, "utf8")));
    writeFileSync(output, JSON.stringify(summary, null, 2));
    console.log(`Wrote human-review summary ${output} (${summary.reviewed} complete, ${summary.incomplete} incomplete)`);
    return;
  }
  throw new Error("Use --mode export or --mode summarize");
}

if (process.argv[1]?.endsWith("human-review.ts")) void main();
