/**
 * VAPID (RFC 8292) for contentless Web Push: an ES256-signed JWT for the push
 * service's origin. Uses Web Crypto only.
 */

const enc = new TextEncoder();

export function b64url(bytes: Uint8Array | ArrayBuffer): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** privateJwk: the P-256 private key as JWK JSON; publicKey: the raw public key, base64url. */
export async function vapidHeaders(endpoint: string, privateJwk: string, publicKey: string, subject: string, nowSec = Math.floor(Date.now() / 1000)): Promise<Record<string, string>> {
  const key = await crypto.subtle.importKey("jwk", JSON.parse(privateJwk) as JsonWebKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSec + 12 * 3600, sub: subject })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`));
  return { Authorization: `vapid t=${header}.${claims}.${b64url(sig)}, k=${publicKey}`, TTL: "86400", Urgency: "high", "Content-Length": "0" };
}
