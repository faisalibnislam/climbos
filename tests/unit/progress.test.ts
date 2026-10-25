import { describe, expect, it } from "vitest";
import { formatEta, phaseOf, progressOf, runStatusPresentation, type Phase } from "../../shared/progress";

const planned: Phase[] = ["read", "profile", "research", "draft", "review"];
const T = 1_000_000;

describe("job progress", () => {
  it("uses a clear shared label and tone for every saved run status", () => {
    expect(["proposed", "cost_reserved", "preparing", "needs_approval", "approved", "scheduled", "executing", "verified", "failed", "uncertain", "paused", "canceled"].map(runStatusPresentation)).toEqual([
      { label: "Queued", tone: "neutral" },
      { label: "Getting ready", tone: "blue" },
      { label: "Working on it", tone: "blue" },
      { label: "Waiting for approval", tone: "amber" },
      { label: "Approved", tone: "green" },
      { label: "Scheduled", tone: "blue" },
      { label: "Working on it", tone: "blue" },
      { label: "Done", tone: "green" },
      { label: "Didn't finish", tone: "red" },
      { label: "Outcome uncertain", tone: "amber" },
      { label: "Paused", tone: "amber" },
      { label: "Canceled", tone: "neutral" },
    ]);
    expect(runStatusPresentation("future_internal_status")).toEqual({ label: "Status update", tone: "neutral" });
  });

  it("maps engine step labels to phases", () => {
    expect(phaseOf("Read your website")).toBe("read");
    expect(phaseOf("Business insights: research")).toBe("research");
    expect(phaseOf("Business insights: draft")).toBe("draft");
    expect(phaseOf("Business insights: review 1")).toBe("review");
    expect(phaseOf("Business insights: revision 1")).toBe("revise");
  });
  it("counts finished phases, partial credit for the running one, and the planned rest", () => {
    const steps = [
      { label: "Read your website", status: "succeeded", startedAt: T, finishedAt: T + 20_000 },
      { label: "Understand the business", status: "succeeded", startedAt: T + 20_000, finishedAt: T + 45_000 },
      { label: "Business insights: research", status: "running", startedAt: T + 45_000 },
    ];
    const p = progressOf(steps, planned, T + 120_000, false);
    // done 20 + 25 + 75 of 475 expected seconds
    expect(p.percent).toBe(25);
    expect(p.current).toBe("research");
    expect(p.elapsedSeconds).toBe(120);
    expect(p.etaSeconds).toBe(360); // 75 left on research + 200 draft + 80 review, rounded up
    expect(formatEta(p.etaSeconds)).toBe("About 6 minutes left");
  });
  it("never reaches 100% before the run finishes, even when a step overruns", () => {
    const p = progressOf([{ label: "Business insights: draft", status: "running", startedAt: T }], ["draft"], T + 3_600_000, false);
    expect(p.percent).toBeLessThanOrEqual(99);
    expect(p.etaSeconds).toBeGreaterThan(0);
    expect(progressOf([], planned, T, true).percent).toBe(100);
  });
});

describe("findings", () => {
  it("summarises research, reviews and plans in plain text", async () => {
    const { findingsFor } = await import("../../shared/progress");
    expect(findingsFor("Growth plays: research", { notes: "## Notes\n- **Plausible** already has a [free trial](https://x.com) for 30 days, no card", sources: [{ url: "https://www.g2.com/a" }, { url: "https://reddit.com/b" }] })).toEqual([
      "Read 2 sources: g2.com, reddit.com",
      "Plausible already has a free trial for 30 days, no card",
    ]);
    expect(findingsFor("Growth plan: review 1", { gates: [], fixes: ["Tie the ad test to one CAC rule"], strengths: [] })[0]).toMatch(/1 fix: Tie the ad test/);
    expect(findingsFor("Growth plays: draft", { plays: [{ name: "Comparison pages" }, { name: "Integration listing" }] })).toEqual(["2 growth plays: Comparison pages · Integration listing"]);
  });
});
