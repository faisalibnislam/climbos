import type { Browser } from "playwright-core";

/**
 * Headless Chromium for ClimbOS's own render worker: @sparticuz/chromium on
 * Vercel, the locally installed Playwright Chromium in development.
 */
export async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright-core");
  if (process.env.VERCEL) {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    // --single-process hangs when a second browser context opens (the mobile view);
    // we load untrusted sites, so keep same-origin and mixed-content protections on.
    const drop = new Set(["--single-process", "--disable-web-security", "--allow-running-insecure-content"]);
    const args = sparticuz.args.filter((a) => !drop.has(a));
    return chromium.launch({ executablePath: await sparticuz.executablePath(), args, headless: true });
  }
  return chromium.launch({ headless: true });
}

export { safePublicUrl } from "../../../shared/net/safeUrl";

/** Hide cookie banners, chat bubbles and sticky overlays so screenshots show the product. */
export const CLEAN_PAGE_CSS = `
  [id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i], [aria-label*="cookie" i],
  #onetrust-banner-sdk, .osano-cm-window, #CybotCookiebotDialog, .cc-window, .truste_box_overlay,
  [id*="intercom" i], [class*="intercom" i], #hubspot-messages-iframe-container, .drift-frame-controller,
  [id*="crisp" i], iframe[title*="chat" i], [class*="chat-widget" i] { display: none !important; visibility: hidden !important; }
  html, body { scroll-behavior: auto !important; }
  *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }
`;
