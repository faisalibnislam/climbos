"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CalendarCheck, CalendarPlus, Clock, Download, Globe } from "@/components/icons"
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { icsInvite } from "../../../../shared/outbound";
import { Logo } from "@/components/brand/Logo";
import { Button, Field, Input, Skeleton, Textarea } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { cn } from "@/lib/utils";

/**
 * ClimbOS's own booking page: a prospect picks a time in their own time zone
 * and gets a confirmed call (with calendar links). No account needed.
 */
export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const ref = useSearchParams().get("ref") ?? undefined;
  const page = useQuery(api.outbound.publicPage, { slug });
  const book = useMutation(api.outbound.book);
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const days = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const s of page?.slots ?? []) {
      const key = new Date(s).toLocaleDateString("en-CA", { timeZone: tz });
      m.set(key, [...(m.get(key) ?? []), s]);
    }
    return [...m.entries()];
  }, [page?.slots, tz]);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", company: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ startAt: number; endAt: number } | null>(null);
  const activeDay = day ?? days[0]?.[0] ?? null;
  const times = days.find(([d]) => d === activeDay)?.[1] ?? [];
  const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: tz });
  const fmtLong = (ms: number) => new Date(ms).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center bg-bg px-4 py-10">
      <Logo markClassName="size-6" />
      <div className="mt-8 w-full max-w-3xl rounded-xl border border-line bg-surface">
        {page === undefined ? (
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-40" />
          </div>
        ) : page === null ? (
          <div className="p-6">
            <h1 className="heading-page">This page isn&apos;t available</h1>
            <p className="mt-1 text-sm text-ink-3">The link may be old. Ask the sender for a new one.</p>
          </div>
        ) : done ? (
          <div className="flex flex-col items-start gap-4 p-6 sm:p-8">
            <span className="grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-800">
              <CalendarCheck aria-hidden className="size-5" />
            </span>
            <div>
              <h1 className="heading-page">You&apos;re booked</h1>
              <p className="mt-1 text-sm text-ink-2">
                {page.title} · <strong>{fmtLong(done.startAt)}</strong> ({page.durationMin} min). A confirmation is on its way to your inbox.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a
                  href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(page.title)}&dates=${new Date(done.startAt).toISOString().replace(/[-:]|\.\d{3}/g, "")}/${new Date(done.endAt).toISOString().replace(/[-:]|\.\d{3}/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <CalendarPlus aria-hidden /> Google Calendar
                </a>
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const ics = icsInvite({ uid: `${slug}-${done.startAt}`, startAt: done.startAt, endAt: done.endAt, title: page.title, description: `Call with ${page.businessName}`, organizer: page.businessName });
                  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "call.ics";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download aria-hidden /> Apple / Outlook (.ics)
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr]">
            <div className="border-b border-line p-6 md:border-b-0 md:border-r">
              <p className="text-overline">{page.businessName}</p>
              <h1 className="heading-section mt-1">{page.title}</h1>
              <p className="mt-3 flex items-center gap-2 text-sm text-ink-3">
                <Clock aria-hidden className="size-4" /> {page.durationMin} minutes
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-ink-3">
                <Globe aria-hidden className="size-4" /> Times in {tz.replace(/_/g, " ")}
              </p>
            </div>
            <div className="min-w-0 p-6">
              {days.length === 0 ? (
                <p className="text-sm text-ink-3">No open times in the next two weeks. Please reply to the email instead.</p>
              ) : slot === null ? (
                <>
                  <h2 className="heading-card">Pick a day</h2>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Day">
                    {days.map(([d, s]) => {
                      const date = new Date(s[0]);
                      const selected = d === activeDay;
                      return (
                        <button
                          key={d}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setDay(d)}
                          className={cn(
                            "flex min-w-16 shrink-0 flex-col items-center rounded-lg border px-3 py-2 text-ui transition-colors",
                            selected ? "border-brand-800 bg-brand-800 text-white" : "border-control bg-surface text-ink hover:bg-surface-2",
                          )}
                        >
                          <span className="text-xs">{date.toLocaleDateString(undefined, { weekday: "short", timeZone: tz })}</span>
                          <span className="text-base font-semibold">{date.toLocaleDateString(undefined, { day: "numeric", timeZone: tz })}</span>
                        </button>
                      );
                    })}
                  </div>
                  <h2 className="heading-card mt-5">Pick a time</h2>
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {times.map((t) => (
                      <button key={t} type="button" onClick={() => setSlot(t)} className="h-10 rounded-lg border border-control bg-surface text-ui font-medium text-ink transition-colors hover:border-brand-800 hover:bg-brand-50">
                        {fmtTime(t)}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <form
                  className="flex flex-col gap-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError(null);
                    try {
                      const r = await book({ slug, startAt: slot, name: form.name, email: form.email, company: form.company || undefined, note: form.note || undefined, ref });
                      setDone({ startAt: r.startAt, endAt: r.endAt });
                    } catch (err) {
                      setError(errorMessage(err));
                      setSlot(null);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{fmtLong(slot)}</p>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setSlot(null)}>
                      Change
                    </Button>
                  </div>
                  <Field label="Your name">
                    <Input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} />
                  </Field>
                  <Field label="Work email">
                    <Input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={200} />
                  </Field>
                  <Field label="Company" hint="Optional">
                    <Input autoComplete="organization" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} maxLength={120} />
                  </Field>
                  <Field label="Anything we should know?" hint="Optional">
                    <Textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={500} />
                  </Field>
                  <Button type="submit" loading={busy}>
                    Confirm the call
                  </Button>
                  <p className="text-xs text-ink-3">We use your email only to send the invite and reminders for this call.</p>
                </form>
              )}
              {error ? (
                <p role="alert" className="mt-3 text-sm text-red-800">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
