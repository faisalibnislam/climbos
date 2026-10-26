import { describe, expect, it } from "vitest";
import { businessProfileOptions, choicePendingLabel, facebookPageOptions, ga4PropertyOptions, linkedInOptions, soleChoice } from "../../shared/integrations/accountChoice";
import { listAllLocations } from "../../shared/integrations/googleBusinessProfile";
import { isLinkedInAuthorUrn, listAdministeredOrganizations, validateLinkedInPost } from "../../shared/integrations/linkedin";
import { parsePlatformApprovals, reviewStateFor } from "../../shared/integrations/platformApprovals";
import { evaluateCapabilities } from "../../shared/integrations/capabilities";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("account choosers", () => {
  it("auto-picks only a single usable option", () => {
    const pages = facebookPageOptions([
      { id: "1", name: "Only Page", pageAccessToken: "t", tasks: ["CREATE_CONTENT"], canPublish: true },
    ]);
    expect(soleChoice(pages)?.id).toBe("1");
    const analystOnly = facebookPageOptions([{ id: "2", name: "Analyst", pageAccessToken: "t", tasks: ["ANALYZE"], canPublish: false }]);
    expect(soleChoice(analystOnly)).toBeUndefined();
    expect(analystOnly[0]!.warning).toMatch(/doesn't allow creating posts/);
    expect(soleChoice([...pages, ...pages])).toBeUndefined();
    expect(choicePendingLabel(0, "Facebook Page", "Facebook Pages")).toBe("No Facebook Pages found for this sign-in");
    expect(choicePendingLabel(3, "Facebook Page", "Facebook Pages")).toBe("3 Facebook Pages available · choose one");
  });

  it("maps LinkedIn profile and Pages, GA4 properties and Business Profile locations", () => {
    const li = linkedInOptions({ id: "abc", personUrn: "urn:li:person:abc", name: "Sam" }, [{ id: "9", urn: "urn:li:organization:9", name: "Formkit", vanityName: "formkit" }]);
    expect(li.map((o) => o.accountType)).toEqual(["linkedin_member", "linkedin_organization"]);
    expect(li[1]!.detail).toContain("linkedin.com/company/formkit");
    expect(linkedInOptions(null, []).length).toBe(0);
    expect(ga4PropertyOptions([{ property: "properties/7", displayName: "Site", account: "accounts/1", accountDisplayName: "Formkit" }])[0]).toMatchObject({ id: "properties/7", label: "Site", detail: "Formkit · Property 7" });
    expect(businessProfileOptions([{ name: "locations/5", title: "Formkit Bakery", account: "accounts/1", address: "1 High St, London" }])[0]).toMatchObject({ id: "locations/5", detail: "1 High St, London" });
  });

  it("LinkedIn accepts organization authors and lists administered Pages one lookup at a time", async () => {
    expect(isLinkedInAuthorUrn("urn:li:organization:123")).toBe(true);
    expect(isLinkedInAuthorUrn("urn:li:organization:abc")).toBe(false);
    expect(validateLinkedInPost({ authorUrn: "urn:li:organization:123", text: "Hello" })).toEqual([]);
    const seen: string[] = [];
    const fetchImpl = async (url: string) => {
      seen.push(url);
      if (url.includes("organizationAcls")) return json({ elements: [{ organization: "urn:li:organization:1" }, { organizationTarget: "urn:li:organization:2" }, { organization: "urn:li:organization:1" }], paging: { total: 3 } });
      if (url.endsWith("/organizations/1")) return json({ localizedName: "One" });
      return json({ message: "denied" }, 403);
    };
    const res = await listAdministeredOrganizations({ accessToken: "t", fetchImpl });
    expect(res.ok && res.data.items.map((o) => o.name)).toEqual(["One", "LinkedIn Page 2"]);
    // No BATCH_GET (banned in the Development tier).
    expect(seen.some((u) => u.includes("ids=List"))).toBe(false);
  });

  it("Business Profile reads accounts then locations with a readMask", async () => {
    const seen: string[] = [];
    const fetchImpl = async (url: string) => {
      seen.push(url);
      if (url.includes("/v1/accounts?")) return json({ accounts: [{ name: "accounts/1", accountName: "Formkit" }] });
      return json({ locations: [{ name: "locations/9", title: "Formkit Bakery", storefrontAddress: { addressLines: ["1 High St"], locality: "London" } }] });
    };
    const res = await listAllLocations({ accessToken: "t", fetchImpl });
    expect(res.ok && res.data.items).toEqual([{ name: "locations/9", title: "Formkit Bakery", account: "accounts/1", address: "1 High St, London" }]);
    expect(seen[1]).toContain("readMask=name%2Ctitle%2CstorefrontAddress");
  });
});

describe("platform approvals", () => {
  it("drops unknown keys and values", () => {
    expect(parsePlatformApprovals({ meta_app_review: "approved", bogus: "approved", x_posting_access: "maybe" })).toEqual({ meta_app_review: "approved" });
  });

  it("the least advanced approval wins for a shared scope", () => {
    const { appReview, approvalLabels } = reviewStateFor("google_business_profile", { google_oauth_verification: "approved", google_business_profile_api: "pending" });
    expect(appReview["https://www.googleapis.com/auth/business.manage"]).toBe("pending");
    expect(approvalLabels["https://www.googleapis.com/auth/business.manage"]).toBe("Google Business Profile API access");
  });

  it("a connected Page without Meta App Review says so", () => {
    const review = reviewStateFor("facebook_pages", {});
    const caps = evaluateCapabilities("facebook_pages", {
      env: { META_APP_ID: "set", META_APP_SECRET: "set" },
      connected: true,
      grantedScopes: ["pages_show_list", "business_management", "pages_manage_posts", "pages_read_engagement", "read_insights"],
      ...review,
    });
    const publish = caps.find((c) => c.capability === "facebook_pages.publish_post")!;
    expect(publish.state).toBe("approval_needed");
    expect(publish.reason).toBe("Publish Page posts needs Meta App Review, which ClimbOS doesn't have yet.");
  });
});
