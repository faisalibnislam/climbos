import { describe, expect, it } from "vitest";
import { b64url, vapidHeaders } from "../../shared/push/vapid";

describe("VAPID", () => {
  it("signs an ES256 JWT for the push service origin that verifies with the public key", async () => {
    const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const jwk = JSON.stringify(await crypto.subtle.exportKey("jwk", k.privateKey));
    const pub = b64url(await crypto.subtle.exportKey("raw", k.publicKey));
    const h = await vapidHeaders("https://fcm.googleapis.com/fcm/send/abc", jwk, pub, "mailto:ops@example.com", 1_800_000_000);
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h.Authorization)!;
    expect(m[4]).toBe(pub);
    const claims = JSON.parse(atob(m[2].replace(/-/g, "+").replace(/_/g, "/")));
    expect(claims).toMatchObject({ aud: "https://fcm.googleapis.com", sub: "mailto:ops@example.com", exp: 1_800_000_000 + 12 * 3600 });
    const sig = Uint8Array.from(atob(m[3].replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (m[3].length % 4)) % 4)), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k.publicKey, sig, new TextEncoder().encode(`${m[1]}.${m[2]}`));
    expect(ok).toBe(true);
    expect(h["Content-Length"]).toBe("0");
  });
});
