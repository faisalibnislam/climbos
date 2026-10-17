"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { buttonClasses } from "@/components/ui/button-styles";

/** Friendly fallback for unexpected errors. Never shows raw error details. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-5 sm:px-8">
        <Link href="/" className="-ml-1 inline-flex min-h-11 items-center rounded-lg px-1" aria-label="ClimbOS home">
          <Logo />
        </Link>
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center px-5 py-16 focus:outline-none">
        <div className="max-w-lg text-center" role="alert">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink">Something went wrong on our side</h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-2">
            Nothing was published or changed. Please try again — if it keeps happening, email{" "}
            <a href="mailto:hello@climbos.app" className="font-medium text-green-800 underline underline-offset-2">
              hello@climbos.app
            </a>
            {digest ? (
              <>
                {" "}
                and mention reference <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.9em]">{digest}</code>
              </>
            ) : null}
            .
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={() => retry()} className={buttonClasses({ size: "lg" })}>
              <RotateCcw aria-hidden="true" />
              Try again
            </button>
            <Link href="/" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              Go to the homepage
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
