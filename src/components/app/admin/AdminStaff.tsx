"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, DataTable, Field, Input, Select, Skeleton, toast } from "@/components/ui";
import { errorMessage } from "../errors";
import type { AdminMe } from "./AdminFrame";

const ROLE_NAME = { owner: "Owner", admin: "Admin", support: "Support" } as const;
/** What each staff role can do, shown as a definition list beside the form. */
const ROLE_CAN: Record<keyof typeof ROLE_NAME, string> = {
  owner: "Everything",
  admin: "Everything except money settings and staff",
  support: "Read, view as user, retry jobs, add up to 500 credits",
};

/** ClimbOS staff: owners (server setting or added), admins and support members. */
export function AdminStaff({ me }: { me: AdminMe }) {
  const rows = useQuery(api.admin.staffList, {});
  const set = useMutation(api.admin.setStaff);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "admin" | "support">("support");
  const canEdit = (me.powers as readonly string[]).includes("staff");
  const run = async (args: Parameters<typeof set>[0]) => {
    try {
      await set(args);
      toast({ tone: "success", title: "Saved" });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    }
  };
  return (
    <div className="flex flex-col gap-6">
      <h1 className="heading-page">Staff</h1>
      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Add a staff member</CardTitle>
            <CardDescription>They sign in with this email. Every staff action is logged.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <Field label="Email" className="w-full flex-1 sm:min-w-64">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Role" className="w-full sm:w-48">
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)} options={(Object.keys(ROLE_NAME) as (keyof typeof ROLE_NAME)[]).map((k) => ({ value: k, label: ROLE_NAME[k] }))} />
            </Field>
            <Button onClick={() => run({ email, role }).then(() => setEmail(""))}>Add</Button>
            <dl className="grid w-full gap-2 text-sm sm:grid-cols-3" aria-label="What each role can do">
              {(Object.keys(ROLE_CAN) as (keyof typeof ROLE_CAN)[]).map((k) => (
                <div key={k} className={k === role ? "rounded-lg border border-brand-800 px-3 py-2" : "rounded-lg border border-line px-3 py-2"}>
                  <dt className="font-medium text-ink">{ROLE_NAME[k]}</dt>
                  <dd className="text-ink-2">{ROLE_CAN[k]}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}
      {rows === undefined ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <DataTable
          caption="Staff"
          rows={rows}
          rowKey={(r) => r.email}
          columns={[
            { key: "email", header: "Email", rowHeader: true, cell: (r) => r.email },
            { key: "role", header: "Role", cell: (r) => <Badge tone={r.role === "owner" ? "violet" : r.role === "admin" ? "blue" : "neutral"}>{r.role}</Badge> },
            { key: "actions", header: "", cell: (r) => (canEdit && !r.fixed ? <Button size="sm" variant="ghost" onClick={() => run({ email: r.email, role: "remove" })}>Remove</Button> : r.fixed ? <span className="text-xs text-ink-3">Server setting</span> : null) },
          ]}
        />
      )}
    </div>
  );
}
