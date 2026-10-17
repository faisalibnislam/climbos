"use client";

import { ArrowLeft, Copy, Download, Maximize2, Minus, Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { newId } from "@shared/design/ops";
import type { DesignDoc } from "@shared/design/types";
import { cn } from "@/lib/utils";
import "../design-fonts.css";
import { DesignThumbnail, type AssetResolver } from "../DesignRenderer";
import { EditorCanvas } from "./Canvas";
import { PanelBody, PANELS, type PanelKey, type UploadedAsset } from "./Panels";
import { Toolbar } from "./Toolbar";
import { duplicatePage, useEditor, withNewIds } from "./useEditor";

/**
 * ClimbOS's own design editor (no third-party editor SDK): panels on the left,
 * contextual toolbar on top, the canvas in the middle and pages along the
 * bottom. Every change is a typed design operation with undo/redo.
 */
export function DesignEditor({
  initial,
  title,
  backHref,
  onSave,
  onExport,
}: {
  initial: DesignDoc;
  title: string;
  backHref: string;
  onSave?: (doc: DesignDoc) => Promise<void> | void;
  onExport?: (doc: DesignDoc, pageIndex: number) => Promise<void> | void;
}) {
  const editor = useEditor(initial);
  const { doc, committed, page, state, dispatch, apply, canUndo, canRedo } = editor;
  const [panel, setPanel] = useState<PanelKey | null>("templates");
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [savedDoc, setSavedDoc] = useState(initial);
  const resolve: AssetResolver = useCallback((src) => (/^(https?:|data:|blob:|\/)/.test(src) ? src : undefined), []);

  // Autosave a moment after the last committed change.
  useEffect(() => {
    if (!onSave || committed === savedDoc) return;
    const t = setTimeout(async () => {
      await onSave(committed);
      setSavedDoc(committed);
    }, 1200);
    return () => clearTimeout(t);
  }, [committed, savedDoc, onSave]);
  const saveStatus = !onSave ? "" : committed !== savedDoc ? "Saving…" : savedDoc !== initial ? "All changes saved" : "";

  // Keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true]")) return;
      const mod = e.metaKey || e.ctrlKey;
      const ids = state.selected;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      } else if (mod && e.key.toLowerCase() === "c") {
        dispatch({ type: "copy" });
      } else if (mod && e.key.toLowerCase() === "v") {
        dispatch({ type: "paste" });
      } else if (mod && e.key.toLowerCase() === "d" && ids.length) {
        e.preventDefault();
        const copies = editor.selectedLayers.map((l) => withNewIds({ ...l, x: l.x + 24, y: l.y + 24 }));
        apply(copies.map((layer) => ({ op: "add_layer", pageId: page.id, layer })), copies.map((c) => c.id));
      } else if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        dispatch({ type: "select", ids: page.layers.filter((l) => !l.locked && !l.hidden).map((l) => l.id) });
      } else if ((e.key === "Delete" || e.key === "Backspace") && ids.length) {
        e.preventDefault();
        apply(ids.map((layerId) => ({ op: "remove_layer", pageId: page.id, layerId })), []);
      } else if (e.key === "Escape") {
        dispatch({ type: "select", ids: [] });
      } else if (e.key.startsWith("Arrow") && ids.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        apply(editor.selectedLayers.filter((l) => !l.locked).map((l) => ({ op: "update_layer", pageId: page.id, layerId: l.id, props: { x: l.x + dx, y: l.y + dy } })));
      } else if (e.key === "Enter" && editor.selectedLayers.length === 1 && editor.selectedLayers[0].type === "text") {
        e.preventDefault();
        dispatch({ type: "editText", id: editor.selectedLayers[0].id });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.selected, editor.selectedLayers, page, apply, dispatch]);

  const upload = (files: FileList) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result);
        const img = new Image();
        img.onload = () => setAssets((a) => [{ id: newId("a"), url, name: file.name, width: img.naturalWidth, height: img.naturalHeight }, ...a]);
        img.src = url;
      };
      reader.readAsDataURL(file);
    }
    setPanel("photos");
  };

  const pageIndex = doc.pages.findIndex((p) => p.id === page.id);
  const zoomPct = state.zoom ? Math.round(state.zoom * 100) : null;

  return (
    <div className="flex h-dvh flex-col bg-surface-2 text-ink">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <Link href={backHref} className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back
        </Link>
        <h1 className="ml-1 truncate font-sans text-base font-semibold tracking-normal">{title}</h1>
        <span className="text-xs text-ink-3" role="status">
          {saveStatus}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => dispatch({ type: "undo" })} disabled={!canUndo} title="Undo (⌘Z)" aria-label="Undo" className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-surface-2 disabled:opacity-30">
            <Undo2 className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => dispatch({ type: "redo" })} disabled={!canRedo} title="Redo (⇧⌘Z)" aria-label="Redo" className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-surface-2 disabled:opacity-30">
            <Redo2 className="size-4" aria-hidden="true" />
          </button>
          <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />
          <button type="button" onClick={() => dispatch({ type: "zoom", zoom: Math.max(0.1, (state.zoom || 0.5) - 0.1) })} title="Zoom out" aria-label="Zoom out" className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-surface-2">
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => dispatch({ type: "zoom", zoom: 0 })} title="Fit to screen" className="h-9 min-w-14 rounded-md px-2 text-xs font-medium text-ink-2 hover:bg-surface-2">
            {zoomPct ? `${zoomPct}%` : "Fit"}
          </button>
          <button type="button" onClick={() => dispatch({ type: "zoom", zoom: Math.min(3, (state.zoom || 0.5) + 0.1) })} title="Zoom in" aria-label="Zoom in" className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-surface-2">
            <Plus className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => dispatch({ type: "zoom", zoom: 0 })} title="Fit" aria-label="Fit to screen" className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-surface-2">
            <Maximize2 className="size-4" aria-hidden="true" />
          </button>
          {onExport ? (
            <button type="button" onClick={() => onExport(committed, pageIndex)} className="ml-2 inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-800 px-3.5 text-sm font-medium text-white hover:bg-brand-900">
              <Download className="size-4" aria-hidden="true" /> Download
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Panel rail */}
        <nav aria-label="Editor panels" className="flex w-[72px] shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-2">
          {PANELS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPanel(panel === p.key ? null : p.key)}
              aria-pressed={panel === p.key}
              className={cn("flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium", panel === p.key ? "bg-brand-50 text-brand-900" : "text-ink-3 hover:bg-surface-2 hover:text-ink")}
            >
              <p.icon className="size-5" aria-hidden="true" />
              {p.label}
            </button>
          ))}
        </nav>
        {panel ? (
          <aside className="w-[300px] shrink-0 overflow-y-auto border-r border-line bg-surface p-4" aria-label={`${panel} panel`}>
            <PanelBody panel={panel} editor={editor} resolve={resolve} assets={assets} onUpload={upload} />
          </aside>
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col" id="main">
          <div className="border-b border-line bg-surface">
            <Toolbar editor={editor} />
          </div>
          <div className="min-h-0 flex-1">
            <EditorCanvas editor={editor} resolve={resolve} />
          </div>
          {/* Pages strip */}
          <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-line bg-surface px-3 py-2" aria-label="Pages">
            {doc.pages.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => dispatch({ type: "page", pageId: p.id })}
                aria-current={p.id === page.id}
                aria-label={`Page ${i + 1}`}
                className={cn("relative shrink-0 overflow-hidden rounded-md border-2", p.id === page.id ? "border-brand-600" : "border-transparent hover:border-line-strong")}
              >
                <DesignThumbnail doc={doc} pageIndex={i} width={Math.round((56 * doc.width) / doc.height)} resolve={resolve} />
                <span className="absolute bottom-0.5 left-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">{i + 1}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const blank = { id: newId("p"), background: { kind: "solid" as const, color: "brand:light" }, layers: [] };
                apply([{ op: "add_page", page: blank, index: pageIndex + 1 }]);
                dispatch({ type: "page", pageId: blank.id });
              }}
              disabled={doc.pages.length >= 20}
              className="grid h-14 w-12 shrink-0 place-items-center rounded-md border border-dashed border-line-strong text-ink-3 hover:border-brand-600 hover:text-ink disabled:opacity-40"
              title="Add page"
              aria-label="Add page"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
            <span aria-hidden="true" className="mx-1 h-8 w-px bg-line" />
            <button type="button" title="Duplicate page" aria-label="Duplicate page" disabled={doc.pages.length >= 20} onClick={() => {
              const copy = duplicatePage(page);
              apply([{ op: "add_page", page: copy, index: pageIndex + 1 }]);
              dispatch({ type: "page", pageId: copy.id });
            }} className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-surface-2 disabled:opacity-30">
              <Copy className="size-4" aria-hidden="true" />
            </button>
            <button type="button" title="Delete page" aria-label="Delete page" disabled={doc.pages.length <= 1} onClick={() => apply([{ op: "remove_page", pageId: page.id }])} className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-red-100 hover:text-red-800 disabled:opacity-30">
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
            <span className="ml-auto text-xs text-ink-3">
              Page {pageIndex + 1} of {doc.pages.length} · {doc.width}×{doc.height}
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
