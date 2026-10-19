"use client";

/*
 * Talking to ClimbOS: chat messages (with a streaming reveal), the prompt input
 * (attachments, model picker, send), the AI command bar and the assistant side panel.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUp, Check, Copy, FileText, ImageIcon, Paperclip, RefreshCw, Sparkle, Square, X } from "@/components/icons";
import { Button, IconButton, Kbd } from "@/components/ui";
import { cn } from "@/lib/utils";
import { AIModelSelector } from "./controls";
import { AIMark, Caret, CreditCost, MODELS, useTypewriter, type ModelTier } from "./shared";

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  model?: ModelTier;
  credits?: number;
  time?: string;
  /** Type the text out on mount (new replies). */
  stream?: boolean;
  attachments?: string[];
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <IconButton
      size="sm"
      aria-label={done ? "Copied" : "Copy reply"}
      icon={done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
    />
  );
}

export function AIMessage({ message, children, onRegenerate }: { message: ChatMessage; children?: ReactNode; onRegenerate?: () => void }) {
  const { shown, streaming, play, skip } = useTypewriter(message.text, { autoplay: message.stream });
  if (message.role === "user")
    return (
      <div className="flex flex-col items-end gap-1">
        {message.attachments?.length ? (
          <div className="flex flex-wrap justify-end gap-1">
            {message.attachments.map((a) => (
              <AttachmentChip key={a} name={a} />
            ))}
          </div>
        ) : null}
        <p className="max-w-[85%] rounded-[var(--radius-card)] bg-surface-2 px-3 py-2 text-sm text-ink">{message.text}</p>
      </div>
    );
  return (
    <div className="flex gap-2.5">
      <AIMark className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-voice !text-ink" aria-live={message.stream ? "polite" : undefined} aria-busy={streaming}>
          {shown}
          {streaming ? <Caret /> : null}
        </p>
        {!streaming && children ? <div className="mt-2">{children}</div> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-2xs text-ink-3">
          {message.model ? <span>{MODELS[message.model].name}</span> : null}
          {message.credits !== undefined ? <span>· {message.credits} {message.credits === 1 ? "credit" : "credits"}</span> : null}
          {message.time ? <span>· {message.time}</span> : null}
          <span className="ml-1 flex items-center">
            {streaming ? (
              <Button size="sm" variant="ghost" onClick={skip} className="h-6 px-1.5 text-2xs">
                Skip
              </Button>
            ) : (
              <>
                <CopyButton text={message.text} />
                {onRegenerate ? <IconButton size="sm" aria-label="Regenerate reply" icon={<RefreshCw className="size-3.5" />} onClick={onRegenerate} /> : null}
                <Button size="sm" variant="ghost" onClick={play} className="h-6 px-1.5 text-2xs">
                  Replay typing
                </Button>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Three dots shown before a reply starts. */
export function AIThinking({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5" role="status">
      <AIMark />
      <span className="flex items-center gap-1.5 text-ui text-ink-3">
        {label}
        <span aria-hidden className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1 animate-soft-pulse rounded-full bg-ink-3 motion-reduce:animate-none" style={{ animationDelay: `${i * 180}ms` }} />
          ))}
        </span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Prompt input                                                        */
/* ------------------------------------------------------------------ */

export function AttachmentChip({ name, onRemove }: { name: string; onRemove?: () => void }) {
  const isImage = /\.(png|jpe?g|webp|gif)$/i.test(name);
  return (
    <span className="inline-flex h-7 max-w-[14rem] items-center gap-1.5 rounded-[var(--radius-badge)] border border-line bg-surface pl-2 pr-1 text-xs text-ink-2">
      {isImage ? <ImageIcon aria-hidden className="size-3.5 shrink-0" /> : <FileText aria-hidden className="size-3.5 shrink-0" />}
      <span className="truncate">{name}</span>
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} className="grid size-5 place-items-center rounded-[3px] text-ink-3 hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:outline-none">
          <X className="size-3" aria-hidden />
        </button>
      ) : (
        <span className="w-1" />
      )}
    </span>
  );
}

export interface AIPromptInputProps {
  onSend: (text: string, attachments: string[], model: ModelTier) => void;
  busy?: boolean;
  onStop?: () => void;
  placeholder?: string;
  model?: ModelTier;
  onModelChange?: (m: ModelTier) => void;
  initialAttachments?: string[];
  canUseSol?: boolean;
  className?: string;
}

export function AIPromptInput({ onSend, busy, onStop, placeholder = "Ask ClimbOS to plan, draft or check something…", model: controlled, onModelChange, initialAttachments = [], canUseSol = true, className }: AIPromptInputProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<string[]>(initialAttachments);
  const [own, setOwn] = useState<ModelTier>("luna");
  const model = controlled ?? own;
  const setModel = onModelChange ?? setOwn;
  const fileRef = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const can = text.trim().length > 0 && !busy;
  const send = () => {
    if (!can) return;
    onSend(text.trim(), files, model);
    setText("");
    setFiles([]);
    if (area.current) area.current.style.height = "";
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };
  return (
    <div className={cn("flex flex-col gap-2 rounded-[var(--radius-card)] border border-line-strong bg-surface p-2 shadow-[var(--card-shadow)] transition-colors focus-within:border-ink focus-within:ring-1 focus-within:ring-ink", className)}>
      {files.length ? (
        <div className="flex flex-wrap gap-1.5 px-1 pt-1" aria-label="Attachments">
          {files.map((f) => (
            <AttachmentChip key={f} name={f} onRemove={() => setFiles(files.filter((x) => x !== f))} />
          ))}
        </div>
      ) : null}
      <label htmlFor={id} className="sr-only">
        Message ClimbOS
      </label>
      <textarea
        id={id}
        ref={area}
        rows={1}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
        }}
        onKeyDown={onKey}
        className="max-h-40 min-h-9 w-full resize-none bg-transparent px-2 py-1.5 text-sm text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none"
      />
      <div className="flex items-center gap-1">
        <input
          ref={fileRef}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const names = Array.from(e.target.files ?? []).map((f) => f.name);
            setFiles((prev) => Array.from(new Set([...prev, ...names])));
            e.target.value = "";
          }}
        />
        <IconButton size="sm" aria-label="Attach files" icon={<Paperclip className="size-4" />} onClick={() => fileRef.current?.click()} />
        <AIModelSelector variant="compact" value={model} onChange={setModel} canUseSol={canUseSol} />
        <span className="ml-auto hidden items-center gap-1 text-2xs text-ink-3 sm:flex">
          <CreditCost credits={MODELS[model].credits} prefix="~" />
        </span>
        {busy && onStop ? (
          <IconButton size="sm" variant="secondary" aria-label="Stop generating" icon={<Square className="size-3.5" />} onClick={onStop} className="ml-auto sm:ml-0" />
        ) : (
          <IconButton size="sm" variant="primary" aria-label="Send" icon={<ArrowUp className="size-4" />} disabled={!can} onClick={send} className="ml-auto sm:ml-0" />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chat interface                                                      */
/* ------------------------------------------------------------------ */

const REPLIES = [
  "Your Saturday posts get twice the saves of weekday ones. I’d move the class announcement to Saturday 9am and add a short reel of the starter. Want me to draft it?",
  "Three nearby cafés now list sourdough. Yours is the only one with classes, so I’d lead with that in ads. I can draft two versions to test.",
  "Done. I drafted the email to past class guests. It waits in Approvals until you send it.",
];

export function AIChat({ initial, className, height = "h-[360px]" }: { initial: ChatMessage[]; className?: string; height?: string }) {
  const [messages, setMessages] = useState(initial);
  const [thinking, setThinking] = useState(false);
  const [model, setModel] = useState<ModelTier>("luna");
  const [replies, setReplies] = useState(0);
  const timer = useRef<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const count = messages.length;
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const id = requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
    return () => cancelAnimationFrame(id);
  }, [count, thinking]);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  const reply = (m: ModelTier, n: number) => {
    setThinking(true);
    const text = REPLIES[replies % REPLIES.length];
    setReplies(replies + 1);
    timer.current = window.setTimeout(() => {
      setThinking(false);
      setMessages((prev) => [...prev, { id: `a${n}`, role: "assistant", text, model: m, credits: MODELS[m].credits, time: "now", stream: true }]);
    }, 700);
  };
  const send = (text: string, attachments: string[], m: ModelTier) => {
    const n = messages.length;
    setMessages([...messages, { id: `u${n}`, role: "user", text, attachments }]);
    reply(m, n);
  };
  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setThinking(false);
  };
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]", className)}>
      <div ref={scroller} className={cn("flex flex-col gap-5 overflow-y-auto p-[var(--card-p)]", height)} role="log" aria-label="Conversation">
        {messages.map((m, i) => (
          <AIMessage key={m.id} message={m} onRegenerate={m.role === "assistant" && i === messages.length - 1 ? () => reply(m.model ?? model, i + 1) : undefined} />
        ))}
        {thinking ? <AIThinking label={`${MODELS[model].name} is thinking`} /> : null}
      </div>
      <div className="border-t border-line bg-surface-2/50 p-2">
        <AIPromptInput onSend={send} busy={thinking} onStop={stop} model={model} onModelChange={setModel} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Command bar                                                         */
/* ------------------------------------------------------------------ */

export interface AICommand {
  id: string;
  label: string;
  hint: string;
  credits: number;
}

export function AICommandBar({ commands, onRun, className }: { commands: AICommand[]; onRun?: (c: AICommand, query: string) => void; className?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [ran, setRan] = useState<string | null>(null);
  const listId = useId();
  const s = q.trim().toLowerCase();
  const hits = s ? commands.filter((c) => c.label.toLowerCase().includes(s) || c.hint.toLowerCase().includes(s)) : commands;
  const askItem: AICommand | null = s && !hits.length ? { id: "ask", label: `Ask: “${q.trim()}”`, hint: "Free-form request", credits: 2 } : null;
  const list = askItem ? [askItem] : hits;
  const run = (c: AICommand) => {
    setRan(c.label);
    setOpen(false);
    setQ("");
    onRun?.(c, q);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % Math.max(1, list.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + list.length) % Math.max(1, list.length));
    } else if (e.key === "Enter" && list[active]) {
      e.preventDefault();
      run(list[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };
  return (
    <div className={cn("relative", className)}>
      <div className="flex h-[var(--h-lg)] items-center gap-2 rounded-[var(--radius-card)] border border-line-strong bg-surface px-3 shadow-[var(--card-shadow)] focus-within:border-ink">
        <Sparkle aria-hidden className="size-4 text-sage-ink" />
        <input
          role="combobox"
          aria-expanded={open && list.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && list[active] ? `${listId}-${list[active].id}` : undefined}
          aria-label="Ask ClimbOS or run a command"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKey}
          placeholder="Ask ClimbOS or type a command"
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
        />
        <Kbd>⌘J</Kbd>
      </div>
      {open && list.length ? (
        <ul id={listId} role="listbox" aria-label="Commands" className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-1 shadow-lg animate-fade-in motion-reduce:animate-none">
          {list.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${c.id}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                run(c);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex min-h-9 cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-1.5", i === active && "bg-surface-2")}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ui font-medium text-ink">{c.label}</span>
                <span className="block truncate text-2xs text-ink-3">{c.hint}</span>
              </span>
              <CreditCost credits={c.credits} prefix="~" />
              {i === active ? <Kbd aria-hidden>↵</Kbd> : <span className="w-5" />}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 min-h-4 text-xs text-ink-3" aria-live="polite">
        {ran ? (
          <>
            Queued: <span className="font-medium text-ink">{ran}</span>. Follow it in the task queue.
          </>
        ) : (
          "↑ ↓ to move, Enter to run, Esc to close"
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Assistant side panel                                                */
/* ------------------------------------------------------------------ */

export interface AIAssistantPanelProps {
  context: string;
  messages: ChatMessage[];
  suggestions: string[];
  onClose?: () => void;
  className?: string;
}

export function AIAssistantPanel({ context, messages: initial, suggestions, onClose, className }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState(initial);
  const [model, setModel] = useState<ModelTier>("luna");
  const send = (text: string, attachments: string[], m: ModelTier) => {
    const n = messages.length;
    setMessages([
      ...messages,
      { id: `u${n}`, role: "user", text, attachments },
      { id: `a${n}`, role: "assistant", text: REPLIES[n % REPLIES.length], model: m, credits: MODELS[m].credits, time: "now", stream: true },
    ]);
  };
  return (
    <aside aria-label="ClimbOS assistant" className={cn("flex h-full min-h-0 flex-col border-l border-line bg-surface", className)}>
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <AIMark size="sm" />
        <h3 className="text-ui font-semibold">Assistant</h3>
        <span className="truncate rounded-[var(--radius-badge)] bg-surface-2 px-1.5 py-0.5 text-2xs text-ink-2">Looking at: {context}</span>
        {onClose ? <IconButton size="sm" aria-label="Close assistant" icon={<X className="size-4" />} onClick={onClose} className="ml-auto" /> : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3" role="log" aria-label="Assistant conversation">
        {messages.map((m) => (
          <AIMessage key={m.id} message={m} />
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t border-line p-2">
        <div className="flex flex-wrap gap-1" aria-label="Suggested prompts">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => send(s, [], model)} className="h-7 rounded-[var(--radius-badge)] bg-surface-2 px-2 text-xs text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:outline-none">
              {s}
            </button>
          ))}
        </div>
        <AIPromptInput onSend={send} model={model} onModelChange={setModel} placeholder="Ask about this page…" />
      </div>
    </aside>
  );
}
