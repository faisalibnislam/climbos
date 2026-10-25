import { describe, expect, it, vi } from "vitest";
import { checkPublicLinks } from "../../shared/integrations/website";

const resolveHost = vi.fn(async () => ["93.184.216.34"]);

describe("pre-publish public link checks", () => {
  it("confirms successful HTTPS destinations without retaining page content", async () => {
    const fetchImpl = vi.fn(async () => new Response("x".repeat(10_000), { status: 200, headers: { "content-type": "text/html" } }));
    const result = await checkPublicLinks(["https://example.com/pricing"], { resolveHost, fetchImpl });
    expect(result).toMatchObject([{ status: "reachable", httpStatus: 200, finalUrl: "https://example.com/pricing" }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns bounded status evidence for a broken destination", async () => {
    const result = await checkPublicLinks(["https://example.com/missing"], {
      resolveHost,
      fetchImpl: async () => new Response("Not found", { status: 404 }),
    });
    expect(result).toEqual([{ url: "https://example.com/missing", status: "unavailable", httpStatus: 404 }]);
  });

  it("never fetches unsafe URLs and refuses batches over five unique links", async () => {
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
    const unsafe = await checkPublicLinks(["https://127.0.0.1/admin"], { resolveHost, fetchImpl });
    expect(unsafe).toMatchObject([{ status: "unavailable" }]);
    expect(fetchImpl).not.toHaveBeenCalled();

    const tooMany = await checkPublicLinks(Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`), { resolveHost, fetchImpl });
    expect(tooMany).toHaveLength(6);
    expect(tooMany.every((link) => link.status === "unavailable")).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
