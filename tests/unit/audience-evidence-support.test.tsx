import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { claimSupport, verifyAudienceEvidence } from "../../shared/agents/provenance";

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn(() => vi.fn()) }));
const { AudienceEvidence } = await import("../../src/components/app/plan/PlanSections");

const facts = ["Most clients book after a referral from a past customer."];
const pages = { "acme.example/about": "We help busy families plan meals. Clients say they hate wasting food every week.", "down.example": null };

describe("audience evidence excerpts", () => {
  it("finds excerpts in referenced facts or loaded pages, and is only 'not found' when every source was checked", () => {
    expect(claimSupport(["fact:0"], "book after a referral from a past customer", { facts, pages })).toBe("found_in_source");
    expect(claimSupport(["https://acme.example/about/"], "they hate wasting food every week", { facts, pages })).toBe("found_in_source");
    expect(claimSupport(["fact:0", "https://acme.example/about"], "they love wasting food", { facts, pages })).toBe("not_found");
    expect(claimSupport(["https://down.example", "https://unread.example"], "they hate wasting food every week", { facts, pages })).toBe("not_checked");
    expect(claimSupport(["fact:0"], undefined, { facts, pages })).toBe("no_excerpt");
    expect(claimSupport([], "they hate wasting food every week", { facts, pages })).toBe("no_excerpt");
  });

  it("marks every audience item and leaves other fields unchanged", () => {
    const [a] = verifyAudienceEvidence([{ name: "Busy families", needs: [{ statement: "Less food waste", basis: "research", evidenceRefs: ["https://acme.example/about"], evidenceExcerpt: "they hate wasting food every week" }], channelPreferences: [{ channel: "Referrals", rationale: "Book after referrals", basis: "owner_report", evidenceRefs: ["fact:0"] }] }], { facts, pages });
    expect(a.name).toBe("Busy families");
    expect(a.needs?.[0].evidenceSupport).toBe("found_in_source");
    expect(a.channelPreferences?.[0].evidenceSupport).toBe("no_excerpt");
  });

  it("shows each item's basis, excerpt and check, with the not-proof caveat", () => {
    const html = renderToStaticMarkup(createElement(AudienceEvidence, { audience: { needs: [{ statement: "Less food waste", basis: "research", evidenceRefs: ["x"], evidenceExcerpt: "they hate wasting food", evidenceSupport: "found_in_source" }], objections: [{ statement: "Too expensive", basis: "inference", evidenceRefs: [], evidenceSupport: "not_found" }] } }));
    expect(html).toContain("Evidence behind this audience (2)");
    expect(html).toContain("Less food waste</span> · research");
    expect(html).toContain("excerpt found in its source");
    expect(html).toContain("treat as unconfirmed");
    expect(html).toContain("not that they prove the claim");
    expect(renderToStaticMarkup(createElement(AudienceEvidence, { audience: {} }))).toBe("");
  });
});
