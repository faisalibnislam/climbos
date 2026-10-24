import { describe, expect, it } from "vitest";
import { applyOwnerEconomics, churnOf, type Economics } from "../../shared/agents/economics";
import { economicsSources, textHash, urlKey, verifyTags } from "../../shared/agents/provenance";
import { SourceTagSchema } from "../../shared/agents/specs";

/** S2 (REQ-PROV): exact numbers, page access and receipts, model can't self-verify, owner lineage. */
const URL = "https://formkit.app/pricing";
const PAGE = "Pricing. Pro costs $30 per month. Business costs $29 per month.";
const econ = (revenue: number, quote: string): Economics => ({
  revenuePerCustomerMonthUsd: revenue,
  grossMargin: 0.8,
  monthlyChurn: 0.05,
  basis: "",
  sources: { revenue: { source: "research", ref: URL, quote, population: "Pro", period: "month" } },
});
const revenueTag = (e: Economics, pages: Record<string, string | null>, searched?: string[]) =>
  verifyTags({ economics: e, plays: [] }, { pages, searched, fetchedAt: 1_700_000_000_000 }).economics.sources!.revenue!;

describe("S2 provenance", () => {
  it("numbers must match exactly: $29.99 isn't verified by '$30 per month'", () => {
    expect(revenueTag(econ(30, "Pro costs $30 per month."), { [urlKey(URL)]: PAGE }).check).toBe("source_verified");
    expect(revenueTag(econ(29.99, "Pro costs $30 per month."), { [urlKey(URL)]: PAGE }).check).toBe("retrieved");
  });

  it("records page access, and a receipt only for pages ClimbOS read", () => {
    const read = revenueTag(econ(30, "Pro costs $30 per month."), { [urlKey(URL)]: PAGE });
    expect(read.access).toBe("read");
    expect(read.receipt).toEqual({ fetchedAt: 1_700_000_000_000, contentHash: textHash(PAGE) });
    const down = revenueTag(econ(30, "Pro costs $30 per month."), { [urlKey(URL)]: null });
    expect(down).toMatchObject({ access: "unavailable", check: "reported" });
    expect(down.receipt).toBeUndefined();
    expect(revenueTag(econ(30, "Pro costs $30 per month."), {}, [urlKey(URL)]).access).toBe("search_only");
    expect(revenueTag(econ(30, "Pro costs $30 per month."), {}, []).access).toBe("not_in_search");
  });

  it("access survives a read back, only with ClimbOS's stamp", () => {
    const e = econ(30, "Pro costs $30 per month.");
    const checked = verifyTags({ economics: e, plays: [] }, { pages: {}, searched: [urlKey(URL)] }).economics;
    expect(economicsSources(checked).revenue).toMatchObject({ check: "reported", access: "search_only" });
    const forged = { ...e, sources: { revenue: { source: "research" as const, ref: URL, access: "read" as const } } };
    expect(economicsSources(forged).revenue.access).toBeUndefined();
  });

  it("the model can't write its own check, stamp, access or receipt", () => {
    const parsed = SourceTagSchema.parse({ source: "research", ref: URL, quote: "q", population: "Pro", period: "month", check: "source_verified", checkedBy: "climbos-provenance-1", access: "read", receipt: { fetchedAt: 1, contentHash: "x" } });
    expect(parsed).toEqual({ source: "research", ref: URL, quote: "q", population: "Pro", period: "month" });
  });

  it("owner-confirmed zero churn is kept, with the value it replaced", () => {
    const e = applyOwnerEconomics({ ...econ(30, ""), sources: { churn: { source: "assumption", ref: "" } } }, { monthlyChurn: 0, updatedAt: 5 });
    expect(e.monthlyChurn).toBe(0);
    expect(churnOf(e)).toBe(0);
    expect(e.sources!.churn).toMatchObject({ source: "owner", check: "owner_input", replaced: { value: 0.05, source: "assumption" } });
    expect(economicsSources(e).churn.replaced).toEqual({ value: 0.05, source: "assumption" });
  });

  it("an owner value equal to the draft records no replacement", () => {
    const e = applyOwnerEconomics(econ(30, ""), { revenuePerCustomerMonthUsd: 30 });
    expect(e.sources!.revenue!.replaced).toBeUndefined();
  });
});
