"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ArrowDown, ArrowUp, Printer } from "@/components/icons"
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

const PERIODS = [7, 30, 90] as const;
const fmt = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** A client-facing results report in the agency's brand. Printable to PDF. */
export default function ClientReportPage() {
  const { token } = useParams<{ token: string }>();
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const r = useQuery(api.clientReports.shared, { token, days });
  const viewed = useMutation(api.clientReports.viewed);
  const counted = useRef(false);
  useEffect(() => {
    if (r && !counted.current) {
      counted.current = true;
      document.title = `${r.client} · results${r.agency ? ` · ${r.agency}` : ""}`;
      void viewed({ token });
    }
  }, [r, token, viewed]);
  if (r === undefined) return <Skeleton className="mx-auto mt-24 h-72 w-full max-w-3xl" />;
  if (r === null) return <main className="grid min-h-dvh place-items-center p-6 text-sm text-ink-3">This report link isn&apos;t active.</main>;
  return (
    <main className="min-h-dvh bg-white px-5 py-10 text-ink print:py-0">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex items-center justify-between gap-4 border-b pb-5" style={{ borderColor: r.color }}>
          <div className="flex items-center gap-3">
            {r.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.logoUrl} alt={r.agency ?? "Logo"} className="h-10 w-auto" />
            ) : r.agency ? (
              <span className="text-lg font-semibold" style={{ color: r.color }}>
                {r.agency}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {PERIODS.map((d) => (
              <button key={d} type="button" onClick={() => setDays(d)} className={cn("rounded-full px-3 py-1 text-sm", d === days ? "text-white" : "bg-surface-2 text-ink-2")} style={d === days ? { background: r.color } : undefined}>
                {d} days
              </button>
            ))}
            <button type="button" onClick={() => window.print()} aria-label="Print or save as PDF" className="rounded-full bg-surface-2 p-2 text-ink-2">
              <Printer className="size-4" aria-hidden />
            </button>
          </div>
        </header>
        <div>
          <p className="text-sm text-ink-3">
            Results for {r.client} · {fmt(r.from)} – {fmt(r.to)}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{r.headline}</h1>
        </div>
        {r.lines.length ? (
          <ul className="grid gap-3 sm:grid-cols-3">
            {r.lines.map((l) => (
              <li key={l.key} className="rounded-2xl border border-line p-4">
                <p className="text-xs text-ink-3">{l.label}</p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums">{l.value.toLocaleString("en-US")}</span>
                  {l.change ? (
                    <span className={cn("inline-flex items-center text-xs font-medium", l.change > 0 ? "text-brand-800" : "text-red-800")}>
                      {l.change > 0 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
                      {Math.abs(l.change).toLocaleString("en-US")} vs previous
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-2">No activity in this period yet.</p>
        )}
        {r.competitors.length ? (
          <section>
            <h2 className="text-lg font-semibold">Market watch</h2>
            <ul className="mt-2 space-y-1.5 text-ink-2">
              {r.competitors.map((c, i) => (
                <li key={i}>
                  <span className="font-medium text-ink">{c.name}:</span> {c.summary}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <footer className="border-t border-line pt-4 text-xs text-ink-3">
          {r.agency ? `Prepared by ${r.agency}` : "Results report"}
          {r.poweredBy ? " · Powered by ClimbOS" : ""}
        </footer>
      </div>
    </main>
  );
}
