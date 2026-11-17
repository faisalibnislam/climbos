import { describe, expect, it, vi } from "vitest";
import { checkSenderDomain } from "../../shared/integrations/resendMarketing";
import { emailReadinessBrief, emailSenderDomain } from "../../shared/growth/emailReadiness";

const domain = { id: "domain-1", name: "news.example.com", status: "verified", capabilities: { sending: "enabled", receiving: "disabled" }, records: [{ record: "SPF", status: "verified" }, { record: "DKIM", status: "verified" }] };
const list = { data: [{ id: domain.id, name: domain.name }], has_more: false };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
async function inspect(details: unknown = domain, listing: unknown = list, status = 200) {
  const fetchImpl = vi.fn(async (url: string) => url.includes("/domains?") ? json(listing, status) : json(details));
  const report = await checkSenderDomain({ apiKey: "re_fixture", from: "Owner <hello@news.example.com>", fetchImpl });
  return { report, fetchImpl };
}

describe("sender setup is an exact, read-only provider observation", () => {
  it("reads the exact domain and reports only the available sending evidence", async () => {
    const { report, fetchImpl } = await inspect();
    expect(report).toMatchObject({ domain: domain.name, state: "verified", checkedAt: expect.any(Number), sourceUrl: "https://api.resend.com/domains/domain-1" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const [, options] of fetchImpl.mock.calls as unknown as [string, RequestInit][]) expect(options.method ?? "GET").toBe("GET");
    expect(emailReadinessBrief(report)).toContain("historical provider report");
    expect(emailReadinessBrief(report)).toContain("does not verify DMARC");
    expect(emailReadinessBrief(null)).toContain("Unknown");
  });
  it.each(["pending", "not_started", "failed", "temporary_failure"])("reports %s as setup needing attention", async status => {
    expect((await inspect({ ...domain, status })).report.state).toBe("setup_required");
  });
  it.each(["partially_verified", "partially_failed", "new_unknown_status"])("keeps %s ambiguous rather than claiming sending is verified or impossible", async status => {
    expect((await inspect({ ...domain, status })).report.state).toBe("unknown");
  });
  it.each([
    { ...domain, id: "wrong" }, { ...domain, name: "example.com" }, { ...domain, capabilities: undefined },
    { ...domain, records: [] }, { ...domain, records: [{ record: "SPF", status: "pending" }, { record: "DKIM", status: "verified" }] },
  ])("keeps inconsistent or incomplete detail evidence unknown", async details => {
    expect((await inspect(details)).report.state).toBe("unknown");
  });
  it("does not accept a receiving-only domain or substitute its parent", async () => {
    expect((await inspect({ ...domain, capabilities: { sending: "disabled", receiving: "enabled" } })).report.state).toBe("setup_required");
    const missing = await inspect(domain, { data: [{ id: "parent", name: "example.com" }], has_more: false });
    expect(missing.report.state).toBe("setup_required");
    expect(missing.fetchImpl).toHaveBeenCalledTimes(1);
  });
  it.each([{}, { data: [], has_more: true }, { data: [{ name: domain.name }], has_more: false }, { data: [list.data[0], list.data[0]], has_more: false }])("does not invent absence or readiness from an invalid list", async listing => {
    expect((await inspect(domain, listing)).report.state).toBe("unknown");
  });
  it.each([403, 429, 500])("keeps HTTP %s unknown with a manual path", async status => {
    const { report } = await inspect(domain, {}, status);
    expect(report.state).toBe("unknown");
    expect(report.message).toContain("Resend account");
  });
  it("follows cursor pages and keeps an over-limit list unknown", async () => {
    let page = 0;
    const fetchImpl = vi.fn(async (url: string) => url.includes("/domains?") ? json(++page === 1 ? { data: [{ id: "other", name: "other.example.com" }], has_more: true } : list) : json(domain));
    expect((await checkSenderDomain({ apiKey: "re_fixture", from: "hello@news.example.com", fetchImpl })).state).toBe("verified");
    expect(fetchImpl.mock.calls[1][0]).toContain("after=other");
    page = 0;
    const capped = vi.fn(async () => json({ data: [{ id: `d-${++page}`, name: "other.example.com" }], has_more: true }));
    expect((await checkSenderDomain({ apiKey: "re_fixture", from: "hello@news.example.com", fetchImpl: capped })).state).toBe("unknown");
    expect(capped).toHaveBeenCalledTimes(5);
  });
  it.each(["hello@example.com,second@example.com", "Name <hello@example.com> extra", "hello@example.com\r\nBcc: a@example.com", "hello@-example.com"])("rejects an ambiguous sender before requests: %s", async from => {
    const fetchImpl = vi.fn();
    expect(emailSenderDomain(from)).toBeNull();
    expect((await checkSenderDomain({ apiKey: "re_fixture", from, fetchImpl })).state).toBe("unknown");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
