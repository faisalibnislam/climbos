import { describe, expect, it } from "vitest";
import { summarizePreviewLearning } from "../../shared/preview/metrics";

describe("anonymous preview learning metrics", () => {
  it("reports median stage latency and optional usefulness only after five observations", () => {
    const rows = [1, 2, 3, 4, 5].map((seconds, index) => ({
      status: "done",
      createdAt: 1_000,
      firstValueAt: 1_000 + seconds * 1_000,
      completedAt: 1_000 + (seconds + 5) * 1_000,
      usefulness: index < 4 ? "useful" as const : "not_yet" as const,
    }));
    expect(summarizePreviewLearning(rows)).toEqual({
      firstValueSamples: 5,
      firstValueP50Ms: 3_000,
      completedSamples: 5,
      completedP50Ms: 8_000,
      usefulnessResponses: 5,
      usefulnessRate: 0.8,
    });
  });

  it("suppresses small-sample medians and usefulness rates and ignores invalid timestamps", () => {
    expect(summarizePreviewLearning([
      { status: "done", createdAt: 100, firstValueAt: 150, completedAt: 200, usefulness: "useful" },
      { status: "failed", createdAt: 100, firstValueAt: 90, completedAt: 220, usefulness: "not_yet" },
    ])).toEqual({
      firstValueSamples: 1,
      firstValueP50Ms: null,
      completedSamples: 1,
      completedP50Ms: null,
      usefulnessResponses: 2,
      usefulnessRate: null,
    });
  });

  it("does not treat failed previews as completed snapshots", () => {
    const rows = Array.from({ length: 6 }, (_, index) => ({
      status: index === 0 ? "failed" : "done",
      createdAt: 0,
      firstValueAt: 1_000,
      completedAt: 2_000,
    }));
    expect(summarizePreviewLearning(rows)).toMatchObject({
      firstValueSamples: 6,
      completedSamples: 5,
      completedP50Ms: 2_000,
    });
  });
});
