"use client";

import { icons, type LucideIcon } from "lucide-react";
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { resolveFont, resolvePaint } from "@shared/design/ops";
import type { BrandKit, DesignDoc, Fill, GroupLayer, IconLayer, ImageLayer, Layer, Page, ShapeLayer, TextLayer } from "@shared/design/types";
import { fontStack, nearestWeight } from "./fonts";

/**
 * ClimbOS's own design renderer. One React component draws a page for the
 * editor canvas, thumbnails and exports (the export service screenshots this
 * exact output), so what owners see is exactly what gets posted.
 * Geometry is in design pixels; `scale` maps them to screen pixels.
 */

export type AssetResolver = (src: string) => string | undefined;

const defaultResolver: AssetResolver = (src) => (/^(https?:|data:|blob:|\/)/.test(src) ? src : undefined);

export function fillToCss(fill: Fill | undefined, brand: BrandKit): string {
  if (!fill || fill.kind === "none") return "transparent";
  if (fill.kind === "solid") return resolvePaint(fill.color, brand);
  const stops = fill.stops.map((s) => `${resolvePaint(s.color, brand)} ${Math.round(s.offset * 100)}%`).join(", ");
  return `linear-gradient(${fill.angle + 90}deg, ${stops})`;
}

function shadowCss(l: Layer, brand: BrandKit): string | undefined {
  if (!l.shadow) return undefined;
  return `drop-shadow(${l.shadow.x}px ${l.shadow.y}px ${l.shadow.blur}px ${resolvePaint(l.shadow.color, brand)})`;
}

function boxStyle(l: Layer, brand: BrandKit, offset = { x: 0, y: 0 }): CSSProperties {
  return {
    position: "absolute",
    left: l.x - offset.x,
    top: l.y - offset.y,
    width: l.width,
    height: l.height,
    transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined,
    transformOrigin: "center center",
    opacity: l.opacity,
    filter: shadowCss(l, brand),
  };
}

/* ---------------- Text (with auto-fit) ---------------- */

function TextBox({ layer, brand, onFit }: { layer: TextLayer; brand: BrandKit; onFit?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const family = resolveFont(layer.fontFamily, brand);
  const weight = nearestWeight(family, layer.fontWeight);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The fit scale lives on the element (a CSS variable), not in React state.
    if (!layer.autoFit) {
      el.style.setProperty("--fit", "1");
      onFit?.();
      return;
    }
    let cancelled = false;
    const fit = () => {
      if (cancelled) return;
      // Binary search the largest scale where the text fits the box.
      let lo = 0.2;
      let hi = 1;
      el.style.setProperty("--fit", "1");
      if (el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1) {
        onFit?.();
        return;
      }
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        el.style.setProperty("--fit", String(mid));
        if (el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1) lo = mid;
        else hi = mid;
      }
      el.style.setProperty("--fit", String(lo));
      onFit?.();
    };
    if (typeof document !== "undefined" && document.fonts?.ready) document.fonts.ready.then(fit);
    else fit();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.autoFit, layer.text, layer.width, layer.height, layer.fontSize, family, weight, layer.lineHeight, layer.letterSpacing, layer.transform]);

  const bg = layer.background;
  return (
    <div
      ref={ref}
      style={
        {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: layer.verticalAlign === "middle" ? "center" : layer.verticalAlign === "bottom" ? "flex-end" : "flex-start",
          overflow: "hidden",
          boxSizing: "border-box",
          padding: bg ? bg.padding : 0,
          background: bg ? resolvePaint(bg.color, brand) : undefined,
          borderRadius: bg ? bg.radius : undefined,
        } as CSSProperties
      }
    >
      <div
        style={{
          fontFamily: fontStack(family),
          fontWeight: weight,
          fontStyle: layer.fontStyle ?? "normal",
          fontSize: `calc(${layer.fontSize}px * var(--fit, 1))`,
          lineHeight: layer.lineHeight,
          letterSpacing: layer.letterSpacing,
          color: resolvePaint(layer.color, brand),
          textAlign: layer.align,
          textTransform: layer.transform === "uppercase" ? "uppercase" : undefined,
          textDecoration: layer.underline ? "underline" : undefined,
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
          wordBreak: "break-word",
        }}
      >
        {layer.text}
      </div>
    </div>
  );
}

/* ---------------- Image ---------------- */

function ImageBox({ layer, brand, resolve }: { layer: ImageLayer; brand: BrandKit; resolve: AssetResolver }) {
  const url = layer.src === "brand:logo" ? (brand.logoSrc ? resolve(brand.logoSrc) : undefined) : layer.src ? resolve(layer.src) : undefined;
  const f = layer.filters ?? {};
  const filter = [
    f.brightness !== undefined ? `brightness(${f.brightness})` : "",
    f.contrast !== undefined ? `contrast(${f.contrast})` : "",
    f.saturation !== undefined ? `saturate(${f.saturation})` : "",
    f.blur ? `blur(${f.blur}px)` : "",
    f.grayscale ? "grayscale(1)" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const radius = layer.mask === "circle" ? "50%" : layer.radius;
  const clipPath = layer.mask === "blob" ? "path('M0.5,0 C0.85,0 1,0.2 1,0.5 C1,0.8 0.82,1 0.5,1 C0.18,1 0,0.78 0,0.5 C0,0.2 0.15,0 0.5,0 Z')" : undefined;
  const c = layer.crop;
  const innerW = layer.width / Math.max(c.width, 0.01);
  const innerH = layer.height / Math.max(c.height, 0.01);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: radius,
        clipPath,
        border: layer.border ? `${layer.border.width}px solid ${resolvePaint(layer.border.color, brand)}` : undefined,
        boxSizing: "border-box",
        background: url ? undefined : "repeating-linear-gradient(45deg, #e4e7ec 0 12px, #f0f2f5 12px 24px)",
        position: "relative",
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={layer.alt ?? ""}
          draggable={false}
          crossOrigin="anonymous"
          style={
            layer.fit === "contain"
              ? { width: "100%", height: "100%", objectFit: "contain", filter: filter || undefined, transform: flip(layer) }
              : {
                  position: "absolute",
                  width: innerW,
                  height: innerH,
                  left: -c.x * innerW,
                  top: -c.y * innerH,
                  maxWidth: "none",
                  objectFit: "cover",
                  filter: filter || undefined,
                  transform: flip(layer),
                }
          }
        />
      ) : null}
    </div>
  );
}

function flip(l: ImageLayer): string | undefined {
  if (!l.flipX && !l.flipY) return undefined;
  return `scale(${l.flipX ? -1 : 1}, ${l.flipY ? -1 : 1})`;
}

/* ---------------- Shapes and icons ---------------- */

function starPoints(n = 5, inner = 0.45): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 50 : 50 * inner;
    const a = (Math.PI / n) * i - Math.PI / 2;
    pts.push(`${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`);
  }
  return pts.join(" ");
}

function polygonPoints(sides = 6): string {
  return Array.from({ length: sides }, (_, i) => {
    const a = ((Math.PI * 2) / sides) * i - Math.PI / 2;
    return `${50 + 50 * Math.cos(a)},${50 + 50 * Math.sin(a)}`;
  }).join(" ");
}

function ShapeBox({ layer, brand }: { layer: ShapeLayer; brand: BrandKit }) {
  const fill = fillToCss(layer.fill, brand);
  const stroke = layer.stroke ? resolvePaint(layer.stroke.color, brand) : undefined;
  if (layer.shape === "rect" || layer.shape === "ellipse") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: fill,
          borderRadius: layer.shape === "ellipse" ? "50%" : layer.radius,
          border: layer.stroke ? `${layer.stroke.width}px ${layer.stroke.dash?.length ? "dashed" : "solid"} ${stroke}` : undefined,
          boxSizing: "border-box",
        }}
      />
    );
  }
  // SVG shapes stretch to the box. Gradients use a <linearGradient>.
  const gradId = `g-${layer.id}`;
  const svgFill = layer.fill.kind === "linear" ? `url(#${gradId})` : layer.fill.kind === "solid" ? resolvePaint(layer.fill.color, brand) : "none";
  const sw = layer.stroke ? (layer.stroke.width / Math.max(layer.width, 1)) * 100 : 0;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style={{ overflow: "visible", display: "block" }} aria-hidden="true">
      {layer.fill.kind === "linear" ? (
        <defs>
          <linearGradient id={gradId} gradientTransform={`rotate(${layer.fill.angle} 0.5 0.5)`}>
            {layer.fill.stops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={resolvePaint(s.color, brand)} />
            ))}
          </linearGradient>
        </defs>
      ) : null}
      {layer.shape === "triangle" ? <polygon points="50,0 100,100 0,100" fill={svgFill} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" /> : null}
      {layer.shape === "star" ? <polygon points={starPoints()} fill={svgFill} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" /> : null}
      {layer.shape === "polygon" ? <polygon points={polygonPoints(layer.sides)} fill={svgFill} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" /> : null}
      {layer.shape === "line" || layer.shape === "arrow" ? (
        <>
          <line x1="0" y1="50" x2={layer.shape === "arrow" ? 92 : 100} y2="50" stroke={stroke ?? fillToCss(layer.fill, brand)} strokeWidth={layer.stroke?.width ?? 4} vectorEffect="non-scaling-stroke" strokeDasharray={layer.stroke?.dash?.join(" ")} />
          {layer.shape === "arrow" ? <polygon points="88,30 100,50 88,70" fill={stroke ?? fillToCss(layer.fill, brand)} /> : null}
        </>
      ) : null}
    </svg>
  );
}

function IconBox({ layer, brand }: { layer: IconLayer; brand: BrandKit }) {
  const Icon = (icons as Record<string, LucideIcon>)[layer.icon] ?? icons.Sparkles;
  return <Icon width="100%" height="100%" color={resolvePaint(layer.color, brand)} strokeWidth={layer.strokeWidth} absoluteStrokeWidth={false} aria-hidden="true" />;
}

/* ---------------- Layers and pages ---------------- */

export function LayerView({ layer, brand, resolve, offset, onFit }: { layer: Layer; brand: BrandKit; resolve: AssetResolver; offset?: { x: number; y: number }; onFit?: () => void }) {
  if (layer.hidden) return null;
  // A logo slot with no brand logo set renders nothing (rather than a placeholder).
  if (layer.type === "image" && layer.src === "brand:logo" && !brand.logoSrc) return null;
  let inner: ReactNode = null;
  switch (layer.type) {
    case "text":
      inner = <TextBox layer={layer} brand={brand} onFit={onFit} />;
      break;
    case "image":
      inner = <ImageBox layer={layer} brand={brand} resolve={resolve} />;
      break;
    case "shape":
      inner = <ShapeBox layer={layer} brand={brand} />;
      break;
    case "icon":
      inner = <IconBox layer={layer} brand={brand} />;
      break;
    case "group":
      inner = <GroupBox layer={layer} brand={brand} resolve={resolve} onFit={onFit} />;
      break;
  }
  return (
    <div data-layer-id={layer.id} style={boxStyle(layer, brand, offset)}>
      {inner}
    </div>
  );
}

function GroupBox({ layer, brand, resolve, onFit }: { layer: GroupLayer; brand: BrandKit; resolve: AssetResolver; onFit?: () => void }) {
  return (
    <>
      {layer.children.map((c) => (
        <LayerView key={c.id} layer={c} brand={brand} resolve={resolve} offset={{ x: layer.x, y: layer.y }} onFit={onFit} />
      ))}
    </>
  );
}

export function PageView({ doc, page, resolve = defaultResolver, onReady }: { doc: DesignDoc; page: Page; resolve?: AssetResolver; onReady?: () => void }) {
  const bg = page.background;
  const bgUrl = bg.imageSrc ? resolve(bg.imageSrc) : undefined;
  const textCount = countText(page.layers);
  const fitted = useRef(0);
  useLayoutEffect(() => {
    fitted.current = 0;
    if (textCount === 0) onReady?.();
  }, [page, textCount, onReady]);
  const onFit = () => {
    fitted.current++;
    if (fitted.current >= textCount) onReady?.();
  };
  return (
    <div style={{ position: "relative", width: doc.width, height: doc.height, overflow: "hidden", background: fillToCss(bg, doc.brand) }}>
      {bgUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bgUrl} alt="" crossOrigin="anonymous" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: bg.imageOpacity ?? 1 }} />
      ) : null}
      {page.layers.map((l) => (
        <LayerView key={l.id} layer={l} brand={doc.brand} resolve={resolve} onFit={onFit} />
      ))}
    </div>
  );
}

function countText(layers: Layer[]): number {
  return layers.reduce((n, l) => n + (l.hidden ? 0 : l.type === "text" ? 1 : l.type === "group" ? countText(l.children) : 0), 0);
}

/** A page scaled to fit a box (thumbnails, previews). */
export function DesignThumbnail({ doc, pageIndex = 0, width, resolve, className }: { doc: DesignDoc; pageIndex?: number; width: number; resolve?: AssetResolver; className?: string }) {
  const scale = width / doc.width;
  const page = doc.pages[pageIndex] ?? doc.pages[0];
  return (
    <div className={className} style={{ width, height: doc.height * scale, overflow: "hidden", position: "relative" }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: doc.width, height: doc.height }}>
        <PageView doc={doc} page={page} resolve={resolve} />
      </div>
    </div>
  );
}
