import { describe, expect, it } from "vitest";
import { APP_TOOLS, PRIMARY_NAV, appArea, appHref, findTools } from "../../src/components/app/navigation";

describe("simpler navigation keeps existing tools discoverable", () => {
  it("retains every legacy specialist destination under a primary area", () => {
    const legacy = ["content", "autopilot", "outbound", "visibility", "pipeline", "reviews", "pages", "images", "reels", "studio", "links", "competitors", "connections", "chat", "inbox"];
    for (const key of legacy) {
      expect(APP_TOOLS.find((tool) => tool.key === key)?.description).toBeTruthy();
      expect([...PRIMARY_NAV.map((item) => item.key), "settings"]).toContain(appArea(key));
    }
    expect(new Set(APP_TOOLS.map((item) => item.key)).size).toBe(APP_TOOLS.length);
  });

  it("finds tasks using familiar and specialist words without requiring AI", () => {
    expect(findTools("posts").some((tool) => tool.key === "content")).toBe(true);
    expect(findTools("SEO").map((tool) => tool.key)).toContain("visibility");
    expect(findTools("pipeline").map((tool) => tool.key)).toContain("pipeline");
    expect(findTools("messages", "customers").every((tool) => tool.area === "customers")).toBe(true);
    expect(findTools("xyz-not-a-tool")).toEqual([]);
  });

  it("keeps deep-link ownership and workspace paths intact", () => {
    expect(appArea("content")).toBe("work");
    expect(appArea("outbound")).toBe("customers");
    expect(appArea("competitors")).toBe("plan");
    expect(appHref("business-a", "studio")).toBe("/studio/business-a");
    expect(appHref("business-b", "review")).toBe("/app/business-b/today#review");
    expect(appHref("a/b", "content")).toBe("/app/a%2Fb/content");
  });
});
