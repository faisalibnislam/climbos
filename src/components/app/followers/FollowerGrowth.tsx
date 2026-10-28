"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { buttonClasses } from "@/components/ui";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
const signed = (n: number) => `${n >= 0 ? "▲" : "▼"} ${fmt(Math.abs(n))} this week`;

/** Followers per connected platform with the weekly change and a small 8-week bar chart. */
export function FollowerGrowth({ slug, always = false }: { slug: string; always?: boolean }) {
  const data = useQuery(api.followers.summary, { slug });
  if (!data) return null;
  const anyTracked = data.platforms.some((p) => p.latest !== null || p.connected);
  if (!anyTracked && !always) return null;
  return (
    <section aria-labelledby="followers-heading" className="flex flex-col gap-4">
      <h2 id="followers-heading" className="heading-section">Followers</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.platforms.map((p) =>
          p.latest !== null ? (
            <article key={p.provider} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-5">
              <h3 className="text-ui font-semibold text-ink">{p.label}</h3>
              <p className="font-[family-name:var(--font-display-serif)] text-4xl tabular-nums text-ink">{fmt(p.latest)}</p>
              <p className="text-ui text-ink-2">{p.weekChange === null ? "Change shows after a week" : signed(p.weekChange)}</p>
              {p.weekly.length > 1 ? (
                <div aria-hidden="true" className="mt-2 flex h-10 items-end gap-1">
                  {p.weekly.map((v, i) => {
                    const max = Math.max(...p.weekly);
                    const min = Math.min(...p.weekly);
                    const h = max === min ? 60 : 20 + ((v - min) / (max - min)) * 80;
                    return <span key={i} className={i === p.weekly.length - 1 ? "flex-1 rounded-sm bg-brand-800" : "flex-1 rounded-sm bg-brand-200"} style={{ height: `${h}%` }} />;
                  })}
                </div>
              ) : null}
            </article>
          ) : (
            <article key={p.provider} className="flex flex-col items-start justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-surface-2 p-5">
              <h3 className="text-ui font-semibold text-ink">{p.label}</h3>
              <p className="text-ui text-ink-3">{p.connected ? "First count arrives tomorrow." : "Connect to track followers."}</p>
              {p.connected ? null : (
                <Link href={`/app/${slug}/connections`} className={buttonClasses({ size: "sm", variant: "secondary" })}>
                  Connect
                </Link>
              )}
            </article>
          ),
        )}
      </div>
    </section>
  );
}
