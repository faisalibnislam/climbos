"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { ArrowUp, Magic } from "@/components/icons";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Button, toast } from "@/components/ui";
import { errorInfo } from "@/components/app/errors";
import { cn } from "@/lib/utils";

export interface WishComposerHandle {
  fill: (text: string) => void;
}

/** Wish ideas that fit the business, mixing everyday work with less obvious growth plays. */
export function wishSuggestions(type: string | null | undefined): string[] {
  switch (type) {
    case "saas":
      return [
        "Plan a Product Hunt launch",
        "Get 10 G2 reviews",
        "Pitch YouTube reviewers",
        "5 founder-story LinkedIn posts",
      ];
    case "ecommerce":
    case "physical_products":
      return [
        "Send our product to 20 creators",
        "Get into holiday gift guides",
        "Plan a pre-order drop",
        "Win back lapsed customers",
      ];
    case "services":
      return [
        "Get more Google reviews",
        "Find local partners",
        "Plan a seasonal offer",
        "Write a referral offer",
      ];
    default:
      return [
        "3 Instagram posts for next week",
        "Audit my site for enquiries",
        "Autopilot for Instagram",
        "Why did sign-ups change?",
      ];
  }
}

/**
 * The wish bar: say what you want in your own words. Drafts, plans and
 * research start right away; anything that would go live waits for you.
 */
export const WishComposer = forwardRef<WishComposerHandle, { slug: string; suggestions: string[]; disabled?: boolean; disabledReason?: string | null }>(function WishComposer(
  { slug, suggestions, disabled, disabledReason },
  ref,
) {
  const send = useMutation(api.workspace.sendChat);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({
    fill: (t: string) => {
      setText(t);
      requestAnimationFrame(() => {
        area.current?.focus();
        area.current?.setSelectionRange(t.length, t.length);
      });
    },
  }));

  const submit = async () => {
    const wish = text.trim();
    if (!wish || busy || disabled) return;
    setBusy(true);
    try {
      await send({ slug, text: wish });
      setText("");
    } catch (err) {
      toast({ tone: "danger", title: errorInfo(err).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="wish-heading" className="rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
      <h2 id="wish-heading" className="heading-section flex items-center gap-2">
        <Magic aria-hidden className="size-4 text-sun-strong" /> What should your team do?
      </h2>
      <form
        className={cn(
          "mt-4 flex items-end gap-2 rounded-xl border border-control bg-surface p-2 pl-3.5 transition-colors focus-within:border-brand-800 focus-within:ring-2 focus-within:ring-brand-100",
          disabled && "opacity-60",
        )}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="wish-input" className="sr-only">
          Your wish for the team
        </label>
        <textarea
          id="wish-input"
          ref={area}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={1}
          disabled={disabled}
          placeholder={`${suggestions[0] ?? "Posts for our launch"}…`}
          className="min-h-9 flex-1 resize-none bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink-3"
        />
        <Button type="submit" loading={busy} disabled={!text.trim() || disabled} aria-label="Send">
          <ArrowUp aria-hidden className="sm:hidden" />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
      {disabled && disabledReason ? <p className="mt-2 text-ui text-ink-3">{disabledReason}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Ideas">
        {suggestions.slice(0, 3).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setText(s);
              requestAnimationFrame(() => area.current?.focus());
            }}
            className="inline-flex min-h-8 items-center rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-left text-ui text-ink-2 transition-colors hover:border-line-strong hover:bg-surface hover:text-ink"
          >
            {s}
          </button>
        ))}
      </div>
    </section>
  );
});
