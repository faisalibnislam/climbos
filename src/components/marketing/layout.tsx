import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { buttonClasses } from "@/components/ui/button-styles";
import { cn } from "@/lib/utils";
import { CTA } from "./content";
import { MobileNav } from "./MobileNav";

export const NAV_LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
] as const;

/** Centered content column with a 20px mobile gutter. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>{children}</div>;
}

/** Section wrapper with an accessible name from its heading. */
export function Section({
  id,
  labelledBy,
  className,
  children,
}: {
  id?: string;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("scroll-mt-20 py-16 sm:py-24", className)}>
      <Container>{children}</Container>
    </section>
  );
}

/** Eyebrow + serif H2 + intro paragraph. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
  align = "left",
  className,
}: {
  id: string;
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-700">{eyebrow}</p> : null}
      <h2 id={id} className="mt-2 font-display text-[2rem] font-extrabold leading-[1.15] tracking-tight text-ink sm:text-[2.6rem]">
        {title}
      </h2>
      {intro ? <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-2 sm:text-lg">{intro}</p> : null}
    </div>
  );
}

/** Sticky marketing header: logo, primary nav, Sign in and Get started. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="-ml-1 inline-flex min-h-11 items-center rounded-lg px-1" aria-label="ClimbOS home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="inline-flex min-h-11 items-center rounded-lg px-3 text-[0.95rem] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/sign-in" className={buttonClasses({ variant: "ghost" })}>
            Sign in
          </Link>
          <Link href={CTA.getStarted.href} className={buttonClasses({ variant: "primary" })}>
            {CTA.getStarted.label}
          </Link>
        </div>
        <MobileNav links={NAV_LINKS.map((l) => ({ ...l }))} />
      </Container>
    </header>
  );
}

const FOOTER_GROUPS = [
  {
    title: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/demo", label: "Try the demo" },
      { href: "/sign-in", label: "Sign in" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/security", label: "Security" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

/** Marketing footer with product + legal links and pricing note. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface-2/60">
      <Container className="grid gap-10 py-12 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 leading-relaxed text-ink-2">Your AI growth team. You stay in charge of everything that goes live.</p>
        </div>
        {FOOTER_GROUPS.map((g) => (
          <nav key={g.title} aria-label={g.title}>
            <h2 className="text-sm font-semibold text-ink">{g.title}</h2>
            <ul className="mt-2">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex min-h-11 items-center text-ink-2 hover:text-ink hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <Container className="flex flex-col gap-2 border-t border-line py-6 text-sm text-ink-3 sm:flex-row sm:justify-between">
        <p>© 2026 ClimbOS</p>
        <p>Prices in USD. Ad spend is paid directly to ad platforms.</p>
      </Container>
    </footer>
  );
}
