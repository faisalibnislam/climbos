import { AwsClient } from "aws4fetch";

/**
 * Cloudflare R2 object storage (S3-compatible). Used for generated images and
 * exports when configured; otherwise Convex file storage is used. Objects are
 * private: keys are tenant-prefixed and every read is a short-lived presigned URL.
 */

export function r2Configured(): boolean {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
}

function client(): AwsClient {
  return new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  });
}

function objectUrl(key: string): string {
  const safeKey = key.split("/").map(encodeURIComponent).join("/");
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/${safeKey}`;
}

/** Tenant-scoped object key: orgs/<orgId>/<kind>/<random>.<ext> */
export function r2Key(orgId: string, kind: "images" | "exports", ext: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `orgs/${orgId}/${kind}/${id}.${ext.replace(/[^a-z0-9]/gi, "")}`;
}

export async function r2Put(key: string, body: Uint8Array | string, contentType: string): Promise<void> {
  const res = await client().fetch(objectUrl(key), {
    method: "PUT",
    body: body as BodyInit,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) throw new Error(`R2 upload failed (${res.status})`);
}

export async function r2Delete(key: string): Promise<void> {
  await client().fetch(objectUrl(key), { method: "DELETE" });
}

/** Presigned GET valid for `seconds` (default 1 hour; long enough for Instagram to fetch media). */
export async function r2SignedUrl(key: string, seconds = 3600): Promise<string> {
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(Math.max(60, Math.min(seconds, 7 * 86_400))));
  const signed = await client().sign(new Request(url.toString(), { method: "GET" }), { aws: { signQuery: true } });
  return signed.url;
}
