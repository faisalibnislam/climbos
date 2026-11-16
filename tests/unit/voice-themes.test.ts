import { describe, expect, it } from "vitest";
import { customerVoiceBrief, groupVoiceThemes } from "../../shared/reviews/voiceThemes";

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

  it("does not count a repeated record or invalid date as independent evidence", () => {
    const source = { id: "one", kind: "email", channel: "support", text: "Setup was easy", receivedAt: 100 };
    expect(groupVoiceThemes([source, source, { ...source, id: "invalid", receivedAt: NaN }])).toEqual([]);
    const themes = groupVoiceThemes([source, { ...source, id: "two", text: "Setup was not confusing" }]);
    expect(themes[0]).toMatchObject({ count: 2, label: "Getting started" });
    expect(themes[0]).not.toHaveProperty("sentiment");
  });

  it("keeps complete source records when context is bounded and discloses omissions", () => {
    const base = groupVoiceThemes([
      { id: "one", kind: "email", channel: "support", text: "Setup was easy", receivedAt: 100 },
      { id: "two", kind: "email", channel: "support", text: "Setup was confusing", receivedAt: 200 },
    ])[0]!;
    const themes = Array.from({ length: 6 }, (_, index) => ({ ...base, status: "suggested" as const, suggestedLabel: base.label, ownerNote: null, reviewedAt: null,
      examples: base.examples.map(row => ({ ...row, sourceUrl: `https://example.com/${index}/${"a".repeat(1950)}` })),
    }));
    const brief = JSON.parse(customerVoiceBrief({ themes, capturedAt: 300, sourceCount: 12, limited: false, scope: "Test scope" }));
    expect(brief.limited).toBe(true);
    expect(brief.omittedActiveThemes).toBeGreaterThan(0);
    expect(brief.themes[0].examples).toEqual(themes[0].examples);
  });
});
