"use client";

import { icons, type LucideIcon } from "lucide-react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Image as ImageIcon, LayoutTemplate, Layers, Lock, Palette, Shapes, Type, Unlock, Upload } from "@/components/icons";
import { useMemo, useRef, useState } from "react";
import { newId } from "@shared/design/ops";
import { TEMPLATES, templatePage } from "@shared/design/templates";
import type { DesignDoc, ImageLayer, Layer, ShapeLayer, TextLayer } from "@shared/design/types";
import { Button, ColorPicker, IconButton, Input, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DesignThumbnail, type AssetResolver } from "../DesignRenderer";
import { DESIGN_FONTS } from "../fonts";
import { SelectField } from "./controls";
import type { Editor } from "./useEditor";

export type PanelKey = "templates" | "text" | "elements" | "photos" | "brand" | "layers";

export const PANELS: { key: PanelKey; label: string; icon: LucideIcon }[] = [
  { key: "templates", label: "Templates", icon: LayoutTemplate },
  { key: "text", label: "Text", icon: Type },
  { key: "elements", label: "Elements", icon: Shapes },
  { key: "photos", label: "Photos", icon: ImageIcon },
  { key: "brand", label: "Brand", icon: Palette },
  { key: "layers", label: "Layers", icon: Layers },
];

export interface UploadedAsset {
  id: string;
  /** What the design stores ("asset:<id>" for library images); defaults to the URL. */
  ref?: string;
  url: string;
  name: string;
  width: number;
  height: number;
}

function centered(doc: DesignDoc, w: number, h: number) {
  return { x: Math.round((doc.width - w) / 2), y: Math.round((doc.height - h) / 2), width: Math.round(w), height: Math.round(h), rotation: 0, opacity: 1 };
}

type Upload = (files: FileList | File[], kind?: "upload" | "logo") => Promise<UploadedAsset[]>;

export function PanelBody({ panel, editor, resolve, assets, onUpload }: { panel: PanelKey; editor: Editor; resolve: AssetResolver; assets: UploadedAsset[]; onUpload: Upload }) {
  switch (panel) {
    case "templates":
      return <TemplatesPanel editor={editor} resolve={resolve} />;
    case "text":
      return <TextPanel editor={editor} />;
    case "elements":
      return <ElementsPanel editor={editor} />;
    case "photos":
      return <PhotosPanel editor={editor} assets={assets} onUpload={onUpload} />;
    case "brand":
      return <BrandPanel editor={editor} resolve={resolve} onUpload={onUpload} />;
    case "layers":
      return <LayersPanel editor={editor} />;
  }
}

/** Panel section label: an h2 for the outline, styled as an overline like every editor group label. */
function PanelTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn("px-1 pb-2", className)}>
      <span className="text-overline">{children}</span>
    </h2>
  );
}

function TemplatesPanel({ editor, resolve }: { editor: Editor; resolve: AssetResolver }) {
  const { doc, page, apply } = editor;
  const format = doc.format === "custom" ? "instagram_portrait" : doc.format;
  const previews = useMemo(() => TEMPLATES.map((t) => ({ t, page: templatePage(t.id, format) })), [format]);
  return (
    <div>
      <PanelTitle>Templates</PanelTitle>
      <p className="px-1 pb-3 text-xs text-ink-3">Replaces the current page. Undo brings it back.</p>
      <div className="grid grid-cols-2 gap-3">
        {previews.map(({ t, page: tp }) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              const index = doc.pages.findIndex((p) => p.id === page.id);
              const fresh = templatePage(t.id, format);
              apply([{ op: "add_page", page: fresh, index }, { op: "remove_page", pageId: page.id }], []);
              editor.dispatch({ type: "page", pageId: fresh.id });
            }}
            className="group overflow-hidden rounded-xl border border-line bg-surface text-left transition-colors hover:border-brand-600 hover:bg-surface-2"
          >
            <DesignThumbnail doc={{ ...doc, pages: [tp] }} width={132} resolve={resolve} />
            <span className="block px-2 py-1.5 text-xs font-medium text-ink-2 group-hover:text-ink">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const presetClasses = "rounded-lg border border-line bg-surface px-3 py-3 text-left text-ink transition-colors hover:border-brand-600 hover:bg-surface-2";

function TextPanel({ editor }: { editor: Editor }) {
  const { doc, page, apply } = editor;
  const add = (preset: "heading" | "subheading" | "body" | "pill") => {
    const s = Math.min(doc.width, doc.height);
    const spec: Record<string, Partial<TextLayer>> = {
      heading: { text: "Add a heading", fontSize: s * 0.09, fontWeight: 800, fontFamily: "brand:heading", lineHeight: 1.05 },
      subheading: { text: "Add a subheading", fontSize: s * 0.05, fontWeight: 600, fontFamily: "brand:heading", lineHeight: 1.15 },
      body: { text: "Add a little bit of body text", fontSize: s * 0.034, fontWeight: 400, fontFamily: "brand:body", lineHeight: 1.45 },
      pill: { text: "NEW", fontSize: s * 0.03, fontWeight: 700, fontFamily: "brand:body", letterSpacing: 2, transform: "uppercase", align: "center", verticalAlign: "middle", background: { color: "brand:accent", padding: s * 0.012, radius: s * 0.03 } },
    };
    const p = spec[preset];
    const w = preset === "pill" ? s * 0.22 : doc.width * 0.8;
    const h = (p.fontSize ?? 40) * (p.lineHeight ?? 1.2) * (preset === "body" ? 3 : preset === "pill" ? 1.8 : 1.3);
    const layer: TextLayer = {
      id: newId(),
      type: "text",
      ...centered(doc, w, h),
      text: "",
      fontFamily: "brand:body",
      fontWeight: 400,
      fontSize: 40,
      lineHeight: 1.2,
      letterSpacing: 0,
      color: "brand:dark",
      align: "left",
      verticalAlign: "top",
      autoFit: true,
      ...p,
    } as TextLayer;
    apply([{ op: "add_layer", pageId: page.id, layer }], [layer.id]);
  };
  return (
    <div className="flex flex-col gap-2">
      <PanelTitle>Text</PanelTitle>
      <button type="button" onClick={() => add("heading")} className={presetClasses}>
        <span className="text-2xl font-semibold">Add a heading</span>
      </button>
      <button type="button" onClick={() => add("subheading")} className={presetClasses}>
        <span className="text-lg font-semibold">Add a subheading</span>
      </button>
      <button type="button" onClick={() => add("body")} className={presetClasses}>
        <span className="text-sm">Add body text</span>
      </button>
      <button type="button" onClick={() => add("pill")} className={presetClasses}>
        <span className="rounded-full bg-sun px-2.5 py-1 text-xs font-semibold tracking-widest text-ink">LABEL PILL</span>
      </button>
    </div>
  );
}

const SHAPES: { shape: ShapeLayer["shape"]; label: string }[] = [
  { shape: "rect", label: "Rectangle" },
  { shape: "ellipse", label: "Circle" },
  { shape: "triangle", label: "Triangle" },
  { shape: "star", label: "Star" },
  { shape: "polygon", label: "Hexagon" },
  { shape: "line", label: "Line" },
  { shape: "arrow", label: "Arrow" },
];

const ICON_NAMES = Object.keys(icons);
const ICON_SET = icons as Record<string, LucideIcon | undefined>;
const STARTER_ICONS = ["Star", "Heart", "Check", "Sparkles", "Zap", "Rocket", "Target", "TrendingUp", "Coffee", "Leaf", "Sun", "Gift", "Camera", "Mail", "Phone", "MapPin", "Clock", "Calendar", "ShieldCheck", "Award", "PartyPopper", "Handshake", "ThumbsUp", "MessageCircle", "ArrowRight"].filter((n) => ICON_SET[n]);

function ElementsPanel({ editor }: { editor: Editor }) {
  const { doc, page, apply } = editor;
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (term ? ICON_NAMES.filter((n) => n.toLowerCase().includes(term)) : STARTER_ICONS).slice(0, 48);
  }, [q]);
  const s = Math.min(doc.width, doc.height);
  const addShape = (shape: ShapeLayer["shape"]) => {
    const line = shape === "line" || shape === "arrow";
    const layer: ShapeLayer = {
      id: newId(),
      type: "shape",
      shape,
      ...centered(doc, s * (line ? 0.5 : 0.3), line ? s * 0.04 : s * 0.3),
      fill: { kind: "solid", color: "brand:primary" },
      stroke: line ? { width: 6, color: "brand:dark" } : undefined,
      radius: shape === "rect" ? Math.round(s * 0.02) : 0,
      sides: shape === "polygon" ? 6 : undefined,
    };
    apply([{ op: "add_layer", pageId: page.id, layer }], [layer.id]);
  };
  const addIcon = (icon: string) => {
    const layer: Layer = { id: newId(), type: "icon", icon, ...centered(doc, s * 0.16, s * 0.16), color: "brand:primary", strokeWidth: 2 };
    apply([{ op: "add_layer", pageId: page.id, layer }], [layer.id]);
  };
  return (
    <div>
      <PanelTitle>Shapes</PanelTitle>
      <div className="grid grid-cols-4 gap-2">
        {SHAPES.map((sh) => (
          <Tooltip key={sh.shape} content={sh.label}>
            <button type="button" aria-label={`Add ${sh.label.toLowerCase()}`} onClick={() => addShape(sh.shape)} className="grid aspect-square place-items-center rounded-lg border border-line bg-surface transition-colors hover:border-brand-600 hover:bg-surface-2">
              <ShapeGlyph shape={sh.shape} />
            </button>
          </Tooltip>
        ))}
      </div>
      <PanelTitle className="mt-6">Icons</PanelTitle>
      <label className="block px-1">
        <span className="sr-only">Search icons</span>
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="Search icons (e.g. coffee, heart)" className="h-8" />
      </label>
      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {matches.map((name) => {
          const I = ICON_SET[name];
          if (!I) return null;
          return (
            <Tooltip key={name} content={name}>
              <button type="button" aria-label={`Add ${name} icon`} onClick={() => addIcon(name)} className="grid aspect-square place-items-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
                <I className="size-5" aria-hidden="true" />
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

function ShapeGlyph({ shape }: { shape: ShapeLayer["shape"] }) {
  const c = "fill-brand-800";
  return (
    <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
      {shape === "rect" ? <rect x="3" y="5" width="18" height="14" rx="2" className={c} /> : null}
      {shape === "ellipse" ? <circle cx="12" cy="12" r="9" className={c} /> : null}
      {shape === "triangle" ? <polygon points="12,3 21,20 3,20" className={c} /> : null}
      {shape === "star" ? <polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6" className={c} /> : null}
      {shape === "polygon" ? <polygon points="12,2 20.7,7 20.7,17 12,22 3.3,17 3.3,7" className={c} /> : null}
      {shape === "line" ? <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2.5" className="stroke-brand-800" /> : null}
      {shape === "arrow" ? (
        <>
          <line x1="3" y1="12" x2="18" y2="12" strokeWidth="2.5" className="stroke-brand-800" />
          <polygon points="16,7 22,12 16,17" className={c} />
        </>
      ) : null}
    </svg>
  );
}

function PhotosPanel({ editor, assets, onUpload }: { editor: Editor; assets: UploadedAsset[]; onUpload: Upload }) {
  const { doc, page, apply, selectedLayers } = editor;
  const input = useRef<HTMLInputElement>(null);
  const target = selectedLayers.length === 1 && selectedLayers[0].type === "image" ? (selectedLayers[0] as ImageLayer) : null;
  const use = (a: UploadedAsset) => {
    const crop = (boxW: number, boxH: number) => {
      // Cover-crop the image to the frame's aspect ratio, centred.
      const imgR = a.width / a.height;
      const boxR = boxW / boxH;
      return imgR > boxR ? { x: (1 - boxR / imgR) / 2, y: 0, width: boxR / imgR, height: 1 } : { x: 0, y: (1 - imgR / boxR) / 2, width: 1, height: imgR / boxR };
    };
    if (target) {
      apply([{ op: "update_layer", pageId: page.id, layerId: target.id, props: { src: a.ref ?? a.url, crop: crop(target.width, target.height), alt: a.name } as Partial<Layer> }]);
      return;
    }
    const maxW = doc.width * 0.7;
    const w = Math.min(maxW, (doc.height * 0.7 * a.width) / a.height);
    const h = (w * a.height) / a.width;
    const layer: ImageLayer = { id: newId(), type: "image", src: a.ref ?? a.url, ...centered(doc, w, h), crop: { x: 0, y: 0, width: 1, height: 1 }, fit: "cover", radius: 0, alt: a.name };
    apply([{ op: "add_layer", pageId: page.id, layer }], [layer.id]);
  };
  return (
    <div>
      <PanelTitle>Photos</PanelTitle>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(e) => {
        if (e.target.files?.length) void onUpload(Array.from(e.target.files)).catch(() => undefined);
        e.target.value = "";
      }} aria-label="Upload images" />
      <Button variant="secondary" onClick={() => input.current?.click()} className="w-full">
        <Upload aria-hidden="true" /> Upload your photos
      </Button>
      <p className="mt-2 px-1 text-xs text-ink-3">{target ? "Click a photo to replace the selected image." : "Click a photo to add it. Select an image first to replace it."} Only use photos you have the rights to.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {assets.map((a) => (
          <Tooltip key={a.id} content={a.name}>
            <button type="button" onClick={() => use(a)} className="overflow-hidden rounded-lg border border-line transition-colors hover:border-brand-600">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name} className="aspect-square w-full object-cover" />
            </button>
          </Tooltip>
        ))}
      </div>
      {assets.length === 0 ? <p className="mt-6 rounded-xl border border-dashed border-line-strong bg-surface p-4 text-center text-ui text-ink-3">Your uploaded photos and logos appear here.</p> : null}
    </div>
  );
}

function BrandPanel({ editor, resolve, onUpload }: { editor: Editor; resolve: AssetResolver; onUpload: Upload }) {
  const { doc, apply } = editor;
  const logoInput = useRef<HTMLInputElement>(null);
  const slots = Object.keys(doc.brand.colors) as (keyof DesignDoc["brand"]["colors"])[];
  return (
    <div className="flex flex-col gap-4">
      <div>
        <PanelTitle>Brand kit</PanelTitle>
        <p className="px-1 text-xs text-ink-3">Every layer that uses a brand colour or font updates when you change it here.</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {slots.map((k) => (
          <div key={k} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface py-1 pl-3 pr-1 text-ui font-medium capitalize text-ink-2">
            {k}
            <ColorPicker label={`Brand ${k}`} value={doc.brand.colors[k]} onChange={(hex) => apply([{ op: "set_brand", brand: { colors: { [k]: hex } } }])} />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <span className="px-1 text-ui font-medium text-ink-2">Heading font</span>
        <SelectField label="Heading font" value={doc.brand.fonts.heading} className="w-full" onChange={(heading) => apply([{ op: "set_brand", brand: { fonts: { heading } } }])} options={DESIGN_FONTS.map((f) => ({ value: f.family, label: f.family, style: { fontFamily: f.family } }))} />
        <span className="px-1 text-ui font-medium text-ink-2">Body font</span>
        <SelectField label="Body font" value={doc.brand.fonts.body} className="w-full" onChange={(body) => apply([{ op: "set_brand", brand: { fonts: { body } } }])} options={DESIGN_FONTS.map((f) => ({ value: f.family, label: f.family, style: { fontFamily: f.family } }))} />
      </div>
      <div>
        <span className="px-1 text-ui font-medium text-ink-2">Logo</span>
        <input
          ref={logoInput}
          type="file"
          accept="image/png,image/svg+xml,image/webp,image/jpeg"
          className="sr-only"
          aria-label="Upload logo"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const saved = await onUpload([file], "logo").catch(() => []);
            if (saved[0]) {
              apply([{ op: "set_brand", brand: { logoSrc: saved[0].ref ?? saved[0].url } }]);
              return;
            }
            // No library (local editing): keep it in the design.
            const reader = new FileReader();
            reader.onload = () => apply([{ op: "set_brand", brand: { logoSrc: String(reader.result) } }]);
            reader.readAsDataURL(file);
          }}
        />
        <button type="button" onClick={() => logoInput.current?.click()} className="mt-2 flex h-20 w-full items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface transition-colors hover:border-brand-600 hover:bg-surface-2">
          {doc.brand.logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolve(doc.brand.logoSrc)} alt="Current logo" className="max-h-14 max-w-[80%] object-contain" />
          ) : (
            <span className="text-ui text-ink-3">Upload your logo</span>
          )}
        </button>
      </div>
    </div>
  );
}

function layerLabel(l: Layer): string {
  if (l.name) return l.name;
  if (l.type === "text") return l.text.slice(0, 40) || "Text";
  if (l.type === "image") return l.slot === "logo" ? "Logo" : l.alt || "Image";
  if (l.type === "shape") return l.shape[0].toUpperCase() + l.shape.slice(1);
  if (l.type === "icon") return `Icon: ${l.icon}`;
  return "Group";
}

const layerAction = "text-ink-3 hover:bg-surface hover:text-ink";

function LayersPanel({ editor }: { editor: Editor }) {
  const { page, state, dispatch, apply } = editor;
  const ordered = [...page.layers].reverse();
  return (
    <div>
      <PanelTitle>Layers</PanelTitle>
      <p className="px-1 pb-3 text-xs text-ink-3">Top of the list is in front.</p>
      <ul className="flex flex-col gap-1">
        {ordered.map((l) => {
          const i = page.layers.findIndex((x) => x.id === l.id);
          const selected = state.selected.includes(l.id);
          return (
            <li key={l.id} className={cn("flex items-center rounded-lg border px-1 transition-colors", selected ? "border-brand-600 bg-brand-50" : "border-transparent hover:bg-surface-2")}>
              <button type="button" onClick={() => dispatch({ type: "select", ids: [l.id] })} className={cn("h-8 min-w-0 flex-1 truncate px-1 text-left text-ui", l.hidden ? "text-ink-3 line-through" : "text-ink")}>
                {layerLabel(l)}
              </button>
              <IconButton size="sm" aria-label="Move layer up" icon={<ChevronUp />} disabled={i === page.layers.length - 1} onClick={() => apply([{ op: "move_layer", pageId: page.id, layerId: l.id, toIndex: i + 1 }])} className={layerAction} />
              <IconButton size="sm" aria-label="Move layer down" icon={<ChevronDown />} disabled={i === 0} onClick={() => apply([{ op: "move_layer", pageId: page.id, layerId: l.id, toIndex: i - 1 }])} className={layerAction} />
              <IconButton size="sm" aria-label={l.hidden ? "Show layer" : "Hide layer"} icon={l.hidden ? <EyeOff /> : <Eye />} onClick={() => apply([{ op: "update_layer", pageId: page.id, layerId: l.id, props: { hidden: !l.hidden } }])} className={layerAction} />
              <IconButton size="sm" aria-label={l.locked ? "Unlock layer" : "Lock layer"} icon={l.locked ? <Lock /> : <Unlock />} onClick={() => apply([{ op: "update_layer", pageId: page.id, layerId: l.id, props: { locked: !l.locked } }])} className={layerAction} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
