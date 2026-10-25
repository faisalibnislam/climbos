import { describe, expect, it } from "vitest";
import { buildAiSearchPanelQueries } from "../../shared/aiSearch/panelQueries";

describe("AI search question panels", () => {
  it("keeps the same customer questions across selected answer tools", () => {
    expect(buildAiSearchPanelQueries("  Best option for me?\nBest   option for me?\nHow does it work?", ["chatgpt", "perplexity"], " Dhaka ")).toEqual({
      queries: [
        { provider: "chatgpt", query: "Best option for me?", location: "Dhaka" },
        { provider: "perplexity", query: "Best option for me?", location: "Dhaka" },
        { provider: "chatgpt", query: "How does it work?", location: "Dhaka" },
        { provider: "perplexity", query: "How does it work?", location: "Dhaka" },
      ],
      error: null,
    });
  });

  it("requires a question and a selected answer tool", () => {
    expect(buildAiSearchPanelQueries(" \n ", ["chatgpt"], "").error).toContain("question");
    expect(buildAiSearchPanelQueries("A question", [], "").error).toContain("answer tool");
  });

  it("blocks panels above the backend limit", () => {
    const questions = Array.from({ length: 21 }, (_, index) => `Question ${index + 1}`).join("\n");
    const result = buildAiSearchPanelQueries(questions, ["chatgpt", "gemini", "perplexity", "google_ai_overview", "other"], "");
    expect(result.queries).toHaveLength(105);
    expect(result.error).toContain("up to 100");
  });
});
