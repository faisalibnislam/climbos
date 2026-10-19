import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge must know the design system's custom scale, or it reads
 * `text-ui` / `text-2xs` as colours and drops `text-white` (and vice versa).
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: ["2xs", "ui", "kpi"] },
    classGroups: {
      "font-size": ["heading-page", "heading-section", "heading-card", "heading-dialog", "text-overline", "metric"],
    },
  },
});

/** Merge class names, resolving Tailwind conflicts (later classes win). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const numberFormatter = new Intl.NumberFormat("en-US");

/** Format an integer with thousands separators, e.g. 15000 → "15,000". */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Format whole US dollars, e.g. 2299 → "$2,299". */
export function formatUsd(value: number, options: { cents?: boolean } = {}): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: options.cents ? 2 : 0,
    maximumFractionDigits: options.cents ? 2 : 0,
  }).format(value);
}

/** Pluralize a simple English noun: plural(1, "seat") → "1 seat", plural(3, "seat") → "3 seats". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Only allow same-site relative redirect targets ("/app", "/onboarding?plan=growth").
 * Rejects absolute URLs, protocol-relative ("//evil.com") and backslash tricks.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/app"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
