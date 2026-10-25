"use client";

import { useState } from "react";
import { Check } from "@/components/icons";
import { Button } from "@/components/ui";
import type { LandingContent } from "../../../../shared/landing";

/** Responsive, non-interactive rendering of the current unsaved ClimbOS page draft. */
export function LandingDraftPreview({ name, color, content }: { name: string; color: string; content: LandingContent }) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  return (
    <section className="rounded-xl border border-line bg-surface-2/50 p-3" aria-label="Landing page draft preview">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Draft preview</h3>
          <p className="text-xs text-ink-3">Current editor content · no form submissions or analytics are active here</p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Preview viewport">
          <Button size="sm" variant={viewport === "desktop" ? "secondary" : "ghost"} aria-pressed={viewport === "desktop"} onClick={() => setViewport("desktop")}>Desktop</Button>
          <Button size="sm" variant={viewport === "mobile" ? "secondary" : "ghost"} aria-pressed={viewport === "mobile"} onClick={() => setViewport("mobile")}>Mobile</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white p-2">
        <div role="group" aria-label={`${viewport} rendering of landing page draft`} className={`mx-auto min-h-[30rem] overflow-hidden bg-white text-ink shadow-sm transition-[width] ${viewport === "mobile" ? "w-[390px] max-w-full" : "w-full max-w-[1100px]"}`}>
          <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
            <span className="text-lg font-semibold">{name}</span>
            <span className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: color }}>{content.ctaLabel}</span>
          </header>
          <section className={`mx-auto max-w-3xl px-5 pb-12 text-center ${viewport === "mobile" ? "pt-8" : "pt-16"}`}>
            <h1 className={`font-semibold leading-tight tracking-tight ${viewport === "mobile" ? "text-4xl" : "text-6xl"}`}>{content.headline}</h1>
            <p className={`mx-auto mt-5 max-w-2xl text-ink-2 ${viewport === "mobile" ? "text-lg" : "text-xl"}`}>{content.subhead}</p>
            <span className="mt-7 inline-block rounded-full px-7 py-3.5 text-base font-semibold text-white shadow-lg" style={{ background: color }}>{content.ctaLabel}</span>
          </section>
          {content.benefits.length ? <section className="bg-surface-2 px-5 py-12"><ul className={`mx-auto grid max-w-5xl gap-4 ${viewport === "mobile" ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-4"}`}>
            {content.benefits.map((benefit, index) => <li key={index} className="rounded-2xl bg-white p-5 shadow-sm"><Check className="mb-3 size-6" style={{ color }} aria-hidden /><p className="font-semibold">{benefit.title}</p><p className="mt-1 text-sm text-ink-2">{benefit.text}</p></li>)}
          </ul></section> : null}
          {content.steps.length ? <section className="mx-auto max-w-3xl px-5 py-12"><h2 className="text-center text-2xl font-semibold">How it works</h2><ol className="mt-6 space-y-3">{content.steps.filter((step) => step.trim()).map((step, index) => <li key={index} className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: color }}>{index + 1}</span><span className="pt-1 text-sm">{step}</span></li>)}</ol></section> : null}
          {content.proof ? <section className="px-5 pb-12"><p className="mx-auto max-w-3xl rounded-2xl border-l-4 bg-surface-2 p-5 text-base italic text-ink-2" style={{ borderColor: color }}>{content.proof}</p></section> : null}
          {content.faq.length ? <section className="mx-auto max-w-3xl px-5 pb-12"><h2 className="text-center text-2xl font-semibold">Questions</h2><ul className="mt-4 divide-y divide-line">{content.faq.map((item, index) => <li key={index} className="py-3"><p className="font-semibold">{item.q}</p><p className="mt-1 text-sm text-ink-2">{item.a}</p></li>)}</ul></section> : null}
          <section className="px-5 py-12" style={{ background: color }}><div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-xl"><p className="text-lg font-semibold">{content.ctaLabel}</p>{content.formIntro ? <p className="mt-2 text-sm text-ink-2">{content.formIntro}</p> : null}<div className="mt-4 flex flex-col gap-3"><span className="rounded-xl border border-line px-4 py-3 text-sm text-ink-3">Your name</span><span className="rounded-xl border border-line px-4 py-3 text-sm text-ink-3">Email address</span><span className="rounded-xl border border-line px-4 py-3 text-sm text-ink-3">Optional message</span><span className="rounded-xl px-5 py-3 text-center text-sm font-semibold text-white" style={{ background: color }}>{content.ctaLabel}</span></div></div></section>
          <footer className="px-5 py-6 text-center text-xs text-ink-3">© {name}</footer>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-3">This preview reflects the ClimbOS landing-page draft, not the audited website. Check the final rendered page and its interactions before publishing.</p>
    </section>
  );
}
