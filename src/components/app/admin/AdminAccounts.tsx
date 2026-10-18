"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { useState } from "react";
import { Badge, DataTable, Input, Skeleton } from "@/components/ui";
import { formatNumber } from "@/lib/utils";

/** Search accounts by owner, name or workspace. */
export function AdminAccounts() {
  const [q, setQ] = useState("");
  const rows = useQuery(api.admin.searchAccounts, { q });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="heading-page">Accounts</h1>
      <Input aria-label="Search accounts" placeholder="Search by email, name or workspace" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
      {rows === undefined ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <DataTable
          caption="Accounts"
          hideCaption
          rows={rows}
          rowKey={(r) => r.id}
          emptyText="No accounts match."
          columns={[
            { key: "owner", header: "Owner", rowHeader: true, cell: (r) => <Link href={`/ops/accounts/${r.id}`} className="font-medium text-brand-800 hover:underline">{r.ownerEmail ?? r.name}</Link>, sortValue: (r) => r.ownerEmail ?? "" },
            { key: "workspaces", header: "Workspaces", cell: (r) => r.workspaces.map((w) => w.name).join(", ") || "—" },
            { key: "package", header: "Package", cell: (r) => (r.package ? <Badge tone={r.package.comp ? "violet" : "green"}>{r.package.name}{r.package.comp ? " (comp)" : ""}</Badge> : <span className="text-ink-3">Free</span>) },
            { key: "credits", header: "Credits", align: "right", cell: (r) => formatNumber(r.credits), sortValue: (r) => r.credits },
            { key: "status", header: "Status", cell: (r) => (r.suspended ? <Badge tone="red">Suspended</Badge> : "Active") },
            { key: "created", header: "Joined", cell: (r) => new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), sortValue: (r) => r.createdAt },
          ]}
        />
      )}
    </div>
  );
}
