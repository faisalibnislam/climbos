"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { LandingPresentation } from "./LandingPresentation";
import type { LandingContent } from "../../../../shared/landing";

/** Shared visitor-page layout for the current unsaved draft, with an inert lead form. */
export function LandingDraftPreview({ name, color, content, website, badge }: { name: string; color: string; content: LandingContent; website?: string | null; badge?: boolean }) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  return (
    <section className="rounded-xl border border-line bg-surface-2/50 p-3" aria-label="Landing page draft preview">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Draft preview</h3>
          <p className="text-xs text-ink-3">Unsaved edits shown · form and analytics off</p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Preview viewport">
          <Button size="sm" variant={viewport === "desktop" ? "secondary" : "ghost"} aria-pressed={viewport === "desktop"} onClick={() => setViewport("desktop")}>Desktop</Button>
          <Button size="sm" variant={viewport === "mobile" ? "secondary" : "ghost"} aria-pressed={viewport === "mobile"} onClick={() => setViewport("mobile")}>Mobile</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white p-2">
        <div role="group" aria-label={`${viewport} rendering of landing page draft`} className={`mx-auto overflow-hidden shadow-sm transition-[width] ${viewport === "mobile" ? "w-[390px] max-w-full" : "w-full max-w-[1100px]"}`}>
          <LandingPresentation
            name={name}
            color={color}
            content={content}
            website={website}
            badge={badge}
            preview
            form={
              <div aria-label="Example contact form" className="flex flex-col gap-3">
                <p className="text-xl font-semibold">{content.ctaLabel}</p>
                {content.formIntro ? <p className="text-ink-2">{content.formIntro}</p> : null}
                <span className="w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink-3">Your name</span>
                <span className="w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink-3">Email</span>
                <span className="min-h-20 w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink-3">Anything we should know? (optional)</span>
                <span className="rounded-xl px-5 py-3.5 text-center text-base font-semibold text-white" style={{ background: color }}>{content.ctaLabel}</span>
              </div>
            }
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-3">This is your ClimbOS page, not your website. Check it again after publishing.</p>
    </section>
  );
}
