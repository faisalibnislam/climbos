import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { findingFingerprint, latestDecisions, priorDecisionsBrief, type PriorDecision } from "../../shared/agents/designDecisions";

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn(() => vi.fn()) }));
const { PriorDecisionNote } = await import("../../src/components/app/ConversionAuditView");

const d = (o: Partial<PriorDecision>): PriorDecision => ({ lens: "conversion_trust", sourceUrl: "https://www.acme.example/pricing/", region: "Hero headline area", status: "dismissed", decidedAt: 100, runId: "r1", runCreatedAt: 50, ...o });

describe("design finding decisions across audits", () => {
  it("identifies a finding by lens, page path and region, ignoring host prefix, trailing slash and wording", () => {
    expect(findingFingerprint({ lens: "conversion_trust", sourceUrl: "https://www.acme.example/pricing/", region: "Hero headline area!" })).toBe("conversion_trust|acme.example/pricing|hero headline area");
    expect(findingFingerprint({ lens: "conversion_trust", sourceUrl: "https://acme.example/pricing", region: "hero  headline area" })).toBe("conversion_trust|acme.example/pricing|hero headline area");
    expect(findingFingerprint({ lens: "visual_craft", sourceUrl: "https://acme.example/pricing", region: "Hero headline area" })).not.toBe(findingFingerprint({ lens: "conversion_trust", sourceUrl: "https://acme.example/pricing", region: "Hero headline area" }));
    expect(findingFingerprint({ lens: "conversion_trust", sourceUrl: "not a url", region: "Hero" })).toBeNull();
  });

  it("keeps the newest decision per finding and tells the next audit not to re-raise dismissed ones blindly", () => {
    const latest = latestDecisions([d({ status: "accepted", decidedAt: 10 }), d({ status: "dismissed", decidedAt: 20, note: "We use this headline on purpose." }), d({ region: "Footer links", status: "reopened", decidedAt: 30 })]);
    expect(latest.size).toBe(2);
    expect([...latest.values()].find((x) => x.region === "Hero headline area")?.status).toBe("dismissed");
    const brief = priorDecisionsBrief(latest);
    expect(brief.summary).toContain("[dismissed] conversion_trust");
    expect(brief.summary).toContain("don't raise it again unless the page evidence has changed");
    expect(brief.summary).not.toContain("Footer links"); // reopened has no carry-over rule
    expect(brief.notes).toEqual(["conversion_trust · Hero headline area: We use this headline on purpose."]);
    expect(priorDecisionsBrief(new Map()).summary).toBe("");
  });

  it("shows the earlier decision on a matching finding with a same-issue caveat", () => {
    const html = renderToStaticMarkup(createElement(PriorDecisionNote, { prior: { status: "dismissed", decidedAt: Date.UTC(2026, 9, 1), note: "We use this headline on purpose." } }));
    expect(html).toContain("In an earlier audit you dismissed a finding in the same place");
    expect(html).toContain("We use this headline on purpose.");
    expect(html).toContain("check it&#x27;s the same issue");
  });
});
