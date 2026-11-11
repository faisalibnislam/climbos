import { afterEach, expect, it, vi } from "vitest";
vi.mock("node:dns/promises", () => ({ lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]) }));
import { researchWebsite } from "../../convex/ai/research";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("reads public pages without invoking a paid scraper during the discovery conversation", async () => {
  vi.stubEnv("FIRECRAWL_API_KEY", "isolated-test-key-not-a-real-secret");
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input); calls.push(url);
    if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
    if (url !== "https://example.com/") throw new Error("Unexpected request outside the public website.");
    return new Response("<html><head><title>Example studio</title></head><body><h1>Handmade cycling belts</h1><p>Durable leather belts made for everyday bicycle commuters.</p></body></html>", { status: 200, headers: { "Content-Type": "text/html" } });
  }));
  const result = await researchWebsite("https://example.com/", 0, { allowPaidFetch: false });
  expect(result.pages[0].status).toBe("ok");
  expect(result.pages[0].text).toContain("Handmade cycling belts");
  expect(calls.every(url => url.startsWith("https://example.com/"))).toBe(true);
  expect(calls.some(url => /firecrawl/i.test(url))).toBe(false);
});
