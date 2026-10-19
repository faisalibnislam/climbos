"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Send } from "@/components/icons"
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function visitorId(): string {
  try {
    const k = "climbos:visitor";
    const existing = localStorage.getItem(k);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(k, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** The chat panel shown inside the owner's site (loaded by /w.js in an iframe). */
export default function WidgetPage() {
  const { key } = useParams<{ key: string }>();
  const page = useSearchParams().get("p") ?? undefined;
  const [vid] = useState(() => (typeof window === "undefined" ? "" : visitorId()));
  const data = useQuery(api.chat.widget, vid ? { key, visitorId: vid } : "skip");
  const [text, setText] = useState("");
  const [now, setNow] = useState(() => Date.now());
  // "Typing…" for up to a minute after the visitor's message (Climb AI gives up after that).
  const waitingSince = data?.waitingSince ?? null;
  useEffect(() => {
    if (!waitingSince) return;
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(tick);
  }, [waitingSince]);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [data?.messages.length]);
  if (data === null) return <main className="grid h-dvh place-items-center bg-white p-6 text-sm text-ink-3">Chat is offline.</main>;
  const color = data?.color ?? "#0b5d46";
  return (
    <main className="flex h-dvh flex-col bg-white">
      <header className="px-4 py-3 text-white" style={{ background: color }}>
        <p className="text-sm font-semibold">{data?.name ?? "Chat"}</p>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
        {data?.messages.length === 0 ? <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-2">{data.greeting}</p> : null}
        {data?.messages.map((m) => (
          <p key={m.id} className={cn("max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm", m.role === "visitor" ? "ml-auto text-white" : "bg-surface-2 text-ink")} style={m.role === "visitor" ? { background: color } : undefined}>
            {m.text}
          </p>
        ))}
        {waitingSince && now - waitingSince < 60_000 ? <p className="text-xs text-ink-3">Typing…</p> : null}
        {data?.handOff ? <p className="max-w-[85%] rounded-2xl bg-surface-2 px-3 py-2 text-sm text-ink">{data.hasEmail ? "Thanks! The team will reply here soon." : "Thanks! The team will reply soon. What's your email, in case you leave the page?"}</p> : null}
        <div ref={end} />
      </div>
      {error ? <p className="px-3 text-xs text-red-800">{error}</p> : null}
      <form
        className="flex items-end gap-2 border-t border-line p-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          setText("");
          setError(null);
          setNow(Date.now());
          try {
            const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, visitorId: vid, text: t, page }) });
            const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
            if (!res.ok || !body?.ok) {
              setError(body?.message ?? "We couldn't send that. Please try again.");
              setText(t);
            }
          } catch {
            setError("We couldn't reach the chat. Check your connection.");
            setText(t);
          }
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          aria-label="Message"
          placeholder="Type a message"
          className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-ink-3"
        />
        <button type="submit" aria-label="Send" className="grid size-10 place-items-center rounded-xl text-white" style={{ background: color }}>
          <Send className="size-4" aria-hidden />
        </button>
      </form>
      {data?.badge ? (
        <a href="https://climbos.app" target="_blank" rel="noopener noreferrer" className="pb-2 text-center text-xs text-ink-3">
          Chat by ClimbOS
        </a>
      ) : null}
    </main>
  );
}
