import type { ReactNode } from "react";
import { Check } from "@/components/icons";
import type { LandingContent } from "../../../../shared/landing";

/** Shared visual shell for the public page and the owner's non-submitting preview. */
export function LandingPresentation({
  name,
  color,
  content,
  website,
  badge = false,
  preview = false,
  form,
}: {
  name: string;
  color: string;
  content: LandingContent;
  website?: string | null;
  badge?: boolean;
  preview?: boolean;
  form: ReactNode;
}) {
  const cta = preview
    ? <span className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: color }}>{content.ctaLabel}</span>
    : <a href="#start" className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: color }}>{content.ctaLabel}</a>;

  return (
    <main className="@container min-h-dvh bg-white text-ink">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="text-lg font-semibold">{name}</span>
        {cta}
      </header>
      <section className="mx-auto max-w-3xl px-5 pb-16 pt-10 text-center @sm:pt-20">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight @sm:text-6xl">{content.headline}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-2 @sm:text-xl">{content.subhead}</p>
        {preview
          ? <span className="mt-8 inline-block rounded-full px-7 py-3.5 text-base font-semibold text-white shadow-lg" style={{ background: color }}>{content.ctaLabel}</span>
          : <a href="#start" className="mt-8 inline-block rounded-full px-7 py-3.5 text-base font-semibold text-white shadow-lg" style={{ background: color }}>{content.ctaLabel}</a>}
      </section>
      {content.benefits.length ? (
        <section className="bg-surface-2 px-5 py-16">
          <ul className="mx-auto grid max-w-5xl gap-5 @sm:grid-cols-2 @lg:grid-cols-4">
            {content.benefits.map((b, i) => (
              <li key={i} className="rounded-2xl bg-white p-6 shadow-sm">
                <Check className="mb-3 size-6" style={{ color }} aria-hidden />
                <p className="text-lg font-semibold">{b.title}</p>
                <p className="mt-1.5 text-ink-2">{b.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {content.steps.length ? (
        <section className="mx-auto max-w-3xl px-5 py-16">
          <h2 className="text-center text-3xl font-semibold">How it works</h2>
          <ol className="mt-8 space-y-4">
            {content.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full font-semibold text-white" style={{ background: color }}>{i + 1}</span>
                <p className="pt-1.5 text-lg">{s}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {content.proof ? <section className="px-5 pb-16"><p className="mx-auto max-w-3xl rounded-2xl border-l-4 bg-surface-2 p-6 text-lg italic text-ink-2" style={{ borderColor: color }}>{content.proof}</p></section> : null}
      {content.faq.length ? (
        <section className="mx-auto max-w-3xl px-5 pb-16">
          <h2 className="text-center text-3xl font-semibold">Questions</h2>
          <div className="mt-6 divide-y divide-line">
            {content.faq.map((q, i) => <details key={i} className="py-4"><summary className="cursor-pointer text-lg font-semibold">{q.q}</summary><p className="mt-2 text-ink-2">{q.a}</p></details>)}
          </div>
        </section>
      ) : null}
      <section id={preview ? undefined : "start"} className="px-5 py-16" style={{ background: color }}>
        <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-xl @sm:p-8">{form}</div>
      </section>
      <footer className="px-5 py-8 text-center text-sm text-ink-3">
        © {name}
        {website ? <> {" · "}{preview ? <span>{website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span> : <a href={website} className="underline underline-offset-2">{website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>}</> : null}
        {badge ? <> {" · "}{preview ? <span>Made with ClimbOS</span> : <a href="https://climbos.app" className="underline underline-offset-2">Made with ClimbOS</a>}</> : null}
      </footer>
    </main>
  );
}
