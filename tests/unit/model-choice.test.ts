import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { BUILT_IN_ROUTE, modelAvailable, modelOptions, routeModelKey, runModel, userRoute } from "../../shared/ai/modelChoice";
import { MODEL_SPECS, searchCallUsd, worstCaseStepMicros } from "../../shared/ai/models";
import { modelTurn } from "../../shared/ai/turn";
import { turnCostMicros, ZERO_USAGE } from "../../shared/ai/types";
import { getRateVersion, rateVersionForDate, RESEARCH_2026_10_17, type ModelKey } from "../../shared/economics/rates";

const NOW = getRateVersion("model-choice-2026-10-26");
const KEYS = Object.keys(MODEL_SPECS) as ModelKey[];

describe("model choice rate table", () => {
  it("prices every callable model in every rate version", () => {
    for (const id of ["research-2026-10-17", "verified-2026-10-17", "model-choice-2026-10-26", "gemini-argon-reprice-2026-12-01", "gemini-flash-reprice-2027-01-01"]) {
      const v = getRateVersion(id);
      for (const key of KEYS) {
        const rate = v.models[key];
        expect(rate, `${id} ${key}`).toBeDefined();
        expect(rate.provider).toBe(MODEL_SPECS[key].provider);
        expect(rate.inputPerM).toBeGreaterThan(0);
        expect(rate.outputPerM).toBeGreaterThan(rate.inputPerM);
      }
    }
  });

  it("is the version in force from 26 Oct 2026, with Argon and Flash price rises on their dates", () => {
    expect(rateVersionForDate("2026-10-25").id).toBe("verified-2026-10-17");
    expect(rateVersionForDate("2026-10-26").id).toBe("model-choice-2026-10-26");
    expect(rateVersionForDate("2026-12-01").models["gemini-4-argon"]).toMatchObject({ inputPerM: 4, outputPerM: 20 });
    expect(rateVersionForDate("2026-11-30").models["gemini-4-argon"]).toMatchObject({ inputPerM: 2, outputPerM: 10 });
    const jan = rateVersionForDate("2027-01-01");
    expect(jan.models["gemini-4-argon"].inputPerM).toBe(4);
    expect(jan.models["gemini-3.6-flash"]).toMatchObject({ inputPerM: 1.5, outputPerM: 7.5 });
    expect(jan.services.groundingSearchCall).toBe(0.014);
  });

  it("keeps the workbook fixture's routed rows unchanged", () => {
    expect(RESEARCH_2026_10_17.models["gpt-6-luna"]).toMatchObject({ inputPerM: 0.1, outputPerM: 0.5 });
    expect(RESEARCH_2026_10_17.models["gpt-6.1-sol"]).toMatchObject({ inputPerM: 2, outputPerM: 10 });
    expect(RESEARCH_2026_10_17.services.groundingSearchCall).toBeUndefined();
  });

  it("estimates a step at each model's own published rates", () => {
    const expected: Partial<Record<ModelKey, [number, number]>> = {
      "gpt-6-luna": [0.1, 0.5],
      "gpt-6-sol": [2, 10],
      "gpt-6.1-sol": [2, 10],
      "gpt-6-astra": [10, 50],
      "claude-haiku-5.5": [0.1, 0.5],
      "claude-sonnet-5": [2, 10],
      "claude-sonnet-5.5": [2, 10],
      "claude-opus-5": [5, 25],
      "claude-opus-5.5": [4, 20],
      "claude-fable-5": [10, 50],
      "claude-fable-5.1": [10, 50],
      "gemini-3.1-flash-lite": [0.25, 1.5],
      "gemini-3.5-flash-lite": [0.3, 2.5],
      "gemini-3.6-flash": [0.75, 3.75],
      "gemini-3.8-flash": [0.75, 3.75],
      "gemini-3.1-pro": [2, 12],
      "gemini-4-argon": [2, 10],
    };
    expect(Object.keys(expected).sort()).toEqual([...KEYS].sort());
    for (const key of KEYS) {
      const [inPerM, outPerM] = expected[key]!;
      // 100k in + 10k out, rounded up to whole µUSD.
      expect(worstCaseStepMicros(key, 100_000, 10_000, NOW), key).toBe(Math.ceil(inPerM * 100_000 + outPerM * 10_000));
    }
  });

  it("meters actual usage and searches per provider", () => {
    const usage = { ...ZERO_USAGE, inputTokens: 1_000_000, outputTokens: 0, webSearches: 10, calls: 1 };
    expect(turnCostMicros("claude-opus-5.5", usage, NOW)).toBe(4_000_000 + 100_000);
    expect(turnCostMicros("gemini-3.1-pro", usage, NOW)).toBe(2_000_000 + 140_000);
    expect(searchCallUsd("gpt-6-luna", NOW)).toBe(0.01);
    // Before model choice, every search used the shared rate.
    expect(searchCallUsd("gemini-3.8-flash", RESEARCH_2026_10_17)).toBe(0.01);
  });
});

describe("model choice routing", () => {
  it("maps the built-in tiers onto a route and leaves other models alone", () => {
    const route = { standard: "claude-sonnet-5.5", advanced: "claude-opus-5.5", source: "default" } as const;
    expect(routeModelKey(route, "gpt-6-luna")).toBe("claude-sonnet-5.5");
    expect(routeModelKey(route, "gpt-6.1-sol")).toBe("claude-opus-5.5");
    expect(routeModelKey(route, "gemini-3.1-flash-lite")).toBe("gemini-3.1-flash-lite");
    expect(routeModelKey(undefined, "gpt-6-luna")).toBe("gpt-6-luna");
    expect(routeModelKey(userRoute("gemini-4-argon"), "gpt-6.1-sol")).toBe("gemini-4-argon");
  });

  it("treats runs saved before model choice (or with an unknown model) as the built-in route", () => {
    expect(runModel({}, "gpt-6-luna")).toBe("gpt-6-luna");
    expect(runModel({ modelRoute: { standard: "retired-model", advanced: "gpt-6.1-sol", source: "default" } }, "gpt-6-luna")).toBe("gpt-6-luna");
    expect(runModel({ modelRoute: { ...BUILT_IN_ROUTE, standard: "claude-haiku-5.5" } }, "gpt-6-luna")).toBe("claude-haiku-5.5");
  });

  it("lists every model cheapest first and marks providers without a key unavailable", () => {
    const env = { OPENAI_API_KEY: "x", GEMINI_API_KEY: "y" };
    const options = modelOptions(NOW, env);
    expect(options).toHaveLength(KEYS.length);
    const blended = options.map((o) => o.inputPerM + o.outputPerM);
    expect([...blended].sort((a, b) => a - b)).toEqual(blended);
    expect(options.slice(0, 2).map((o) => o.key)).toEqual(["claude-haiku-5.5", "gpt-6-luna"]);
    expect(options.at(-1)?.provider).not.toBe("google");
    expect(options.filter((o) => !o.available).every((o) => o.provider === "anthropic")).toBe(true);
    expect(modelAvailable("claude-haiku-5.5", env)).toBe(false);
    expect(modelAvailable("gemini-3.1-pro", env)).toBe(true);
  });
});

describe("provider adapters without keys", () => {
  const saved = { a: process.env.ANTHROPIC_API_KEY, g: process.env.GEMINI_API_KEY, o: process.env.OPENAI_API_KEY };
  afterEach(() => {
    for (const [k, v] of [["ANTHROPIC_API_KEY", saved.a], ["GEMINI_API_KEY", saved.g], ["OPENAI_API_KEY", saved.o]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("reports provider_unavailable instead of calling the API", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    for (const modelKey of ["claude-sonnet-5.5", "gemini-3.1-pro", "gpt-6-astra"] as const) {
      const r = await modelTurn({ modelKey, system: [{ text: "s" }], messages: [{ role: "user", content: "hi" }], schema: z.object({ a: z.string() }), maxTokens: 100 }, NOW);
      expect(r).toMatchObject({ ok: false, kind: "provider_unavailable", costMicros: 0 });
    }
  });
});
