import { describe, expect, it } from "vitest";
import { PlatformPreparationSchema } from "../../shared/acquisition/platformPreparation";
import { untracedNumbers } from "../../shared/agents/lint";
import { captureResourceAllowed, localDraftCaptureUrl } from "../../shared/site/capturePolicy";
const path = `/render/landing-draft/${"a".repeat(48)}`;
describe("private draft capture scope", () => {
  it("binds local capture to an exact loopback origin and one-time token path", () => {
    const url = localDraftCaptureUrl(`http://127.0.0.1:3420${path}`, "http://127.0.0.1:3420")!;
    expect(url).not.toBeNull();
    for (const raw of [`http://localhost:3420${path}`, `http://127.0.0.1:3420${path}?x=1`, "http://127.0.0.1:3420/api/private", `http://user:pass@127.0.0.1:3420${path}`]) expect(localDraftCaptureUrl(raw, url.origin)).toBeNull();
    expect(localDraftCaptureUrl(`http://localhost.attacker.test${path}`, "http://localhost.attacker.test")).toBeNull();
    expect(captureResourceAllowed(url.toString(), url)).toBe(true);
    expect(captureResourceAllowed(`${url.origin}/_next/static/chunk.js`, url)).toBe(true);
    for (const raw of ["http://169.254.169.254/latest/meta-data/", `${url.origin}/api/private.png`, `${url.origin}/_next/server/private`, `${url.origin}${path}?x=1`, `http://127.0.0.1:3320${path}`]) expect(captureResourceAllowed(raw, url)).toBe(false);
    expect(captureResourceAllowed(url.toString(), null)).toBe(false);
  });
});

it("rejects empty and malformed platform URLs without throwing during form validation", () => {
  const field = PlatformPreparationSchema.shape.destination;
  for (const value of ["", "not a URL", "http://example.com/", "https://user:pass@example.com/"]) expect(field.safeParse(value).success).toBe(false);
});
it("does not mistake precedent reference IDs for business quantities", () => {
  expect(untracedNumbers("Analogy CP-050; compare CP-099.", "")).toEqual([]);
  expect(untracedNumbers("CP-050 produced 50% growth", "")).toContain("50%");
});
