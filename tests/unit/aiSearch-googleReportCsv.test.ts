import { describe, expect, it } from "vitest";
import { parseGoogleAiReportCsv } from "../../shared/aiSearch/googleReportCsv";

describe("Google generative-AI report CSV", () => {
  it("parses and merges page rows while retaining platform impressions", () => {
    expect(parseGoogleAiReportCsv('Top pages,Impressions\nhttps://example.com/a,12\nhttps://example.com/a,3\nhttps://example.com/b,~')).toEqual({
      ok: true,
      dimension: "page",
      rows: [
        { dimensionValue: "https://example.com/a", impressions: 15 },
        { dimensionValue: "https://example.com/b", impressions: 0 },
      ],
    });
  });

  it("accepts a date table and quoted CSV fields", () => {
    expect(parseGoogleAiReportCsv('Date,Impressions\n2026-10-01,"1,200"')).toMatchObject({
      ok: true,
      dimension: "date",
      rows: [{ dimensionValue: "2026-10-01", impressions: 1200 }],
    });
  });

  it("rejects ambiguous dimensions, malformed values, and non-public URLs", () => {
    expect(parseGoogleAiReportCsv("Page,Date,Impressions\nhttps://example.com,2026-10-01,1")).toMatchObject({ ok: false });
    expect(parseGoogleAiReportCsv("Device,Impressions\nMobile,-1")).toMatchObject({ ok: false });
    expect(parseGoogleAiReportCsv("Pages,Impressions\njavascript:alert(1),1")).toMatchObject({ ok: false });
  });
});
