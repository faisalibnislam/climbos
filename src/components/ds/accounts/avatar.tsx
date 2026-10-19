"use client";

/*
 * People marks: UserAvatar (photo → initials fallback, sizes, presence dot),
 * AvatarGroup (+N overflow popover) and PresenceIndicator (dot + text).
 * Circles are for people only; workspaces/brands use `shape="square"`.
 */
import { useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";

export type Presence = "online" | "away" | "busy" | "offline";
export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface Person {
  id: string;
  name: string;
  email?: string;
  src?: string | null;
  presence?: Presence;
  role?: string;
}

const SIZE: Record<AvatarSize, { box: string; text: string; dot: string }> = {
  xs: { box: "size-5", text: "text-2xs", dot: "size-1.5 ring-1" },
  sm: { box: "size-6", text: "text-2xs", dot: "size-2 ring-[1.5px]" },
  md: { box: "size-8", text: "text-xs", dot: "size-2.5 ring-2" },
  lg: { box: "size-10", text: "text-sm", dot: "size-3 ring-2" },
  xl: { box: "size-14", text: "text-lg", dot: "size-3.5 ring-[3px]" },
};

/** Soft, deterministic fills so the same person always gets the same colour. */
const FILLS = ["bg-brand-100 text-brand-900", "bg-sun-soft text-brand-950", "bg-cream text-ink", "bg-surface-3 text-ink", "bg-blue-100 text-blue-800", "bg-orange-100 text-orange-800"];

export const PRESENCE: Record<Presence, { label: string; dot: string }> = {
  online: { label: "Online", dot: "bg-green-500" },
  away: { label: "Away", dot: "bg-amber-500" },
  busy: { label: "Do not disturb", dot: "bg-red-500" },
  offline: { label: "Offline", dot: "bg-surface-3 shadow-[inset_0_0_0_1.5px_var(--chart-6)]" },
};

export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function fillFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FILLS[h % FILLS.length];
}

export interface UserAvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  presence?: Presence;
  /** People are round; workspaces, brands and bots are square. */
  shape?: "circle" | "square";
  /** Coloured ring, e.g. a collaborator's cursor colour. */
  ringColor?: string;
  className?: string;
}

/** Avatar with image, initials fallback (also when the image fails) and an optional presence dot. */
export function UserAvatar({ name, src, size = "md", presence, shape = "circle", ringColor, className }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const s = SIZE[size];
  const showImg = src && !failed;
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "inline-grid place-items-center overflow-hidden font-semibold",
          s.box,
          s.text,
          shape === "circle" ? "rounded-full" : "rounded-[var(--radius-control)]",
          !showImg && fillFor(name),
        )}
        style={ringColor ? { boxShadow: `0 0 0 2px var(--surface), 0 0 0 4px ${ringColor}` } : undefined}
      >
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatars may come from any provider domain
          <img src={src} alt={name} className="size-full object-cover" onError={() => setFailed(true)} />
        ) : (
          <>
            <span aria-hidden="true">{initialsOf(name)}</span>
            <span className="sr-only">{name}</span>
          </>
        )}
      </span>
      {presence ? (
        <span
          aria-label={PRESENCE[presence].label}
          role="img"
          className={cn("absolute bottom-0 right-0 rounded-full ring-surface", s.dot, PRESENCE[presence].dot)}
        />
      ) : null}
    </span>
  );
}

export interface AvatarGroupProps {
  people: Person[];
  /** How many avatars show before the +N chip. */
  max?: number;
  size?: Exclude<AvatarSize, "xl">;
  /** Accessible name for the group, e.g. "Workspace members". */
  label: string;
  className?: string;
}

/** Overlapping avatars; the +N chip opens a popover listing everyone else. */
export function AvatarGroup({ people, max = 4, size = "md", label, className }: AvatarGroupProps) {
  const shown = people.slice(0, max);
  const rest = people.slice(max);
  return (
    <div role="group" aria-label={`${label}: ${people.length}`} className={cn("flex items-center", className)}>
      {shown.map((p, i) => (
        <span key={p.id} className={cn("rounded-full ring-2 ring-surface", i > 0 && "-ml-2")} title={p.name}>
          <UserAvatar name={p.name} src={p.src} size={size} />
        </span>
      ))}
      {rest.length ? (
        <Popover>
          <PopoverTrigger
            aria-label={`Show ${rest.length} more`}
            className={cn(
              "-ml-2 inline-grid place-items-center rounded-full bg-surface-2 font-semibold text-ink-2 ring-2 ring-surface hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]",
              SIZE[size].box,
              SIZE[size].text,
            )}
          >
            +{rest.length}
          </PopoverTrigger>
          <PopoverContent className="w-60 p-1.5">
            <p className="text-overline px-2 pb-1 pt-1">{rest.length} more</p>
            <ul>
              {rest.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-[var(--radius-control)] px-2 py-1.5">
                  <UserAvatar name={p.name} src={p.src} size="sm" presence={p.presence} />
                  <span className="min-w-0 flex-1 truncate text-ui">{p.name}</span>
                  {p.role ? <span className="text-xs text-ink-3">{p.role}</span> : null}
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

/** Presence dot with text (never colour alone). `detail` adds e.g. "Last seen 2h ago". */
export function PresenceIndicator({ presence, detail, className }: { presence: Presence; detail?: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-ui text-ink-2", className)}>
      <span aria-hidden className="relative inline-flex size-2">
        {presence === "online" ? <span className="absolute inset-0 rounded-full bg-green-500 opacity-60 motion-safe:animate-ping" /> : null}
        <span className={cn("relative size-2 rounded-full", PRESENCE[presence].dot)} />
      </span>
      <span>{PRESENCE[presence].label}</span>
      {detail ? <span className="text-ink-3">· {detail}</span> : null}
    </span>
  );
}
