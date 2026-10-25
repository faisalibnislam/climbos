import { describe, expect, it } from "vitest";
import { evaluateCapability, staleSyncMsFor, STALE_SYNC_MS, type CapabilityContext } from "../../shared/integrations/capabilities";

const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);
const HOUR = 3_600_000;
const GOOGLE_ENV = { GOOGLE_OAUTH_CLIENT_ID: "id", GOOGLE_OAUTH_CLIENT_SECRET: "secret" };
const ctx = (partial: Partial<CapabilityContext>): CapabilityContext => ({ env: GOOGLE_ENV, connected: true, now: NOW, ...partial });

describe("per-provider sync freshness", () => {
  it("gives lagging or weekly sources more room and never marks owner uploads stale", () => {
    expect(staleSyncMsFor("search_console")).toBe(96 * HOUR);
    expect(staleSyncMsFor("ga4")).toBe(72 * HOUR);
    expect(staleSyncMsFor("website")).toBe(8 * 24 * HOUR);
    expect(staleSyncMsFor("csv_revenue")).toBeNull();
    expect(staleSyncMsFor("google_ads")).toBe(STALE_SYNC_MS);
  });

  it("applies the provider's threshold to read capabilities", () => {
    const scopes = ["https://www.googleapis.com/auth/webmasters.readonly"];
    expect(evaluateCapability("search_console", "search_console.read_performance", ctx({ grantedScopes: scopes, lastSyncAt: NOW - 60 * HOUR })).state).not.toBe("sync_delayed");
    expect(evaluateCapability("search_console", "search_console.read_performance", ctx({ grantedScopes: scopes, lastSyncAt: NOW - 97 * HOUR })).state).toBe("sync_delayed");
    expect(evaluateCapability("csv_revenue", "csv_revenue.import", ctx({ env: {}, lastSyncAt: NOW - 400 * 24 * HOUR })).state).not.toBe("sync_delayed");
  });
});
