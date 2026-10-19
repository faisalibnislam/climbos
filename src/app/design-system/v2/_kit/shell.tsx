"use client";

/*
 * Design-system shell: Signal theme scope, grouped sidebar (drawer on mobile),
 * top bar with breadcrumbs, ⌘K search across pages and element names, and a
 * comfortable/compact density toggle (remembered per browser).
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { ArrowRight, ChevronRight, Menu, Search, X } from "@/components/icons";
import { Kbd, Segmented, Toaster } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ALL_ITEMS, NAV, slugify } from "../nav";

type Density = "comfortable" | "compact";

function useThemeScope(density: Density) {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.dataset.theme;
    root.dataset.theme = "wact";
    return () => {
      if (prev) root.dataset.theme = prev;
      else delete root.dataset.theme;
    };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (density === "compact") root.dataset.density = "compact";
    else delete root.dataset.density;
    try {
      localStorage.setItem("ds-density", density);
    } catch {}
    return () => {
      delete root.dataset.density;
    };
  }, [density]);
}

interface Hit {
  title: string;
  sub: string;
  href: string;
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const all = useMemo<Hit[]>(
    () => ALL_ITEMS.flatMap((i) => [{ title: i.title, sub: i.group, href: i.href }, ...(i.elements ?? []).map((e) => ({ title: e, sub: `${i.group} · ${i.title}`, href: `${i.href}#${slugify(e)}` }))]),
    [],
  );
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return all.filter((h) => !h.href.includes("#")).slice(0, 40);
    return all
      .map((h) => ({ h, score: h.title.toLowerCase().startsWith(s) ? 0 : h.title.toLowerCase().includes(s) ? 1 : h.sub.toLowerCase().includes(s) ? 2 : 9 }))
      .filter((x) => x.score < 9)
      .sort((a, b) => a.score - b.score)
      .slice(0, 40)
      .map((x) => x.h);
  }, [q, all]);
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);
  if (!open) return null;
  const go = (h: Hit) => {
    onClose();
    setQ("");
    router.push(h.href);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 p-4 pt-[12vh]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Search the design system" className="w-full max-w-xl overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="size-4 text-ink-3" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => Math.min(hits.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter" && hits[idx]) go(hits[idx]);
              else if (e.key === "Escape") onClose();
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="ds-cmdk-list"
            aria-activedescendant={hits[idx] ? `ds-hit-${idx}` : undefined}
            placeholder="Search components, foundations, patterns…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3 focus-visible:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul id="ds-cmdk-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {hits.length ? (
            hits.map((h, i) => (
              <li key={h.href} id={`ds-hit-${i}`} role="option" aria-selected={i === idx}>
                <button type="button" onMouseEnter={() => setIdx(i)} onClick={() => go(h)} className={cn("flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-left", i === idx && "bg-surface-2")}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{h.title}</span>
                    <span className="block truncate text-xs text-ink-3">{h.sub}</span>
                  </span>
                  {i === idx ? <ArrowRight className="size-4 text-ink-3" /> : null}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-8 text-center text-sm text-ink-3">Nothing matches “{q}”.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Design system" className="flex flex-col gap-5">
      {NAV.map((g) => (
        <div key={g.title}>
          <p className="text-overline mb-1.5 px-2.5">{g.title}</p>
          <ul className="flex flex-col gap-px">
            {g.items.map((i) => {
              const active = path === i.href;
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn("flex items-center justify-between rounded-[var(--radius-control)] px-2.5 py-1.5 text-ui transition-colors", active ? "bg-surface font-medium text-ink shadow-[var(--card-shadow)]" : "text-ink-2 hover:bg-surface/60 hover:text-ink")}
                  >
                    {i.title}
                    {i.elements?.length && g.title === "Components" ? <span className="text-2xs tabular-nums text-ink-3">{i.elements.length}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DesignShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [density, setDensity] = useState<Density>("comfortable");
  const [cmdk, setCmdk] = useState(false);
  const [drawer, setDrawer] = useState(false);
  useThemeScope(density);
  useEffect(() => {
    try {
      const d = localStorage.getItem("ds-density");
      if (d === "compact") {
        const id = requestAnimationFrame(() => setDensity("compact"));
        return () => cancelAnimationFrame(id);
      }
    } catch {}
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdk((v) => !v);
      } else if (e.key === "/" && !(e.target as HTMLElement)?.closest("input, textarea, [contenteditable]")) {
        e.preventDefault();
        setCmdk(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const current = ALL_ITEMS.find((i) => i.href === path);
  return (
    // data-theme here too so the server-rendered page is already Signal (no flash);
    // the effect sets it on <html> for portals (dialogs, menus, toasts).
    <div data-theme="wact" data-density={density === "compact" ? "compact" : undefined} className="min-h-dvh bg-bg text-ink" style={{ fontFamily: "var(--font-body)" }}>
      <Toaster />
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-6 overflow-y-auto border-r border-line bg-bg px-3 py-5 lg:flex">
        <Link href="/design-system/v2" className="px-2.5">
          <Logo markClassName="size-7" className="text-lg" />
        </Link>
        <SideNav />
        <p className="mt-auto px-2.5 text-2xs text-ink-3">Signal · design system v2</p>
      </aside>
      {drawer ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 overflow-y-auto bg-bg px-3 py-5 shadow-lg">
            <div className="flex items-center justify-between px-2.5">
              <Logo markClassName="size-7" className="text-lg" />
              <button type="button" aria-label="Close navigation" onClick={() => setDrawer(false)} className="grid size-8 place-items-center rounded-[var(--radius-control)] hover:bg-surface"><X className="size-4" /></button>
            </div>
            <SideNav onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      ) : null}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/95 px-4 backdrop-blur sm:px-6">
          <button type="button" aria-label="Open navigation" onClick={() => setDrawer(true)} className="grid size-8 place-items-center rounded-[var(--radius-control)] hover:bg-surface lg:hidden"><Menu className="size-4" /></button>
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 whitespace-nowrap text-ui text-ink-3 sm:flex">
            <Link href="/design-system/v2" className="hover:text-ink">Design system</Link>
            {current && current.href !== "/design-system/v2" ? (
              <>
                <ChevronRight className="size-3.5" />
                <span>{current.group}</span>
                <ChevronRight className="size-3.5" />
                <span className="truncate text-ink" aria-current="page">{current.title}</span>
              </>
            ) : null}
          </nav>
          <button type="button" onClick={() => setCmdk(true)} className="ml-auto flex h-[var(--h-sm)] w-full max-w-56 shrink-0 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-ui text-ink-3 shadow-[var(--btn-2-shadow)] hover:text-ink">
            <Search className="size-4" />
            <span className="flex-1 text-left">Search</span>
            <Kbd>⌘K</Kbd>
          </button>
          <Segmented label="Density" value={density} onChange={setDensity} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} className="hidden md:inline-flex" />
        </header>
        <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-10">{children}</main>
      </div>
      <CommandPalette open={cmdk} onClose={() => setCmdk(false)} />
    </div>
  );
}
