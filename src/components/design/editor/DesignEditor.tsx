"use client";

import { ArrowLeft, Copy, Download, Maximize2, Minus, Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { newId } from "@shared/design/ops";
import type { DesignDoc } from "@shared/design/types";
import { Button, IconButton, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";
import "../design-fonts.css";
import { DesignThumbnail, type AssetResolver } from "../DesignRenderer";
import { EditorCanvas } from "./Canvas";
import { Divider } from "./controls";
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
  onTitleChange,
  resolve: externalResolve,
  library,
  onUpload: externalUpload,
  headerActions,
  readOnly = false,
}: {
  initial: DesignDoc;
  title: string;
  backHref: string;
  onSave?: (doc: DesignDoc) => Promise<void> | void;
  onExport?: (doc: DesignDoc, pageIndex: number) => Promise<void> | void;
  onTitleChange?: (title: string) => void;
  /** Resolves "asset:<id>" references to URLs (the workspace asset library). */
  resolve?: AssetResolver;
  /** Photos and logos already in the workspace library. */
  library?: UploadedAsset[];
  /** Saves files to the workspace library and returns them; without it, uploads stay in this session only. */
  onUpload?: (files: File[], kind: "upload" | "logo") => Promise<UploadedAsset[]>;
  headerActions?: (ctx: { doc: DesignDoc; pageIndex: number }) => ReactNode;
  readOnly?: boolean;
}) {
  const editor = useEditor(initial);
  const { doc, committed, page, state, dispatch, apply, canUndo, canRedo } = editor;
  const [panel, setPanel] = useState<PanelKey | null>("templates");
  const [sessionAssets, setSessionAssets] = useState<UploadedAsset[]>([]);
  const [savedDoc, setSavedDoc] = useState(initial);
  const [saveError, setSaveError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState(title);
  const resolve: AssetResolver = useCallback((src) => externalResolve?.(src) ?? (/^(https?:|data:|blob:|\/)/.test(src) ? src : undefined), [externalResolve]);
  const assets = useMemo(() => [...sessionAssets, ...(library ?? []).filter((a) => !sessionAssets.some((s) => s.id === a.id))], [sessionAssets, library]);

  // Autosave a moment after the last committed change; failures retry on the next change and show.
  useEffect(() => {
    if (!onSave || readOnly || committed === savedDoc) return;
    const t = setTimeout(async () => {
      try {
        await onSave(committed);
        setSavedDoc(committed);
        setSaveError(false);
      } catch {
        setSaveError(true);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [committed, savedDoc, onSave, readOnly]);
  const unsaved = Boolean(onSave) && !readOnly && committed !== savedDoc;
  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  const saveStatus = !onSave || readOnly ? (readOnly ? "View only" : "") : saveError ? "Couldn't save. Retrying with your next change." : unsaved ? "Saving…" : savedDoc !== initial ? "All changes saved" : "Saved";

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

  const upload = async (files: FileList | File[], kind: "upload" | "logo" = "upload"): Promise<UploadedAsset[]> => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") && f.size <= 20 * 1024 * 1024);
    if (externalUpload) {
      setUploading(true);
      try {
        const saved = await externalUpload(list, kind);
        setSessionAssets((a) => [...saved, ...a]);
        if (kind === "upload") setPanel("photos");
        return saved;
      } finally {
        setUploading(false);
      }
    }
    for (const file of list) {
      if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result);
        const img = new Image();
        img.onload = () => setSessionAssets((a) => [{ id: newId("a"), url, name: file.name, width: img.naturalWidth, height: img.naturalHeight }, ...a]);
        img.src = url;
      };
      reader.readAsDataURL(file);
    }
    setPanel("photos");
    return [];
  };

  const pageIndex = doc.pages.findIndex((p) => p.id === page.id);
  const zoomPct = state.zoom ? Math.round(state.zoom * 100) : null;

  return (
    <div className="flex h-full min-h-[32rem] flex-col bg-surface-2 text-ink">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <Button asChild variant="ghost" size="sm" className="text-ink-2 hover:text-ink">
          <Link href={backHref}>
            <ArrowLeft aria-hidden="true" /> Back
          </Link>
        </Button>
        {onTitleChange && !readOnly ? (
          <input
            aria-label="Design name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const t = name.trim();
              if (t && t !== title) onTitleChange(t);
              else setName(title);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setName(title);
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="heading-section ml-1 min-w-0 max-w-xs truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 hover:border-line focus:border-brand-600 focus:outline-none"
          />
        ) : (
          <h1 className="heading-section ml-1 truncate">{title}</h1>
        )}
        <span className={cn("text-xs", saveError ? "text-red-800" : "text-ink-3")} role="status">
          {uploading ? "Uploading…" : saveStatus}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <IconButton size="sm" aria-label="Undo" tooltip="Undo (⌘Z)" icon={<Undo2 />} onClick={() => dispatch({ type: "undo" })} disabled={!canUndo} className="text-ink-2 hover:text-ink" />
          <IconButton size="sm" aria-label="Redo" tooltip="Redo (⇧⌘Z)" icon={<Redo2 />} onClick={() => dispatch({ type: "redo" })} disabled={!canRedo} className="text-ink-2 hover:text-ink" />
          <Divider />
          <IconButton size="sm" aria-label="Zoom out" icon={<Minus />} onClick={() => dispatch({ type: "zoom", zoom: Math.max(0.1, (state.zoom || 0.5) - 0.1) })} className="text-ink-2 hover:text-ink" />
          <Tooltip content="Fit to screen">
            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "zoom", zoom: 0 })} className="min-w-14 px-2 tabular-nums text-ink-2 hover:text-ink">
              {zoomPct ? `${zoomPct}%` : "Fit"}
            </Button>
          </Tooltip>
          <IconButton size="sm" aria-label="Zoom in" icon={<Plus />} onClick={() => dispatch({ type: "zoom", zoom: Math.min(3, (state.zoom || 0.5) + 0.1) })} className="text-ink-2 hover:text-ink" />
          <IconButton size="sm" aria-label="Fit to screen" icon={<Maximize2 />} onClick={() => dispatch({ type: "zoom", zoom: 0 })} className="text-ink-2 hover:text-ink" />
          {onExport ? (
            <Button size="sm" onClick={() => onExport(committed, pageIndex)} className="ml-2">
              <Download aria-hidden="true" /> Download
            </Button>
          ) : null}
          {headerActions ? <div className="ml-2 flex items-center gap-2">{headerActions({ doc: committed, pageIndex })}</div> : null}
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
              className={cn("flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-2xs font-medium transition-colors", panel === p.key ? "bg-brand-50 text-brand-900" : "text-ink-3 hover:bg-surface-2 hover:text-ink")}
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

        <section className="flex min-w-0 flex-1 flex-col" aria-label="Canvas">
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
                className={cn("relative shrink-0 overflow-hidden rounded-lg border-2 transition-colors", p.id === page.id ? "border-brand-600" : "border-transparent hover:border-line-strong")}
              >
                <DesignThumbnail doc={doc} pageIndex={i} width={Math.round((56 * doc.width) / doc.height)} resolve={resolve} />
                <span className="absolute bottom-1 left-1 rounded-sm bg-ink/70 px-1 text-2xs font-medium text-white">{i + 1}</span>
              </button>
            ))}
            <Tooltip content="Add page">
              <button
                type="button"
                onClick={() => {
                  const blank = { id: newId("p"), background: { kind: "solid" as const, color: "brand:light" }, layers: [] };
                  apply([{ op: "add_page", page: blank, index: pageIndex + 1 }]);
                  dispatch({ type: "page", pageId: blank.id });
                }}
                disabled={doc.pages.length >= 20}
                className="grid h-14 w-12 shrink-0 place-items-center rounded-lg border border-dashed border-line-strong text-ink-3 transition-colors hover:border-brand-600 hover:bg-surface-2 hover:text-ink disabled:opacity-55"
                aria-label="Add page"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </Tooltip>
            <Divider />
            <IconButton
              size="sm"
              aria-label="Duplicate page"
              icon={<Copy />}
              disabled={doc.pages.length >= 20}
              onClick={() => {
                const copy = duplicatePage(page);
                apply([{ op: "add_page", page: copy, index: pageIndex + 1 }]);
                dispatch({ type: "page", pageId: copy.id });
              }}
              className="text-ink-2 hover:text-ink"
            />
            <IconButton
              size="sm"
              aria-label="Delete page"
              icon={<Trash2 />}
              disabled={doc.pages.length <= 1}
              onClick={() => apply([{ op: "remove_page", pageId: page.id }])}
              className="text-ink-2 hover:bg-red-100 hover:text-red-800"
            />
            <span className="ml-auto text-xs text-ink-3">
              Page {pageIndex + 1} of {doc.pages.length} · {doc.width}×{doc.height}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
