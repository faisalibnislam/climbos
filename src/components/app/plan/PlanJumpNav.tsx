"use client";

/*
 * Floating "jump to" bar for long pages (the growth plan). It finds the page's top-level
 * sections by their headings, so it follows whatever the page renders (plan or compare),
 * highlights the one in view and scrolls to a section on click. Sticky at the bottom of
 * its container, so it stays centred over the content column.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  label: string;
}

/** Short names for long plan headings; anything else uses its heading text. */
const SHORT: [RegExp, string][] = [
  [/^the short version/i, "Summary"],
  [/^your goal/i, "Goal"],
  [/^growth plays/i, "Plays"],
  [/^(north star|diagnosis)/i, "Target"],
  [/^(execution|how it runs|phases)/i, "Execution"],
  [/^who to reach|^audiences/i, "Audiences"],
  [/^how we'?ll measure/i, "Measure"],
  [/^next review/i, "Next review"],
  [/^what we (know|learned)|insights/i, "Insights"],
  [/^sources/i, "Sources"],
  [/^discussion|comments/i, "Comments"],
  [/^recent work|latest work/i, "Work"],
  [/^review (your )?plan/i, "Approve"],
  [/^sharpen/i, "Sharpen"],
];

function shortLabel(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  for (const [re, l] of SHORT) if (re.test(t)) return l;
  return t.length > 18 ? `${t.slice(0, 17)}…` : t;
}

function collect(root: HTMLElement): Item[] {
  const out: Item[] = [];
  const seen = new Set<string>();
  for (const s of root.querySelectorAll<HTMLElement>("section[aria-labelledby]")) {
    if (s.parentElement?.closest("section[aria-labelledby]") && root.contains(s.parentElement.closest("section[aria-labelledby]"))) continue;
    if (s.closest("[hidden], .hidden") || s.offsetParent === null) continue;
    const hid = s.getAttribute("aria-labelledby") ?? "";
    const h = document.getElementById(hid);
    const label = s.dataset.navLabel ?? (h ? shortLabel(h.textContent ?? "") : "");
    if (!label || seen.has(label)) continue;
    if (!s.id) s.id = `jump-${hid}`;
    seen.add(label);
    out.push({ id: s.id, label });
  }
  return out;
}

export function PlanJumpNav({ rootRef, className }: { rootRef: RefObject<HTMLElement | null>; className?: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  // Rebuild the list when the page content changes (data loads, tabs, compare).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setItems((prev) => {
          const next = collect(root);
          return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
        }),
      );
    };
    refresh();
    const mo = new MutationObserver(refresh);
    mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
    };
  }, [rootRef]);

  // Which section is in view.
  useEffect(() => {
    if (!items.length) return;
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => Boolean(e));
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);

  // Appears once the page header has scrolled away.
  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 240);
    const id = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Keep the active item visible inside the bar.
  useEffect(() => {
    const el = active ? bar.current?.querySelector<HTMLElement>(`[data-jump="${active}"]`) : null;
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  if (items.length < 3) return null;
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <nav
      aria-label="Jump to section"
      className={cn(
        "pointer-events-none sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center transition-[opacity,transform] duration-200 motion-reduce:transition-none lg:bottom-4",
        shown ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        className,
      )}
    >
      <div ref={bar} className={cn("flex max-w-full gap-0.5 overflow-x-auto rounded-[var(--radius-card)] bg-ink p-1 text-white shadow-lg [scrollbar-width:none]", shown && "pointer-events-auto")}>
        {items.map((i) => (
          <a
            key={i.id}
            href={`#${i.id}`}
            data-jump={i.id}
            aria-current={active === i.id ? "true" : undefined}
            tabIndex={shown ? 0 : -1}
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById(i.id);
              // Land below the sticky top bar.
              if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: reduce ? "auto" : "smooth" });
              setActive(i.id);
            }}
            className={cn(
              "flex h-[var(--h-sm)] shrink-0 items-center whitespace-nowrap rounded-[var(--radius-control)] px-3 text-ui font-medium transition-colors",
              active === i.id ? "bg-white text-ink" : "text-white/75 hover:bg-white/10 hover:text-white",
            )}
          >
            {i.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
