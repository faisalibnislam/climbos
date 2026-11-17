import { describe, expect, it } from "vitest";
import { checkContactFrequency, frequencyBlockMessage } from "../../shared/growth/contactFrequency";

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 25);

describe("owner-set contact frequency", () => {
  it("applies no limit unless the owner sets one", () => {
    expect(checkContactFrequency([{ lastMarketingEmailAt: now - DAY, activeOutreach: true }], undefined, now)).toBeNull();
  });

  it("explains unresolved marketing attempts without promising a clearance date", () => {
    const check = { recentlyEmailed: 0, activeOutreach: 0, activeMarketing: 1, clearAt: null };
    expect(frequencyBlockMessage(check, 7)).toContain("1 person is waiting for a marketing send result");
    expect(frequencyBlockMessage(check, 7)).not.toContain("clears on");
    expect(frequencyBlockMessage({ ...check, unknownMarketingAudience: true }, 7)).toContain("cannot verify the recipients");
  });

  it("counts people emailed by a broadcast or outreach within the limit, and anyone in active outreach", () => {
    const check = checkContactFrequency([
      { lastMarketingEmailAt: now - 2 * DAY, activeOutreach: false },
      { lastOutreachSentAt: now - 5 * DAY, activeOutreach: false },
      { lastMarketingEmailAt: now - 9 * DAY, activeOutreach: false },
      { activeOutreach: true },
      { activeOutreach: false },
    ], 7, now)!;
    expect(check).toEqual({ recentlyEmailed: 2, activeOutreach: 1, clearAt: now + 5 * DAY });
    const message = frequencyBlockMessage(check, 7)!;
    expect(message).toContain("2 people were emailed by ClimbOS within your 7-day limit");
    expect(message).toContain("1 is in an active outreach sequence");
    expect(message).toContain("clears on 2026-10-30");
    expect(frequencyBlockMessage({ recentlyEmailed: 0, activeOutreach: 0, clearAt: null }, 7)).toBeNull();
  });
});
