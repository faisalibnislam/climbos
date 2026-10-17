import { afterEach, describe, expect, it } from "vitest";
import { r2Configured, r2Key, r2SignedUrl } from "../../convex/lib/r2";

describe("R2 object storage", () => {
  afterEach(() => {
    for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) delete process.env[k];
  });

  it("is off unless every variable is set", () => {
    expect(r2Configured()).toBe(false);
    process.env.R2_ACCOUNT_ID = "acct";
    expect(r2Configured()).toBe(false);
  });

  it("uses tenant-prefixed random keys and short-lived presigned GET URLs", async () => {
    Object.assign(process.env, { R2_ACCOUNT_ID: "acct123", R2_ACCESS_KEY_ID: "AKIDEXAMPLE", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "climbos-assets" });
    expect(r2Configured()).toBe(true);
    const key = r2Key("org_abc", "images", "png");
    expect(key).toMatch(/^orgs\/org_abc\/images\/[0-9a-f]{32}\.png$/);
    expect(r2Key("org_abc", "images", "png")).not.toBe(key);
    const url = new URL(await r2SignedUrl(key, 600));
    expect(url.host).toBe("acct123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe(`/climbos-assets/${key}`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("X-Amz-Credential")).toContain("AKIDEXAMPLE");
    // Expiry is clamped to at most 7 days.
    expect(new URL(await r2SignedUrl(key, 10 * 86_400)).searchParams.get("X-Amz-Expires")).toBe(String(7 * 86_400));
  });
});
