import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnswerAccuracyCard } from "../../src/components/app/visibility/AnswerAccuracy";

describe("answer accuracy card", () => {
  it("lists errors with the correct fact and the limits of correction", () => {
    const html = renderToStaticMarkup(createElement(AnswerAccuracyCard, { accuracy: { byProvider: [{ provider: "gemini", checked: 3, withErrors: 1 }], recentErrors: [{ provider: "gemini", query: "bakery hours", checkedAt: Date.UTC(2026, 9, 1), incorrectClaim: "open on Sundays", correctFact: "Closed on Sundays." }] } }));
    expect(html).toContain("Gemini: 1 of 3 checked answers had an error");
    expect(html).toContain("open on Sundays");
    expect(html).toContain("Correct: Closed on Sundays.");
    expect(html).toContain("can&#x27;t make an AI tool change its answer");
    expect(renderToStaticMarkup(createElement(AnswerAccuracyCard, { accuracy: { byProvider: [], recentErrors: [] } }))).toBe("");
  });
});
