import { describe, expect, it } from "vitest";
import { groupVoiceThemes } from "../../shared/reviews/voiceThemes";

describe("voice theme signal grouping", () => {
  it("requires repeated sources, preserves dates and channels, and redacts direct identifiers", () => {
    const rows = groupVoiceThemes([
      { id: "1", kind: "review", channel: "google", text: "Setup was confusing; contact ana@example.com", receivedAt: 100, redact: ["Alex"] },
      { id: "2", kind: "email", channel: "support", text: "The setup process is confusing", receivedAt: 200, redact: ["Alex"] },
      { id: "3", kind: "review", channel: "google", text: "Good staff", receivedAt: 300 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: "onboarding", count: 2, channels: ["google", "support"], firstSeenAt: 100, lastSeenAt: 200, confidence: "low" });
    expect(rows[0]!.examples[0]!.excerpt).not.toContain("ana@example.com");
    expect(groupVoiceThemes([{ id: "1", kind: "review", channel: "google", text: "Setup was confusing", receivedAt: 100 }])).toEqual([]);
  });
});
