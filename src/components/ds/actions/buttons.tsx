"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu as RMenu } from "radix-ui";
import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronDown, CircleAlert, Copy, Plus, RefreshCw, Trash2, X } from "@/components/icons";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Tooltip,
  buttonClasses,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { KeyCombo } from "./shortcuts";

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

export interface MenuAction {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  /** Shortcut shown on the right, e.g. ["mod", "D"]. */
  shortcut?: string[];
  danger?: boolean;
  disabled?: boolean;
  /** Draws a separator above this item. */
  separated?: boolean;
}

/** Menu items for any of the dropdown-based buttons. */
export function MenuActions({ actions, label }: { actions: MenuAction[]; label?: string }) {
  return (
    <>
      {label ? <DropdownMenuLabel>{label}</DropdownMenuLabel> : null}
      {actions.map((a) => (
        <Fragment key={a.label}>
          {a.separated ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem icon={a.icon} danger={a.danger} disabled={a.disabled} onSelect={a.onSelect}>
            <span className="flex-1">{a.label}</span>
            {a.shortcut ? <KeyCombo keys={a.shortcut} className="pl-4" /> : null}
          </DropdownMenuItem>
        </Fragment>
      ))}
    </>
  );
}

/** Keeps a timeout that is cleared on unmount. */
function useTimeout() {
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (ref.current) clearTimeout(ref.current);
  }, []);
  return (fn: () => void, ms: number) => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(fn, ms);
  };
}

/* ------------------------------------------------------------------ */
/* Split button                                                        */
/* ------------------------------------------------------------------ */

export interface SplitButtonProps {
  children: ReactNode;
  onClick?: () => void;
  /** Related alternatives in the menu half. */
  actions: MenuAction[];
  variant?: Extract<ButtonVariant, "primary" | "secondary">;
  size?: ButtonSize;
  /** Accessible name of the menu half. */
  menuLabel?: string;
  disabled?: boolean;
  loading?: boolean;
}

/** A default action plus a menu of close alternatives (Approve ▾ Approve and schedule). */
export function SplitButton({ children, onClick, actions, variant = "primary", size = "md", menuLabel = "More options", disabled, loading }: SplitButtonProps) {
  const square = size === "sm" ? "w-8" : size === "lg" ? "w-10" : "w-9";
  return (
    <div role="group" className="inline-flex">
      <Button variant={variant} size={size} onClick={onClick} disabled={disabled} loading={loading} className="rounded-r-none">
        {children}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            disabled={disabled || loading}
            aria-label={menuLabel}
            className={cn("rounded-l-none px-0", square, variant === "primary" ? "border-l border-white/20" : "-ml-px")}
          >
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <MenuActions actions={actions} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dropdown button                                                     */
/* ------------------------------------------------------------------ */

export interface DropdownButtonOption {
  value: string;
  label: string;
}

export interface DropdownButtonProps {
  /** Button text (action menus). For pickers, the selected label is shown instead. */
  children?: ReactNode;
  icon?: ReactNode;
  /** Action menu. */
  actions?: MenuAction[];
  /** Picker menu: one option is ticked and shown on the button. */
  options?: DropdownButtonOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  /** `soft` is the quiet grey filter look (Sources ⌄, Last 6 months ⌄). */
  variant?: ButtonVariant | "soft";
  size?: ButtonSize;
  align?: "start" | "end";
  menuLabel?: string;
  "aria-label"?: string;
}

/** A button that opens a menu of actions, or picks one value from a short list. */
export function DropdownButton({ children, icon, actions, options, value, onValueChange, variant = "secondary", size = "md", align = "start", menuLabel, "aria-label": ariaLabel }: DropdownButtonProps) {
  const selected = options?.find((o) => o.value === value);
  const soft = variant === "soft";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={soft ? "ghost" : variant}
          size={size}
          aria-label={ariaLabel}
          className={cn("group/dd", soft && "bg-surface-2 font-normal text-ink-2 hover:bg-surface-3 hover:text-ink")}
        >
          {icon}
          {selected ? selected.label : children}
          <ChevronDown aria-hidden="true" className="-mr-0.5 transition-transform group-data-[state=open]/dd:rotate-180" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {options ? (
          <>
            {menuLabel ? <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel> : null}
            <RMenu.RadioGroup value={value} onValueChange={onValueChange}>
              {options.map((o) => (
                <RMenu.RadioItem
                  key={o.value}
                  value={o.value}
                  className="flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-md px-2.5 text-ui text-ink outline-none data-[highlighted]:bg-surface-2 data-[state=checked]:font-medium [&_svg]:size-4"
                >
                  <span className="flex-1">{o.label}</span>
                  <RMenu.ItemIndicator className="inline-flex">
                    <Check aria-hidden="true" />
                  </RMenu.ItemIndicator>
                </RMenu.RadioItem>
              ))}
            </RMenu.RadioGroup>
          </>
        ) : (
          <MenuActions actions={actions ?? []} label={menuLabel} />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------------------------------------------ */
/* Floating action button                                              */
/* ------------------------------------------------------------------ */

export interface FabAction {
  label: string;
  icon: ReactNode;
  onSelect?: () => void;
}

export interface FabProps {
  icon: ReactNode;
  label: string;
  /** Show the label next to the icon. */
  extended?: boolean;
  onClick?: () => void;
  /** Speed dial: the button opens these actions instead of running onClick. */
  actions?: FabAction[];
  /** `fixed` pins to the viewport corner; `absolute` to the nearest positioned parent. */
  position?: "fixed" | "absolute" | "static";
  /** `lime` only when it is the single most important action on the screen. */
  tone?: "ink" | "lime";
  className?: string;
}

/** The one floating action on mobile and canvas screens. Optional speed dial. */
export function Fab({ icon, label, extended, onClick, actions, position = "fixed", tone = "ink", className }: FabProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const pos = position === "fixed" ? "fixed bottom-6 right-6 z-40" : position === "absolute" ? "absolute bottom-4 right-4 z-10" : "relative";
  const toneCls = tone === "lime" ? "bg-sun text-ink hover:brightness-95" : "bg-ink text-white hover:bg-black";

  const button = (
    <button
      ref={trigger}
      type="button"
      aria-label={extended ? undefined : label}
      aria-expanded={actions ? open : undefined}
      aria-controls={actions ? listId : undefined}
      onClick={() => (actions ? setOpen((o) => !o) : onClick?.())}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-cta)] text-sm font-medium shadow-lg transition-[background-color,filter] [&_svg]:size-5",
        extended ? "px-5" : "w-12",
        toneCls,
      )}
    >
      <span aria-hidden="true" className={cn("inline-flex transition-transform duration-200", open && "rotate-45")}>
        {icon}
      </span>
      {extended ? label : null}
    </button>
  );

  return (
    <div ref={wrap} className={cn(pos, "flex flex-col items-end gap-2", className)} onKeyDown={(e) => e.key === "Escape" && open && close()}>
      {actions && open ? (
        <ul id={listId} aria-label={label} className="flex flex-col items-end gap-2">
          {actions.map((a) => (
            <li key={a.label}>
              <button
                type="button"
                onClick={() => {
                  a.onSelect?.();
                  close();
                }}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface pl-3 pr-3.5 text-ui font-medium text-ink shadow-lg hover:bg-surface-2 [&_svg]:size-4 [&_svg]:text-ink-3"
              >
                <span aria-hidden="true" className="inline-flex">
                  {a.icon}
                </span>
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {extended || actions ? button : <Tooltip content={label} side="left">{button}</Tooltip>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle button + group                                               */
/* ------------------------------------------------------------------ */

export interface ToggleButtonProps extends Omit<ButtonProps, "onChange" | "variant"> {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  /** `ghost` for toolbars (Bold, Pin); `secondary` for labelled toggles (Follow). */
  variant?: "ghost" | "secondary";
  icon?: ReactNode;
}

/** On/off button (aria-pressed). Pressed is shown by fill and weight, not colour alone. */
export function ToggleButton({ pressed, onPressedChange, variant = "secondary", icon, children, className, size = "md", ...props }: ToggleButtonProps) {
  const iconOnly = !children;
  const square = size === "sm" ? "w-8 px-0" : size === "lg" ? "w-10 px-0" : "w-9 px-0";
  return (
    <Button
      variant={variant}
      size={size}
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        iconOnly && square,
        pressed && (variant === "ghost" ? "bg-surface-3 text-ink hover:bg-surface-3" : "border-ink bg-ink text-white hover:bg-ink"),
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      {children}
    </Button>
  );
}

export interface ToggleGroupItem {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface ToggleGroupProps {
  label: string;
  items: ToggleGroupItem[];
  value: string[];
  onValueChange: (value: string[]) => void;
  /** `single` keeps exactly one pressed (view switchers). */
  type?: "single" | "multiple";
  /** Hide labels and show icons (labels become tooltips and aria-labels). */
  iconOnly?: boolean;
  size?: ButtonSize;
}

/** A set of toggle buttons. Arrow keys move between them. */
export function ToggleGroup({ label, items, value, onValueChange, type = "multiple", iconOnly, size = "sm" }: ToggleGroupProps) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const btns = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length;
    e.preventDefault();
    btns[next]?.focus();
  };
  return (
    <div role="group" aria-label={label} onKeyDown={onKey} className="inline-flex gap-0.5 rounded-[calc(var(--radius-control)+2px)] bg-surface-2 p-0.5">
      {items.map((it) => {
        const on = value.includes(it.value);
        const btn = (
          <ToggleButton
            key={it.value}
            variant="ghost"
            size={size}
            pressed={on}
            aria-label={iconOnly ? it.label : undefined}
            icon={it.icon}
            onPressedChange={(p) => {
              if (type === "single") onValueChange([it.value]);
              else onValueChange(p ? [...value, it.value] : value.filter((v) => v !== it.value));
            }}
            className={cn(on && "bg-surface text-ink shadow-[var(--btn-2-shadow)] hover:bg-surface")}
          >
            {iconOnly ? null : it.label}
          </ToggleButton>
        );
        return iconOnly ? (
          <Tooltip key={it.value} content={it.label}>
            {btn}
          </Tooltip>
        ) : (
          btn
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Loading (async) button                                              */
/* ------------------------------------------------------------------ */

export interface AsyncButtonProps extends Omit<ButtonProps, "onClick" | "loading"> {
  /** Return a promise; the button shows a spinner until it settles. */
  onClick: () => Promise<unknown> | void;
  /** Shown for a moment after success, e.g. "Saved". */
  successText?: ReactNode;
  /** Shown after a failure, e.g. "Try again". */
  errorText?: ReactNode;
}

/** Button that runs async work: spinner while busy, a short confirmation after. */
export function AsyncButton({ onClick, successText, errorText = "Try again", loadingText, children, ...props }: AsyncButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const later = useTimeout();
  const run = async () => {
    setState("loading");
    try {
      await onClick();
      if (successText) {
        setState("success");
        later(() => setState("idle"), 1600);
      } else setState("idle");
    } catch {
      setState("error");
    }
  };
  return (
    <>
      <Button {...props} loading={state === "loading"} loadingText={loadingText} onClick={run}>
        {state === "success" ? (
          <>
            <Check aria-hidden="true" /> {successText}
          </>
        ) : state === "error" ? (
          <>
            <CircleAlert aria-hidden="true" /> {errorText}
          </>
        ) : (
          children
        )}
      </Button>
      <span className="sr-only" aria-live="polite">
        {state === "loading" ? "Working" : state === "success" ? successText : state === "error" ? "Failed" : ""}
      </span>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Copy button                                                         */
/* ------------------------------------------------------------------ */

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

export interface CopyButtonProps {
  /** Text placed on the clipboard. */
  value: string;
  label?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Copies a value and confirms with a tick for two seconds (announced to screen readers). */
export function CopyButton({ value, label = "Copy", copiedLabel = "Copied", iconOnly, variant = "secondary", size = "sm", className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const later = useTimeout();
  const copy = async () => {
    await writeClipboard(value);
    setCopied(true);
    later(() => setCopied(false), 2000);
  };
  const icon = copied ? <Check aria-hidden="true" className="text-green-800" /> : <Copy aria-hidden="true" />;
  return (
    <>
      {iconOnly ? (
        <IconButton aria-label={copied ? copiedLabel : label} icon={icon} variant={variant} size={size} onClick={copy} className={className} />
      ) : (
        <Button variant={variant} size={size} onClick={copy} className={className}>
          {icon}
          {copied ? copiedLabel : label}
        </Button>
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? copiedLabel : ""}
      </span>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Back, close, refresh                                                */
/* ------------------------------------------------------------------ */

export interface BackButtonProps {
  /** Link target. Without it the button calls onClick, or goes back in history. */
  href?: string;
  onClick?: () => void;
  children?: ReactNode;
  iconOnly?: boolean;
  className?: string;
}

/** Returns to the parent page. Prefer `href` (a real link) when the parent is known. */
export function BackButton({ href, onClick, children = "Back", iconOnly, className }: BackButtonProps) {
  const router = useRouter();
  const cls = buttonClasses({ variant: "ghost", size: "sm", className: cn("-ml-2 text-ink-2 hover:text-ink", iconOnly && "w-8 px-0", className) });
  const content = (
    <>
      <ArrowLeft aria-hidden="true" />
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick ?? (() => router.back())} className={cls}>
      {content}
    </button>
  );
}

export interface CloseButtonProps {
  onClick?: () => void;
  label?: string;
  size?: ButtonSize;
  /** `dark` on ink bars and image overlays. */
  tone?: "default" | "dark";
  className?: string;
}

/** Dismiss control for dialogs, panels, banners and chips. */
export function CloseButton({ onClick, label = "Close", size = "sm", tone = "default", className }: CloseButtonProps) {
  return (
    <IconButton
      aria-label={label}
      tooltip={false}
      icon={<X />}
      size={size}
      onClick={onClick}
      className={cn(tone === "dark" ? "text-white/80 hover:bg-white/10 hover:text-white active:bg-white/15" : "text-ink-3 hover:text-ink", className)}
    />
  );
}

export interface RefreshButtonProps {
  onRefresh: () => Promise<unknown> | void;
  /** Freshness text, e.g. "Updated 2 min ago". */
  lastUpdated?: ReactNode;
  label?: string;
  iconOnly?: boolean;
  size?: ButtonSize;
}

/** Re-fetches data. The icon turns while busy; freshness sits beside it. */
export function RefreshButton({ onRefresh, lastUpdated, label = "Refresh", iconOnly, size = "sm" }: RefreshButtonProps) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };
  const icon = <RefreshCw aria-hidden="true" className={cn(busy && "animate-spin")} />;
  return (
    <span className="inline-flex items-center gap-2">
      {lastUpdated ? (
        <span className="text-xs text-ink-3" aria-live="polite">
          {busy ? "Refreshing…" : lastUpdated}
        </span>
      ) : null}
      {iconOnly ? (
        <IconButton aria-label={label} icon={icon} size={size} variant="secondary" onClick={run} aria-busy={busy || undefined} disabled={busy} />
      ) : (
        <Button variant="secondary" size={size} onClick={run} aria-busy={busy || undefined} disabled={busy}>
          {icon}
          {label}
        </Button>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Expand / collapse                                                   */
/* ------------------------------------------------------------------ */

export interface ExpandButtonProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** id of the region it shows and hides. */
  controls?: string;
  /** Visible text; with iconOnly it becomes the accessible name. */
  children: ReactNode;
  iconOnly?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

/** Shows or hides a region. The chevron turns; aria-expanded carries the state. */
export function ExpandButton({ expanded, onExpandedChange, controls, children, iconOnly, size = "sm", variant = "ghost" }: ExpandButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={() => onExpandedChange(!expanded)}
      className={cn(iconOnly && (size === "sm" ? "w-8 px-0" : "w-9 px-0"))}
    >
      {iconOnly ? <span className="sr-only">{children}</span> : children}
      <ChevronDown aria-hidden="true" className={cn("transition-transform duration-200", expanded && "rotate-180")} />
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Add / remove                                                        */
/* ------------------------------------------------------------------ */

export interface AddButtonProps extends Omit<ButtonProps, "variant"> {
  /** `dashed` is the full-width "add another" row under a list. */
  appearance?: "inline" | "dashed";
}

/** Adds an item to a list. */
export function AddButton({ appearance = "inline", children = "Add", className, size = "sm", ...props }: AddButtonProps) {
  return (
    <Button
      variant="ghost"
      size={size}
      className={cn(appearance === "dashed" && "w-full justify-start border border-dashed border-line-strong text-ink-2 hover:border-ink/30 hover:text-ink", className)}
      {...props}
    >
      <Plus aria-hidden="true" />
      {children}
    </Button>
  );
}

export interface RemoveButtonProps {
  onRemove: () => void;
  /** What is removed, for the accessible name: "Remove utm_source". */
  itemLabel: string;
  /** Ask for a second click before removing. */
  confirm?: boolean;
  icon?: "trash" | "x";
  size?: ButtonSize;
}

/** Removes one item. With `confirm`, the first click turns it into "Remove?" for 3 seconds. */
export function RemoveButton({ onRemove, itemLabel, confirm, icon = "trash", size = "sm" }: RemoveButtonProps) {
  const [arming, setArming] = useState(false);
  const later = useTimeout();
  if (arming) {
    return (
      <Button
        variant="danger"
        size={size}
        autoFocus
        onClick={onRemove}
        onBlur={() => setArming(false)}
        onKeyDown={(e) => e.key === "Escape" && setArming(false)}
        aria-label={`Confirm remove ${itemLabel}`}
      >
        Remove?
      </Button>
    );
  }
  return (
    <IconButton
      aria-label={`Remove ${itemLabel}`}
      tooltip="Remove"
      icon={icon === "x" ? <X /> : <Trash2 />}
      size={size}
      className="text-ink-3 hover:bg-red-100 hover:text-red-800"
      onClick={() => {
        if (!confirm) return onRemove();
        setArming(true);
        later(() => setArming(false), 3000);
      }}
    />
  );
}
