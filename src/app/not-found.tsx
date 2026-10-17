import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { buttonClasses } from "@/components/ui/button-styles";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="hero-glow flex min-h-dvh flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-5 sm:px-8">
        <Link href="/" className="-ml-1 inline-flex min-h-11 items-center rounded-lg px-1" aria-label="ClimbOS home">
          <Logo />
        </Link>
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center px-5 py-16 focus:outline-none">
        <div className="max-w-lg text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-green-700">Page not found</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            This path doesn&apos;t lead anywhere — yet.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-2">
            The page may have moved, or the link might have a typo. Let&apos;s get you back on track.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className={buttonClasses({ size: "lg" })}>
              Go to the homepage
            </Link>
            <Link href="/demo" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              Try the demo
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
