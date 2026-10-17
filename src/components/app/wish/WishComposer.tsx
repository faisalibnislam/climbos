"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { ArrowUp, Sparkles } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Button, Kbd, toast } from "@/components/ui";
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
        "Plan a Product Hunt launch for next month",
        "Get 10 new G2 reviews from our happiest customers",
        "Find YouTubers who review tools like ours and draft pitches",
        "Write 5 LinkedIn posts from the founder's story",
      ];
    case "ecommerce":
    case "physical_products":
      return [
        "Find 20 creators to send our product to",
        "Get us into this year's holiday gift guides",
        "Plan a limited pre-order drop with posts and an email",
        "Win back customers who haven't ordered in 90 days",
      ];
    case "services":
      return [
        "Get more 5-star Google reviews this month",
        "Find local businesses we could partner with",
        "Plan a seasonal offer with posts and a flyer",
        "Write a referral offer for past clients",
      ];
    default:
      return [
        "Get 3 Instagram posts ready for next week",
        "Audit my website for more enquiries",
        "Turn on autopilot for Instagram and Facebook",
        "Why did sign-ups change last month?",
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
    <section aria-labelledby="wish-heading" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="wish-heading" className="heading-section flex items-center gap-2">
            <Sparkles aria-hidden className="size-4 text-sun-strong" /> What should your team do?
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">Say it in your own words. Drafts, plans and research start right away; nothing goes live without you.</p>
        </div>
        <span className="hidden shrink-0 items-center gap-1 text-xs text-ink-3 sm:flex">
          Anywhere: <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </div>
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
          placeholder={`e.g. ${suggestions[0] ?? "Get posts ready for our launch next Tuesday"}`}
          className="min-h-9 flex-1 resize-none bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink-3"
        />
        <Button type="submit" loading={busy} disabled={!text.trim() || disabled} aria-label="Make it happen">
          <ArrowUp aria-hidden className="sm:hidden" />
          <span className="hidden sm:inline">Make it happen</span>
        </Button>
      </form>
      {disabled && disabledReason ? <p className="mt-2 text-ui text-ink-3">{disabledReason}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Ideas">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setText(s);
              requestAnimationFrame(() => area.current?.focus());
            }}
            className="inline-flex h-8 items-center rounded-lg border border-line bg-surface-2 px-2.5 text-ui text-ink-2 transition-colors hover:border-line-strong hover:bg-surface hover:text-ink"
          >
            {s}
          </button>
        ))}
      </div>
    </section>
  );
});
