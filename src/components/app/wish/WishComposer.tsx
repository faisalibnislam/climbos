"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "@/components/ui";
import { RequestComposer } from "@/components/ui/request-composer";
import { errorInfo } from "@/components/app/errors";
import { askDraftKey, wishDraftKey } from "@/components/app/draftKeys";
import { useCostDisplay } from "@/components/app/useCostDisplay";

export interface WishComposerHandle {
  fill: (text: string) => void;
}

/** Everyday, business-type-aware request starters; choosing one only fills the draft. */
export function wishSuggestions(type?: string | null): string[] {
  return ["Get more paying customers", "Help me launch a product", "Help me build an audience", typeSuggestions(type)[0]];
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
export const WishComposer = forwardRef<WishComposerHandle, { slug: string; userId?: string; identityReady: boolean; suggestions: string[]; disabled?: boolean; disabledReason?: string | null; requestCostEstimateMicros: number; autoDraftBudgetMicros: number; isDemo: boolean; onSubmitted?: () => void }>(function WishComposer(
  { slug, userId, identityReady, suggestions, disabled, disabledReason, requestCostEstimateMicros, autoDraftBudgetMicros, isDemo, onSubmitted }, ref,
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
    try {
      saved = window.sessionStorage.getItem(scope) ?? "";
      const handoffKey = askDraftKey(slug, userId!);
      const handoff = window.sessionStorage.getItem(handoffKey);
      if (handoff) {
        saved = saved.trim() ? `${saved.trimEnd()}\n${handoff}` : handoff;
        // Persist before consuming: Strict Mode can run this restoration twice
        // before the state-persistence effect runs. Both passes must read the
        // merged draft, rather than the second pass restoring the older text.
        window.sessionStorage.setItem(scope, saved);
        window.sessionStorage.removeItem(handoffKey);
      }
    } catch { /* Storage may be unavailable. */ }
    setDraft({ scope, text: saved });
    setLoadedScope(scope);
  }, [scope, slug, userId]);

  // Consume handoffs only after this identity's saved draft is restored. A
  // parent effect could otherwise consume the request before restoration and
  // then lose it when the stored draft overwrote the new text.
  useEffect(() => {
    if (!scope || !userId || loadedScope !== scope) return;
    const load = () => {
      try {
        const key = askDraftKey(slug, userId);
        const handoff = window.sessionStorage.getItem(key);
        if (!handoff) return;
        setDraft((current) => {
          const text = current.scope === scope ? current.text : "";
          return { scope, text: text.trim() ? `${text.trimEnd()}\n${handoff}` : handoff };
        });
        window.sessionStorage.removeItem(key);
        requestAnimationFrame(() => area.current?.focus());
      } catch { /* Keep any stored handoff for a later attempt. */ }
    };
    load();
    window.addEventListener("climbos:compose", load);
    return () => window.removeEventListener("climbos:compose", load);
  }, [scope, slug, userId, loadedScope]);

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
      onSubmitted?.();
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
        label="Your request"
        submitLabel="Let’s get started"
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
