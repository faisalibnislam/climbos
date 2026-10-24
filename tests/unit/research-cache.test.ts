import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { TurnResult } from "../../shared/ai/types";
import {
  runResearch,
  researchCacheKey,
  type AgentDeps,
} from "../../shared/agents/runtime";
import type {
  AgentInput,
  AgentSpec,
  CachedResearch,
} from "../../shared/agents/types";
import type { ModelKey } from "../../shared/economics/rates";

const spec: AgentSpec<unknown> = {
  id: "cache-test",
  label: "Cache test",
  role: "cmo",
  skills: [],
  schema: z.unknown(),
  rubric: {
    id: "cache",
    title: "Cache",
    gates: [],
    criteria: [],
    shipRule: { minEach: 1, minAverage: 1 },
  },
  models: { research: "gpt-6-luna", draft: "gpt-6-luna", critic: "gpt-6-luna" },
  maxTokens: { research: 100, draft: 100, critic: 100 },
  effort: { research: "low", draft: "low", critic: "low" },
  maxRevisions: 0,
};

const input: AgentInput = {
  task: "Find current market signals",
  brief: "Use only evidence from the requested market.",
  facts: ["Owner reports 20 active customers."],
  research: {
    maxSearches: 2,
    maxFetches: 1,
    brief: "Find evidence",
    cacheTtlMs: 60_000,
  },
};

function result(
  output: string,
  sources = [{ url: "https://example.com/source", title: "Source" }],
): TurnResult {
  return {
    ok: true,
    output,
    text: output,
    appended: [],
    usage: {
      inputTokens: 20,
      outputTokens: 10,
      thinkingTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      webSearches: 1,
      webFetches: 0,
      calls: 1,
    },
    costMicros: 25,
    sources,
    actualModelId: "gpt-6-luna",
    stopReason: "completed",
  };
}

function deps(overrides: Partial<AgentDeps> = {}) {
  const phases: { stepKind?: "model" | "compute"; record: unknown }[] = [];
  const base: AgentDeps = {
    turn: async () => result("Observed evidence"),
    phase: async (_key, _label, fn) => {
      const output = await fn();
      phases.push({ stepKind: _key.stepKind, record: output.record });
      return output.value;
    },
    ...overrides,
  };
  return { base, phases };
}

describe("tenant research cache behavior", () => {
  it("reuses fresh exact-request research and records the hit as compute", async () => {
    let providerCalls = 0;
    const box: { current: CachedResearch | null } = { current: null };
    const cache = {
      get: async () => box.current,
      put: async (
        _key: string,
        value: Omit<CachedResearch, "expiresAt">,
        expiresAt: number,
      ) => {
        box.current = { ...value, expiresAt };
      },
    };
    const first = deps({
      researchCache: cache,
      turn: async () => {
        providerCalls += 1;
        return result("Observed evidence");
      },
    });
    const firstValue = await runResearch(spec, input, first.base);
    expect(firstValue?.notes).toBe("Observed evidence");
    expect(providerCalls).toBe(1);
    expect(box.current?.expiresAt).toBeGreaterThan(Date.now());

    const second = deps({
      researchCache: cache,
      turn: async () => {
        providerCalls += 1;
        return result("Unexpected second call");
      },
    });
    const cachedValue = await runResearch(spec, input, second.base);
    expect(cachedValue).toEqual(firstValue);
    expect(providerCalls).toBe(1);
    expect(second.phases[0]?.stepKind).toBe("compute");
    expect(second.phases[0]?.record).toMatchObject({
      cacheHit: true,
      result: { costMicros: 0, stopReason: "cache_hit" },
    });
  });

  it("uses a different key when business evidence or model changes", async () => {
    const originalKey = await researchCacheKey(spec, input);
    const changedInput = {
      ...input,
      facts: ["Owner reports 21 active customers."],
    };
    const changedKey = await researchCacheKey(spec, changedInput);
    const changedModel: AgentSpec<unknown> = {
      ...spec,
      models: { ...spec.models, research: "gpt-6.1-sol" as ModelKey },
    };
    expect(changedKey).not.toBe(originalKey);
    expect(await researchCacheKey(changedModel, input)).not.toBe(originalKey);
  });

  it("ignores expired cache entries and continues if cache storage fails", async () => {
    let providerCalls = 0;
    const expired = {
      get: async () => ({
        notes: "Stale",
        sources: [],
        expiresAt: Date.now() - 1,
      }),
      put: async () => {},
    };
    const first = deps({
      researchCache: expired,
      turn: async () => {
        providerCalls += 1;
        return result("Fresh evidence");
      },
    });
    expect((await runResearch(spec, input, first.base))?.notes).toBe(
      "Fresh evidence",
    );

    const failing = {
      get: async () => {
        throw new Error("offline");
      },
      put: async () => {
        throw new Error("offline");
      },
    };
    const second = deps({
      researchCache: failing,
      turn: async () => {
        providerCalls += 1;
        return result("Research still succeeds");
      },
    });
    expect((await runResearch(spec, input, second.base))?.notes).toBe(
      "Research still succeeds",
    );
    expect(providerCalls).toBe(2);
  });
});
