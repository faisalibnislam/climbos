import { DM_Sans, Geist, Hanken_Grotesk, Instrument_Sans } from "next/font/google";

/* Body font candidates, loaded only on this preview page. Inter is the current body font. */
const geist = Geist({ subsets: ["latin"], display: "swap" });
const instrument = Instrument_Sans({ subsets: ["latin"], display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], display: "swap" });

const CANDIDATES: { name: string; family: string; note: string }[] = [
  { name: "Inter (current)", family: "var(--font-sans-ui)", note: "Neutral, very legible at 13–14px, everywhere in SaaS." },
  { name: "Geist", family: geist.style.fontFamily, note: "Crisp and modern with tight numbers; closest to the reference dashboards." },
  { name: "Instrument Sans", family: instrument.style.fontFamily, note: "Slightly condensed with warm curves; pairs closely with Reckless." },
  { name: "DM Sans", family: dmSans.style.fontFamily, note: "Soft geometric and friendly; rounder, less corporate." },
  { name: "Hanken Grotesk", family: hanken.style.fontFamily, note: "Classic grotesk with a little character; calm in tables." },
];

/** The same KPI, table row, copy and buttons in each candidate, under a Reckless title. */
export function BodyFonts() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {CANDIDATES.map((c) => (
        <div key={c.name} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--card-shadow)]" style={{ fontFamily: c.family }}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">{c.name}</p>
            <p className="text-2xs text-ink-3">Free · Google Fonts</p>
          </div>
          <p className="font-display text-2xl tracking-[-0.02em]">Know which plays bring customers</p>
          <p className="text-sm text-ink-2">ClimbOS researches your business, plans the work and tracks every lead back to the play that brought it.</p>
          <div className="flex items-end justify-between rounded-xl bg-surface-2 p-3">
            <div>
              <p className="text-[30px] font-semibold leading-9 tracking-[-0.02em] tabular-nums">$4.20</p>
              <p className="text-ui text-ink-2">CPL (cost per lead)</p>
            </div>
            <p className="text-ui tabular-nums text-ink-2">1,200 · 180 · 61%</p>
          </div>
          <div className="flex flex-wrap gap-2 text-ui">
            <span className="inline-flex h-8 items-center rounded-lg bg-ink px-3 font-medium text-white">Approve</span>
            <span className="inline-flex h-8 items-center rounded-lg bg-surface px-3 font-medium shadow-[var(--btn-2-shadow)] ring-1 ring-line">Export</span>
            <span className="inline-flex h-6 items-center rounded-full bg-green-100 px-2.5 text-xs font-medium text-green-800">Active</span>
          </div>
          <p className="text-xs text-ink-3">{c.note}</p>
        </div>
      ))}
    </div>
  );
}
