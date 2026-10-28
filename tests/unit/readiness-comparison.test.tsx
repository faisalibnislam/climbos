import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { compareReadiness } from "../../shared/seo/readinessCompare";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
const { ReadinessComparisonTable } = await import("../../src/components/app/competitors/ReadinessComparison");

describe("search readiness comparison", () => {
  it("compares page-level checks only, ignoring crawler and robots findings, and lists where you're behind", () => {
    const result = compareReadiness(
      { name: "You", checkedAt: 1, findingIds: ["missing-description", "robots-unavailable", "no-structured-data"] },
      [{ name: "Rival", checkedAt: 2, findingIds: ["no-structured-data"] }, { name: "New rival", checkedAt: null, findingIds: null }],
    );
    const row = (id: string) => result.checks.find((c) => c.id === id)!;
    expect(row("missing-description")).toMatchObject({ you: "attention", competitors: [{ name: "Rival", status: "ok" }, { name: "New rival", status: "unknown" }] });
    expect(row("no-structured-data")).toMatchObject({ you: "attention", competitors: [{ status: "attention" }, { status: "unknown" }] });
    expect(result.checks.some((c) => c.id === "robots-unavailable")).toBe(false);
    expect(result.youBehind).toEqual(["Search description"]);
  });

  it("marks your column unknown without a completed own check", () => {
    const result = compareReadiness({ name: "You", checkedAt: null, findingIds: null }, [{ name: "Rival", checkedAt: 2, findingIds: [] }]);
    expect(result.checks.every((c) => c.you === "unknown")).toBe(true);
    expect(result.youBehind).toEqual([]);
    const html = renderToStaticMarkup(createElement(ReadinessComparisonTable, { data: { ...result, ownCheckedAt: null } }));
    expect(html).toContain("Your site hasn&#x27;t been checked yet");
    expect(html).toContain("not rankings, traffic or AI citations");
  });
});
