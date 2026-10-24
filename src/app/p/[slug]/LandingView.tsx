"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Check } from "@/components/icons"
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { Skeleton } from "@/components/ui";
import { firstViewToday } from "@/lib/seen";

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
  return (
    <main className="min-h-dvh bg-white text-ink">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="text-lg font-semibold">{page.name}</span>
        <a href="#start" className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: color }}>
          {c.ctaLabel}
        </a>
      </header>
      <section className="mx-auto max-w-3xl px-5 pb-16 pt-10 text-center sm:pt-20">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">{c.headline}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-2 sm:text-xl">{c.subhead}</p>
        <a href="#start" className="mt-8 inline-block rounded-full px-7 py-3.5 text-base font-semibold text-white shadow-lg" style={{ background: color }}>
          {c.ctaLabel}
        </a>
      </section>
      {c.benefits.length ? (
        <section className="bg-surface-2 px-5 py-16">
          <ul className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {c.benefits.map((b, i) => (
              <li key={i} className="rounded-2xl bg-white p-6 shadow-sm">
                <Check className="mb-3 size-6" style={{ color }} aria-hidden />
                <p className="text-lg font-semibold">{b.title}</p>
                <p className="mt-1.5 text-ink-2">{b.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {c.steps.length ? (
        <section className="mx-auto max-w-3xl px-5 py-16">
          <h2 className="text-center text-3xl font-semibold">How it works</h2>
          <ol className="mt-8 space-y-4">
            {c.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full font-semibold text-white" style={{ background: color }}>
                  {i + 1}
                </span>
                <p className="pt-1.5 text-lg">{s}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {c.proof ? (
        <section className="px-5 pb-16">
          <p className="mx-auto max-w-3xl rounded-2xl border-l-4 bg-surface-2 p-6 text-lg italic text-ink-2" style={{ borderColor: color }}>
            {c.proof}
          </p>
        </section>
      ) : null}
      {c.faq.length ? (
        <section className="mx-auto max-w-3xl px-5 pb-16">
          <h2 className="text-center text-3xl font-semibold">Questions</h2>
          <div className="mt-6 divide-y divide-line">
            {c.faq.map((q, i) => (
              <details key={i} className="py-4">
                <summary className="cursor-pointer text-lg font-semibold">{q.q}</summary>
                <p className="mt-2 text-ink-2">{q.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}
      <section id="start" className="px-5 py-16" style={{ background: color }}>
        <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          {state === "done" ? (
            <p className="text-center text-lg font-semibold">Thanks! We&apos;ll be in touch soon.</p>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setState("busy");
                setError(null);
                try {
                  const testId = assignment?.testId ?? lastTestIdFor(slug);
                  await submit({ slug, ...f, visitorKey: visitorKeyFor(slug), ...(testId ? { testId: testId as Id<"abTests"> } : {}) });
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
              {page.bookingUrl ? (
                <a href={page.bookingUrl} className="text-center text-sm font-medium underline underline-offset-2">
                  Or book a call now
                </a>
              ) : null}
            </form>
          )}
        </div>
      </section>
      <footer className="px-5 py-8 text-center text-sm text-ink-3">
        © {page.name}
        {page.website ? (
          <>
            {" · "}
            <a href={page.website} className="underline underline-offset-2">
              {page.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          </>
        ) : null}
        {page.badge ? (
          <>
            {" · "}
            <a href="https://climbos.app" className="underline underline-offset-2">
              Made with ClimbOS
            </a>
          </>
        ) : null}
      </footer>
    </main>
  );
}
