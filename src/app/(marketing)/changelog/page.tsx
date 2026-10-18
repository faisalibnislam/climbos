import type { Metadata } from "next";
import { CHANGELOG } from "@shared/changelog";

export const metadata: Metadata = {
  title: "What's new",
  description: "Everything we've shipped in ClimbOS, newest first.",
  alternates: { canonical: "/changelog" },
};

export default function ChangelogPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="heading-page">What&apos;s new</h1>
      <p className="mt-2 text-ink-3">Everything we&apos;ve shipped, newest first.</p>
      <ol className="mt-10 flex flex-col gap-10">
        {CHANGELOG.map((e) => (
          <li key={e.date} className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <time dateTime={e.date} className="text-sm text-ink-3">
              {new Date(`${e.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </time>
            <div>
              <h2 className="heading-section">{e.title}</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink-2">
                {e.items.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
