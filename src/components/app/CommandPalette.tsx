"use client";

import { Search, Sparkles, ArrowRight } from "@/components/icons";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, toast } from "@/components/ui";
import { APP_TOOLS, PRIMARY_NAV, appHref } from "./navigation";
import { askDraftKey } from "./draftKeys";

export function CommandPalette({ slug }: { slug: string }) {
  const router = useRouter();
  const me = useQuery(api.orgs.me);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("climbos:command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("climbos:command", onOpen);
    };
  }, []);

  const go = (key: string) => {
    setOpen(false);
    setQ("");
    router.push(key.startsWith("settings/") ? `/app/${slug}/${key}` : appHref(slug, key));
  };
  const base = [
    ...PRIMARY_NAV.map((item) => ({ id: item.key as string, label: item.label, hint: item.description, search: "" })),
    ...APP_TOOLS.map((item) => ({ id: item.key, label: item.label, hint: item.description, search: item.search })),
    { id: "review", label: "Review work", hint: "What needs your approval.", search: "approve" },
    { id: "settings/business", label: "Your business & goal", hint: "Business details and your goal.", search: "budget" },
    { id: "settings/billing", label: "Plan & payments", hint: "Subscription and credits.", search: "billing" },
    { id: "settings/team", label: "Settings", hint: "Team and business settings.", search: "" },
  ];
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = base.filter((item) => words.every((word) => `${item.label} ${item.hint} ${item.search}`.toLowerCase().includes(word)));
  const commands = matches.map((item) => ({ ...item, run: () => go(item.id) }));
  if (q.trim()) commands.push({
    id: "ask", label: "Ask for help with this", hint: "Opens an editable request. Nothing starts yet.", search: "",
    run: () => {
      if (!me) return;
      try {
        sessionStorage.setItem(askDraftKey(slug, me.userId), q.trim());
        // A same-page handoff needs an event as well as the navigation fallback.
        window.dispatchEvent(new CustomEvent("climbos:compose", { detail: { slug, userId: me.userId } }));
        go("today");
      } catch {
        toast({ tone: "danger", title: "Couldn't save this request. Copy it, then open Home." });
      }
    },
  });
  const clamp = Math.min(active, Math.max(0, commands.length - 1));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Find a tool or ask for help" description="Opening pages is free. You check requests before anything starts." onOpenAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus(); }}>
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
          <input ref={inputRef} value={q} onChange={(event) => { setQ(event.target.value); setActive(0); }} onKeyDown={(event) => {
            // Do not activate a result on the IME confirmation Enter key.
            // Safari may expose that final keydown as legacy keyCode 229.
            if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(value + 1, commands.length - 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
            if (event.key === "Enter") { event.preventDefault(); commands[clamp]?.run(); }
          }} placeholder="Try posts, customers, or website…" aria-label="Find a tool or prepare a request" role="combobox" aria-expanded={open} aria-controls="palette-list" aria-activedescendant={commands[clamp] ? `cmd-${commands[clamp].id}` : undefined} className="h-10 w-full min-w-0 bg-transparent text-base text-ink outline-none placeholder:text-ink-3" />
        </div>
        <ul id="palette-list" role="listbox" className="max-h-80 overflow-y-auto py-2">
          {commands.map((command, index) => <li key={command.id} id={`cmd-${command.id}`} role="option" aria-selected={index === clamp}>
            <button type="button" disabled={command.id === "ask" && !me} onMouseEnter={() => setActive(index)} onClick={command.run} className={cn("flex min-h-11 w-full items-start gap-2 rounded-[var(--radius-control)] px-2.5 py-2 text-left", index === clamp ? "bg-surface-2 text-ink" : "text-ink-2")}>
              {command.id === "ask" ? <Sparkles className="mt-1 size-4 shrink-0" aria-hidden /> : <ArrowRight className="mt-1 size-4 shrink-0" aria-hidden />}
              <span className="min-w-0"><span className="block text-ui font-medium">{command.label}</span><span className="mt-0.5 block text-xs text-ink-3">{command.hint}</span></span>
            </button>
          </li>)}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
