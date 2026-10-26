import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { LandingPresentation } from "@/components/app/landing/LandingPresentation";

export const metadata: Metadata = { title: "Draft capture", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** One exact landing draft version, served to the render worker by a single-use token. Not a public page. */
export default async function DraftCapture({ params }: PageProps<"/render/landing-draft/[token]">) {
  const { token } = await params;
  const draft = await fetchQuery(api.landingRenders.draftByToken, { token }).catch(() => null);
  if (!draft) return <main className="grid min-h-dvh place-items-center p-6 text-sm">This draft link has expired.</main>;
  const c = draft.content;
  return (
    <LandingPresentation
      name={draft.name}
      color={draft.color}
      content={c}
      website={draft.website}
      preview
      form={
        <div aria-label="Example contact form" className="flex flex-col gap-3">
          <p className="text-xl font-semibold">{c.ctaLabel}</p>
          {c.formIntro ? <p className="text-ink-2">{c.formIntro}</p> : null}
          <span className="w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink-3">Your name</span>
          <span className="w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink-3">Email</span>
          <span className="min-h-20 w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink-3">Anything we should know? (optional)</span>
          <span className="rounded-xl px-5 py-3.5 text-center text-base font-semibold text-white" style={{ background: draft.color }}>{c.ctaLabel}</span>
        </div>
      }
    />
  );
}
