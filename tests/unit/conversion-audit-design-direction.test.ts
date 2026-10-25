import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("convex/react", () => ({
  useQuery: hooks.useQuery,
  useMutation: hooks.useMutation,
}));

import { ConversionAuditView } from "../../src/components/app/ConversionAuditView";

describe("Conversion audit design direction choices", () => {
  beforeEach(() => {
    hooks.useQuery.mockImplementation((_query, args) => args?.runId
      ? { canEdit: true, rows: [{ findingIndex: 0, status: undefined, note: "", selectedDirectionId: "hero-proof", selectedDirectionName: "Show proof earlier", selectedDirectionAt: 100, updatedAt: 100 }] }
      : null);
  });

  it("shows the saved owner choice separately from the audit finding and preserves the editable brief route", () => {
    const html = renderToStaticMarkup(createElement(ConversionAuditView, {
      slug: "design-co",
      runId: "audit_run" as never,
      value: { designCritic: { coverage: "visual_sampled", findings: [{ region: "Hero", lens: "communication_hierarchy", classification: "heuristic", observation: "The offer is hard to scan.", directions: [{ id: "hero-proof", name: "Show proof earlier", responseLevel: "quick_fix", communicates: "Make evidence visible sooner.", tradeoff: "Takes space from the headline.", change: "Move one confirmed customer proof point above the fold.", previewBrief: "Place the confirmed proof point above the first call to action.", measurementPlan: "Record the current qualified inquiry baseline before any live change.", effort: "small" }] }] } },
    }));

    expect(html).toContain("Owner chose this direction");
    expect(html).toContain("Saved against this audit finding. It does not change or publish the audited website.");
    expect(html).toContain("Prepare editable brief");
    expect(html).toContain("Selected");
  });

  it("requires saving the exact direction before opening its editable brief", () => {
    hooks.useQuery.mockImplementation((_query, args) => args?.runId
      ? { canEdit: true, rows: [] }
      : null);

    const html = renderToStaticMarkup(createElement(ConversionAuditView, {
      slug: "design-co",
      runId: "audit_run" as never,
      value: { designCritic: { coverage: "visual_sampled", findings: [{ region: "Hero", directions: [{ id: "hero-proof", name: "Show proof earlier", change: "Move confirmed proof above the call to action.", previewBrief: "Move proof." }] }] } },
    }));

    expect(html).toContain("Choose this direction");
    expect(html).toContain("Prepare editable brief</button>");
    expect(html).toContain("Choose and save this direction first.");
    expect(html).not.toContain("pages?brief=");
  });
});
