import type { ReactNode } from "react";
import { Callout } from "@/components/ui/feedback";
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
          <Callout tone="warning" className="mb-8" title="Draft — pending legal review.">
            This is a plain-English working draft and may change before it becomes final.
          </Callout>
        ) : null}
        <h1 className="text-5xl text-ink">{title}</h1>
        <p className="mt-3 text-xs text-ink-3">Last updated {updated}</p>
        {intro ? <p className="mt-6 text-lg text-ink-2">{intro}</p> : null}
        <div className="prose-climb mt-6">{children}</div>
      </article>
    </Container>
  );
}
