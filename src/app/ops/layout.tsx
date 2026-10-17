import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { Toaster, buttonClasses } from "@/components/ui";

export const metadata: Metadata = {
  title: "Console",
  robots: { index: false, follow: false },
};

/** Standalone frame for the operator console (outside the workspace shell). */
export default function OpsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-bg">
      <Toaster />
      <header className="border-b border-line bg-surface/70">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="-ml-1 inline-flex min-h-9 items-center rounded-lg px-1" aria-label="ClimbOS home">
            <Logo />
          </Link>
          <Link href="/app" className={buttonClasses({ variant: "link" })}>
            Back to app
          </Link>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:py-8">
        {children}
      </main>
    </div>
  );
}
