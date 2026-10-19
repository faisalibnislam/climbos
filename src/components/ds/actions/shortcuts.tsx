"use client";

import { useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * Keyboard shortcut helpers. Write shortcuts as key lists, e.g. ["mod", "K"]:
 * `mod` is ⌘ on Apple devices and Ctrl elsewhere.
 */

const noop = () => () => {};
const detectMac = () => /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

/** True on Apple platforms. Renders as Mac on the server, then corrects after hydration. */
export function useIsMac() {
  return useSyncExternalStore(noop, detectMac, () => true);
}

const GLYPH: Record<string, [mac: string, other: string, spoken: string]> = {
  mod: ["⌘", "Ctrl", "Command"],
  ctrl: ["⌃", "Ctrl", "Control"],
  alt: ["⌥", "Alt", "Option"],
  shift: ["⇧", "Shift", "Shift"],
  enter: ["↵", "Enter", "Enter"],
  esc: ["Esc", "Esc", "Escape"],
  tab: ["⇥", "Tab", "Tab"],
  backspace: ["⌫", "Backspace", "Backspace"],
  up: ["↑", "↑", "Up arrow"],
  down: ["↓", "↓", "Down arrow"],
  left: ["←", "←", "Left arrow"],
  right: ["→", "→", "Right arrow"],
  space: ["Space", "Space", "Space"],
};

function glyph(key: string, mac: boolean) {
  const g = GLYPH[key.toLowerCase()];
  if (!g) return { visual: key.length === 1 ? key.toUpperCase() : key, spoken: key.length === 1 ? key.toUpperCase() : key };
  return { visual: mac ? g[0] : g[1], spoken: key.toLowerCase() === "mod" && !mac ? "Control" : g[2] };
}

/** Plain-text form of a shortcut, e.g. "⌘K" or "Ctrl+K" (for titles and tooltips). */
export function shortcutText(keys: string[], mac: boolean) {
  const parts = keys.map((k) => glyph(k, mac).visual);
  return mac ? parts.join("") : parts.join("+");
}

/** Does this keyboard event match the shortcut? Use in onKeyDown handlers. */
export function matchesShortcut(e: KeyboardEvent | ReactKeyboardEvent, keys: string[]) {
  const mac = detectMac();
  const mods = new Set(keys.slice(0, -1).map((k) => k.toLowerCase()));
  const key = keys[keys.length - 1].toLowerCase();
  const wantMeta = mods.has("mod") ? mac : false;
  const wantCtrl = mods.has("ctrl") || (mods.has("mod") && !mac);
  return (
    e.metaKey === wantMeta &&
    e.ctrlKey === wantCtrl &&
    e.shiftKey === mods.has("shift") &&
    e.altKey === mods.has("alt") &&
    (e.key.toLowerCase() === key || (key === "esc" && e.key === "Escape") || (key === "enter" && e.key === "Enter"))
  );
}

export interface KeyComboProps {
  /** Keys in order, e.g. ["mod", "shift", "Z"]. */
  keys: string[];
  /** `dark` for use on ink buttons, tooltips and bars. */
  tone?: "default" | "dark";
  size?: "sm" | "md";
  className?: string;
}

/** Shortcut chips (⌘ K). Screen readers hear "Command K" once, not each glyph. */
export function KeyCombo({ keys, tone = "default", size = "sm", className }: KeyComboProps) {
  const mac = useIsMac();
  const parts = keys.map((k) => glyph(k, mac));
  return (
    <span className={cn("inline-flex items-center gap-0.5 align-middle", className)}>
      <span className="sr-only">{parts.map((p) => p.spoken).join(" ")}</span>
      {parts.map((p, i) => (
        <kbd
          key={`${p.visual}-${i}`}
          aria-hidden="true"
          className={cn(
            "inline-flex items-center justify-center rounded-[var(--radius-control)] border font-sans font-medium tabular-nums",
            size === "sm" ? "h-5 min-w-5 px-1 text-2xs" : "h-6 min-w-6 px-1.5 text-xs",
            tone === "dark" ? "border-white/20 bg-white/10 text-white/80" : "border-line-strong bg-surface text-ink-3 shadow-[0_1px_0_var(--line-strong)]",
          )}
        >
          {p.visual}
        </kbd>
      ))}
    </span>
  );
}
