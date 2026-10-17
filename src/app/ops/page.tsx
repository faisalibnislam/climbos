"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { OpsConsole } from "@/components/app/ops/OpsConsole";
import { QueryBoundary } from "@/components/app/results/QueryBoundary";
import { Spinner } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button-styles";

/**
 * Operator console. Rendered only when the backend says the signed-in user is
 * an operator; everyone else sees a plain "not found" page. Every ops query
 * and mutation independently re-checks operator access on the server.
 */
export default function OpsPage() {
  const isOperator = useQuery(api.ops.isOperatorQuery, {});
  if (isOperator === undefined) {
    return (
      <p role="status" className="flex items-center justify-center gap-3 py-24 text-ink-2">
        <Spinner /> Loading…
      </p>
    );
  }
  if (!isOperator) return <OpsNotFound />;
  return (
    <QueryBoundary>
      <OpsConsole />
    </QueryBoundary>
  );
}

function OpsNotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-700">Page not found</p>
      <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-ink">This path doesn&apos;t lead anywhere — yet.</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-2">The page may have moved, or the link might have a typo.</p>
      <div className="mt-8 flex justify-center">
        <Link href="/app" className={buttonClasses({ size: "lg" })}>
          Go to your workspace
        </Link>
      </div>
    </div>
  );
}
