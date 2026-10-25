"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { Skeleton } from "@/components/ui";
import { firstViewToday } from "@/lib/seen";
import { LandingPresentation } from "@/components/app/landing/LandingPresentation";

/** Anonymous, stable per-page subject key. The server chooses and persists the arm. */
const visitorKeys = new Map<string, string>();
function visitorKeyFor(slug: string): string {
  const key = `climbos:visitor:p:${slug}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved && saved.length >= 16) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    const saved = visitorKeys.get(slug);
    if (saved) return saved;
    const id = crypto.randomUUID();
    visitorKeys.set(slug, id);
    return id;
  }
}

function lastTestIdFor(slug: string): string | undefined {
  try {
    return localStorage.getItem(`climbos:ab-test:p:${slug}`) ?? undefined;
  } catch {
    return undefined;
  }
}

/** A ClimbOS landing page: hero, benefits, steps, proof, FAQ and a lead form. */
export default function LandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const page = useQuery(api.landing.publicPage, { slug });
  const assignLanding = useMutation(api.landing.assignLanding);
  const viewed = useMutation(api.landing.viewed);
  const submit = useMutation(api.landing.submit);
  const counted = useRef(false);
  const [assignment, setAssignment] = useState<{ testId: string; variant: "A" | "B" } | null>(null);
  const [resolvedTestId, setResolvedTestId] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", email: "", message: "" });
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const pageHeadline = page?.content.headline;
  const pageName = page?.name;
  const testId = page?.test?.id;
  const variant = page?.test && assignment?.testId === page.test.id ? assignment.variant : undefined;
  useEffect(() => {
    if (pageHeadline === undefined || pageName === undefined) return;
    document.title = `${pageHeadline} · ${pageName}`;
    const countView = !counted.current && firstViewToday(`p:${slug}`);
    counted.current = true;
    if (!testId) {
      if (countView) void viewed({ slug, countView: true });
      return;
    }
    let active = true;
    const visitorKey = visitorKeyFor(slug);
    void (async () => {
      const assigned = await assignLanding({ slug, visitorKey });
      const result = assigned.testId
        ? await viewed({ slug, visitorKey, testId: assigned.testId, countView })
        : (await viewed({ slug, countView }), assigned);
      if (!active) return;
      if (result.testId && result.variant) {
        setAssignment({ testId: result.testId, variant: result.variant });
        try { localStorage.setItem(`climbos:ab-test:p:${slug}`, result.testId); } catch { /* Session can still use its in-memory assignment. */ }
      }
      setResolvedTestId(testId);
    })().catch(() => {
      if (active) setResolvedTestId(testId); // Keep the original version available; this visit is not counted in the test.
    });
    return () => { active = false; };
  }, [pageHeadline, pageName, testId, slug, assignLanding, viewed]);
  if (page === undefined) return <Skeleton className="mx-auto mt-24 h-64 w-full max-w-3xl" />;
  if (page === null) return <main className="grid min-h-dvh place-items-center p-6 text-sm text-ink-3">This page isn&apos;t available.</main>;
  if (page.test && resolvedTestId !== page.test.id) return <Skeleton className="mx-auto mt-24 h-64 w-full max-w-3xl" />;
  const c = variant === "B" && page.test ? { ...page.content, ...page.test.b } : page.content;
  const color = page.color;
  const input = "w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none focus:border-ink-3";
  const form = state === "done" ? (
    <p className="text-center text-lg font-semibold">Thanks! We&apos;ll be in touch soon.</p>
  ) : (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        setError(null);
        try {
          const currentTestId = assignment?.testId ?? lastTestIdFor(slug);
          await submit({ slug, ...f, visitorKey: visitorKeyFor(slug), ...(currentTestId ? { testId: currentTestId as Id<"abTests"> } : {}) });
          setState("done");
        } catch (err) {
          setError(errorMessage(err));
          setState("idle");
        }
      }}
    >
      <p className="text-xl font-semibold">{c.ctaLabel}</p>
      {c.formIntro ? <p className="text-ink-2">{c.formIntro}</p> : null}
      <input className={input} placeholder="Your name" aria-label="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
      <input className={input} type="email" placeholder="Email" aria-label="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
      <textarea className={input} rows={3} placeholder="Anything we should know? (optional)" aria-label="Message" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button type="submit" disabled={state === "busy"} className="rounded-xl px-5 py-3.5 text-base font-semibold text-white disabled:opacity-60" style={{ background: color }}>
        {state === "busy" ? "Sending…" : c.ctaLabel}
      </button>
      {page.bookingUrl ? <a href={page.bookingUrl} className="text-center text-sm font-medium underline underline-offset-2">Or book a call now</a> : null}
    </form>
  );
  return <LandingPresentation name={page.name} color={color} content={c} website={page.website} badge={page.badge} form={form} />;
}
