"use client";

import { useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { Bold, Heading, Italic, Link2, List, Redo2, Underline, Undo2 } from "@/components/icons";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CopyButton, matchesShortcut } from "../actions";

/* ------------------------------------------------------------------ */
/* Shared: toolbar with roving focus                                   */
/* ------------------------------------------------------------------ */

export interface ToolbarItem {
  id: string;
  label: string;
  icon: ReactNode;
  /** Shown in the tooltip-style title, e.g. "⌘B". */
  hint?: string;
  pressed?: boolean;
  onRun: () => void;
  /** Draw a divider before this item. */
  divider?: boolean;
}

/** Formatting toolbar (role="toolbar"): one Tab stop, ←/→ move between buttons. */
export function EditorToolbar({ label, items, controls, className }: { label: string; items: ToolbarItem[]; controls?: string; className?: string }) {
  const [focusIdx, setFocusIdx] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = items.length;
    const map: Record<string, number> = { ArrowRight: focusIdx + 1, ArrowLeft: focusIdx - 1, Home: 0, End: n - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    const i = (map[e.key] + n) % n;
    setFocusIdx(i);
    refs.current[i]?.focus();
  };
  return (
    <div role="toolbar" aria-label={label} aria-controls={controls} onKeyDown={onKey} className={cn("flex flex-wrap items-center gap-0.5 border-b border-line bg-surface-2/60 px-1.5 py-1", className)}>
      {items.map((it, i) => (
        <span key={it.id} className="contents">
          {it.divider ? <span aria-hidden="true" className="mx-1 h-4 w-px bg-line-strong" /> : null}
          <button
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            tabIndex={i === focusIdx ? 0 : -1}
            aria-label={it.label}
            aria-pressed={it.pressed}
            title={it.hint ? `${it.label} (${it.hint})` : it.label}
            onMouseDown={(e) => e.preventDefault()}
            onFocus={() => setFocusIdx(i)}
            onClick={it.onRun}
            className={cn(
              "grid h-7 min-w-7 place-items-center rounded-[var(--radius-control)] px-1 text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink [&_svg]:size-4",
              it.pressed && "bg-ink text-white hover:bg-ink hover:text-white",
            )}
          >
            {it.icon}
          </button>
        </span>
      ))}
    </div>
  );
}

const editorShell =
  "overflow-hidden rounded-[var(--radius-field)] border border-control bg-surface transition-colors hover:border-control-hover focus-within:border-brand-700";

/* ------------------------------------------------------------------ */
/* Rich text                                                           */
/* ------------------------------------------------------------------ */

const ALLOWED = new Set(["P", "BR", "B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "A", "H3", "BLOCKQUOTE", "DIV"]);
const DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "NOSCRIPT", "SVG", "MATH", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT"]);
const SAFE_URL = /^(https?:|mailto:)/i;

/**
 * Allow-list HTML sanitizer for the rich text editor (browser only). Keeps
 * basic formatting and http(s)/mailto links; drops every attribute but href.
 */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const root = document.createElement("div");
  const walk = (from: Node, to: Node) => {
    from.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        to.appendChild(document.createTextNode(child.textContent ?? ""));
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as Element;
      const tag = el.tagName.toUpperCase();
      if (DROP.has(tag)) return;
      if (!ALLOWED.has(tag)) return walk(el, to);
      const copy = document.createElement(tag === "DIV" ? "p" : tag.toLowerCase());
      if (tag === "A") {
        const href = (el.getAttribute("href") ?? "").trim();
        if (!SAFE_URL.test(href)) return walk(el, to);
        copy.setAttribute("href", href);
        copy.setAttribute("rel", "noopener noreferrer nofollow");
        copy.setAttribute("target", "_blank");
      }
      walk(el, copy);
      to.appendChild(copy);
    });
  };
  walk(doc.body, root);
  return root.innerHTML;
}

export interface RichTextEditorProps {
  /** Initial HTML. It is sanitized before it is shown. */
  defaultValue?: string;
  /** Sanitized HTML after every change. */
  onChange?: (html: string) => void;
  placeholder?: string;
  "aria-label": string;
  "aria-describedby"?: string;
  /** Minimum editing height in px (default 140). */
  minHeight?: number;
  className?: string;
}

type Marks = { bold: boolean; italic: boolean; underline: boolean; list: boolean; heading: boolean };
const NO_MARKS: Marks = { bold: false, italic: false, underline: false, list: false, heading: false };

/**
 * Lightweight rich text (contentEditable + execCommand): bold, italic,
 * underline, heading, bullets, links, undo/redo. Paste is sanitized.
 */
export function RichTextEditor({ defaultValue = "", onChange, placeholder = "Write something…", minHeight = 140, className, "aria-label": ariaLabel, "aria-describedby": describedBy }: RichTextEditorProps) {
  const editorId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const saved = useRef<Range | null>(null);
  const [marks, setMarks] = useState<Marks>(NO_MARKS);
  const [empty, setEmpty] = useState(!defaultValue);
  const [words, setWords] = useState(0);
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("");

  const sync = () => {
    const el = ref.current;
    if (!el) return;
    const text = el.textContent ?? "";
    setEmpty(!text.trim() && !el.querySelector("li,h3"));
    setWords(text.trim() ? text.trim().split(/\s+/).length : 0);
    onChange?.(sanitizeHtml(el.innerHTML));
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = sanitizeHtml(defaultValue);
    const text = el.textContent ?? "";
    const id = requestAnimationFrame(() => {
      setWords(text.trim() ? text.trim().split(/\s+/).length : 0);
      setEmpty(!text.trim());
    });
    return () => cancelAnimationFrame(id);
    // Only on mount: the editor owns its content afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onSel = () => {
      const sel = document.getSelection();
      if (!sel?.anchorNode || !ref.current?.contains(sel.anchorNode)) return;
      setMarks({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        list: document.queryCommandState("insertUnorderedList"),
        heading: String(document.queryCommandValue("formatBlock")).toLowerCase() === "h3",
      });
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  const run = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    sync();
  };
  const openLink = () => {
    const sel = document.getSelection();
    saved.current = sel && sel.rangeCount && ref.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    setUrl("https://");
    setLinking(true);
  };
  const applyLink = () => {
    const href = url.trim();
    setLinking(false);
    ref.current?.focus();
    const sel = document.getSelection();
    if (saved.current && sel) {
      sel.removeAllRanges();
      sel.addRange(saved.current);
    }
    if (SAFE_URL.test(href) && href.length > 8) run(saved.current?.collapsed ? "insertHTML" : "createLink", saved.current?.collapsed ? sanitizeHtml(`<a href="${href.replace(/"/g, "%22")}">${href.replace(/</g, "&lt;")}</a>`) : href);
  };

  const items: ToolbarItem[] = [
    { id: "b", label: "Bold", hint: "⌘B", icon: <Bold />, pressed: marks.bold, onRun: () => run("bold") },
    { id: "i", label: "Italic", hint: "⌘I", icon: <Italic />, pressed: marks.italic, onRun: () => run("italic") },
    { id: "u", label: "Underline", hint: "⌘U", icon: <Underline />, pressed: marks.underline, onRun: () => run("underline") },
    { id: "h", label: "Heading", icon: <Heading />, pressed: marks.heading, divider: true, onRun: () => run("formatBlock", marks.heading ? "<p>" : "<h3>") },
    { id: "l", label: "Bulleted list", icon: <List />, pressed: marks.list, onRun: () => run("insertUnorderedList") },
    { id: "a", label: "Link", icon: <Link2 />, onRun: openLink },
    { id: "z", label: "Undo", hint: "⌘Z", icon: <Undo2 />, divider: true, onRun: () => run("undo") },
    { id: "y", label: "Redo", hint: "⇧⌘Z", icon: <Redo2 />, onRun: () => run("redo") },
  ];

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    if (html) document.execCommand("insertHTML", false, sanitizeHtml(html));
    else document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
    sync();
  };

  return (
    <div className={cn(editorShell, "has-[[contenteditable]:focus-visible]:outline-2 has-[[contenteditable]:focus-visible]:outline-[var(--focus-ring)]", className)}>
      <EditorToolbar label="Formatting" controls={editorId} items={items} />
      {linking ? (
        <form
          className="flex items-center gap-2 border-b border-line px-2 py-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <input
            autoFocus
            aria-label="Link address"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (e.preventDefault(), setLinking(false), ref.current?.focus())}
            className="h-7 min-w-0 flex-1 rounded-[var(--radius-control)] border border-control bg-surface px-2 text-ui"
          />
          <Button size="sm" type="submit" className="h-7">
            Add link
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setLinking(false)}>
            Cancel
          </Button>
        </form>
      ) : null}
      <div className="relative">
        <div
          ref={ref}
          id={editorId}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          contentEditable
          suppressContentEditableWarning
          data-empty={empty}
          data-placeholder={placeholder}
          onInput={sync}
          onPaste={onPaste}
          onFocus={() => document.execCommand("defaultParagraphSeparator", false, "p")}
          style={{ minHeight }}
          className={cn(
            "px-3 py-2.5 text-sm leading-6 text-ink focus-visible:outline-none!",
            "[&_a]:text-brand-800 [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:border-line-strong [&_blockquote]:pl-3 [&_blockquote]:text-ink-2",
            "[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5",
            "data-[empty=true]:before:pointer-events-none data-[empty=true]:before:absolute data-[empty=true]:before:text-ink-3 data-[empty=true]:before:content-[attr(data-placeholder)]",
          )}
        />
      </div>
      <div className="flex justify-end border-t border-line px-3 py-1 text-2xs tabular-nums text-ink-3">
        {words} {words === 1 ? "word" : "words"}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Markdown: tiny safe renderer (to React elements, never raw HTML)    */
/* ------------------------------------------------------------------ */

const SAFE_HREF = /^(https?:|mailto:|\/|#)/i;
const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const t = m[0];
    const k = `${key}.${i++}`;
    if (m[1]) out.push(<code key={k} className="rounded-[3px] bg-surface-2 px-1 py-0.5 font-mono text-xs">{t.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k} className="font-semibold">{inline(t.slice(2, -2), k)}</strong>);
    else if (m[3]) out.push(<em key={k}>{inline(t.slice(1, -1), k)}</em>);
    else {
      const [, label, href] = t.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/) ?? [];
      out.push(
        SAFE_HREF.test(href ?? "") ? (
          <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-800 underline underline-offset-2">
            {inline(label, k)}
          </a>
        ) : (
          <span key={k}>{label}</span>
        ),
      );
    }
    last = at + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BLOCK_START = /^(```|#{1,3}\s|>\s?|\s*[-*]\s+|\s*\d+\.\s+|(-{3,}|\*{3,})\s*$)/;

/** Markdown subset → React elements: headings, lists, quotes, code, links, bold, italic. */
export function renderMarkdown(src: string): ReactNode[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  const collect = (re: RegExp) => {
    const buf: string[] = [];
    while (i < lines.length && re.test(lines[i])) buf.push(lines[i++].replace(re, ""));
    return buf;
  };
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${k++}`;
    if (!line.trim()) {
      i++;
    } else if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key} className="relative overflow-x-auto rounded-[var(--radius-control)] bg-surface-2 p-3 font-mono text-xs leading-5">
          <code>{buf.join("\n")}</code>
        </pre>,
      );
    } else if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^#+/)![0].length;
      const content = inline(line.replace(/^#+\s+/, ""), key);
      i++;
      if (level === 1) blocks.push(<h3 key={key} className="text-lg font-semibold">{content}</h3>);
      else if (level === 2) blocks.push(<h4 key={key} className="text-base font-semibold">{content}</h4>);
      else blocks.push(<h5 key={key} className="text-sm font-semibold">{content}</h5>);
    } else if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      i++;
      blocks.push(<hr key={key} className="border-line" />);
    } else if (/^>\s?/.test(line)) {
      blocks.push(
        <blockquote key={key} className="border-l-2 border-line-strong pl-3 text-ink-2">
          {inline(collect(/^>\s?/).join(" "), key)}
        </blockquote>,
      );
    } else if (/^\s*[-*]\s+/.test(line)) {
      blocks.push(
        <ul key={key} className="list-disc pl-5">
          {collect(/^\s*[-*]\s+/).map((t, j) => (
            <li key={j}>{inline(t, `${key}.${j}`)}</li>
          ))}
        </ul>,
      );
    } else if (/^\s*\d+\.\s+/.test(line)) {
      blocks.push(
        <ol key={key} className="list-decimal pl-5">
          {collect(/^\s*\d+\.\s+/).map((t, j) => (
            <li key={j}>{inline(t, `${key}.${j}`)}</li>
          ))}
        </ol>,
      );
    } else {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim() && !(buf.length && BLOCK_START.test(lines[i]))) buf.push(lines[i++]);
      blocks.push(<p key={key}>{inline(buf.join(" "), key)}</p>);
    }
  }
  return blocks;
}

/** Rendered markdown with body styles. */
export function MarkdownPreview({ source, className }: { source: string; className?: string }) {
  const blocks = renderMarkdown(source);
  return <div className={cn("flex flex-col gap-2 text-sm leading-6 text-ink", className)}>{blocks.length ? blocks : <p className="text-ink-3">Nothing to preview yet.</p>}</div>;
}

export interface MarkdownEditorProps {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  "aria-label": string;
  "aria-describedby"?: string;
  className?: string;
}

/** Write / Preview markdown with a small toolbar and ⌘B, ⌘I, ⌘K. */
export function MarkdownEditor({ value, onValueChange, placeholder = "Write in markdown…", rows = 8, className, "aria-label": ariaLabel, "aria-describedby": describedBy }: MarkdownEditorProps) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const taId = useId();
  const [tab, setTab] = useState("write");

  const select = (s: number, e: number) =>
    requestAnimationFrame(() => {
      ta.current?.focus();
      ta.current?.setSelectionRange(s, e);
    });
  const wrap = (before: string, after: string, fallback: string) => {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || fallback;
    onValueChange(value.slice(0, s) + before + sel + after + value.slice(e));
    select(s + before.length, s + before.length + sel.length);
  };
  const prefix = (p: string) => {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const start = value.lastIndexOf("\n", s - 1) + 1;
    const block = value.slice(start, e);
    const next = block
      .split("\n")
      .map((l) => (l.startsWith(p) ? l.slice(p.length) : p + l))
      .join("\n");
    onValueChange(value.slice(0, start) + next + value.slice(e));
    select(start, start + next.length);
  };
  const items: ToolbarItem[] = [
    { id: "b", label: "Bold", hint: "⌘B", icon: <Bold />, onRun: () => wrap("**", "**", "bold text") },
    { id: "i", label: "Italic", hint: "⌘I", icon: <Italic />, onRun: () => wrap("_", "_", "italic text") },
    { id: "h", label: "Heading", icon: <Heading />, onRun: () => prefix("## ") },
    { id: "l", label: "Bulleted list", icon: <List />, onRun: () => prefix("- ") },
    { id: "a", label: "Link", hint: "⌘K", icon: <Link2 />, onRun: () => wrap("[", "](https://)", "link text") },
    { id: "c", label: "Code", icon: <span className="font-mono text-xs font-semibold">{"<>"}</span>, onRun: () => wrap("`", "`", "code") },
  ];

  return (
    <Tabs value={tab} onValueChange={setTab} className={cn(editorShell, "has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-[var(--focus-ring)]", className)}>
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-line bg-surface-2/60 pr-1.5">
        <TabsList className="m-1">
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        {tab === "write" ? <EditorToolbar label="Markdown formatting" controls={taId} items={items} className="border-b-0 bg-transparent px-0" /> : null}
      </div>
      <TabsContent value="write" className="mt-0">
        <textarea
          ref={ta}
          id={taId}
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (matchesShortcut(e, ["mod", "B"])) {
              e.preventDefault();
              wrap("**", "**", "bold text");
            } else if (matchesShortcut(e, ["mod", "I"])) {
              e.preventDefault();
              wrap("_", "_", "italic text");
            } else if (matchesShortcut(e, ["mod", "K"])) {
              e.preventDefault();
              wrap("[", "](https://)", "link text");
            }
          }}
          className="block w-full resize-y bg-transparent px-3 py-2.5 font-mono text-ui leading-6 text-ink placeholder:text-ink-3 focus-visible:outline-none!"
        />
      </TabsContent>
      <TabsContent value="preview" className="mt-0 px-3 py-2.5" style={{ minHeight: rows * 24 + 20 }}>
        <MarkdownPreview source={value} />
      </TabsContent>
    </Tabs>
  );
}

/* ------------------------------------------------------------------ */
/* Code editor                                                         */
/* ------------------------------------------------------------------ */

export interface CodeEditorProps {
  value: string;
  onValueChange?: (v: string) => void;
  /** Label in the header, e.g. "JSON", "HTML". */
  language?: string;
  "aria-label": string;
  "aria-describedby"?: string;
  /** Visible lines before scrolling (default 10). */
  rows?: number;
  readOnly?: boolean;
  className?: string;
}

/**
 * Plain code editor: monospace textarea with line numbers. Tab indents,
 * Shift+Tab outdents, Enter keeps indentation. Press Esc then Tab to leave.
 */
export function CodeEditor({ value, onValueChange, language = "Text", rows = 10, readOnly, className, "aria-label": ariaLabel, "aria-describedby": describedBy }: CodeEditorProps) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const escaped = useRef(false);
  const hintId = useId();
  const [pos, setPos] = useState({ line: 1, col: 1 });
  const lines = value.split("\n");

  const track = () => {
    const el = ta.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    const ls = before.split("\n");
    setPos({ line: ls.length, col: ls[ls.length - 1].length + 1 });
  };
  const apply = (next: string, s: number, e: number) => {
    onValueChange?.(next);
    requestAnimationFrame(() => {
      ta.current?.setSelectionRange(s, e);
      track();
    });
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: end } = el;
    if (e.key === "Escape") {
      escaped.current = true;
      return;
    }
    if (e.key === "Tab") {
      if (escaped.current) {
        escaped.current = false;
        return;
      }
      e.preventDefault();
      const start = value.lastIndexOf("\n", s - 1) + 1;
      if (s === end && !e.shiftKey) return apply(value.slice(0, s) + "  " + value.slice(end), s + 2, s + 2);
      const block = value.slice(start, end);
      const next = block
        .split("\n")
        .map((l) => (e.shiftKey ? l.replace(/^ {1,2}/, "") : "  " + l))
        .join("\n");
      return apply(value.slice(0, start) + next + value.slice(end), s === end ? Math.max(start, s + (next.length - block.length)) : start, start + next.length);
    }
    escaped.current = false;
    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const start = value.lastIndexOf("\n", s - 1) + 1;
      const indent = value.slice(start, s).match(/^\s*/)![0];
      const extra = /[{[(]\s*$/.test(value.slice(start, s)) ? "  " : "";
      const ins = `\n${indent}${extra}`;
      apply(value.slice(0, s) + ins + value.slice(end), s + ins.length, s + ins.length);
    }
  };

  return (
    <div className={cn(editorShell, "has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-[var(--focus-ring)]", className)}>
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 py-1 pl-3 pr-1">
        <span className="text-overline">{language}</span>
        <span className="ml-auto text-2xs tabular-nums text-ink-3" aria-live="off">
          Ln {pos.line}, Col {pos.col}
        </span>
        <CopyButton value={value} iconOnly label="Copy code" variant="ghost" size="sm" className="h-7 w-7" />
      </div>
      <div className="flex" style={{ height: rows * 20 + 20 }}>
        <div ref={gutter} aria-hidden="true" className="select-none overflow-hidden border-r border-line bg-surface-2/40 py-2.5 pl-3 pr-2 text-right font-mono text-xs leading-5 tabular-nums text-ink-3">
          {lines.map((_, i) => (
            <div key={i} className={cn(i + 1 === pos.line && "font-semibold text-ink")}>
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={ta}
          aria-label={ariaLabel}
          aria-describedby={cn(describedBy, hintId)}
          readOnly={readOnly}
          value={value}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => onValueChange?.(e.target.value)}
          onKeyDown={onKey}
          onSelect={track}
          onScroll={(e) => {
            if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
          }}
          className="min-w-0 flex-1 resize-none overflow-auto whitespace-pre bg-transparent px-3 py-2.5 font-mono text-xs leading-5 text-ink [tab-size:2] focus-visible:outline-none!"
        />
      </div>
      <p id={hintId} className="sr-only">
        Tab indents. Press Escape then Tab to move focus out of the editor.
      </p>
    </div>
  );
}
