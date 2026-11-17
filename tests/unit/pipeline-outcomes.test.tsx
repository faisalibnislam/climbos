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
    expect(p).toMatchObject({ won: 1, lost: 3, winRate: null, lossReasonNotRecorded: 1, closedWithoutCloseTime: 1, open: { lead: 1, talking: 1, booked: 1 } });
    expect(p.lossReasons).toEqual([{ reason: "price", count: 2 }]);
    expect(p.bySource).toEqual(expect.arrayContaining([{ source: "outbound", won: 1, lost: 1 }, { source: "booking", won: 0, lost: 2 }]));
    expect(p.recentLossNotes).toEqual(["Went with a cheaper local option"]);

    const text = pipelineOutcomesBrief(p);
    expect(text).toContain("win rate unknown (1 won / 3 lost");
    expect(text).toContain("loss reasons: price or budget 2, not recorded 1");
    expect(text).toContain("close date not recorded for 1");
    expect(text).toContain("an unrecorded reason is unknown");
    expect(text).not.toContain("cheaper local option"); // notes go through the untrusted wrapper separately
  });

  it("excludes future close dates from observed wins, losses, reasons and notes", () => {
    const p = pipelineOutcomes([
      deal({ stage: "won", wonAt: now + DAY }),
      deal({ stage: "lost", lostAt: now + DAY, lostReason: "price", lostReasonNote: "Not yet observed" }),
      deal({ stage: "lost", updatedAt: now + DAY }),
      deal({ stage: "won", wonAt: now }),
    ], { nowMs: now });
    expect(p).toMatchObject({ won: 1, lost: 0, winRate: null, invalidCloseTime: 2, closedWithoutCloseTime: 1, lossReasons: [], recentLossNotes: [] });
  });

  it("does not turn recent edits on undated old decisions into recent wins or losses", () => {
    const p = pipelineOutcomes([
      deal({ stage: "won", createdAt: now - 500 * DAY, updatedAt: now }),
      deal({ stage: "lost", createdAt: now - 500 * DAY, updatedAt: now, lostReason: "price", lostReasonNote: "An old note edited today" }),
      deal({ stage: "won", wonAt: now - DAY }),
    ], { nowMs: now });
    expect(p).toMatchObject({ won: 1, lost: 0, winRate: null, closedWithoutCloseTime: 2, recentLossNotes: [] });
    expect(pipelineOutcomesBrief(p)).toContain("close date not recorded for 2");
    expect(pipelineOutcomesBrief(p)).not.toContain("win rate 100%");
  });

  it("withholds the aggregate win rate for a truncated read without discarding dated observations", () => {
    const p = pipelineOutcomes([deal({ stage: "won", wonAt: now - DAY }), deal({ stage: "lost", lostAt: now - DAY, lostReason: "timing" })], { nowMs: now, partial: true });
    expect(p).toMatchObject({ won: 1, lost: 1, winRate: null, partial: true });
    expect(p.lossReasons).toEqual([{ reason: "timing", count: 1 }]);
    expect(pipelineOutcomesBrief(p)).toContain("win rate unknown");
  });

  it("keeps invalid or contradictory close dates out of recent outcomes", () => {
    const p = pipelineOutcomes([
      deal({ stage: "lost", lostAt: now + DAY, lostReason: "price" }),
      deal({ stage: "won", wonAt: Number.NaN }),
      deal({ stage: "won", wonAt: Number.POSITIVE_INFINITY }),
      deal({ stage: "lost", lostAt: now - DAY }),
    ], { nowMs: now });
    expect(p).toMatchObject({ won: 0, lost: 1, winRate: null, invalidCloseTime: 3 });
    expect(p.lossReasons).toEqual([]);
  });

  it("preserves complete recorded ratios, including zero wins and imported historical decisions", () => {
    const lost = deal({ stage: "lost", lostAt: now - DAY, createdAt: now });
    expect(pipelineOutcomes([lost], { nowMs: now }).winRate).toBe(0);
    const p = pipelineOutcomes([lost, deal({ stage: "won", wonAt: now - 2 * DAY, createdAt: now })], { nowMs: now });
    expect(p).toMatchObject({ won: 1, lost: 1, winRate: 0.5, invalidCloseTime: 0 });
    expect(pipelineOutcomesBrief(p)).toContain("win rate 50% (1 won of 2 closed; small sample)");
  });

  it("keeps coverage uncertainty visible even when there are no dated decisions", () => {
    expect(pipelineOutcomesBrief(pipelineOutcomes([deal({ stage: "lost" })], { nowMs: now }))).toContain("close date not recorded for 1");
    expect(pipelineOutcomesBrief(pipelineOutcomes([], { nowMs: now, partial: true }))).toContain("bounded read");
  });

  it.each([{ nowMs: Number.NaN }, { nowMs: now, windowDays: 0 }, { nowMs: now, windowDays: Number.MAX_SAFE_INTEGER }])("rejects invalid observation boundaries: %j", options => {
    expect(() => pipelineOutcomes([], options)).toThrow(RangeError);
  });

  it("returns nothing without a pipeline", () => {
    expect(pipelineOutcomesBrief(pipelineOutcomes([], { nowMs: now }))).toBe("");
    expect(pipelineOutcomesBrief(pipelineOutcomes([deal({ stage: "lead" })], { nowMs: now }))).toContain("no dated closed deals in this window");
  });

  it("offers optional loss reasons with an explicit not-recorded choice", () => {
    const html = renderToStaticMarkup(createElement(LossReasonFields, { slug: "acme", d: { id: "d1" as never, lostReason: null, lostReasonNote: null } }));
    expect(html).toContain("Why didn’t it go ahead?");
    expect(html).toContain("Leave it blank if you don’t know");
  });
});
