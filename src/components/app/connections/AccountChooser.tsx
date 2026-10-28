"use client";

import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import { Button, Callout, RadioCards, toast } from "@/components/ui";
import { errorMessage } from "../errors";
import type { ConnectionItem } from "./ConnectionCard";

type Options = FunctionReturnType<typeof api.connectionActions.availableAccounts>;
type Provider = ConnectionItem["provider"];

/** Plain names for what an account is, shown next to "Connected:". */
export const ACCOUNT_KIND: Record<string, string> = {
  facebook_page: "Facebook Page",
  linkedin_member: "Personal LinkedIn profile",
  linkedin_organization: "LinkedIn Page",
  x_business: "X business account",
  x_account: "X account",
  ga4_property: "Analytics property",
  business_profile_location: "Business Profile location",
  Business: "Instagram business account",
  Media_Creator: "Instagram creator account",
  search_console_property: "Search Console property",
  google_ads_advertiser: "Google Ads advertiser account",
};

/**
 * Pick the Page, profile, property or location this business uses. Options come
 * from the provider's live list for the stored sign-in; the server re-checks the
 * choice against that list before saving it.
 */
export function AccountChooser({
  slug,
  item,
  disabled,
  autoOpen,
  onSignIn,
}: {
  slug: string;
  item: ConnectionItem;
  disabled: boolean;
  /** Open straight away (the owner still has to choose). */
  autoOpen: boolean;
  /** Start a new sign-in, e.g. LinkedIn profile vs Page. */
  onSignIn: (variant?: "linkedin_pages") => void;
}) {
  const listAccounts = useAction(api.connectionActions.availableAccounts);
  const chooseAccount = useAction(api.connectionActions.chooseAccount);
  const [open, setOpen] = useState(autoOpen);
  const [data, setData] = useState<Options | null>(null);
  const [value, setValue] = useState<string>("");
  const [busy, setBusy] = useState<"load" | "save" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const choice = item.choice;
  const conn = item.connection;
  if (!choice || !conn || conn.status !== "connected") return null;
  const isLinkedIn = item.provider === "linkedin";
  const asPage = conn.accountType === "linkedin_organization";

  async function load() {
    setBusy("load");
    setProblem(null);
    try {
      const result = await listAccounts({ slug, provider: item.provider as Provider });
      setData(result);
      setValue(result.selected ?? (result.options.length === 1 ? result.options[0]!.id : ""));
      if (!result.ok) setProblem(result.message);
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!value) return;
    setBusy("save");
    setProblem(null);
    try {
      const res = await chooseAccount({ slug, provider: item.provider as Provider, accountId: value });
      toast({ tone: "success", title: `Connected: ${res.accountLabel}` });
      setOpen(false);
      setData(null);
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          if (choice.selectable) void load();
        }}
      >
        Change
      </Button>
    );
  }

  return (
    <section aria-label={`Choose ${choice.noun}`} className="flex w-full flex-col gap-3 rounded-xl border border-line bg-surface-2 p-4">
      <div>
        <h4 className="text-ui font-semibold text-ink">Choose the {choice.noun} for this business</h4>
        <p className="mt-1 text-sm text-ink-3">
          {choice.selectable
            ? `From the account you signed in with.${item.group === "publish" ? " Changing it means re-approving approved posts." : ""}`
            : `${item.name} uses one account. Sign in again to switch.`}
        </p>
      </div>

      {choice.selectable && !data && busy !== "load" ? (
        <div>
          <Button variant="secondary" size="sm" onClick={load} disabled={disabled}>
            Load options
          </Button>
        </div>
      ) : null}
      {busy === "load" ? <p role="status" className="text-sm text-ink-3">Loading options…</p> : null}

      {data?.ok && data.options.length > 0 ? (
        <RadioCards
          aria-label={`Choose ${choice.noun}`}
          columns={1}
          value={value}
          onValueChange={setValue}
          options={data.options.map((o) => ({
            value: o.id,
            disabled: !o.canPublish,
            title: o.label,
            description: [ACCOUNT_KIND[o.accountType] ?? o.detail, o.accountType === "linkedin_member" || o.accountType === "linkedin_organization" ? o.detail : null, o.warning].filter(Boolean).join(" · "),
          }))}
        />
      ) : null}
      {data?.ok && data.options.length === 0 ? <Callout tone="warning">{data.message}</Callout> : null}
      {data?.truncated ? <p className="text-xs text-ink-3">Showing the first {data.options.length}. Missing yours? Ask us to raise the limit.</p> : null}
      {problem ? <Callout tone="danger" live="status">{problem}</Callout> : null}

      <div className="flex flex-wrap gap-2">
        {choice.selectable && data?.ok && data.options.length > 0 ? (
          <Button onClick={save} loading={busy === "save"} loadingText="Saving…" disabled={disabled || !value || value === conn.externalAccountId}>
            Use this one
          </Button>
        ) : null}
        {isLinkedIn ? (
          asPage ? (
            <Button variant="secondary" onClick={() => onSignIn()} disabled={disabled}>
              Post as yourself instead
            </Button>
          ) : item.pagesSignIn ? (
            <Button variant="secondary" onClick={() => onSignIn("linkedin_pages")} disabled={disabled}>
              Post as a LinkedIn Page instead
            </Button>
          ) : null
        ) : null}
        {!choice.selectable ? (
          <Button variant="secondary" onClick={() => onSignIn()} disabled={disabled}>
            Sign in with another account
          </Button>
        ) : null}
        {!choice.needed ? (
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        ) : null}
      </div>
    </section>
  );
}
