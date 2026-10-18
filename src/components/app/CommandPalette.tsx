"use client";

import { BarChart3, CalendarDays, Compass, CreditCard, Home, Palette, Plug, Search, Settings, Sparkles, Target, type LucideIcon } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui";
import { errorInfo } from "@/components/app/errors";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

/** Key Today reads to prefill a wish typed in the palette when it couldn't be sent (kept out of the URL). */
export const ASK_KEY = "climbos:ask";

/**
 * ⌘K palette: make a wish from anywhere (it's sent at once and Today shows
 * the team working on it) or jump to any part of the workspace.
 */
export function CommandPalette({ slug }: { slug: string }) {
  const router = useRouter();
  const sendWish = useMutation(api.workspace.sendChat);
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
      { id: "business", label: "Business & goal", hint: "Change your goal, budget or refresh research", icon: Target, run: go(`/app/${slug}/settings/business`) },
      { id: "billing", label: "Plans and usage", icon: CreditCard, run: go(`/app/${slug}/settings/billing`) },
      { id: "settings", label: "Settings", icon: Settings, run: go(`/app/${slug}/settings/team`) },
    ];
    const term = q.trim().toLowerCase();
    const matches = term ? base.filter((c) => c.label.toLowerCase().includes(term) || c.hint?.toLowerCase().includes(term)) : base;
    if (!term) return matches;
    const ask: Command = {
      id: "ask",
      label: `Make it happen: “${q.trim()}”`,
      hint: "Your team starts right away",
      icon: Sparkles,
      run: () => {
        const wish = q.trim();
        go(`/app/${slug}/today`)();
        sendWish({ slug, text: wish }).catch((err) => {
          // Couldn't send (e.g. on hold): keep the words ready on Today.
          try {
            sessionStorage.setItem(ASK_KEY, wish);
          } catch {
            // Storage unavailable.
          }
          toast({ tone: "danger", title: errorInfo(err).message });
        });
      },
    };
    // Jumping somewhere is free; a wish spends credits. Enter picks a matching screen first.
    return matches.length ? [...matches, ask] : [ask];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, slug]);

  if (!open) return null;
  const clamp = Math.min(active, Math.max(0, commands.length - 1));
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 px-4 pt-[12vh]" onMouseDown={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Make a wish or search" className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
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
            placeholder="Tell your team what you want, or jump to…"
            aria-label="Make a wish or search"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={commands[clamp] ? `cmd-${commands[clamp].id}` : undefined}
            className="h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
          />
        </div>
        <ul id="palette-list" role="listbox" className="max-h-80 overflow-y-auto p-1">
          {commands.map((c, i) => (
            <li key={c.id} id={`cmd-${c.id}`} role="option" aria-selected={i === clamp}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={c.run}
                className={cn("flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-ui", i === clamp ? "bg-surface-2 text-ink" : "text-ink-2")}
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
