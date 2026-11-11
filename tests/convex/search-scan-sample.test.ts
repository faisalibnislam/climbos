import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
vi.mock("node:dns/promises", async (original) => ({ ...(await original<typeof import("node:dns/promises")>()), lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) }));
afterEach(() => vi.unstubAllGlobals());
async function queued() {
  const t = setup();
  const owner = await asNewUser(t, "scan-sample@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Sample Co", website: "https://sample.example/" });
  const business = (await t.run(async (ctx) => ctx.db.query("businesses").filter((q) => q.eq(q.field("orgId"), orgId)).first()))!;
  await t.run(async (ctx) => ctx.db.patch(business._id, { siteReadiness: { status: "queued", startedAt: 123 } }));
  return { t, owner, slug, business: { ...business, siteReadiness: { startedAt: 123 } } };
}
describe("bounded multi-page readiness", () => {
  it("checks robots before reading and stores the sample without fetching blocked or offsite links", async () => {
    const { t, owner, slug, business } = await queued();
    const seen: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: unknown) => {
      const url = String(input); seen.push(url);
      if (url.endsWith("/robots.txt")) return new Response("User-agent: ClimbOSBot\nDisallow: /services", { headers: { "content-type": "text/plain" } });
      if (url === "https://sample.example/") return new Response('<html lang="en"><title>Sample Co</title><h1>Useful service</h1><a href="/pricing">Pricing</a><a href="/services">Service</a><a href="/about">About</a><a href="https://youtube.com/@sample">Videos</a></html>', { headers: { "content-type": "text/html" } });
      if (url === "https://sample.example/pricing") return new Response('<html><title>Pricing</title><h1>Pricing</h1><p>Ask for a quote.</p></html>', { headers: { "content-type": "text/html" } });
      throw new Error(`Unexpected fetch ${url}`);
    }));
    await t.action(internal.siteWatchActions.scanReadiness, { businessId: business._id, website: business.website!, startedAt: business.siteReadiness!.startedAt! });
    const result = await owner.client.query(api.siteWatch.searchReadiness, { slug });
    expect(seen).toEqual(["https://sample.example/robots.txt", "https://sample.example/", "https://sample.example/pricing"]);
    expect(result?.scan).toMatchObject({ status: "complete", pageSamples: [{ status: "read", observedLinks: expect.arrayContaining(["https://youtube.com/@sample"]) }, { status: "read" }, { status: "blocked_by_robots" }] });
    expect(result?.scan?.pageSamples).toHaveLength(3);
  });
  it("does not read pages when crawler access is unknown", async () => {
    const { t, owner, slug, business } = await queued();
    const network = vi.fn(async () => new Response("Unavailable", { status: 503 }));
    vi.stubGlobal("fetch", network);
    await t.action(internal.siteWatchActions.scanReadiness, { businessId: business._id, website: business.website!, startedAt: business.siteReadiness!.startedAt! });
    expect(network).toHaveBeenCalledTimes(1);
    expect((await owner.client.query(api.siteWatch.searchReadiness, { slug }))?.scan).toMatchObject({ status: "failed", robotsFileStatus: "unavailable", pageSamples: [{ status: "failed" }] });
  });
});
