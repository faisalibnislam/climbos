"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button, Callout, Spinner } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";

/** One click into a private Formkit demo workspace (synthetic data, fixture providers). */
export default function DemoPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const create = useMutation(api.demo.createDemoWorkspace);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (isLoading || started.current) return;
    started.current = true;
    (async () => {
      try {
        if (!isAuthenticated) await signIn("anonymous");
      } catch (e) {
        setError(errorMessage(e));
        started.current = false;
      }
    })();
  }, [isAuthenticated, isLoading, signIn]);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const { slug } = await create({});
        router.replace(`/app/${slug}/today`);
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [isAuthenticated, create, router]);

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="w-full max-w-md text-center">
        <Logo className="justify-center" />
        {error ? (
          <Callout tone="danger" className="mt-8 text-left" title="We couldn't open the demo">
            {error}
            <div className="mt-3">
              <Button onClick={() => window.location.reload()}>Try again</Button>
            </div>
          </Callout>
        ) : (
          <div className="mt-8 space-y-3" role="status">
            <Spinner />
            <p className="font-semibold tracking-tight text-2xl text-ink">Setting up the Formkit demo…</p>
            <p className="text-ink-2">A private sandbox with synthetic data. Nothing in it posts, emails or spends money.</p>
          </div>
        )}
        <p className="mt-10 text-sm text-ink-3">
          Prefer your own business? <Link className="font-semibold text-brand-800 underline" href="/sign-in?next=/onboarding">Start with your website</Link>
        </p>
      </div>
    </main>
  );
}
