"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui";

/** Send people to their workspace, or to onboarding if they don't have one yet. */
export default function AppIndex() {
  const me = useQuery(api.orgs.me);
  const router = useRouter();
  useEffect(() => {
    if (me === undefined) return;
    if (me === null) {
      router.replace("/sign-in?next=/app");
      return;
    }
    const real = me.orgs.find((o) => o.kind === "customer");
    const target = real ?? me.orgs[0];
    if (!target) router.replace("/onboarding");
    // Only owners and admins finish setup; invited teammates go straight to the workspace.
    else if (target.kind === "customer" && target.onboardingStep !== "done" && (target.role === "owner" || target.role === "admin")) router.replace(`/onboarding?workspace=${target.slug}`);
    else router.replace(`/app/${target.slug}/today`);
  }, [me, router]);
  return (
    <main id="main" className="grid min-h-dvh place-items-center">
      <p className="flex items-center gap-2 text-sm text-ink-2" role="status">
        <Spinner /> Opening your workspace…
      </p>
    </main>
  );
}
