import { describe, expect, it } from "vitest";
import { channelWork } from "../../shared/acquisition/makeItHappen";

describe("make it happen: what each channel gets", () => {
  it("drafts social posts and asks to connect the account when it isn't connected", () => {
    const w = channelWork({ id: "O02", family: "organic_social", name: "LinkedIn company page" });
    expect(w.draft).toMatchObject({ job: "content_social", channel: "linkedin", quantity: 3 });
    expect(w.todos.map((t) => t.kind)).toEqual(["connect_account"]);
    expect(channelWork({ id: "O02", family: "organic_social", name: "LinkedIn company page" }, ["linkedin"]).todos).toEqual([]);
  });

  it("drafts a page for search, paused ads for paid, an email for outreach, and only a to-do for manual channels", () => {
    expect(channelWork({ id: "S09", family: "organic_search", name: "Comparison pages" }).draft?.job).toBe("content_seo");
    const ads = channelWork({ id: "P01", family: "paid_search", name: "Google Search ads" });
    expect(ads.draft?.job).toBe("content_ads");
    expect(ads.todos[0].kind).toBe("connect_account");
    const outreach = channelWork({ id: "D01", family: "outreach", name: "Cold email" });
    expect(outreach.draft).toMatchObject({ job: "content_email", channel: "email" });
    expect(outreach.todos[0].title).toMatch(/Choose who to contact/);
    const events = channelWork({ id: "E05", family: "events", name: "Local meetups" });
    expect(events.draft).toBeNull();
    expect(events.todos).toHaveLength(1);
  });
});
