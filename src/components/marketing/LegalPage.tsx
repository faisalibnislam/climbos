import type { ReactNode } from "react";
import { FileWarning } from "lucide-react";
import { Container } from "./layout";

/**
 * Wrapper for long-form policy pages. `draft` shows a prominent
 * "Draft — pending legal review" notice at the top.
 */
export function LegalPage({
  title,
  intro,
  updated,
  draft = false,
  children,
}: {
  title: string;
  intro?: ReactNode;
  updated: string;
  draft?: boolean;
  children: ReactNode;
}) {
  return (
    <Container className="py-14 sm:py-20">
      <article className="mx-auto max-w-3xl">
        {draft ? (
          <div className="mb-8 flex gap-3 rounded-[12px] border border-[#f1dca6] bg-amber-100 p-4 text-amber-800">
            <FileWarning aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <p className="leading-relaxed">
              <strong className="font-semibold">Draft — pending legal review.</strong> This is a plain-English working draft and
              may change before it becomes final.
            </p>
          </div>
        ) : null}
        <h1 className="font-display text-[2.4rem] font-semibold leading-tight tracking-tight text-ink sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-ink-3">Last updated {updated}</p>
        {intro ? <p className="mt-6 text-lg leading-relaxed text-ink-2">{intro}</p> : null}
        <div className="prose-climb mt-6">{children}</div>
      </article>
    </Container>
  );
}
