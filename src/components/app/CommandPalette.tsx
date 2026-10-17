"use client";

import { BarChart3, CalendarDays, Compass, CreditCard, Home, Palette, Plug, Search, Settings, Sparkles, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

/** Key the Today chat reads to prefill a question asked from the palette (kept out of the URL). */
export const ASK_KEY = "climbos:ask";

/**
 * ⌘K palette: ask the AI team anything (it opens Today with the question
 * ready to send) or jump to any part of the workspace.
 */
export function CommandPalette({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("climbos:command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("climbos:command", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const go = (path: string) => () => {
    setOpen(false);
    setQ("");
    router.push(path);
  };
  const commands = useMemo<Command[]>(() => {
    const base: Command[] = [
      { id: "today", label: "Today", icon: Home, run: go(`/app/${slug}/today`) },
      { id: "plan", label: "Growth plan", icon: Compass, run: go(`/app/${slug}/plan`) },
      { id: "content", label: "Content", icon: CalendarDays, run: go(`/app/${slug}/content`) },
      { id: "studio", label: "Design studio", hint: "Create an image post or carousel", icon: Palette, run: go(`/studio/${slug}/new`) },
      { id: "results", label: "Results", icon: BarChart3, run: go(`/app/${slug}/results`) },
      { id: "connections", label: "Connections", icon: Plug, run: go(`/app/${slug}/connections`) },
      { id: "billing", label: "Plans and usage", icon: CreditCard, run: go(`/app/${slug}/settings/billing`) },
      { id: "settings", label: "Settings", icon: Settings, run: go(`/app/${slug}/settings/team`) },
    ];
    const term = q.trim().toLowerCase();
    const matches = term ? base.filter((c) => c.label.toLowerCase().includes(term) || c.hint?.toLowerCase().includes(term)) : base;
    if (!term) return matches;
    const ask: Command = {
      id: "ask",
      label: `Ask your team: “${q.trim()}”`,
      hint: "Opens Today with your question ready to send",
      icon: Sparkles,
      run: () => {
        try {
          sessionStorage.setItem(ASK_KEY, q.trim());
        } catch {
          // Storage unavailable: Today still opens.
        }
        go(`/app/${slug}/today`)();
      },
    };
    return [ask, ...matches];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, slug]);

  if (!open) return null;
  const clamp = Math.min(active, Math.max(0, commands.length - 1));
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12vh]" onMouseDown={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Ask or search" className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="size-4 text-ink-3" aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, commands.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                commands[clamp]?.run();
              }
            }}
            placeholder="Ask your team anything, or jump to…"
            aria-label="Ask or search"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={commands[clamp] ? `cmd-${commands[clamp].id}` : undefined}
            className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
          />
        </div>
        <ul id="palette-list" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
          {commands.map((c, i) => (
            <li key={c.id} id={`cmd-${c.id}`} role="option" aria-selected={i === clamp}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={c.run}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px]", i === clamp ? "bg-surface-2 text-ink" : "text-ink-2")}
              >
                <c.icon className={cn("size-4 shrink-0", c.id === "ask" ? "text-brand-800" : "text-ink-3")} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
                {c.hint ? <span className="hidden truncate text-xs text-ink-3 sm:inline">{c.hint}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
