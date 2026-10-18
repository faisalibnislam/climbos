import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, makePaid, setup } from "./helpers";

describe("white-label client reports", () => {
  it("shares outcomes only, in the agency's brand; links can be turned off", async () => {
    const t = setup();
    const owner = await asNewUser(t, "agency@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Client Bakery" });
    await owner.client.mutation(api.clientReports.setBranding, { slug, brandName: "Growth Agency", brandColor: "#123456", brandLogoUrl: "https://agency.example/logo.png" });
    await expect(owner.client.mutation(api.clientReports.setBranding, { slug, brandName: "X", brandColor: "#123456", brandLogoUrl: "javascript:alert(1)" })).rejects.toThrow(/https/);
    const url = await owner.client.mutation(api.clientReports.createLink, { slug });
    const token = url.split("/report/")[1];
    let r = await t.query(api.clientReports.shared, { token });
    expect(r).toMatchObject({ client: "Client Bakery", agency: "Growth Agency", color: "#123456", poweredBy: true });
    expect(r!.lines.some((l) => l.key === "creditsUsed")).toBe(false);
    await makePaid(t, orgId);
    r = await t.query(api.clientReports.shared, { token, days: 7 });
    expect(r?.poweredBy).toBe(false);
    const b = await owner.client.query(api.clientReports.branding, { slug });
    await owner.client.mutation(api.clientReports.revoke, { slug, id: b.links[0].id });
    expect(await t.query(api.clientReports.shared, { token })).toBeNull();
    expect(await t.query(api.clientReports.shared, { token: "nope" })).toBeNull();
  });
});
