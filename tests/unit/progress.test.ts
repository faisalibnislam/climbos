import { describe, expect, it } from "vitest";
import { formatEta, phaseOf, progressOf, type Phase } from "../../shared/progress";

const planned: Phase[] = ["read", "profile", "research", "draft", "review"];
const T = 1_000_000;

describe("job progress", () => {
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
