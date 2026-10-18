"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Tooltip } from "@/components/ui";

/** Sends a heartbeat for this page every 30s and shows teammates who are on the same page right now. */
export function Presence({ slug }: { slug: string }) {
  const path = usePathname().replace(`/app/${slug}`, "") || "/";
  const beat = useMutation(api.team.heartbeat);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      void beat({ slug, path }).catch(() => undefined);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [beat, slug, path]);
  const here = useQuery(api.team.here, { slug, path, now: Math.floor(now / 30_000) * 30_000 });
  if (!here?.length) return null;
  return (
    <span className="hidden items-center -space-x-1.5 sm:flex" aria-label={`Also here: ${here.map((p) => p.name).join(", ")}`}>
      {here.slice(0, 4).map((p) => (
        <Tooltip key={p.id} content={`${p.name} is here`}>
          <span className="grid size-6 place-items-center rounded-full border-2 border-surface bg-brand-700 text-xs font-semibold text-white">{p.name.slice(0, 1).toUpperCase()}</span>
        </Tooltip>
      ))}
    </span>
  );
}
