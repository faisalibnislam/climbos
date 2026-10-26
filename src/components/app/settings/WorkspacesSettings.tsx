"use client";

import { isUnlimited } from "../../../../shared/economics/credits";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import Link from "next/link";
import { useState } from "react";
import { Button, Callout, DataTable, Input, toast } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button-styles";
import { formatNumber } from "@/lib/utils";
import { errorMessage } from "../errors";
import { LoadingBlock } from "../results/QueryBoundary";
import { SettingsHeader } from "./SettingsNav";
import { DeleteWorkspaceSection } from "./PrivacySettings";

/** Agency view: every workspace on the account, its credit use this month and optional cap, and everyone's access. */
export function WorkspacesSettings({ slug }: { slug: string }) {
  const data = useQuery(api.team.accountOverview, { slug });
  return (
    <div className="flex flex-col gap-8">
      <SettingsHeader
        title="Workspaces"
        intro="Shared credits and bill"
        actions={
          <Link href="/onboarding?new=1" className={buttonClasses({ size: "sm" })}>
            New workspace
          </Link>
        }
      />
      {data === undefined ? (
        <LoadingBlock label="Loading workspaces…" />
      ) : data === null ? (
        <Callout tone="info">Not on an account.</Callout>
      ) : (
        <>
          <DataTable
            caption="Workspaces on this account"
            rows={data.workspaces}
            rowKey={(w) => w.id}
            columns={[
              { key: "name", header: "Workspace", rowHeader: true, cell: (w) => <Link href={`/app/${w.slug}/today`} className="font-medium text-brand-800 hover:underline">{w.name}</Link> },
              { key: "people", header: "People", align: "right", cell: (w) => formatNumber(w.members) },
              { key: "used", header: "Credits this month", align: "right", cell: (w) => formatNumber(w.usedCredits), sortValue: (w) => w.usedCredits },
              { key: "cap", header: "Monthly cap", cell: (w) => (data.isAccountOwner ? <CapEditor slug={slug} orgId={w.id} cap={w.cap} /> : w.cap === null ? "None" : formatNumber(w.cap)) },
              ...(data.isAccountOwner ? [{ key: "remove", header: <span className="sr-only">Remove</span>, cell: (w: (typeof data.workspaces)[number]) => <Link href={`/app/${w.slug}/settings/workspaces#remove-business`} className="text-sm text-red-800 underline">Remove</Link> }] : []),
            ]}
          />
          <section aria-labelledby="people-heading" className="flex flex-col gap-3">
            <h2 id="people-heading" className="heading-section">
              People ({formatNumber(data.seats.used)}{isUnlimited(data.seats.limit) ? ", unlimited seats" : ` of ${formatNumber(data.seats.limit)} seats`})
            </h2>
            <DataTable
              caption="People across your workspaces"
              hideCaption
              rows={data.people}
              rowKey={(p) => p.email}
              columns={[
                { key: "who", header: "Person", rowHeader: true, cell: (p) => p.name ? `${p.name} · ${p.email}` : p.email },
                {
                  key: "access",
                  header: "Access",
                  cell: (p) => (
                    <ul className="flex flex-col gap-0.5">
                      {p.roles.map((r) => (
                        <li key={r.workspace}>
                          <span className="font-medium text-ink">{r.workspace}:</span> {r.role}
                          {r.status === "invited" ? <span className="text-ink-3"> (invited)</span> : null}
                        </li>
                      ))}
                    </ul>
                  ),
                },
              ]}
            />
          </section>
        </>
      )}
      <DeleteWorkspaceSection slug={slug} />
    </div>
  );
}

function CapEditor({ slug, orgId, cap }: { slug: string; orgId: Id<"organizations">; cap: number | null }) {
  const set = useMutation(api.team.setWorkspaceCap);
  const [value, setValue] = useState(cap === null ? "" : String(cap));
  return (
    <span className="flex items-center gap-2">
      <Input aria-label="Monthly credit cap" inputMode="numeric" className="h-8 w-28" value={value} placeholder="None" onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))} />
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          try {
            await set({ slug, orgId, credits: value === "" ? null : Number(value) });
            toast({ tone: "success", title: "Cap saved" });
          } catch (e) {
            toast({ tone: "danger", title: errorMessage(e) });
          }
        }}
      >
        Save
      </Button>
    </span>
  );
}
