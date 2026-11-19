import { expect, it } from "vitest";
import { emailDeliveryWindow, localEmailDeliveryTime } from "../../shared/growth/emailSchedule";
const hour = 3_600_000, now = Date.UTC(2026, 10, 19);
it("bounds an exact approval to one delivery hour within the current allowance", () => {
  expect(emailDeliveryWindow(now + hour, now, now + 24 * hour)).toEqual({ scheduledFor: now + hour, windowEnd: now + 2 * hour });
  expect(emailDeliveryWindow(now + 23 * hour, now, now + 24 * hour)).not.toBeNull();
  expect(emailDeliveryWindow(now + hour, now, now + 2 * hour - 1)).toBeNull();
});
it.each([0, -1, 59_999, 23 * hour + 1, NaN, Infinity, 60_000.1])("rejects unsupported schedule offset %s", delta => {
  expect(emailDeliveryWindow(now + delta, now, now + 30 * hour)).toBeNull();
});
it("rejects malformed and normalized dates, preserving exact local time", () => {
  for (const invalid of ["", "2026-02-30T12:00", "2026-13-01T01:00", "2026-11-19T24:00", "2026-11-19", "2026-11-19T12:00Z"]) expect(localEmailDeliveryTime(invalid)).toBeNull();
  expect(localEmailDeliveryTime("2026-11-19T12:30")).toBe(new Date(2026, 10, 19, 12, 30).getTime());
});
it("rejects a daylight-saving gap and returns an exact instant for a repeated local time", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "America/New_York";
    expect(localEmailDeliveryTime("2026-03-08T02:30")).toBeNull();
    expect(localEmailDeliveryTime("2026-11-01T01:30")).toBe(Date.parse("2026-11-01T05:30:00Z"));
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
