import { z } from "zod";
import { turnCostMicros, ZERO_USAGE, type TurnRequest, type TurnResult } from "../ai/types";
import type { RateVersion } from "../economics/rates";

/**
 * Deterministic stand-in for Claude, used only by automated tests of the
 * Engine v2 wiring (never in production: it is enabled solely by the
 * CLIMBOS_FAKE_LLM test variable). It returns schema-valid answers so the
 * job, checkpoint, metering and resume paths can be exercised exactly.
 *
 * Modes (CLIMBOS_FAKE_LLM):
 * - "ship":   the first draft passes review.
 * - "revise": the first draft fails review; the revision passes.
 * - "fail":   every call fails with a provider error.
 */

type JsonSchema = { type?: string | string[]; properties?: Record<string, JsonSchema>; items?: JsonSchema; enum?: unknown[]; anyOf?: JsonSchema[]; required?: string[] };

function sample(s: JsonSchema, marker: string, key = ""): unknown {
  if (s.enum?.length) return s.enum[0];
  if (s.anyOf?.length) return sample(s.anyOf[0], marker, key);
  const type = Array.isArray(s.type) ? s.type[0] : s.type;
  switch (type) {
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(s.properties ?? {})) out[k] = sample(v, marker, k);
      return out;
    }
    case "array":
      if (key === "factIndexes") return [];
      return s.items ? [sample(s.items, marker, key)] : [];
    case "number":
    case "integer":
      return key === "priority" ? 1 : key.toLowerCase().includes("index") ? 0 : 1;
    case "boolean":
      return key === "needsOwner" ? false : true;
    default:
      // A real channel keeps autopilot routing testable (it ignores unknown channels).
      if (key === "channel") return "facebook";
      return /url/i.test(key) ? "https://example.com" : `${marker} ${key}`.trim();
  }
}

function rubricIds(system: string): { gates: string[]; criteria: string[] } {
  const gatesBlock = system.split("HARD GATES")[1]?.split("CRITERIA")[0] ?? "";
  const critBlock = system.split("CRITERIA (score")[1]?.split("Ship rule")[0] ?? "";
  return {
    gates: [...gatesBlock.matchAll(/^- ([A-Za-z0-9_]+): /gm)].map((m) => m[1]),
    criteria: [...critBlock.matchAll(/^- ([A-Za-z0-9_]+) /gm)].map((m) => m[1]),
  };
}

export async function fakeTurn(req: TurnRequest, rates: RateVersion): Promise<TurnResult> {
  const mode = process.env.CLIMBOS_FAKE_LLM ?? "ship";
  const usage = { ...ZERO_USAGE, inputTokens: 1000, outputTokens: 500, calls: 1, webSearches: req.webSearch ? 1 : 0 };
  const costMicros = turnCostMicros(req.modelKey, usage, rates);
  if (mode === "fail") return { ok: false, kind: "provider_error", message: "Fake provider error", usage, costMicros, appended: [] };

  const system = req.system.map((b) => b.text).join("\n");
  const lastUser = String(req.messages[req.messages.length - 1]?.content ?? "");
  let output: unknown;
  if (!req.schema) {
    output = "FAKE RESEARCH NOTES\n- Competitor A: example.com\nSources: https://example.com";
  } else if (system.includes("HARD GATES")) {
    const { gates, criteria } = rubricIds(system);
    const reviewingFirstDraft = lastUser.includes("fake-v1");
    const pass = mode === "ship" || !reviewingFirstDraft;
    output = {
      gates: gates.map((id) => ({ id, pass: pass, note: pass ? "ok" : "fails" })),
      scores: criteria.map((id) => ({ id, score: pass ? 5 : 2, note: "", fix: pass ? "none" : "Make it specific" })),
      strengths: ["clear"],
      fixes: pass ? [] : ["Make it specific"],
    };
  } else {
    const marker = lastUser.includes("A senior reviewer assessed your draft") ? "fake-v2" : "fake-v1";
    output = sample(z.toJSONSchema(req.schema) as JsonSchema, marker);
    // Growth plans: a portfolio that satisfies the deterministic play rules.
    if (output && typeof output === "object" && Array.isArray((output as { plays?: unknown }).plays)) {
      const tmpl = (output as { plays: Record<string, unknown>[] }).plays[0];
      const play = (kind: string, predictability: number, distinctiveness: number) => ({
        ...tmpl,
        name: `${marker} ${kind} play`,
        kind,
        funnel: ["a hundred contacted → replies: low to high [example.com, C]", "replies → booked: about a third [example.com, C]"],
        unit: "booked jobs",
        horizonDays: 90,
        // Numbers that add up and pay back (100 a week × 13 weeks × 10% × 10% ≈ 13).
        model: {
          weeklyReach: 100,
          weeklyReachLow: 70,
          weeklyReachHigh: 130,
          reachSource: { source: "assumption", ref: "", quote: "" },
          steps: [
            { name: "reply", rate: 0.1, low: 0.05, high: 0.15, source: "research", ref: "https://example.com", quote: "Replies run about 10% for warm lists." },
            { name: "paid", rate: 0.1, low: 0.05, high: 0.2, source: "assumption", ref: "", quote: "" },
          ],
          monthlySpendUsd: 0,
          spendSource: { source: "owner", ref: "No ad budget in the brief", quote: "" },
          ownerHoursPerWeek: 1,
          hoursSource: { source: "assumption", ref: "", quote: "" },
        },
        confidence: "medium",
        test: "a hundred contacts · small budget · three weeks",
        killIf: "no replies",
        scaleIf: "several replies",
        scores: [4, predictability, 3, 3, 3, 4, 5, distinctiveness],
      });
      (output as { plays: unknown[] }).plays = [play("bankable", 4, 2), play("creative", 3, 4)];
      (output as { economics?: unknown }).economics = { revenuePerCustomerMonthUsd: 20, grossMargin: 0.8, monthlyChurn: 0.05, basis: "fake assumptions", sources: { revenue: { source: "research", ref: "https://example.com", quote: "Plans cost $20 per month." }, margin: { source: "assumption", ref: "", quote: "" }, churn: { source: "assumption", ref: "", quote: "" } } };
    }
    // Channel scoring: valid library types and the candidates named in the prompt.
    const cf = output as { types?: unknown; dimensions?: unknown; channels?: unknown; summary?: unknown };
    if (cf && typeof cf === "object" && Array.isArray(cf.types) && Array.isArray(cf.dimensions) && Array.isArray(cf.channels)) {
      const ids = [...lastUser.matchAll(/^([A-Z]\d{2}) · /gm)].map((m) => m[1]).slice(0, 10);
      cf.types = ["b2b_saas"];
      // Neutral text: these reasons flow into later prompts, where a draft marker would confuse the fake reviewer.
      cf.dimensions = [{ key: "customerType", value: "b2b", confidence: "medium", evidence: "scoring evidence" }];
      cf.channels = ids.map((id, i) => ({ id, deltas: [i === 0 ? 10 : 0, 0, 0, 0, 0, 0, 0, 0], reason: "scoring reason", evidence: "scoring evidence", platform: "Google", tactic: "scoring tactic", audience: "scoring audience" }));
      cf.summary = ["scoring summary"];
    }
    // Outbound: three distinct, evidenced prospects and a mergeable sequence.
    const o = output as { prospects?: Record<string, unknown>[]; sequence?: Record<string, unknown>[]; firstLines?: unknown[] };
    if (o && typeof o === "object" && Array.isArray(o.prospects)) {
      const tmpl = o.prospects[0];
      o.prospects = ["alpha", "beta", "gamma"].map((n, i) => ({ ...tmpl, company: `${marker} ${n}`, website: `https://${n}.example.com`, evidence: [{ url: `https://${n}.example.com/about`, observation: `${marker} observation` }], publicEmail: "", fit: 80 - i * 10, timing: 60 }));
    }
    if (o && typeof o === "object" && Array.isArray(o.sequence) && Array.isArray(o.firstLines)) {
      o.sequence = [0, 3].map((day, i) => ({ day, subject: `${marker} note`, body: i === 0 ? `{{firstLine}}\n${marker} body` : `${marker} follow-up`, purpose: "test" }));
      o.firstLines = ["alpha", "beta", "gamma"].map((n) => ({ company: `${marker.replace("fake-v2", "fake-v1")} ${n}`, line: `${marker} opener for ${n}` }));
    }
  }
  const text = typeof output === "string" ? output : JSON.stringify(output);
  return {
    ok: true,
    output: req.schema ? req.schema.parse(output) : output,
    text,
    appended: [{ role: "assistant", content: text }],
    usage,
    costMicros,
    sources: req.webSearch ? [{ url: "https://example.com", title: "Example" }] : [],
    actualModelId: "fake",
    stopReason: "end_turn",
  };
}
