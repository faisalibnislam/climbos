"use node";

import { VIDEO_ROUTE } from "../../shared/ai/models";

/**
 * Google Veo 3.1 Lite through the Gemini API (long-running operation):
 * start → poll → download. Reads GEMINI_API_KEY; never returns it.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function startVeo(prompt: string): Promise<{ ok: true; operation: string } | { ok: false; message: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, message: "Video generation isn't configured." };
  const res = await fetch(`${BASE}/models/${VIDEO_ROUTE.apiModelId}:predictLongRunning`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ instances: [{ prompt }], parameters: { aspectRatio: VIDEO_ROUTE.aspectRatio, resolution: VIDEO_ROUTE.resolution, durationSeconds: VIDEO_ROUTE.clipSeconds, numberOfVideos: 1, personGeneration: "allow_adult" } }),
  }).catch(() => null);
  const json = (await res?.json().catch(() => null)) as { name?: string; error?: { message?: string } } | null;
  if (!res?.ok || !json?.name) return { ok: false, message: json?.error?.message?.slice(0, 200) ?? `Veo error (${res?.status ?? "network"})` };
  return { ok: true, operation: json.name };
}

export async function pollVeo(operation: string): Promise<{ done: false } | { done: true; uri: string } | { done: true; error: string }> {
  const key = process.env.GEMINI_API_KEY!;
  const res = await fetch(`${BASE}/${operation}`, { headers: { "x-goog-api-key": key } }).catch(() => null);
  const json = (await res?.json().catch(() => null)) as { done?: boolean; error?: { message?: string }; response?: { generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[]; raiMediaFilteredReasons?: string[] } } } | null;
  if (!json?.done) return { done: false };
  const uri = json.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (uri) return { done: true, uri };
  return { done: true, error: json.error?.message ?? json.response?.generateVideoResponse?.raiMediaFilteredReasons?.[0] ?? "No video was returned (it may have been blocked by safety filters)." };
}

export async function downloadVeo(uri: string): Promise<Uint8Array | null> {
  const res = await fetch(uri, { headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! }, redirect: "follow" }).catch(() => null);
  if (!res?.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}
