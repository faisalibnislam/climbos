import { describe, expect, it } from "vitest";
import { followerSummary, getFollowerCount } from "../../shared/integrations/followers";

const fetchWith = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

describe("follower counts", () => {
  it("reads Instagram followers_count and Facebook fan_count fallback", async () => {
    const ig = await getFollowerCount({ accessToken: "t", provider: "instagram", accountId: "123", fetchImpl: fetchWith({ followers_count: 2140 }) });
    expect(ig).toEqual({ ok: true, data: { count: 2140 } });
    const fb = await getFollowerCount({ accessToken: "t", provider: "facebook_pages", accountId: "456", fetchImpl: fetchWith({ fan_count: 610 }) });
    expect(fb).toEqual({ ok: true, data: { count: 610 } });
  });

  it("refuses a missing count or a bad account id instead of recording zero", async () => {
    expect((await getFollowerCount({ accessToken: "t", provider: "instagram", accountId: "123", fetchImpl: fetchWith({}) })).ok).toBe(false);
    expect((await getFollowerCount({ accessToken: "t", provider: "instagram", accountId: "../me", fetchImpl: fetchWith({ followers_count: 1 }) })).ok).toBe(false);
  });

  it("summarises latest, 7-day change and weekly points; unknown change stays null", () => {
    const s = followerSummary([{ day: "2026-10-14", count: 1900 }, { day: "2026-10-21", count: 2044 }, { day: "2026-10-28", count: 2140 }], "2026-10-28");
    expect(s.latest).toBe(2140);
    expect(s.weekChange).toBe(96);
    expect(s.weekly).toEqual([1900, 2044, 2140]);
    expect(followerSummary([{ day: "2026-10-28", count: 50 }], "2026-10-28").weekChange).toBeNull();
    expect(followerSummary([], "2026-10-28")).toEqual({ latest: null, weekChange: null, weekly: [] });
  });
});
