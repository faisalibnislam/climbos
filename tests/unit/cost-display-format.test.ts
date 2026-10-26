import { describe, expect, it } from "vitest";
import { IMAGE_ROUTES, imageProviderMicros } from "../../shared/ai/models";
import { microsToUsdCost, microsToUsdLeft, microsToUsdUpTo } from "../../src/components/app/money";

describe("API cost in dollars", () => {
  it("rounds what was spent to the nearest cent and never shows $0.00 for real work", () => {
    expect(microsToUsdCost(0)).toBe("$0.00");
    expect(microsToUsdCost(1)).toBe("under $0.01");
    expect(microsToUsdCost(4_999)).toBe("under $0.01");
    expect(microsToUsdCost(5_000)).toBe("$0.01");
    expect(microsToUsdCost(123_456)).toBe("$0.12");
    expect(microsToUsdCost(1_234_567_890)).toBe("$1,234.57");
  });

  it("rounds worst cases up and balances down", () => {
    expect(microsToUsdUpTo(10_001)).toBe("$0.02");
    expect(microsToUsdUpTo(0)).toBe("$0.00");
    expect(microsToUsdLeft(19_999)).toBe("$0.01");
    expect(microsToUsdLeft(-5)).toBe("$0.00");
  });

  it("prices an image from Gemini's reported usage (pricing page, 26 Oct 2026)", () => {
    const route = IMAGE_ROUTES.standard;
    // 1,120 image tokens at $30/M = $0.0336; 200 prompt tokens at $0.25/M = $0.00005.
    expect(imageProviderMicros(route, { promptTokenCount: 200, candidatesTokenCount: 1_120, candidatesTokensDetails: [{ modality: "IMAGE", tokenCount: 1_120 }] }, true)).toBe(33_650);
    // Text and thinking tokens bill at the text rate ($1.50/M).
    expect(imageProviderMicros(route, { promptTokenCount: 0, candidatesTokenCount: 1_220, thoughtsTokenCount: 100, candidatesTokensDetails: [{ modality: "IMAGE", tokenCount: 1_120 }, { modality: "TEXT", tokenCount: 100 }] }, true)).toBe(33_900);
    // No usage reported: one 1K image assumed; a refusal bills only the prompt.
    expect(imageProviderMicros(route, undefined, true)).toBe(33_600);
    expect(imageProviderMicros(route, { promptTokenCount: 400 }, false)).toBe(100);
    // Always below the flat $0.045 credits charge for a normal image.
    expect(imageProviderMicros(route, { promptTokenCount: 2_000 }, true)).toBeLessThan(route.planningCostPerAttemptUsd * 1_000_000);
  });
});
