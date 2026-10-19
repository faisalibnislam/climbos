"use client";

/*
 * Building blocks for design-system pages.
 * - DocPage: page title, intro and an on-page contents list (built from Specimens).
 * - Specimen: one element, anchored by slugify(title) so ⌘K and links can jump to it.
 * - Stage: the neutral area a live example sits on (ground colour, padded).
 * - Spec: small key/value notes under an example (sizes, tokens, rules).
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link2 } from "@/components/icons";
import { cn } from "@/lib/utils";
import { slugify } from "../nav";

export function DocPage({ eyebrow, title, intro, children }: { eyebrow?: string; title: string; intro?: ReactNode; children: ReactNode }) {
  const [toc, setToc] = useState<{ id: string; title: string }[]>([]);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("[data-specimen]")];
    const id = requestAnimationFrame(() => setToc(els.map((e) => ({ id: e.id, title: e.dataset.specimen ?? e.id }))));
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.id);
    }, { rootMargin: "-20% 0px -70% 0px" });
    els.forEach((e) => io.observe(e));
    return () => {
      cancelAnimationFrame(id);
      io.disconnect();
    };
  }, []);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 xl:grid-cols-[minmax(0,1fr)_200px]">
      <div className="min-w-0">
        <header className="mb-10 flex flex-col gap-3 border-b border-line pb-8">
          {eyebrow ? <p className="text-overline">{eyebrow}</p> : null}
          <h1 className="text-display !text-[clamp(40px,5vw,56px)]">{title}</h1>
          {intro ? <div className="text-voice max-w-3xl">{intro}</div> : null}
        </header>
        <div className="flex flex-col gap-14">{children}</div>
      </div>
      {toc.length > 1 ? (
        <nav aria-label="On this page" className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] self-start overflow-y-auto xl:block">
          <p className="text-overline mb-2">On this page</p>
          <ul className="flex flex-col border-l border-line">
            {toc.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className={cn("-ml-px block border-l py-1 pl-3 text-xs transition-colors", active === t.id ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink")}>
                  {t.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

export function Specimen({ title, description, children, className }: { title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  const id = slugify(title);
  return (
    <section id={id} data-specimen={title} className="scroll-mt-20">
      <div className="group mb-4 flex items-baseline gap-2">
        <h2 className="heading-section">{title}</h2>
        <a href={`#${id}`} aria-label={`Link to ${title}`} className="text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100">
          <Link2 className="size-4" />
        </a>
      </div>
      {description ? <p className="-mt-2 mb-4 max-w-3xl text-sm text-ink-2">{description}</p> : null}
      <div className={cn("flex flex-col gap-3", className)}>{children}</div>
    </section>
  );
}

/** Neutral stage for a live example. `tone="white"` for things that sit on panels. */
export function Stage({ children, className, tone = "ground", label }: { children: ReactNode; className?: string; tone?: "ground" | "white" | "ink"; label?: string }) {
  return (
    <div className={cn("relative rounded-[var(--radius-card)] p-6", tone === "white" ? "border border-line bg-surface" : tone === "ink" ? "bg-ink text-white" : "bg-bg ring-1 ring-line", className)}>
      {label ? <p className="text-overline mb-3">{label}</p> : null}
      {children}
    </div>
  );
}

export function Spec({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className="text-ink-2">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
