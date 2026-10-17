"use client";

import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  BringToFront,
  CaseUpper,
  Copy,
  FlipHorizontal2,
  Group,
  Italic,
  Lock,
  SendToBack,
  Trash2,
  Underline,
  Ungroup,
  Unlock,
} from "lucide-react";
import { newId } from "@shared/design/ops";
import type { ImageLayer, Layer, ShapeLayer, TextLayer } from "@shared/design/types";
import { DESIGN_FONTS, nearestWeight } from "../fonts";
import { ColorControl, Divider, NumberField, SelectField, Slider, ToolButton } from "./controls";
import { withNewIds, type Editor } from "./useEditor";
import { useState } from "react";
import { Checkbox, Tooltip } from "@/components/ui";

const WEIGHT_NAMES: Record<number, string> = { 100: "Thin", 200: "Extra light", 300: "Light", 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold", 800: "Extra bold", 900: "Black" };

export function Toolbar({ editor }: { editor: Editor }) {
  const { selectedLayers, page, doc, apply, updateSelected, state } = editor;
  const one = selectedLayers.length === 1 ? selectedLayers[0] : null;
  const [showAdjust, setShowAdjust] = useState(false);

  if (!selectedLayers.length) {
    return (
      <div className="flex min-h-12 flex-wrap items-center gap-2 px-3">
        <span className="text-ui font-medium text-ink-2">Page background</span>
        <ColorControl
          label="Page background"
          value={page.background.kind === "solid" ? page.background.color : "#ffffff"}
          brand={doc.brand}
          onChange={(color) => apply([{ op: "set_background", pageId: page.id, background: { ...page.background, kind: "solid", color } }])}
        />
        <span className="ml-2 text-ui text-ink-3">Select something on the page to edit it. Double-click text to type.</span>
      </div>
    );
  }

  const ids = selectedLayers.map((l) => l.id);
  const topIndex = (id: string) => page.layers.findIndex((l) => l.id === id);
  const arrange = (to: "front" | "back" | "up" | "down") =>
    apply(
      ids
        .filter((id) => topIndex(id) >= 0)
        .map((layerId) => {
          const i = topIndex(layerId);
          const toIndex = to === "front" ? page.layers.length : to === "back" ? 0 : to === "up" ? i + 1 : i - 1;
          return { op: "move_layer" as const, pageId: page.id, layerId, toIndex };
        }),
    );
  const duplicate = () => {
    const copies = selectedLayers.map((l) => withNewIds({ ...l, x: l.x + 24, y: l.y + 24 }));
    apply(copies.map((layer) => ({ op: "add_layer", pageId: page.id, layer })), copies.map((c) => c.id));
  };
  const remove = () => apply(ids.map((layerId) => ({ op: "remove_layer", pageId: page.id, layerId })), []);
  const allLocked = selectedLayers.every((l) => l.locked);

  // Align selected layers to the page (single) or to each other (multiple).
  const align = (axis: "x" | "y") => {
    if (one) {
      const props = axis === "x" ? { x: Math.round((doc.width - one.width) / 2) } : { y: Math.round((doc.height - one.height) / 2) };
      apply([{ op: "update_layer", pageId: page.id, layerId: one.id, props }]);
      return;
    }
    const minX = Math.min(...selectedLayers.map((l) => l.x));
    const maxX = Math.max(...selectedLayers.map((l) => l.x + l.width));
    const minY = Math.min(...selectedLayers.map((l) => l.y));
    const maxY = Math.max(...selectedLayers.map((l) => l.y + l.height));
    apply(
      selectedLayers.map((l) => ({
        op: "update_layer" as const,
        pageId: page.id,
        layerId: l.id,
        props: axis === "x" ? { x: Math.round((minX + maxX) / 2 - l.width / 2) } : { y: Math.round((minY + maxY) / 2 - l.height / 2) },
      })),
    );
  };

  return (
    <div className="flex min-h-12 flex-wrap items-center gap-1 px-3 py-1.5">
      {one?.type === "text" ? <TextControls layer={one} editor={editor} /> : null}
      {one?.type === "image" ? <ImageControls layer={one} editor={editor} showAdjust={showAdjust} setShowAdjust={setShowAdjust} /> : null}
      {one?.type === "shape" ? <ShapeControls layer={one} editor={editor} /> : null}
      {one?.type === "icon" ? (
        <>
          <ColorControl label="Icon colour" value={one.color} brand={doc.brand} onChange={(color) => updateSelected({ color } as Partial<Layer>)} />
          <NumberField label="Line width" value={one.strokeWidth} min={0.5} max={4} step={0.25} onChange={(strokeWidth) => updateSelected({ strokeWidth } as Partial<Layer>)} />
        </>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-1">
        <Tooltip content="Transparency">
          <label className="inline-flex h-8 items-center gap-2 text-ui font-medium text-ink-2">
            Opacity
            <input type="range" min={0} max={1} step={0.05} value={one?.opacity ?? 1} onChange={(e) => updateSelected({ opacity: Number(e.target.value) })} className="w-20 accent-brand-800" />
          </label>
        </Tooltip>
        {one ? <NumberField label="Rotation" value={one.rotation} min={-360} max={360} suffix="°" width="w-14" onChange={(rotation) => updateSelected({ rotation })} /> : null}
        <Divider />
        <ToolButton label="Centre horizontally" onClick={() => align("x")}>
          <AlignHorizontalJustifyCenter />
        </ToolButton>
        <ToolButton label="Centre vertically" onClick={() => align("y")}>
          <AlignVerticalJustifyCenter />
        </ToolButton>
        <ToolButton label="Bring forward" onClick={() => arrange("up")}>
          <ArrowUpToLine />
        </ToolButton>
        <ToolButton label="Send backward" onClick={() => arrange("down")}>
          <ArrowDownToLine />
        </ToolButton>
        <ToolButton label="Bring to front" onClick={() => arrange("front")}>
          <BringToFront />
        </ToolButton>
        <ToolButton label="Send to back" onClick={() => arrange("back")}>
          <SendToBack />
        </ToolButton>
        <Divider />
        {selectedLayers.length > 1 ? (
          <ToolButton label="Group" onClick={() => apply([{ op: "group", pageId: page.id, layerIds: ids, groupId: newId("g") }])}>
            <Group />
          </ToolButton>
        ) : null}
        {one?.type === "group" ? (
          <ToolButton label="Ungroup" onClick={() => apply([{ op: "ungroup", pageId: page.id, groupId: one.id }], one.children.map((c) => c.id))}>
            <Ungroup />
          </ToolButton>
        ) : null}
        <ToolButton label={allLocked ? "Unlock" : "Lock"} active={allLocked} onClick={() => updateSelected({ locked: !allLocked })}>
          {allLocked ? <Lock /> : <Unlock />}
        </ToolButton>
        <ToolButton label="Duplicate (⌘D)" onClick={duplicate}>
          <Copy />
        </ToolButton>
        <ToolButton label="Delete (Delete key)" onClick={remove} className="hover:bg-red-100 hover:text-red-800">
          <Trash2 />
        </ToolButton>
      </div>
      {state.selected.length > 1 ? <span className="w-full text-xs text-ink-3">{state.selected.length} layers selected</span> : null}
    </div>
  );
}

function TextControls({ layer, editor }: { layer: TextLayer; editor: Editor }) {
  const { doc, updateSelected } = editor;
  const family = layer.fontFamily === "brand:heading" ? doc.brand.fonts.heading : layer.fontFamily === "brand:body" ? doc.brand.fonts.body : layer.fontFamily;
  const font = DESIGN_FONTS.find((f) => f.family === family);
  const set = (p: Partial<TextLayer>) => updateSelected(p as Partial<Layer>);
  return (
    <>
      <SelectField
        label="Font"
        value={layer.fontFamily}
        className="w-44"
        onChange={(fontFamily) => set({ fontFamily, fontWeight: nearestWeight(fontFamily.startsWith("brand:") ? family : fontFamily, layer.fontWeight) })}
        options={[
          { value: "brand:heading", label: `Brand heading (${doc.brand.fonts.heading})` },
          { value: "brand:body", label: `Brand body (${doc.brand.fonts.body})` },
          ...DESIGN_FONTS.map((f) => ({ value: f.family, label: f.family, style: { fontFamily: f.family } })),
        ]}
      />
      <SelectField label="Weight" value={nearestWeight(family, layer.fontWeight)} className="w-32" onChange={(fontWeight) => set({ fontWeight })} options={(font?.weights ?? [400, 700]).map((w) => ({ value: w, label: WEIGHT_NAMES[w] ?? String(w) }))} />
      <NumberField label="Font size" value={layer.fontSize} min={6} max={600} onChange={(fontSize) => set({ fontSize })} />
      <ColorControl label="Text colour" value={layer.color} brand={doc.brand} onChange={(color) => set({ color })} />
      <Divider />
      <ToolButton label="Bold" active={layer.fontWeight >= 700} onClick={() => set({ fontWeight: nearestWeight(family, layer.fontWeight >= 700 ? 400 : 700) })}>
        <Bold />
      </ToolButton>
      <ToolButton label="Italic" active={layer.fontStyle === "italic"} onClick={() => set({ fontStyle: layer.fontStyle === "italic" ? "normal" : "italic" })}>
        <Italic />
      </ToolButton>
      <ToolButton label="Underline" active={layer.underline} onClick={() => set({ underline: !layer.underline })}>
        <Underline />
      </ToolButton>
      <ToolButton label="Uppercase" active={layer.transform === "uppercase"} onClick={() => set({ transform: layer.transform === "uppercase" ? "none" : "uppercase" })}>
        <CaseUpper />
      </ToolButton>
      <Divider />
      <ToolButton label="Align left" active={layer.align === "left"} onClick={() => set({ align: "left" })}>
        <AlignLeft />
      </ToolButton>
      <ToolButton label="Align centre" active={layer.align === "center"} onClick={() => set({ align: "center" })}>
        <AlignCenter />
      </ToolButton>
      <ToolButton label="Align right" active={layer.align === "right"} onClick={() => set({ align: "right" })}>
        <AlignRight />
      </ToolButton>
      <SelectField
        label="Vertical position"
        value={layer.verticalAlign}
        onChange={(verticalAlign) => set({ verticalAlign })}
        options={[
          { value: "top", label: "Top" },
          { value: "middle", label: "Middle" },
          { value: "bottom", label: "Bottom" },
        ]}
      />
      <NumberField label="Line height" value={layer.lineHeight} min={0.6} max={3} step={0.05} width="w-16" onChange={(lineHeight) => set({ lineHeight })} />
      <NumberField label="Letter spacing" value={layer.letterSpacing} min={-10} max={40} step={0.5} width="w-14" onChange={(letterSpacing) => set({ letterSpacing })} />
      <ToolButton label="Shrink to fit the box" active={layer.autoFit} onClick={() => set({ autoFit: !layer.autoFit })}>
        Fit
      </ToolButton>
      <ToolButton label="Highlight background" active={Boolean(layer.background)} onClick={() => set({ background: layer.background ? undefined : { color: "brand:accent", padding: Math.round(layer.fontSize * 0.35), radius: Math.round(layer.fontSize * 0.3) } })}>
        Pill
      </ToolButton>
      {layer.background ? <ColorControl label="Highlight colour" value={layer.background.color} brand={doc.brand} onChange={(color) => set({ background: { ...layer.background!, color } })} /> : null}
    </>
  );
}

function ImageControls({ layer, editor, showAdjust, setShowAdjust }: { layer: ImageLayer; editor: Editor; showAdjust: boolean; setShowAdjust: (v: boolean) => void }) {
  const { updateSelected } = editor;
  const set = (p: Partial<ImageLayer>) => updateSelected(p as Partial<Layer>);
  const zoom = 1 / layer.crop.width;
  const setZoom = (z: number) => {
    const w = Math.min(1, 1 / z);
    const h = Math.min(1, (layer.crop.height / layer.crop.width) * w);
    const cx = layer.crop.x + layer.crop.width / 2;
    const cy = layer.crop.y + layer.crop.height / 2;
    set({ crop: { width: w, height: h, x: Math.max(0, Math.min(1 - w, cx - w / 2)), y: Math.max(0, Math.min(1 - h, cy - h / 2)) } });
  };
  const f = layer.filters ?? {};
  return (
    <>
      <SelectField
        label="Fit"
        value={layer.fit}
        onChange={(fit) => set({ fit })}
        options={[
          { value: "cover", label: "Fill the frame" },
          { value: "contain", label: "Show whole image" },
        ]}
      />
      <SelectField
        label="Shape"
        value={layer.mask ?? "none"}
        onChange={(mask) => set({ mask })}
        options={[
          { value: "none", label: "Rectangle" },
          { value: "rounded", label: "Rounded" },
          { value: "circle", label: "Circle" },
          { value: "blob", label: "Soft blob" },
        ]}
      />
      {layer.mask === "rounded" || layer.mask === "none" || !layer.mask ? <NumberField label="Corner radius" value={layer.radius} min={0} max={500} onChange={(radius) => set({ radius })} /> : null}
      <ToolButton label="Flip horizontally" active={layer.flipX} onClick={() => set({ flipX: !layer.flipX })}>
        <FlipHorizontal2 />
      </ToolButton>
      <ToolButton label="Crop and adjust" active={showAdjust} onClick={() => setShowAdjust(!showAdjust)}>
        Adjust
      </ToolButton>
      {showAdjust ? (
        <div className="grid w-full max-w-xl grid-cols-1 gap-x-4 gap-y-1 rounded-xl border border-line bg-surface p-3 sm:grid-cols-2">
          <Slider label="Zoom" value={zoom} min={1} max={4} onChange={setZoom} />
          <Slider label="Left / right" value={layer.crop.x} min={0} max={Math.max(0, 1 - layer.crop.width)} onChange={(x) => set({ crop: { ...layer.crop, x } })} />
          <Slider label="Up / down" value={layer.crop.y} min={0} max={Math.max(0, 1 - layer.crop.height)} onChange={(y) => set({ crop: { ...layer.crop, y } })} />
          <Slider label="Brightness" value={f.brightness ?? 1} min={0.3} max={1.7} onChange={(brightness) => set({ filters: { ...f, brightness } })} />
          <Slider label="Contrast" value={f.contrast ?? 1} min={0.3} max={1.7} onChange={(contrast) => set({ filters: { ...f, contrast } })} />
          <Slider label="Saturation" value={f.saturation ?? 1} min={0} max={2} onChange={(saturation) => set({ filters: { ...f, saturation } })} />
          <Checkbox checked={Boolean(f.grayscale)} onCheckedChange={(v) => set({ filters: { ...f, grayscale: v === true } })} label="Black and white" />
        </div>
      ) : null}
    </>
  );
}

function ShapeControls({ layer, editor }: { layer: ShapeLayer; editor: Editor }) {
  const { doc, updateSelected } = editor;
  const set = (p: Partial<ShapeLayer>) => updateSelected(p as Partial<Layer>);
  return (
    <>
      <span className="text-ui font-medium text-ink-2">Fill</span>
      <ColorControl label="Fill colour" value={layer.fill.kind === "solid" ? layer.fill.color : "#ffffff"} brand={doc.brand} onChange={(color) => set({ fill: { kind: "solid", color } })} />
      <span className="ml-2 text-ui font-medium text-ink-2">Border</span>
      <ColorControl label="Border colour" value={layer.stroke?.color ?? "#101828"} brand={doc.brand} onChange={(color) => set({ stroke: { width: layer.stroke?.width ?? 4, color } })} />
      <NumberField label="Border width" value={layer.stroke?.width ?? 0} min={0} max={80} onChange={(width) => set({ stroke: width ? { width, color: layer.stroke?.color ?? "#101828" } : undefined })} />
      {layer.shape === "rect" ? <NumberField label="Corner radius" value={layer.radius} min={0} max={1000} onChange={(radius) => set({ radius })} /> : null}
    </>
  );
}
