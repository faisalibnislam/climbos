import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { pipelineOutcomes, pipelineOutcomesBrief, type PipelineDeal } from "../../shared/growth/pipeline";
import { LossReasonFields } from "../../src/components/app/pipeline/LossReasonFields";

vi.mock("convex/react", () => ({ useMutation: vi.fn(() => vi.fn()) }));

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 25);
const deal = (o: Partial<PipelineDeal>): PipelineDeal => ({ stage: "lead", source: "manual", createdAt: now - 30 * DAY, updatedAt: now - DAY, ...o });

describe("owner pipeline outcomes", () => {
  it("counts closed deals in the window, loss reasons, unrecorded reasons, sources and open stages", () => {
    const p = pipelineOutcomes([
      deal({ stage: "won", source: "outbound", wonAt: now - 10 * DAY }),
      deal({ stage: "lost", source: "outbound", lostAt: now - 5 * DAY, lostReason: "price", lostReasonNote: "Went with a cheaper local option" }),
      deal({ stage: "lost", source: "booking", lostAt: now - 6 * DAY, lostReason: "price" }),
      deal({ stage: "lost", source: "booking", lostAt: now - 7 * DAY }),
      deal({ stage: "lost", updatedAt: now - 20 * DAY }), // older record: no close time
      deal({ stage: "won", wonAt: now - 400 * DAY }), // outside the window
      deal({ stage: "talking" }), deal({ stage: "booked" }), deal({ stage: "lead" }),
    ], { nowMs: now });
    expect(p).toMatchObject({ won: 1, lost: 4, winRate: 1 / 5, lossReasonNotRecorded: 2, lostWithoutCloseTime: 1, open: { lead: 1, talking: 1, booked: 1 } });
    expect(p.lossReasons).toEqual([{ reason: "price", count: 2 }]);
    expect(p.bySource).toEqual(expect.arrayContaining([{ source: "outbound", won: 1, lost: 1 }, { source: "booking", won: 0, lost: 2 }]));
    expect(p.recentLossNotes).toEqual(["Went with a cheaper local option"]);

    const text = pipelineOutcomesBrief(p);
    expect(text).toContain("win rate 20% (1 won of 5 closed; small sample)");
    expect(text).toContain("loss reasons: price or budget 2, not recorded 2");
    expect(text).toContain("1 older lost deals dated by last update");
    expect(text).toContain("an unrecorded reason is unknown");
    expect(text).not.toContain("cheaper local option"); // notes go through the untrusted wrapper separately
  });

  it("returns nothing without a pipeline", () => {
    expect(pipelineOutcomesBrief(pipelineOutcomes([], { nowMs: now }))).toBe("");
    expect(pipelineOutcomesBrief(pipelineOutcomes([deal({ stage: "lead" })], { nowMs: now }))).toContain("no closed deals yet");
  });

  it("offers optional loss reasons with an explicit not-recorded choice", () => {
    const html = renderToStaticMarkup(createElement(LossReasonFields, { slug: "acme", d: { id: "d1" as never, lostReason: null, lostReasonNote: null }, save: () => undefined }));
    expect(html).toContain("Why didn&#x27;t it go ahead?");
    expect(html).toContain("Leave it blank if you don&#x27;t know");
  });
});
