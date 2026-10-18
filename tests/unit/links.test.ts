import { describe, expect, it } from "vitest";
import { isBot, shortenable, utmFor, withUtm } from "../../shared/links";

describe("tracked links", () => {
  it("tags URLs with UTM per channel and keeps the owner's own tags", () => {
    expect(withUtm("https://shop.example/offer", utmFor("instagram_post"))).toBe("https://shop.example/offer?utm_source=instagram&utm_medium=social&utm_campaign=climbos");
    expect(withUtm("https://shop.example/?utm_source=mine", utmFor("google_search_ad"))).toBe("https://shop.example/?utm_source=mine&utm_medium=cpc&utm_campaign=climbos");
    expect(withUtm("javascript:alert(1)", utmFor("x"))).toBeNull();
  });
  it("never shortens ads and ignores link-preview bots", () => {
    expect(shortenable("ad")).toBe(false);
    expect(shortenable("social_post")).toBe(true);
    expect(isBot("LinkedInBot/1.0 (compatible; Mozilla/5.0)")).toBe(true);
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1")).toBe(false);
  });
});
