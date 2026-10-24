import { describe, expect, it } from "vitest";
import { CHANNEL_BY_ID } from "../../shared/acquisition/library";
import { limitChecks, scoreChannels, scorecardText, type AcquisitionProfile } from "../../shared/acquisition/scoring";

/** S5 (REQ-STRAT-03): cash, owner time, sales cycle and capability apply before ranking, in code. */
const v = (value: string) => ({ value, confidence: "high" as const, source: "owner" as const });
const saas: AcquisitionProfile = { types: ["b2b_saas"], budgetUsd: 600, horizonDays: 90, dims: { customerType: v("b2b"), geography: v("global"), aov: v("high"), salesMotion: v("sales_led"), salesCycle: v("short"), team: v("small") } };
const picked = (rows: ReturnType<typeof scoreChannels>) => rows.filter((r) => r.status === "primary" || r.status === "in_plan");

describe("hard limits before ranking", () => {
  it("off by default: the scorecard is exactly what it was", () => {
    const rows = scoreChannels(saas);
    expect(rows.every((r) => r.limits === undefined)).toBe(true);
    expect(JSON.stringify(scoreChannels(saas, [], undefined, undefined))).toBe(JSON.stringify(rows));
  });

  it("cash: a channel the budget can't feed is blocked and never picked", () => {
    const broke = { ...saas, budgetUsd: 0 };
    const rows = scoreChannels(broke, [], undefined, {});
    expect(rows.find((r) => r.id === "P01")?.limits?.[0]).toMatchObject({ kind: "cash", verdict: "blocked" });
    expect(picked(rows).some((r) => r.paid)).toBe(false);
  });

  it("owner time: with no hours, only channels ClimbOS runs end to end are picked; with hours, the plan differs", () => {
    const none = picked(scoreChannels(saas, [], undefined, { ownerHoursPerWeek: 0 }));
    const some = picked(scoreChannels(saas, [], undefined, { ownerHoursPerWeek: 10 }));
    expect(none.length).toBeGreaterThan(0);
    expect(none.every((r) => r.exec === "auto")).toBe(true);
    expect(some.some((r) => r.exec !== "auto")).toBe(true);
    expect(none.map((r) => r.id)).not.toEqual(some.map((r) => r.id));
  });

  it("sales cycle: a channel whose first revenue lands after the goal date is late, and on-time channels go first", () => {
    const long = { ...saas, dims: { ...saas.dims, salesCycle: v("medium") } };
    const rows = scoreChannels(long, [], undefined, {});
    const seo = rows.find((r) => r.id === "S01")!; // months to learn + 45-day cycle > 90 days
    expect(seo.limits?.find((l) => l.kind === "sales_cycle")).toMatchObject({ verdict: "late" });
    const plan = picked(rows);
    const onTimeLeft = rows.filter((r) => r.status !== "ineligible" && r.score >= 50 && !r.limits?.length && !plan.includes(r));
    // A late channel is only in the plan when no on-time channel was left to take its slot.
    if (plan.some((r) => r.limits?.some((l) => l.verdict === "late"))) expect(onTimeLeft).toEqual([]);
    expect(plan[0].limits?.some((l) => l.verdict === "late") ?? false).toBe(false);
  });

  it("sales cycle: a long cycle and a near goal date steer the plan to customers already won (retention outranks acquisition)", () => {
    const slow = { ...saas, horizonDays: 30, dims: { ...saas.dims, salesCycle: v("long") } };
    const plan = picked(scoreChannels(slow, [], undefined, {}));
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.some((r) => r.limits?.some((l) => l.verdict === "late"))).toBe(false);
    expect(plan.map((r) => r.id)).toContain("R02"); // customer referral program
    // Without limits the same business gets new-buyer acquisition channels first.
    expect(picked(scoreChannels(slow))[0].id).not.toBe(plan[0].id);
  });

  it("sales cycle: when no channel is on time, late ones still fill the plan and say when revenue lands", () => {
    const now = { ...saas, horizonDays: 5, dims: { ...saas.dims, salesCycle: v("immediate") } };
    const rows = scoreChannels(now, [], undefined, {});
    const plan = picked(rows);
    expect(plan.length).toBeGreaterThan(0);
    for (const r of plan.filter((x) => x.limits?.some((l) => l.verdict === "late"))) expect(r.limits!.find((l) => l.verdict === "late")!.reason).toMatch(/First revenue around day \d+/);
  });

  it("capability: outreach without a mailbox needs setup but isn't blocked; with one it's clear", () => {
    const d01 = CHANNEL_BY_ID.D01;
    expect(limitChecks(d01, saas, { connected: [] })).toEqual([{ kind: "capability", verdict: "setup", reason: expect.stringContaining("mailbox") }]);
    expect(limitChecks(d01, saas, { connected: ["email_mailbox"] })).toEqual([]);
    // Unknown connections (null) are never claimed as missing.
    expect(limitChecks(d01, saas, { connected: null })).toEqual([]);
  });

  it("measurement: owner-confirmed missing conversion tracking blocks paid acquisition before ranking", () => {
    const noTracking = { ...saas, dims: { ...saas.dims, tracking: v("none") } };
    const rows = scoreChannels(noTracking, [], undefined, {});
    expect(rows.find((r) => r.id === "P01")?.limits).toContainEqual(expect.objectContaining({ kind: "measurement", verdict: "blocked" }));
    expect(picked(rows).some((r) => r.paid)).toBe(false);
  });

  it("measurement: inferred or unknown tracking does not hard-block paid tests", () => {
    const inferred = { ...saas, dims: { ...saas.dims, tracking: { value: "none", confidence: "medium" as const, source: "inferred" as const } } };
    expect(limitChecks(CHANNEL_BY_ID.P01, inferred, {}).some((x) => x.kind === "measurement")).toBe(false);
    expect(limitChecks(CHANNEL_BY_ID.P01, saas, {}).some((x) => x.kind === "measurement")).toBe(false);
  });

  it("capacity: zero owner-confirmed delivery capacity blocks new-buyer channels but permits existing-base work", () => {
    expect(limitChecks(CHANNEL_BY_ID.P01, saas, { newCustomersPerMonth: 0 }).some((x) => x.kind === "capacity" && x.verdict === "blocked")).toBe(true);
    expect(limitChecks(CHANNEL_BY_ID.R02, saas, { newCustomersPerMonth: 0 }).some((x) => x.kind === "capacity")).toBe(false);
    expect(limitChecks(CHANNEL_BY_ID.P01, saas, {}).some((x) => x.kind === "capacity")).toBe(false);
  });

  it("the planner's scorecard names the limit", () => {
    const text = scorecardText(scoreChannels({ ...saas, budgetUsd: 0 }, [], undefined, { connected: [] }), 400);
    expect(text).toMatch(/P01 Google Search Ads: .*Not now · .*Needs at least \$300\/month to learn anything; the budget is \$0/);
    expect(text).toMatch(/D01 Cold email: .*setup: Connect the owner's mailbox/);
  });

  it("contrasting businesses get different channel agendas", () => {
    const local: AcquisitionProfile = { types: ["local_services"], budgetUsd: 0, horizonDays: 30, dims: { customerType: v("b2c"), geography: v("local"), salesCycle: v("immediate"), team: v("solo") } };
    const a = picked(scoreChannels(saas, [], undefined, { ownerHoursPerWeek: 5, connected: ["email_mailbox"] })).map((r) => r.id);
    const b = picked(scoreChannels(local, [], undefined, { ownerHoursPerWeek: 2, connected: [] })).map((r) => r.id);
    expect(a.length && b.length).toBeTruthy();
    expect(a.filter((id) => b.includes(id))).toHaveLength(0);
  });
});
