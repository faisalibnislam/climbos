import { describe, expect, it } from "vitest";
import { lintDeliveryCapacity, lintServiceArea } from "../../shared/agents/specs";
import { decisionQuestions, type Economics } from "../../shared/agents/economics";
import { isServiceBusiness } from "../../shared/acquisition/library";

/** Slice 4: demand the business can't deliver, or can't reach, is waste (EV09, EV17). */
describe("delivery capacity", () => {
  it("fails a forecast above what the business can take (hard capacity rule)", () => {
    const issues = lintDeliveryCapacity(30, { newCustomersPerMonth: 3, horizonDays: 90 });
    expect(issues).toMatchObject([{ rule: "capacity", severity: "error" }]);
    expect(issues[0].message).toMatch(/about 9 \(3 a month\)/);
  });
  it("passes within capacity, and stays off when capacity is unknown", () => {
    expect(lintDeliveryCapacity(8, { newCustomersPerMonth: 3, horizonDays: 90 })).toEqual([]);
    expect(lintDeliveryCapacity(500, { horizonDays: 90 })).toEqual([]);
  });
  it("asks a service business for its capacity when the plays forecast new customers", () => {
    const economics: Economics = { revenuePerCustomerMonthUsd: 400, grossMargin: 0.5, monthlyChurn: 0.05, basis: "" };
    const plays = [{ name: "Referrals", kind: "bankable", horizonDays: 90, model: { weeklyReach: 200, steps: [{ name: "reply", rate: 0.1 }, { name: "buy", rate: 0.2 }], monthlySpendUsd: 0, ownerHoursPerWeek: 1 } }];
    const q = decisionQuestions({ economics, plays: plays as never }, {}, 3, { serviceBusiness: true, horizonDays: 90 });
    expect(q[0]).toMatchObject({ key: "newCustomersPerMonth", unit: "count_month" });
    expect(decisionQuestions({ economics, plays: plays as never }, {}, 3, { serviceBusiness: false, horizonDays: 90 }).some((x) => x.key === "newCustomersPerMonth")).toBe(false);
    expect(decisionQuestions({ economics, plays: plays as never }, { newCustomersPerMonth: 5 }, 3, { serviceBusiness: true }).some((x) => x.key === "newCustomersPerMonth")).toBe(false);
  });
  it("knows which businesses deliver through people's time", () => {
    expect(isServiceBusiness(["agency"])).toBe(true);
    expect(isServiceBusiness(["b2b_saas"])).toBe(false);
    expect(isServiceBusiness([], "local_service")).toBe(isServiceBusiness(undefined, "local_service"));
  });
});

describe("service area", () => {
  it("fails paid reach for a local business that isn't limited to the area (EV17)", () => {
    expect(lintServiceArea([{ path: "plays[0]", spend: 300, text: "National Google search ads for 'plumber'" }], { serviceArea: "local" })).toMatchObject([{ rule: "service_area", path: "plays[0]" }]);
  });
  it("passes geo-targeted or free reach, and businesses that serve everywhere", () => {
    expect(lintServiceArea([{ path: "plays[0]", spend: 300, text: "Search ads within 5 miles of the shop" }], { serviceArea: "local" })).toEqual([]);
    expect(lintServiceArea([{ path: "plays[0]", spend: 0, text: "Post in the national subreddit" }], { serviceArea: "local" })).toEqual([]);
    expect(lintServiceArea([{ path: "plays[0]", spend: 300, text: "National search ads" }], { serviceArea: "national" })).toEqual([]);
  });
});
