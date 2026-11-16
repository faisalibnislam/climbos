import { describe, expect, it } from "vitest";
import { postResultBrief, postResultEvidenceIssue, postResultValueIssue, postResultWindow } from "../../shared/growth/postResults";
const now = Date.parse("2026-11-16T12:00:00Z");
describe("post observation boundaries", () => {
  it("uses completed local dates including both DST transitions", () => {
    for (const [date, hours] of [["2026-03-08", 23], ["2026-11-01", 25]] as const) {
      const w = postResultWindow(date, date, "America/New_York", now);
      expect(w.periodEnd - w.periodStart).toBe(hours * 3600000);
    }
    expect(postResultWindow("2026-11-15", "2026-11-15", "Asia/Dhaka", now).periodStart).toBe(Date.parse("2026-11-14T18:00:00Z"));
  });
  it.each([["2026-02-30", "2026-03-01", "UTC"], ["2026-11-16", "2026-11-16", "UTC"], ["2026-11-15", "2026-11-14", "UTC"], ["2026-11-15", "2026-11-15", "Missing/Zone"], ["2025-11-13", "2026-11-15", "UTC"]])("rejects invalid or incomplete %s–%s in %s", (a,b,tz) => {
    expect(() => postResultWindow(a,b,tz,now)).toThrow();
  });
  it("accepts 366 local dates but not 367", () => {
    expect(() => postResultWindow("2025-11-15", "2026-11-15", "America/New_York", now)).not.toThrow();
    expect(() => postResultWindow("2025-11-14", "2026-11-15", "America/New_York", now)).toThrow();
  });
  it("keeps zero distinct from unknown and rejects invalid counts", () => {
    expect(postResultValueIssue({ payingCustomers: 0 })).toBeNull();
    for (const n of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(postResultValueIssue({ likes: n })).toBeTruthy();
    const report = { source: "owner" as const, capturedAt: now, likes: 5000, payingCustomers: 0 };
    expect(postResultBrief(report, null)).toContain("Signups: unknown; Paying customers: 0");
    expect(postResultBrief(report, null)).toContain("not customers or revenue");
    expect(postResultEvidenceIssue(report, null, now, false)).toContain("exact content version");
    expect(postResultEvidenceIssue({ ...report, source: "fixture" }, null, now, false)).toContain("Synthetic");
    expect(postResultBrief(null, "Wrong tenant")).toContain("Latest post report not used");
  });
});
