"use client";

import { useEffect, useSyncExternalStore } from "react";

const noop = () => () => undefined;
import type { DesignDoc } from "@shared/design/types";
import "./design-fonts.css";
import { PageView } from "./DesignRenderer";

declare global {
  interface Window {
    __climbosDesign?: { doc: DesignDoc; urls: Record<string, string>; pages: number[] };
    __climbosReady?: boolean;
  }
}

/**
 * What the export worker screenshots: the requested pages at 1:1, stacked,
 * drawn by the same renderer as the editor. Signals ready once fonts,
 * images and auto-fit text have settled.
 */
export function DesignRenderFrame() {
  // The worker injects the design before load; the server render has none, so hydration matches.
  const job = useSyncExternalStore(noop, () => window.__climbosDesign, () => undefined);
  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    (async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).map((img) => (img.complete ? null : new Promise((r) => ((img.onload = r), (img.onerror = r))))));
      // Two frames for auto-fit text to measure and settle.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (!cancelled) window.__climbosReady = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [job]);
  if (!job) return null;
  const { doc, urls, pages } = job;
  const resolve = (src: string) => urls[src] ?? (/^(https?:|data:)/.test(src) ? src : undefined);
  return (
    <div style={{ margin: 0, padding: 0, background: "transparent" }}>
      <style>{`html,body{margin:0;padding:0;background:transparent} nextjs-portal{display:none!important} @page{size:${doc.width}px ${doc.height}px;margin:0} .design-page{break-after:page;page-break-after:always}`}</style>
      {pages.map((i) => (
        <div key={i} className="design-page" data-page={i} style={{ width: doc.width, height: doc.height, overflow: "hidden", position: "relative" }}>
          <PageView doc={doc} page={doc.pages[i]} resolve={resolve} />
        </div>
      ))}
    </div>
  );
}
