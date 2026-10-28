"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "@/components/ui";
import { RequestComposer } from "@/components/ui/request-composer";
import { errorInfo } from "@/components/app/errors";
import { wishDraftKey } from "@/components/app/draftKeys";
import { useCostDisplay } from "@/components/app/useCostDisplay";

export interface WishComposerHandle {
  fill: (text: string) => void;
}

/** Everyday, business-type-aware request starters; choosing one only fills the draft. */
export function wishSuggestions(type?: string | null): string[] {
  return ["New business: plan my launch", "Get more customers", "Grow my followers on social media", typeSuggestions(type)[0]];
}

function typeSuggestions(type?: string | null): string[] {
  switch (type) {
    case "saas":
      return [
        "Help me choose the next step for my software business",
        "Find out what may stop the right people from signing up",
        "Help new customers reach their first useful result",
        "Explain what my recent results say about growth",
      ];
    case "ecommerce":
      return [
        "Help me choose the next step for my online store",
        "Help more shoppers finish an order",
        "Find out what may bring past customers back",
        "Explain what my recent results say about sales",
      ];
    case "physical_products":
      return [
        "Help me choose the next step for my product business",
        "Help shoppers understand what makes my product useful",
        "Find a practical way to reach people who may need my product",
        "Explain what my recent results say about sales",
      ];
    case "services":
      return [
        "Help me choose the next step for my service business",
        "Help more of the right people book with me",
        "Find out what may stop enquiries from becoming bookings",
        "Prepare posts that answer common customer questions",
      ];
    default:
      return [
        "Help me choose what to do next",
        "Prepare posts for next week",
        "Help me find more customers",
        "Explain my recent results",
      ];
  }
}

/** Uses the existing costed work flow; inserting a suggestion never starts it. */
export const WishComposer = forwardRef<WishComposerHandle, { slug: string; userId?: string; identityReady: boolean; suggestions: string[]; disabled?: boolean; disabledReason?: string | null; requestCostEstimateMicros: number; autoDraftBudgetMicros: number; isDemo: boolean }>(function WishComposer(
  { slug, userId, identityReady, suggestions, disabled, disabledReason, requestCostEstimateMicros, autoDraftBudgetMicros, isDemo }, ref,
) {
  const fmt = useCostDisplay();
  const send = useMutation(api.workspace.sendChat);
  const scope = identityReady && userId ? wishDraftKey(slug, userId) : null;
  const [draft, setDraft] = useState<{ scope: string | null; text: string }>({ scope: null, text: "" });
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const text = draft.scope === scope ? draft.text : "";

  useEffect(() => {
    setLoadedScope(null);
    if (!scope) {
      setDraft({ scope: null, text: "" });
      return;
    }
    let saved = "";
    try { saved = window.sessionStorage.getItem(scope) ?? ""; } catch { /* Storage may be unavailable. */ }
    setDraft({ scope, text: saved });
    setLoadedScope(scope);
  }, [scope]);

  useEffect(() => {
    if (!scope || loadedScope !== scope || draft.scope !== scope) return;
    try {
      if (draft.text.trim()) window.sessionStorage.setItem(scope, draft.text);
      else window.sessionStorage.removeItem(scope);
    } catch { /* The request remains editable if browser storage is unavailable. */ }
  }, [draft, loadedScope, scope]);

  useImperativeHandle(ref, () => ({
    fill: (value) => {
      // A queued request must not discard a draft someone is already writing.
      setDraft((current) => {
        const currentText = current.scope === scope ? current.text : "";
        return { scope, text: currentText.trim() ? `${currentText.trimEnd()}\n${value}` : value };
      });
      requestAnimationFrame(() => area.current?.focus());
    },
  }), [scope]);

  const submit = async () => {
    const request = text.trim();
    if (!request || pending.current || disabled || !scope) return;
    pending.current = true;
    setBusy(true);
    try {
      await send({ slug, text: request });
      setDraft({ scope, text: "" });
    } catch (error) {
      toast({ tone: "danger", title: errorInfo(error).message });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <section aria-label="Ask ClimbOS" className="space-y-3">
      <RequestComposer
        label="Describe a problem or a goal"
        inputRef={area}
        value={text}
        onChange={(next) => setDraft({ scope, text: next })}
        onSubmit={() => void submit()}
        placeholder="For example: we just opened and nobody knows about us yet"
        suggestions={suggestions}
        busy={busy}
        disabled={disabled || !scope}
        helper={!identityReady ? "Checking your account…" : isDemo
          ? "Demo: no credits used, nothing sent or posted."
          : `Up to ${fmt.upTo(requestCostEstimateMicros + autoDraftBudgetMicros)}; unused credits return. Nothing is posted or spent without you.`}
      />
      {(disabled || !scope) && disabledReason ? <p role="status" className="text-sm text-ink-3">{disabledReason}</p> : null}
    </section>
  );
});
