import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { dealAttention, dealDueDate, isDealDate, pipelineAttention } from "../../shared/growth/pipeline";
import { DealAttentionBadges } from "../../src/components/app/pipeline/DealAttentionBadges";

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 25, 12);

describe("deal attention", () => {
  it("uses the configured local day, including both daylight-saving transitions", () => {
    const d = { stage: "talking" as const, nextStepDate: "2026-03-08" };
    expect(dealAttention(d, Date.parse("2026-03-09T03:59:59Z"), "America/New_York").overdue).toBe(false);
    expect(dealAttention(d, Date.parse("2026-03-09T04:00:00Z"), "America/New_York").overdue).toBe(true);
    expect(dealAttention({ ...d, nextStepDate: "2026-11-01" }, Date.parse("2026-11-02T04:59:59Z"), "America/New_York").overdue).toBe(false);
    expect(dealAttention({ ...d, nextStepDate: "2026-11-01" }, Date.parse("2026-11-02T05:00:00Z"), "America/New_York").overdue).toBe(true);
    const midnight = Date.parse("2026-11-17T00:30:00Z");
    expect(dealAttention({ ...d, nextStepDate: "2026-11-16" }, midnight, "Asia/Dhaka").overdue).toBe(true);
    expect(dealAttention({ ...d, nextStepDate: "2026-11-16" }, midnight, "America/Los_Angeles").overdue).toBe(false);
  });

  it("preserves unknown, conflicting and invalid dates instead of inventing deadlines", () => {
    for (const timezone of [undefined, null, "", "Unknown/Zone"]) expect(dealAttention({ stage: "talking", nextStepDate: "2026-01-01" }, now, timezone)).toMatchObject({ overdue: false, nextStepTimingUnknown: true });
    for (const nextStepDate of ["2026-02-30", "2026-13-01", "2026-2-01", "tomorrow"]) {
      expect(isDealDate(nextStepDate)).toBe(false);
      expect(dealAttention({ stage: "talking", nextStepDate }, now, "UTC")).toMatchObject({ overdue: false, nextStepTimingUnknown: true });
    }
    expect(isDealDate("2028-02-29")).toBe(true);
    expect(dealAttention({ stage: "talking", nextStepDate: "2026-01-01", nextStepAt: now }, now, "UTC")).toMatchObject({ overdue: false, nextStepTimingUnknown: true });
    for (const stageChangedAt of [Number.NaN, Number.POSITIVE_INFINITY, 8.64e15 + 1, now + 1]) expect(dealAttention({ stage: "booked", stageChangedAt }, now, "UTC")).toMatchObject({ stalledDays: null, stageAgeKnown: false });
    expect(dealAttention({ stage: "booked", nextStepDate: "2026-01-01", stageChangedAt: 0 }, Number.NaN, "UTC")).toMatchObject({ overdue: false, nextStepTimingUnknown: true, stageAgeKnown: false });
    expect(dealDueDate({ nextStepAt: Date.parse("2026-11-17T01:00:00Z") }, "America/Los_Angeles")).toBe("2026-11-16");
  });

  it("flags next steps whose day has passed and stage age past the review threshold", () => {
    expect(dealAttention({ stage: "talking", nextStepAt: now - 2 * DAY, stageChangedAt: now - 3 * DAY }, now, "UTC")).toEqual({ overdue: true, stalledDays: null, stageAgeKnown: true, nextStepTimingUnknown: false });
    // Due today is not overdue yet.
    expect(dealAttention({ stage: "talking", nextStepAt: now - 3 * 3_600_000, stageChangedAt: now }, now, "UTC").overdue).toBe(false);
    expect(dealAttention({ stage: "talking", stageChangedAt: now - 15 * DAY }, now, "UTC").stalledDays).toBe(15);
    expect(dealAttention({ stage: "lead", stageChangedAt: now - 15 * DAY }, now, "UTC").stalledDays).toBeNull();
    expect(dealAttention({ stage: "lead", stageChangedAt: now - 22 * DAY }, now, "UTC").stalledDays).toBe(22);
  });

  it("never treats unknown stage age or closed deals as stalled", () => {
    expect(dealAttention({ stage: "booked" }, now, "UTC")).toEqual({ overdue: false, stalledDays: null, stageAgeKnown: false, nextStepTimingUnknown: false });
    expect(dealAttention({ stage: "won", nextStepAt: now - 30 * DAY, stageChangedAt: now - 90 * DAY }, now, "UTC")).toEqual({ overdue: false, stalledDays: null, stageAgeKnown: true, nextStepTimingUnknown: false });
    expect(pipelineAttention([
      { stage: "talking", nextStepAt: now - 2 * DAY, stageChangedAt: now - 20 * DAY },
      { stage: "booked" },
      { stage: "lost", nextStepAt: now - 5 * DAY },
    ], now, "UTC")).toEqual({ overdue: 1, stalled: 1, stageAgeUnknown: 1, nextStepTimingUnknown: 0 });
  });

  it("labels the card and shows nothing when there's nothing to review", () => {
    const html = renderToStaticMarkup(createElement(DealAttentionBadges, { attention: { overdue: true, stalledDays: 16, stageAgeKnown: true, nextStepTimingUnknown: false } }));
    expect(html).toContain("Next step overdue");
    expect(html).toContain("No stage change in 16 days");
    expect(renderToStaticMarkup(createElement(DealAttentionBadges, { attention: { overdue: false, stalledDays: null, stageAgeKnown: false, nextStepTimingUnknown: false } }))).toBe("");
  });
});
