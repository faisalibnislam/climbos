import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { dealAttention, pipelineAttention } from "../../shared/growth/pipeline";
import { DealAttentionBadges } from "../../src/components/app/pipeline/DealAttentionBadges";

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 25, 12);

describe("deal attention", () => {
  it("flags next steps whose day has passed and stage age past the review threshold", () => {
    expect(dealAttention({ stage: "talking", nextStepAt: now - 2 * DAY, stageChangedAt: now - 3 * DAY }, now)).toEqual({ overdue: true, stalledDays: null, stageAgeKnown: true });
    // Due today is not overdue yet.
    expect(dealAttention({ stage: "talking", nextStepAt: now - 3 * 3_600_000, stageChangedAt: now }, now).overdue).toBe(false);
    expect(dealAttention({ stage: "talking", stageChangedAt: now - 15 * DAY }, now).stalledDays).toBe(15);
    expect(dealAttention({ stage: "lead", stageChangedAt: now - 15 * DAY }, now).stalledDays).toBeNull();
    expect(dealAttention({ stage: "lead", stageChangedAt: now - 22 * DAY }, now).stalledDays).toBe(22);
  });

  it("never treats unknown stage age or closed deals as stalled", () => {
    expect(dealAttention({ stage: "booked" }, now)).toEqual({ overdue: false, stalledDays: null, stageAgeKnown: false });
    expect(dealAttention({ stage: "won", nextStepAt: now - 30 * DAY, stageChangedAt: now - 90 * DAY }, now)).toEqual({ overdue: false, stalledDays: null, stageAgeKnown: true });
    expect(pipelineAttention([
      { stage: "talking", nextStepAt: now - 2 * DAY, stageChangedAt: now - 20 * DAY },
      { stage: "booked" },
      { stage: "lost", nextStepAt: now - 5 * DAY },
    ], now)).toEqual({ overdue: 1, stalled: 1, stageAgeUnknown: 1 });
  });

  it("labels the card and shows nothing when there's nothing to review", () => {
    const html = renderToStaticMarkup(createElement(DealAttentionBadges, { attention: { overdue: true, stalledDays: 16, stageAgeKnown: true } }));
    expect(html).toContain("Next step overdue");
    expect(html).toContain("No stage change in 16 days");
    expect(renderToStaticMarkup(createElement(DealAttentionBadges, { attention: { overdue: false, stalledDays: null, stageAgeKnown: false } }))).toBe("");
  });
});
