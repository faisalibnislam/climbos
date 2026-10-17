/**
 * AES-256-GCM encryption for connector secrets. Keys come from the Convex
 * environment (CLIMBOS_ENCRYPTION_KEY, base64 32 bytes) with a key id for
 * rotation; CLIMBOS_ENCRYPTION_KEY_PREVIOUS keeps old ciphertext readable
 * until it is re-encrypted. Plaintext secrets are never stored or logged.
 */

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

async function importKey(b64: string): Promise<CryptoKey> {
  const raw = b64ToBytes(b64);
  if (raw.length !== 32) throw new Error("Encryption key must be 32 bytes (base64).");
  return crypto.subtle.importKey("raw", raw as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export function encryptionConfigured(): boolean {
  return Boolean(process.env.CLIMBOS_ENCRYPTION_KEY);
}

export async function encryptSecret(plaintext: string, aad: string): Promise<{ keyId: string; iv: string; ciphertext: string }> {
  const keyB64 = process.env.CLIMBOS_ENCRYPTION_KEY;
  if (!keyB64) throw new Error("CLIMBOS_ENCRYPTION_KEY is not configured.");
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: new TextEncoder().encode(aad) },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { keyId: process.env.CLIMBOS_ENCRYPTION_KEY_ID ?? "k1", iv: bytesToB64(iv), ciphertext: bytesToB64(new Uint8Array(ct)) };
}

export async function decryptSecret(record: { keyId: string; iv: string; ciphertext: string }, aad: string): Promise<string> {
  const current = process.env.CLIMBOS_ENCRYPTION_KEY;
  const previous = process.env.CLIMBOS_ENCRYPTION_KEY_PREVIOUS;
  const currentId = process.env.CLIMBOS_ENCRYPTION_KEY_ID ?? "k1";
  const candidates = record.keyId === currentId ? [current, previous] : [previous, current];
  for (const k of candidates) {
    if (!k) continue;
    try {
      const pt = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: b64ToBytes(record.iv) as BufferSource, additionalData: new TextEncoder().encode(aad) },
        await importKey(k),
        b64ToBytes(record.ciphertext) as BufferSource,
      );
      return new TextDecoder().decode(pt);
    } catch {
      // try the next key
    }
  }
  throw new Error("Could not decrypt connector secret (key rotated without migration?).");
}

/** Additional authenticated data binds a ciphertext to its tenant + connection. */
export function secretAad(orgId: string, connectionId: string): string {
  return `climbos:${orgId}:${connectionId}`;
}
