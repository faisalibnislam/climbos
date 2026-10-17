"use client";

import { useCallback, useMemo, useReducer } from "react";
import { applyOps, commit, createHistory, findLayer, newId, redo, translateLayer, undo, type DesignOp, type History } from "@shared/design/ops";
import type { DesignDoc, Layer, Page } from "@shared/design/types";

/**
 * Editor state: undo/redo history of design documents, the current page and
 * selection, and a live "draft" document used while dragging so a move or
 * resize becomes one undo step when the pointer is released.
 */

export interface EditorState {
  history: History;
  /** While dragging/resizing: the live document. Committed on pointer up. */
  draft: DesignDoc | null;
  pageId: string;
  selected: string[];
  editingTextId: string | null;
  clipboard: Layer[];
  zoom: number; // 0 = fit
}

type Action =
  | { type: "apply"; ops: DesignOp[]; select?: string[] }
  | { type: "preview"; doc: DesignDoc }
  | { type: "commitDraft" }
  | { type: "cancelDraft" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "select"; ids: string[] }
  | { type: "page"; pageId: string }
  | { type: "editText"; id: string | null }
  | { type: "copy" }
  | { type: "paste" }
  | { type: "zoom"; zoom: number }
  | { type: "replace"; doc: DesignDoc };

function reducer(s: EditorState, a: Action): EditorState {
  switch (a.type) {
    case "apply": {
      try {
        const next = applyOps(s.history.present, a.ops);
        const pageStillThere = next.pages.some((p) => p.id === s.pageId);
        return {
          ...s,
          history: commit(s.history, next),
          draft: null,
          pageId: pageStillThere ? s.pageId : next.pages[0].id,
          selected: a.select ?? s.selected.filter((id) => next.pages.some((p) => findLayer(p.layers, id))),
        };
      } catch (e) {
        console.warn("Design op rejected:", (e as Error).message);
        return s;
      }
    }
    case "preview":
      return { ...s, draft: a.doc };
    case "commitDraft":
      return s.draft ? { ...s, history: commit(s.history, s.draft), draft: null } : s;
    case "cancelDraft":
      return { ...s, draft: null };
    case "undo": {
      const h = undo(s.history);
      return { ...s, history: h, draft: null, editingTextId: null, pageId: h.present.pages.some((p) => p.id === s.pageId) ? s.pageId : h.present.pages[0].id };
    }
    case "redo": {
      const h = redo(s.history);
      return { ...s, history: h, draft: null, editingTextId: null, pageId: h.present.pages.some((p) => p.id === s.pageId) ? s.pageId : h.present.pages[0].id };
    }
    case "select":
      return { ...s, selected: a.ids, editingTextId: a.ids.includes(s.editingTextId ?? "") ? s.editingTextId : null };
    case "page":
      return { ...s, pageId: a.pageId, selected: [], editingTextId: null };
    case "editText":
      return { ...s, editingTextId: a.id, selected: a.id ? [a.id] : s.selected };
    case "copy": {
      const page = s.history.present.pages.find((p) => p.id === s.pageId);
      const layers = s.selected.map((id) => (page ? findLayer(page.layers, id) : undefined)).filter((l): l is Layer => Boolean(l));
      return layers.length ? { ...s, clipboard: layers } : s;
    }
    case "paste": {
      if (!s.clipboard.length) return s;
      const copies = s.clipboard.map((l) => withNewIds(translateLayer(l, 24, 24)));
      return reducer({ ...s, clipboard: copies }, { type: "apply", ops: copies.map((layer) => ({ op: "add_layer", pageId: s.pageId, layer })), select: copies.map((c) => c.id) });
    }
    case "zoom":
      return { ...s, zoom: a.zoom };
    case "replace":
      return { ...s, history: commit(s.history, a.doc), draft: null, pageId: a.doc.pages.some((p) => p.id === s.pageId) ? s.pageId : a.doc.pages[0].id };
  }
}

export function withNewIds(l: Layer): Layer {
  if (l.type === "group") return { ...l, id: newId(), children: l.children.map(withNewIds) };
  return { ...l, id: newId() };
}

export function duplicatePage(p: Page): Page {
  return { ...p, id: newId("p"), layers: p.layers.map(withNewIds) };
}

export function useEditor(initial: DesignDoc) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    history: createHistory(initial),
    draft: null,
    pageId: initial.pages[0].id,
    selected: [],
    editingTextId: null,
    clipboard: [],
    zoom: 0,
  }));
  const doc = state.draft ?? state.history.present;
  const page = doc.pages.find((p) => p.id === state.pageId) ?? doc.pages[0];
  const selectedLayers = useMemo(() => state.selected.map((id) => findLayer(page.layers, id)).filter((l): l is Layer => Boolean(l)), [page, state.selected]);

  const apply = useCallback((ops: DesignOp[], select?: string[]) => dispatch({ type: "apply", ops, select }), []);
  const updateSelected = useCallback(
    (props: Partial<Layer>) => {
      if (!state.selected.length) return;
      dispatch({ type: "apply", ops: state.selected.map((layerId) => ({ op: "update_layer", pageId: page.id, layerId, props })) });
    },
    [state.selected, page.id],
  );

  return {
    state,
    dispatch,
    doc,
    committed: state.history.present,
    page,
    selectedLayers,
    apply,
    updateSelected,
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0,
  };
}

export type Editor = ReturnType<typeof useEditor>;
