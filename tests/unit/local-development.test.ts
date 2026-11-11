import { describe, expect, it } from "vitest";
import { localDevLoginEnabled, localWorkspaceTestingEnabled } from "../../shared/policy/localDevelopment";

describe("local-only password sign-in", () => {
  it.each(["http://localhost:3000", "http://127.0.0.1:3410", "http://[::1]:3000"])("accepts an explicitly opted-in loopback origin %s", (url) => {
    expect(localDevLoginEnabled("true", url)).toBe(true);
    expect(localDevLoginEnabled(undefined, url)).toBe(false);
  });
  it.each(["http://localhost.attacker.example", "http://localhost@attacker.example", "https://climbos.app", "http://localhost:3000/path", "http://localhost:3000?redirect=x", "not a URL"])("refuses %s", (url) => {
    expect(localDevLoginEnabled("true", url)).toBe(false);
  });
});

describe("local workspace count exemption", () => {
  const env = { CLIMBOS_LOCAL_REAL_RESEARCH: "true", SITE_URL: "http://127.0.0.1:3430" };
  it("requires both the operator's account opt-in and the dedicated real-data local environment", () => {
    expect(localWorkspaceTestingEnabled(true, env)).toBe(true);
    expect(localWorkspaceTestingEnabled(false, env)).toBe(false);
    expect(localWorkspaceTestingEnabled(undefined, env)).toBe(false);
    expect(localWorkspaceTestingEnabled(true, { ...env, CLIMBOS_LOCAL_REAL_RESEARCH: undefined })).toBe(false);
    expect(localWorkspaceTestingEnabled(true, { ...env, CLIMBOS_FAKE_LLM: "true" })).toBe(false);
  });
  it.each(["https://climbos.app", "http://127.0.0.1:3430.attacker.example", "http://localhost:3430", "http://127.0.0.1:3430/path"])("never enables the exemption on %s", site => {
    expect(localWorkspaceTestingEnabled(true, { ...env, SITE_URL: site })).toBe(false);
  });
});
