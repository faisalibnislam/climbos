import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to ClimbOS with a one-time code sent to your email.",
  robots: { index: false },
};

function FormFallback() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-bg">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-5 sm:px-8">
        <Link href="/" className="-ml-1 inline-flex min-h-11 items-center rounded-lg px-1" aria-label="ClimbOS home">
          <Logo />
        </Link>
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 items-start justify-center px-5 pb-16 pt-6 focus:outline-none sm:pt-14">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="p-6 sm:p-8">
              <h1 className="heading-page">Sign in or create your account</h1>
              <p className="mt-1.5 text-sm text-ink-2">Use your work email. New here? The same steps create your account.</p>
              <div className="mt-6">
                <Suspense fallback={<FormFallback />}>
                  <SignInForm />
                </Suspense>
              </div>
            </CardContent>
          </Card>
          <p className="mt-6 text-center text-xs text-ink-3">
            By continuing you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-ink">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
