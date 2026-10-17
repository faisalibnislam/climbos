import { NextResponse } from "next/server";
import { CLEAN_PAGE_CSS, launchBrowser, safePublicUrl } from "@/lib/render/browser";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Shot {
  kind: "desktop" | "mobile" | "section";
  label: string;
  width: number;
  height: number;
  png: string; // base64
}

/**
 * ClimbOS render worker: real screenshots of a customer's public website for
 * posts (desktop and mobile views plus feature-section crops with their
 * headings). Called only by the Convex backend with the shared server secret.
 */
export async function POST(req: Request) {
  const secret = process.env.CLIMBOS_SERVER_SECRET;
  if (!secret || req.headers.get("x-climbos-secret") !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { url?: string; sections?: number };
  const url = safePublicUrl(body.url ?? "");
  if (!url) return NextResponse.json({ error: "Only public http(s) pages can be captured." }, { status: 400 });
  const maxSections = Math.max(0, Math.min(6, body.sections ?? 4));

  const browser = await launchBrowser();
  const shots: Shot[] = [];
  let title = "";
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 ClimbOS-Capture/1.0" });
    const page = await desktop.newPage();
    // Never follow the page to private hosts (redirect-based SSRF).
    await page.route("**/*", (route) => (safePublicUrl(route.request().url()) ? route.continue() : route.abort()));
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 25_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
    await page.addStyleTag({ content: CLEAN_PAGE_CSS });
    await page.waitForTimeout(600);
    title = await page.title();
    shots.push({ kind: "desktop", label: title || url.hostname, width: 1440, height: 900, png: (await page.screenshot({ type: "png" })).toString("base64") });

    // Sticky headers and floating bars would sit on top of every crop: hide them now.
    await page.evaluate(() => {
      for (const el of Array.from(document.querySelectorAll("body *")) as HTMLElement[]) {
        const pos = getComputedStyle(el).position;
        if (pos === "fixed" || pos === "sticky") el.style.setProperty("visibility", "hidden", "important");
      }
    });
    // Feature sections: large blocks with a heading, cropped one by one.
    const sections = await page.evaluate((max) => {
      const out: { y: number; h: number; label: string }[] = [];
      const blocks = Array.from(document.querySelectorAll("section, main > div, [class*='feature' i]")) as HTMLElement[];
      for (const el of blocks) {
        const r = el.getBoundingClientRect();
        const y = r.top + window.scrollY;
        const heading = el.querySelector("h1, h2, h3")?.textContent?.trim() ?? "";
        if (r.height < 320 || r.height > 1600 || r.width < 900 || !heading || y < 500) continue;
        if (out.some((o) => Math.abs(o.y - y) < 200)) continue;
        out.push({ y, h: Math.min(r.height, 1100), label: heading.slice(0, 120) });
        if (out.length >= max) break;
      }
      return out;
    }, maxSections);
    for (const s of sections) {
      await page.evaluate((y) => window.scrollTo(0, y), s.y);
      await page.waitForTimeout(400);
      const png = await page.screenshot({ type: "png", clip: { x: 0, y: s.y, width: 1440, height: s.h }, fullPage: true });
      shots.push({ kind: "section", label: s.label, width: 1440, height: Math.round(s.h), png: png.toString("base64") });
    }
    await desktop.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const m = await mobile.newPage();
    await m.route("**/*", (route) => (safePublicUrl(route.request().url()) ? route.continue() : route.abort()));
    await m.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 25_000 });
    await m.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => undefined);
    await m.addStyleTag({ content: CLEAN_PAGE_CSS });
    await m.waitForTimeout(400);
    shots.push({ kind: "mobile", label: `${title || url.hostname} (mobile)`, width: 390, height: 844, png: (await m.screenshot({ type: "png" })).toString("base64") });
    await mobile.close();
  } catch (e) {
    if (!shots.length) return NextResponse.json({ error: `Couldn't capture this page: ${(e as Error).message.slice(0, 200)}` }, { status: 502 });
  } finally {
    await browser.close();
  }
  return NextResponse.json({ url: url.toString(), title, shots });
}
