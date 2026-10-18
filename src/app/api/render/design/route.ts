import { NextResponse } from "next/server";
import type { DesignDoc } from "@shared/design/types";
import { launchBrowser, safePublicUrl } from "@/lib/render/browser";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * ClimbOS design worker: opens our own render page in headless Chrome with
 * the design injected, then screenshots each page (PNG) or prints them all
 * (PDF). The same renderer as the editor draws it, so downloads match the
 * canvas exactly. Called only by the Convex backend with the shared secret.
 */
export async function POST(req: Request) {
  const secret = process.env.CLIMBOS_SERVER_SECRET;
  if (!secret || req.headers.get("x-climbos-secret") !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { doc?: DesignDoc; urls?: Record<string, string>; pages?: number[]; kind?: "png" | "pdf"; uploadUrls?: string[] };
  const doc = body.doc;
  if (!doc || doc.version !== 1 || !Array.isArray(doc.pages) || !(doc.width > 0 && doc.width <= 4000) || !(doc.height > 0 && doc.height <= 4000)) return NextResponse.json({ error: "Invalid design." }, { status: 400 });
  const pages = (body.pages ?? [0]).filter((i) => Number.isInteger(i) && i >= 0 && i < doc.pages.length).slice(0, 20);
  if (!pages.length) return NextResponse.json({ error: "No pages." }, { status: 400 });
  // Files go straight to storage (one upload URL per file): responses stay small whatever the size.
  const uploads = (body.uploadUrls ?? []).filter((u) => /^https:\/\/[^/]+\.convex\.(cloud|site)\//.test(u) || u.startsWith("http://127.0.0.1"));
  if (uploads.length < (body.kind === "pdf" ? 1 : pages.length)) return NextResponse.json({ error: "Missing upload URLs." }, { status: 400 });
  const put = async (url: string, data: Buffer, type: string): Promise<string> => {
    const r = await fetch(url, { method: "POST", headers: { "content-type": type }, body: new Uint8Array(data) });
    const j = (await r.json().catch(() => ({}))) as { storageId?: string };
    if (!r.ok || !j.storageId) throw new Error(`Upload failed (${r.status})`);
    return j.storageId;
  };
  // Image URLs the design may load: resolved asset URLs and public https images in the design.
  const urls = Object.fromEntries(Object.entries(body.urls ?? {}).filter(([k, u]) => k.startsWith("asset:") && safePublicUrl(u)));
  const allowed = new Set(Object.values(urls));
  const origin = new URL(req.url).origin;

  const t0 = Date.now();
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: { width: doc.width, height: doc.height }, deviceScaleFactor: 1 });
    await context.addInitScript((job) => {
      (window as unknown as { __climbosDesign: unknown }).__climbosDesign = job;
    }, { doc, urls, pages });
    const page = await context.newPage();
    // Our own page and assets, the design's images, data: URLs. Nothing else.
    await page.route("**/*", (route) => {
      const u = route.request().url();
      const ok = u.startsWith("data:") || u.startsWith(origin) || allowed.has(u) || (/^https:\/\//.test(u) && route.request().resourceType() === "image" && Boolean(safePublicUrl(u)));
      return ok ? route.continue() : route.abort();
    });
    await page.goto(`${origin}/render/design`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForFunction(() => (window as unknown as { __climbosReady?: boolean }).__climbosReady === true, undefined, { timeout: 20_000 });
    if (body.kind === "pdf") {
      const pdf = await page.pdf({ width: `${doc.width}px`, height: `${doc.height}px`, printBackground: true });
      const id = await put(uploads[0], pdf, "application/pdf");
      console.log(`[design] pdf ${pages.length} pages, ${pdf.length} bytes, ${Date.now() - t0}ms`);
      return NextResponse.json({ storageIds: [id] });
    }
    const storageIds: string[] = [];
    for (const [n, i] of pages.entries()) {
      const png = await page.locator(`[data-page="${i}"]`).screenshot({ type: "png" });
      storageIds.push(await put(uploads[n], png, "image/png"));
    }
    console.log(`[design] ${storageIds.length} png, ${Date.now() - t0}ms`);
    return NextResponse.json({ storageIds });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 300) }, { status: 500 });
  } finally {
    await browser.close().catch(() => undefined);
  }
}
