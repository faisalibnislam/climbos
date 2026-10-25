import { afterEach, describe, expect, it } from "vitest";
import { modelProviderConfigured } from "../../convex/ai/providers";

const original = {
  openai: process.env.OPENAI_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
};

afterEach(() => {
  if (original.openai === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = original.openai;
  if (original.gemini === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = original.gemini;
  if (original.anthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = original.anthropic;
});

describe("model provider readiness", () => {
  it("checks OpenAI for the OpenAI-backed public preview model", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "configured";

    expect(modelProviderConfigured("gpt-6-luna")).toBe(true);
  });

  it("does not report an OpenAI model ready because another provider is configured", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "configured";

    expect(modelProviderConfigured("gpt-6-luna")).toBe(false);
  });

  it("checks the provider selected by the model catalog", () => {
    delete process.env.OPENAI_API_KEY;
    process.env.GEMINI_API_KEY = "configured";

    expect(modelProviderConfigured("gemini-3.8-flash")).toBe(true);
    expect(modelProviderConfigured("gpt-6-luna")).toBe(false);
  });
});
