"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { Skeleton } from "@/components/ui";
import { firstViewToday } from "@/lib/seen";

/** Link in bio: big tap targets, tracked links, optional email sign-up. */
export default function BioPage() {
  const { slug } = useParams<{ slug: string }>();
  const p = useQuery(api.bio.publicPage, { slug });
  const viewed = useMutation(api.bio.viewed);
  const signup = useMutation(api.bio.signup);
  const counted = useRef(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (p && !counted.current) {
      counted.current = true;
      document.title = p.title;
      // One view per visitor per day, so reloads don't inflate the count.
      if (firstViewToday(`bio:${slug}`)) void viewed({ slug });
    }
  }, [p, slug, viewed]);
  if (p === undefined) return <Skeleton className="mx-auto mt-24 h-64 w-full max-w-sm" />;
  if (p === null) return <main className="grid min-h-dvh place-items-center p-6 text-sm text-ink-3">This page isn&apos;t available.</main>;
  return (
    <main className="min-h-dvh px-5 py-12" style={{ background: `linear-gradient(180deg, ${p.color}22, #ffffff 40%)` }}>
      <div className="mx-auto flex max-w-sm flex-col items-center gap-5 text-center">
        <span className="grid size-20 place-items-center rounded-full text-3xl font-semibold text-white" style={{ background: p.color }} aria-hidden>
          {p.title.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h1 className="text-xl font-semibold text-ink">{p.title}</h1>
          {p.bio ? <p className="mt-1 text-sm text-ink-2">{p.bio}</p> : null}
        </div>
        <ul className="flex w-full flex-col gap-3">
          {p.links.map((l, i) => (
            <li key={i}>
              <a href={l.href} className="block w-full rounded-2xl px-5 py-4 text-base font-semibold text-white shadow-sm transition-transform active:scale-[0.98]" style={{ background: p.color }}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        {p.collectEmails ? (
          state === "done" ? (
            <p className="text-sm text-ink-2">Thanks, you&apos;re on the list.</p>
          ) : (
            <form
              className="flex w-full gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setState("busy");
                setError(null);
                try {
                  await signup({ slug, email });
                  setState("done");
                } catch (err) {
                  setError(errorMessage(err));
                  setState("idle");
                }
              }}
            >
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email for news and offers" aria-label="Email" className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-3 text-sm outline-none focus:border-ink-3" />
              <button type="submit" disabled={state === "busy"} className="rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60" style={{ background: p.color }}>
                Join
              </button>
            </form>
          )
        ) : null}
        {error ? <p className="text-sm text-red-800">{error}</p> : null}
        {p.badge ? (
          <a href="https://climbos.app" className="text-xs text-ink-3">
            Made with ClimbOS
          </a>
        ) : null}
      </div>
    </main>
  );
}
