"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, ExternalLink, Eye, EyeOff, Mail, Minus, Plus, Search, X } from "@/components/icons";
import { Select, useFieldControl } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CopyButton, KeyCombo, matchesShortcut } from "../actions";
import { FieldMessage } from "./field-parts";

/* ------------------------------------------------------------------ */
/* Affix input: the shell every decorated input uses                   */
/* ------------------------------------------------------------------ */

type Size = "sm" | "md" | "lg";
const HEIGHT: Record<Size, string> = { sm: "h-[var(--h-sm)]", md: "h-[var(--h-md)]", lg: "h-[var(--h-lg)] text-sm" };

/** Border, focus and invalid styles for a field that holds more than an input. */
export const shellClasses =
  "flex w-full min-w-0 items-stretch rounded-[var(--radius-field)] border border-control bg-surface text-ui text-ink transition-colors " +
  "hover:border-control-hover focus-within:border-brand-700 " +
  "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-0 has-[input:focus-visible]:outline-[var(--focus-ring)] " +
  "has-[[aria-invalid=true]]:border-red-800 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:bg-surface-2 has-[input:disabled]:text-ink-3";

/** The bare input inside a shell (the shell draws the focus ring). */
export const bareInputClasses =
  "h-full min-w-0 flex-1 bg-transparent px-3 text-inherit placeholder:text-ink-3 focus-visible:outline-none! disabled:cursor-not-allowed " +
  "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

export interface AffixInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  size?: Size;
  /** Leading text or icon (decorative), e.g. a search icon or "$". */
  prefix?: ReactNode;
  /** Trailing text or icon (decorative), e.g. "%", "USD", ".climbos.site". */
  suffix?: ReactNode;
  /** Draw prefix/suffix as grey add-on segments instead of inline text. */
  addon?: boolean;
  /** Trailing interactive control inside the field (clear, copy, Apply). */
  action?: ReactNode;
  /** Leading interactive control, flush to the edge (country code select, − button). */
  leading?: ReactNode;
  /** Trailing interactive control, flush to the edge (+ button). */
  trailing?: ReactNode;
  containerClassName?: string;
}

/** Input with prefix / suffix text, icons or an inline action. Auto-wires to <Field>. */
export const AffixInput = forwardRef<HTMLInputElement, AffixInputProps>(function AffixInput(
  { size = "md", prefix, suffix, addon, action, leading, trailing, containerClassName, className, id, required, "aria-describedby": describedBy, ...props },
  ref,
) {
  const wiring = useFieldControl({ id, required, "aria-describedby": describedBy });
  const seg = (side: "l" | "r", node: ReactNode) =>
    addon ? (
      <span aria-hidden="true" className={cn("flex shrink-0 items-center bg-surface-2 px-3 text-ink-3", side === "l" ? "rounded-l-[inherit] border-r border-line" : "rounded-r-[inherit] border-l border-line")}>
        {node}
      </span>
    ) : (
      <span aria-hidden="true" className={cn("flex shrink-0 items-center text-ink-3 [&_svg]:size-4", side === "l" ? "pl-3 -mr-1.5" : "pr-3 -ml-1.5")}>
        {node}
      </span>
    );
  return (
    <div className={cn(shellClasses, HEIGHT[size], containerClassName)}>
      {leading}
      {prefix ? seg("l", prefix) : null}
      <input ref={ref} className={cn(bareInputClasses, size === "sm" && "px-2.5", className)} {...wiring} {...props} />
      {suffix ? seg("r", suffix) : null}
      {action ? <span className="flex shrink-0 items-center gap-0.5 pr-1">{action}</span> : null}
      {trailing}
    </div>
  );
});

/** Small square button that fits inside a field. */
export function InlineIconButton({ label, onClick, children, disabled, pressed }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-[var(--radius-control)] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export interface SearchInputProps extends Omit<AffixInputProps, "value" | "onChange" | "prefix" | "action" | "type" | "onSubmit"> {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  /** Focus shortcut, e.g. ["/"] or ["mod", "K"]. Shown while empty. */
  shortcut?: string[];
}

/** Search field: icon, clear button, Esc clears, optional focus shortcut. */
export function SearchInput({ value, onValueChange, onSubmit, shortcut, placeholder = "Search", ...props }: SearchInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
      if ((!typing || shortcut.length > 1) && matchesShortcut(e, shortcut)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);
  return (
    <AffixInput
      ref={ref}
      type="search"
      role="searchbox"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && value) {
          e.preventDefault();
          onValueChange("");
        } else if (e.key === "Enter") onSubmit?.(value);
      }}
      prefix={<Search />}
      action={
        value ? (
          <InlineIconButton
            label="Clear search"
            onClick={() => {
              onValueChange("");
              ref.current?.focus();
            }}
          >
            <X />
          </InlineIconButton>
        ) : shortcut ? (
          <span className="pr-1.5">
            <KeyCombo keys={shortcut} />
          </span>
        ) : null
      }
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Password                                                            */
/* ------------------------------------------------------------------ */

const RULES: { test: (p: string) => boolean; label: string }[] = [
  { test: (p) => p.length >= 10, label: "10 or more characters" },
  { test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p), label: "Upper and lower case" },
  { test: (p) => /\d/.test(p), label: "A number" },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: "A symbol" },
];

/** 0–4 score with a label and which rules pass. */
export function passwordStrength(p: string) {
  const passed = RULES.map((r) => r.test(p));
  let score = passed.filter(Boolean).length;
  if (p.length >= 16 && score >= 3) score = 4;
  if (p.length < 6) score = Math.min(score, 1);
  const label = !p ? "" : ["Too weak", "Weak", "Fair", "Good", "Strong"][score];
  return { score, label, rules: RULES.map((r, i) => ({ label: r.label, ok: passed[i] })) };
}

export interface PasswordInputProps extends Omit<AffixInputProps, "type" | "action" | "value" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Show the strength meter and rule checklist (for new passwords). */
  showStrength?: boolean;
}

/** Password field with show/hide and an optional strength meter. */
export function PasswordInput({ value, onValueChange, showStrength, "aria-describedby": describedBy, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const meterId = useId();
  const s = passwordStrength(value);
  const bar = ["bg-red-800", "bg-red-800", "bg-amber-500", "bg-green-500", "bg-green-800"][s.score];
  return (
    <div className="flex flex-col gap-2">
      <AffixInput
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        autoComplete={showStrength ? "new-password" : "current-password"}
        spellCheck={false}
        aria-describedby={cn(describedBy, showStrength && meterId) || undefined}
        action={
          <InlineIconButton label={visible ? "Hide password" : "Show password"} pressed={visible} onClick={() => setVisible((v) => !v)}>
            {visible ? <EyeOff /> : <Eye />}
          </InlineIconButton>
        }
        {...props}
      />
      {showStrength ? (
        <div id={meterId} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div aria-hidden="true" className="grid flex-1 grid-cols-4 gap-1">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className={cn("h-1 rounded-full", value && s.score >= i ? bar : "bg-surface-3")} />
              ))}
            </div>
            <span className="w-16 text-right text-xs font-medium text-ink-2" aria-live="polite">
              {s.label}
            </span>
          </div>
          <ul className="grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
            {s.rules.map((r) => (
              <li key={r.label} className={cn("flex items-center gap-1.5", r.ok ? "text-green-800" : "text-ink-3")}>
                {r.ok ? <Check aria-hidden="true" className="size-3.5" /> : <span aria-hidden="true" className="mx-1 size-1.5 rounded-full bg-current" />}
                {r.label}
                <span className="sr-only">{r.ok ? " (done)" : " (missing)"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Email                                                               */
/* ------------------------------------------------------------------ */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TYPOS: Record<string, string> = { "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmail.co": "gmail.com", "hotmial.com": "hotmail.com", "outlok.com": "outlook.com", "yaho.com": "yahoo.com" };

export const isEmail = (v: string) => EMAIL.test(v.trim());

export interface EmailInputProps extends Omit<AffixInputProps, "type" | "value" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
}

/** Email field. Checks format on blur and offers a fix for common domain typos. */
export function EmailInput({ value, onValueChange, onBlur, "aria-describedby": describedBy, ...props }: EmailInputProps) {
  const [touched, setTouched] = useState(false);
  const msgId = useId();
  const domain = value.split("@")[1]?.toLowerCase() ?? "";
  const fix = TYPOS[domain];
  const invalid = touched && value !== "" && !isEmail(value);
  return (
    <div className="flex flex-col gap-1.5">
      <AffixInput
        type="email"
        inputMode="email"
        autoComplete="email"
        spellCheck={false}
        prefix={<Mail />}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={cn(describedBy, (invalid || fix) && msgId) || undefined}
        onChange={(e) => onValueChange(e.target.value)}
        onBlur={(e) => {
          setTouched(true);
          onBlur?.(e);
        }}
        {...props}
      />
      {invalid ? (
        <FieldMessage id={msgId}>Enter an email like name@business.com</FieldMessage>
      ) : fix && touched ? (
        <p id={msgId} className="text-ui text-ink-2">
          Did you mean{" "}
          <button type="button" className="font-medium text-brand-800 underline underline-offset-2" onClick={() => onValueChange(`${value.split("@")[0]}@${fix}`)}>
            {value.split("@")[0]}@{fix}
          </button>
          ?
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* URL                                                                 */
/* ------------------------------------------------------------------ */

const HOST = /^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i;

export interface UrlInputProps extends Omit<AffixInputProps, "type" | "value" | "onChange" | "prefix"> {
  /** Full URL ("https://…") or "". */
  value: string;
  onValueChange: (url: string) => void;
}

/** Website field with a fixed https:// add-on. Pasted schemes are stripped; valid URLs get an open link. */
export function UrlInput({ value, onValueChange, onBlur, "aria-describedby": describedBy, ...props }: UrlInputProps) {
  const [touched, setTouched] = useState(false);
  const msgId = useId();
  const rest = value.replace(/^https?:\/\//i, "");
  const valid = HOST.test(rest);
  const invalid = touched && rest !== "" && !valid;
  return (
    <div className="flex flex-col gap-1.5">
      <AffixInput
        type="text"
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        addon
        prefix="https://"
        value={rest}
        aria-invalid={invalid || undefined}
        aria-describedby={cn(describedBy, invalid && msgId) || undefined}
        onChange={(e) => {
          const r = e.target.value.trim().replace(/^https?:\/\//i, "");
          onValueChange(r ? `https://${r}` : "");
        }}
        onBlur={(e) => {
          setTouched(true);
          onBlur?.(e);
        }}
        action={
          valid ? (
            <a
              href={`https://${rest}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open website in a new tab"
              className="grid size-7 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          ) : null
        }
        {...props}
      />
      {invalid ? <FieldMessage id={msgId}>Enter a web address like yourbusiness.com</FieldMessage> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phone                                                               */
/* ------------------------------------------------------------------ */

export const PHONE_COUNTRIES = [
  { code: "US", dial: "1", mask: "(###) ###-####" },
  { code: "CA", dial: "1", mask: "(###) ###-####" },
  { code: "GB", dial: "44", mask: "#### ######" },
  { code: "AU", dial: "61", mask: "### ### ###" },
  { code: "IN", dial: "91", mask: "##### #####" },
  { code: "DE", dial: "49", mask: "#### #######" },
] as const;
export type PhoneCountry = (typeof PHONE_COUNTRIES)[number]["code"];

function applyMask(digits: string, mask: string) {
  let out = "";
  let i = 0;
  for (const ch of mask) {
    if (i >= digits.length) break;
    if (ch === "#") out += digits[i++];
    else out += ch;
  }
  return out;
}

export interface PhoneValue {
  country: PhoneCountry;
  /** Digits only, national format. */
  national: string;
}

export interface PhoneInputProps extends Omit<AffixInputProps, "type" | "value" | "onChange" | "leading"> {
  value: PhoneValue;
  onValueChange: (v: PhoneValue & { e164: string }) => void;
}

/** Phone number with a country code picker and as-you-type formatting. Emits E.164. */
export function PhoneInput({ value, onValueChange, ...props }: PhoneInputProps) {
  const ccId = useId();
  const c = PHONE_COUNTRIES.find((x) => x.code === value.country) ?? PHONE_COUNTRIES[0];
  const max = c.mask.split("#").length - 1;
  const emit = (country: PhoneCountry, national: string) => {
    const dial = PHONE_COUNTRIES.find((x) => x.code === country)?.dial ?? "1";
    onValueChange({ country, national, e164: national ? `+${dial}${national}` : "" });
  };
  return (
    <AffixInput
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      placeholder={c.mask.replace(/#/g, "0")}
      value={applyMask(value.national, c.mask)}
      onChange={(e) => emit(value.country, e.target.value.replace(/\D/g, "").slice(0, max))}
      leading={
        <Select
          id={`${ccId}-cc`}
          aria-label="Country code"
          value={value.country}
          onValueChange={(v) => emit(v as PhoneCountry, value.national)}
          options={PHONE_COUNTRIES.map((x) => ({ value: x.code, label: `${x.code} +${x.dial}` }))}
          className="h-full w-[6.25rem] shrink-0 rounded-none rounded-l-[inherit] border-0 border-r border-line bg-surface-2 px-2.5 hover:border-line"
        />
      }
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Currency                                                            */
/* ------------------------------------------------------------------ */

const SYMBOL: Record<string, string> = { USD: "$", CAD: "$", AUD: "$", GBP: "£", EUR: "€", INR: "₹" };

export interface CurrencyInputProps extends Omit<AffixInputProps, "type" | "value" | "onChange" | "prefix" | "suffix"> {
  value: number | null;
  onValueChange: (v: number | null) => void;
  currency?: string;
  /** Decimal places (default 2). */
  decimals?: number;
  min?: number;
  max?: number;
}

/** Money field: symbol prefix, currency code suffix, grouped digits when not editing. */
export function CurrencyInput({ value, onValueChange, currency = "USD", decimals = 2, min = 0, max, onFocus, onBlur, ...props }: CurrencyInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const shown = draft ?? (value === null ? "" : fmt.format(value));
  return (
    <AffixInput
      type="text"
      inputMode="decimal"
      prefix={SYMBOL[currency] ?? currency}
      suffix={currency}
      value={shown}
      className="tabular-nums"
      onFocus={(e) => {
        setDraft(value === null ? "" : String(value));
        onFocus?.(e);
      }}
      onChange={(e) => {
        const clean = e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
        setDraft(clean);
        const n = clean === "" || clean === "." ? null : Number(clean);
        onValueChange(n);
      }}
      onBlur={(e) => {
        setDraft(null);
        if (value !== null) {
          const r = Number(Math.min(max ?? Infinity, Math.max(min, value)).toFixed(decimals));
          if (r !== value) onValueChange(r);
        }
        onBlur?.(e);
      }}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Number / stepper                                                    */
/* ------------------------------------------------------------------ */

export interface NumberInputProps extends Omit<AffixInputProps, "type" | "value" | "onChange" | "min" | "max" | "step" | "leading" | "trailing"> {
  value: number | null;
  onValueChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Show − and + buttons on either side (stepper input). */
  stepper?: boolean;
  /** Spoken unit for aria-valuetext, e.g. "posts". */
  unit?: string;
}

/**
 * Number field (ARIA spinbutton). Up/Down step, Shift or PageUp/PageDown x10,
 * Home/End jump to min/max. Clamps on blur.
 */
export function NumberInput({ value, onValueChange, min, max, step = 1, stepper, unit, size = "md", disabled, onBlur, onKeyDown, className, containerClassName, ...props }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const decimals = (String(step).split(".")[1] ?? "").length;
  const clamp = (n: number) => Number(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)).toFixed(decimals));
  const bump = (by: number) => {
    setDraft(null);
    onValueChange(clamp((value ?? min ?? 0) + by));
  };
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    const big = step * 10;
    const map: Record<string, () => void> = {
      ArrowUp: () => bump(e.shiftKey ? big : step),
      ArrowDown: () => bump(-(e.shiftKey ? big : step)),
      PageUp: () => bump(big),
      PageDown: () => bump(-big),
      Home: () => min !== undefined && onValueChange(min),
      End: () => max !== undefined && onValueChange(max),
    };
    if (map[e.key]) {
      e.preventDefault();
      map[e.key]();
    }
    onKeyDown?.(e);
  };
  const atMin = min !== undefined && value !== null && value <= min;
  const atMax = max !== undefined && value !== null && value >= max;
  const btn = (dir: -1 | 1) => (
    <button
      type="button"
      tabIndex={-1}
      aria-label={dir < 0 ? "Decrease" : "Increase"}
      disabled={disabled || (dir < 0 ? atMin : atMax)}
      onClick={() => bump(dir * step)}
      className={cn(
        "grid shrink-0 place-items-center text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-35 [&_svg]:size-4",
        size === "sm" ? "w-8" : "w-9",
        dir < 0 ? "rounded-l-[inherit] border-r border-line" : "rounded-r-[inherit] border-l border-line",
      )}
    >
      {dir < 0 ? <Minus aria-hidden="true" /> : <Plus aria-hidden="true" />}
    </button>
  );
  return (
    <AffixInput
      type="text"
      role="spinbutton"
      inputMode={decimals ? "decimal" : "numeric"}
      autoComplete="off"
      size={size}
      disabled={disabled}
      aria-valuenow={value ?? undefined}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={value === null ? undefined : `${value}${unit ? ` ${unit}` : ""}`}
      value={draft ?? (value === null ? "" : String(value))}
      onChange={(e) => {
        const clean = e.target.value.replace(/[^\d.-]/g, "");
        setDraft(clean);
        const n = Number(clean);
        onValueChange(clean === "" || clean === "-" || Number.isNaN(n) ? null : n);
      }}
      onBlur={(e) => {
        setDraft(null);
        if (value !== null && clamp(value) !== value) onValueChange(clamp(value));
        onBlur?.(e);
      }}
      onKeyDown={keys}
      className={cn("tabular-nums", stepper && "px-1 text-center", className)}
      containerClassName={cn(stepper && "w-36", containerClassName)}
      leading={stepper ? btn(-1) : undefined}
      trailing={stepper ? btn(1) : undefined}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/* One-time code                                                       */
/* ------------------------------------------------------------------ */

export interface OtpInputProps {
  value: string;
  onValueChange: (v: string) => void;
  /** Called once all boxes are filled. */
  onComplete?: (v: string) => void;
  length?: number;
  /** Group label, e.g. "Verification code". */
  label?: string;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-describedby"?: string;
}

/** Digit boxes for one-time codes. Auto-advances, Backspace goes back, paste fills all. */
export function OtpInput({ value, onValueChange, onComplete, length = 6, label = "Verification code", invalid, disabled, autoFocus, "aria-describedby": describedBy }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  const focus = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };
  const commit = (next: string) => {
    const v = next.replace(/\D/g, "").slice(0, length);
    onValueChange(v);
    if (v.length === length) onComplete?.(v);
  };
  const setAt = (i: number, d: string) => {
    const arr = digits.slice();
    arr[i] = d;
    commit(arr.join(""));
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();
    commit(text);
    requestAnimationFrame(() => focus(text.length));
  };
  const half = length % 2 === 0 ? length / 2 : -1;
  return (
    <div role="group" aria-label={label} aria-describedby={describedBy} className="flex items-center gap-1.5">
      {digits.map((d, i) => (
        <span key={i} className="contents">
          {i === half ? <span aria-hidden="true" className="mx-1 h-px w-3 bg-line-strong" /> : null}
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && i === 0}
            disabled={disabled}
            aria-label={`Digit ${i + 1} of ${length}`}
            aria-invalid={invalid || undefined}
            value={d}
            onFocus={(e) => e.target.select()}
            onPaste={onPaste}
            onChange={(e) => {
              const ch = e.target.value.replace(/\D/g, "").slice(-1);
              if (!ch) return;
              // Fill gaps so typing into box 4 of an empty code still works left to right.
              const arr = digits.slice();
              const at = Math.min(i, value.length);
              arr[at] = ch;
              commit(arr.join(""));
              focus(at + 1);
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace") {
                e.preventDefault();
                if (d) setAt(i, "");
                else if (i > 0) {
                  const arr = digits.slice();
                  arr[i - 1] = "";
                  commit(arr.join(""));
                  focus(i - 1);
                }
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                focus(i - 1);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                focus(i + 1);
              }
            }}
            className={cn(
              "size-11 rounded-[var(--radius-field)] border border-control bg-surface text-center text-lg font-semibold tabular-nums text-ink transition-colors",
              "hover:border-control-hover focus-visible:border-brand-700 focus-visible:outline-offset-0! disabled:bg-surface-2 aria-[invalid=true]:border-red-800",
            )}
          />
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inline action inputs                                                */
/* ------------------------------------------------------------------ */

/** Read-only value with a copy button inside the field (API keys, links, codes). */
export function CopyInput({ value, label = "Copy", size = "md", mono = true, ...props }: Omit<AffixInputProps, "value" | "readOnly" | "action"> & { value: string; label?: string; mono?: boolean }) {
  return (
    <AffixInput
      readOnly
      value={value}
      size={size}
      onFocus={(e) => e.target.select()}
      className={cn(mono && "font-mono text-xs")}
      action={<CopyButton value={value} iconOnly label={label} variant="ghost" size="sm" className="h-7 w-7" />}
      {...props}
    />
  );
}
