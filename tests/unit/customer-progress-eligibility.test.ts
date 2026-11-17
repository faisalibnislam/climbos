import { describe, expect, it } from "vitest";
import { normalizeProgressRule, progressEligibility, type CustomerProgressRecord, type CustomerProgressRule } from "../../shared/growth/customerProgress";

const DAY = 86400000, NOW = Date.UTC(2026, 10, 17, 23, 59);
const rule: CustomerProgressRule = { scope: "Export onboarding", state: "started", criterion: "Created account; first real export not yet observed", maxAgeDays: 7 };
const record = (): CustomerProgressRecord => ({ revision: 1, history: [], current: [{ scope: rule.scope, state: "started", criterion: rule.criterion, evidence: "Owner reviewed the setup record", observedOn: "2026-11-10", recordedAt: NOW - DAY, recordedBy: "owner", revision: 1 }] });

describe("per-send customer progress eligibility", () => {
  it("qualifies the exact definition at the inclusive UTC calendar-day boundary", () => {
    expect(progressEligibility(record(), rule, NOW).status).toBe("eligible");
    expect(progressEligibility(record(), rule, Date.UTC(2026, 10, 18)).status).toBe("outdated");
    expect(progressEligibility(record(), { ...rule, scope: "  EXPORT   onboarding " }, NOW).status).toBe("eligible");
  });
  it.each(["missing", "other scope", "explicit unknown", "future date", "invalid date", "future recorded time", "no evidence", "duplicate scope", "invalid revision"])("keeps %s progress unknown instead of assuming a missed milestone", kind => {
    const value = record(), r = value.current[0];
    if (kind === "missing") value.current = [];
    if (kind === "other scope") r.scope = "Another product";
    if (kind === "explicit unknown") r.state = "unknown";
    if (kind === "future date") r.observedOn = "2026-11-18";
    if (kind === "invalid date") r.observedOn = "2026-02-30";
    if (kind === "future recorded time") r.recordedAt = NOW + 1;
    if (kind === "no evidence") r.evidence = " ";
    if (kind === "duplicate scope") value.current.push({ ...r, scope: "EXPORT onboarding", state: "activated" });
    if (kind === "invalid revision") r.revision = 2;
    expect(progressEligibility(value, rule, NOW).status).toBe("unknown");
  });
  it.each(["activated", "retained", "exited"] as const)("excludes someone now reported as %s", state => {
    const value = record(); value.current[0].state = state;
    expect(progressEligibility(value, rule, NOW).status).toBe("different_progress");
  });
  it("does not equate different business definitions of the same stage", () => {
    const value = record(); value.current[0].criterion = "Started a paid project";
    expect(progressEligibility(value, rule, NOW).status).toBe("different_progress");
  });
  it.each([0, -1, 1.5, 366, NaN])("rejects an invalid owner age limit: %s", maxAgeDays => {
    expect(normalizeProgressRule({ ...rule, maxAgeDays })).toBeNull();
  });
  it("never permits unknown as an eligibility stage or silently supplies a definition", () => {
    expect(normalizeProgressRule({ ...rule, state: "unknown" })).toBeNull();
    expect(normalizeProgressRule({ ...rule, criterion: " " })).toBeNull();
    expect(progressEligibility(undefined, rule, NOW).status).toBe("unknown");
  });
});
