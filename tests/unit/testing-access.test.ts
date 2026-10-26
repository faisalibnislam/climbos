import { describe, expect, it } from "vitest";
import { evaluateCapabilities } from "../../shared/integrations/capabilities";
import { reviewStateFor } from "../../shared/integrations/platformApprovals";

const FACEBOOK = {
  env: { META_APP_ID: "set", META_APP_SECRET: "set" },
  connected: true,
  grantedScopes: ["pages_show_list", "business_management", "pages_manage_posts", "pages_read_engagement", "read_insights"],
};
const GA4 = {
  env: { GOOGLE_OAUTH_CLIENT_ID: "set", GOOGLE_OAUTH_CLIENT_SECRET: "set" },
  connected: true,
  grantedScopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  canRefreshToken: true,
};

describe("testing access while platform approvals are unfinished", () => {
  it("lets ClimbOS testers use Meta features before App Review, labelled as testing", () => {
    const caps = evaluateCapabilities("facebook_pages", { ...FACEBOOK, ...reviewStateFor("facebook_pages", {}), testingAccess: true });
    const publish = caps.find((c) => c.capability === "facebook_pages.publish_post")!;
    expect(publish.state).toBe("testing_access");
    expect(publish.reason).toContain("testing mode");
    expect(publish.reason).toContain("Meta App Review");
    expect(publish.reason).toContain('Businesses still see "Needs approval"');
  });

  it("keeps businesses gated", () => {
    const caps = evaluateCapabilities("facebook_pages", { ...FACEBOOK, ...reviewStateFor("facebook_pages", { meta_app_review: "pending" }) });
    expect(caps.every((c) => c.state !== "testing_access")).toBe(true);
    expect(caps.find((c) => c.capability === "facebook_pages.publish_post")!.state).toBe("provider_review_pending");
  });

  it("covers Google reports before OAuth verification", () => {
    const caps = evaluateCapabilities("ga4", { ...GA4, ...reviewStateFor("ga4", {}), testingAccess: true });
    expect(caps.find((c) => c.capability === "ga4.read_reports")!.state).toBe("testing_access");
  });

  it("is plain ready once the approval is granted", () => {
    const caps = evaluateCapabilities("ga4", { ...GA4, ...reviewStateFor("ga4", { google_oauth_verification: "approved" }), testingAccess: true });
    expect(caps.find((c) => c.capability === "ga4.read_reports")!.state).toBe("ready");
  });

  it("doesn't hide the tester's own account problems", () => {
    const caps = evaluateCapabilities("facebook_pages", { ...FACEBOOK, connected: false, ...reviewStateFor("facebook_pages", {}), testingAccess: true });
    expect(caps.every((c) => c.state === "setup_needed")).toBe(true);
  });
});
