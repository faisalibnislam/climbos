import { afterEach, describe, expect, it, vi } from "vitest";
import { measureSitePerformance } from "../../convex/ai/sitePerformance";
import { parseCruxPerformance, parseLighthousePerformance } from "../../shared/site/performance";

describe("site performance normalization", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does not send private or invalid page URLs to Google measurement services", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const result = await measureSitePerformance("http://127.0.0.1/admin");
    expect(result.pageUrl).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("runs one mobile lab check without a CrUX key and reports field data as not configured", async () => {
    vi.stubEnv("GOOGLE_CRUX_API_KEY", "");
    vi.stubEnv("GOOGLE_PAGESPEED_API_KEY", "");
    const fetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ lighthouseResult: { finalUrl: "https://example.com/", categories: { performance: { score: 0.9 } }, audits: {} } }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    const result = await measureSitePerformance("https://example.com/");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("pagespeedonline.googleapis.com");
    expect(result.labData).toMatchObject({ status: "measured", score: 0.9 });
    expect(result.fieldData.status).toBe("not_configured");
  });

  it("requests exact-page phone field data only when the CrUX key is configured", async () => {
    vi.stubEnv("GOOGLE_CRUX_API_KEY", "test-key");
    vi.stubEnv("GOOGLE_PAGESPEED_API_KEY", "");
    const fetch = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => String(input).includes("chromeuxreport")
      ? new Response(JSON.stringify({ record: { key: { url: "https://example.com/pricing", formFactor: "PHONE" }, collectionPeriod: { firstDate: { year: 2026, month: 9, day: 1 }, lastDate: { year: 2026, month: 9, day: 28 } }, metrics: { largest_contentful_paint: { percentiles: { p75: 2400 } } } } }), { status: 200 })
      : new Response(JSON.stringify({ lighthouseResult: { categories: { performance: { score: 0.8 } }, audits: {} } }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    const result = await measureSitePerformance("https://example.com/pricing");
    expect(fetch).toHaveBeenCalledTimes(2);
    const cruxCall = fetch.mock.calls.find(([url]) => String(url).includes("chromeuxreport"));
    expect(cruxCall?.[1]?.method).toBe("POST");
    expect(String(cruxCall?.[0])).toContain("key=test-key");
    expect(JSON.parse(String(cruxCall?.[1]?.body))).toEqual({ url: "https://example.com/pricing", formFactor: "PHONE", metrics: ["largest_contentful_paint", "interaction_to_next_paint", "cumulative_layout_shift"] });
    expect(result.fieldData).toMatchObject({ status: "measured", recordUrl: "https://example.com/pricing", collectionPeriod: "2026-09-01 to 2026-09-28" });
  });

  it("preserves CrUX phone p75, data window, and metric status without converting field data into a score", () => {
    const result = parseCruxPerformance({
      record: {
        key: { url: "https://example.com/pricing", formFactor: "PHONE" },
        collectionPeriod: { firstDate: { year: 2026, month: 9, day: 1 }, lastDate: { year: 2026, month: 9, day: 28 } },
        metrics: {
          largest_contentful_paint: { percentiles: { p75: 2800 } },
          interaction_to_next_paint: { percentiles: { p75: 190 } },
          cumulative_layout_shift: { percentiles: { p75: "0.08" } },
        },
      },
    }, 1234);

    expect(result).toMatchObject({ status: "measured", formFactor: "PHONE", recordUrl: "https://example.com/pricing", collectionPeriod: "2026-09-01 to 2026-09-28", fetchedAt: 1234 });
    expect(result.metrics).toEqual([
      { id: "largest_contentful_paint", label: "Largest Contentful Paint", value: 2800, unit: "ms", verdict: "needs_improvement" },
      { id: "interaction_to_next_paint", label: "Interaction to Next Paint", value: 190, unit: "ms", verdict: "good" },
      { id: "cumulative_layout_shift", label: "Cumulative Layout Shift", value: 0.08, unit: "score", verdict: "good" },
    ]);
  });

  it("reports missing CrUX rows as no data instead of treating them as zero", () => {
    expect(parseCruxPerformance({ record: { metrics: {} } }, 1)).toMatchObject({ status: "no_data", metrics: [], fetchedAt: 1 });
  });

  it("keeps Lighthouse mobile lab measurements and opportunity details separate from field metrics", () => {
    const result = parseLighthousePerformance({
      lighthouseResult: {
        finalUrl: "https://example.com/",
        categories: { performance: { score: 0.78 } },
        audits: {
          "largest-contentful-paint": { displayValue: "3.4 s" },
          "unused-javascript": { scoreDisplayMode: "numeric", score: 0.2, title: "Reduce unused JavaScript", displayValue: "Potential savings: 400 ms", description: "Remove code that this page does not need.", details: { overallSavingsMs: 400 } },
          "passed-audit": { scoreDisplayMode: "numeric", score: 1, title: "Passed", details: { overallSavingsMs: 0 } },
        },
      },
    }, "https://example.com/", 42);

    expect(result).toMatchObject({ status: "measured", strategy: "mobile", requestedUrl: "https://example.com/", finalUrl: "https://example.com/", fetchedAt: 42, score: 0.78 });
    expect(result.metrics).toEqual([{ id: "largest-contentful-paint", label: "Largest Contentful Paint", displayValue: "3.4 s" }]);
    expect(result.opportunities).toEqual([{ id: "unused-javascript", title: "Reduce unused JavaScript", displayValue: "Potential savings: 400 ms", description: "Remove code that this page does not need." }]);
  });

  it("does not invent a Lighthouse score from incomplete API responses", () => {
    expect(parseLighthousePerformance({}, "https://example.com")).toMatchObject({ status: "no_result", score: null, metrics: [], opportunities: [] });
  });
});
