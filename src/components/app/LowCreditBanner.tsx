"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/** Thin banner when credits run low: top up (packages) or upgrade (free). Dismissed for the session. */
export function LowCreditBanner({ slug }: { slug: string }) {
  const c = useQuery(api.workspace.credits, { slug });
  // Credits load on the client only, so reading storage here can't mismatch the server render.
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem("climbos:lowcredit") === "1";
    } catch {
      return false;
    }
  });
  if (!c || c.isDemo || hidden) return null;
  const threshold = Math.max(20, Math.round(c.monthly.total * 0.1));
  if (c.available >= threshold) return null;
  const out = c.available <= 0;
  return (
    <div role="status" className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-6">
      <span>
        {out ? "You're out of credits." : `${c.available} credits left.`}{" "}
        <Link href={`/app/${slug}/settings/billing`} className="font-semibold underline underline-offset-2">
          {c.paid ? "Top up" : "Upgrade"}
        </Link>
        {c.paid && c.resetsAt ? ` or wait for ${new Date(c.resetsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.` : null}
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        className="rounded p-1 hover:bg-amber-100"
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem("climbos:lowcredit", "1");
          } catch {
            // Private mode: hides until reload.
          }
        }}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
