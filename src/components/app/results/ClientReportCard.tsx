"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Copy, Link2, Trash2 } from "@/components/icons"
import { useState } from "react";
import { Button, Card, CardContent, ColorPicker, Field, Input, toast } from "@/components/ui";
import { errorMessage } from "../errors";
import { PERMISSION_WHO, useWorkspaceMember } from "../content/shared";
import { can } from "@shared/policy";

/** Share a branded, read-only results report with a client (white-label on packages). */
export function ClientReportCard({ slug }: { slug: string }) {
  const b = useQuery(api.clientReports.branding, { slug });
  const save = useMutation(api.clientReports.setBranding);
  const create = useMutation(api.clientReports.createLink);
  const revoke = useMutation(api.clientReports.revoke);
  const [form, setForm] = useState<{ name: string; color: string; logo: string } | null>(null);
  const member = useWorkspaceMember(slug);
  if (!b) return null;
  // Branding needs manage_team and share links need export: both owner or admin.
  const canShare = Boolean(member?.role && can(member.role, "export") && can(member.role, "manage_team"));
  const f = form ?? { name: b.brandName, color: b.brandColor, logo: b.brandLogoUrl };
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast({ tone: "success", title: ok });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    }
  };
  const copy = (url: string) => navigator.clipboard.writeText(url).then(() => toast({ tone: "success", title: "Link copied" }), () => toast({ tone: "info", title: "Report link", description: url }));
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <p className="heading-card">Share with a client</p>
        <p className="text-xs text-ink-3">Read-only outcomes. No credits, drafts or settings.</p>
        {canShare ? (
        <>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
          <Field label="Agency name" optional>
            <Input value={f.name} onChange={(e) => setForm({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Logo link" optional>
            <Input value={f.logo} placeholder="https://…/logo.png" onChange={(e) => setForm({ ...f, logo: e.target.value })} />
          </Field>
          <ColorPicker label="Brand colour" value={f.color} onChange={(hex) => setForm({ ...f, color: hex })} />
        </div>
        <div className="flex flex-wrap gap-2">
          {form ? (
            <Button variant="secondary" onClick={() => run(async () => { await save({ slug, brandName: f.name, brandColor: f.color, brandLogoUrl: f.logo }); setForm(null); }, "Branding saved")}>
              Save
            </Button>
          ) : null}
          <Button onClick={() => run(async () => copy(await create({ slug })))}>
            <Link2 aria-hidden /> Create link
          </Button>
        </div>
        </>
        ) : (
          <p className="text-xs text-ink-3">Needs {PERMISSION_WHO.manage_team}.</p>
        )}
        {b.links.length ? (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {b.links.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                <span className="truncate text-ink-2">
                  {l.url.replace(/^https?:\/\//, "")} · {l.views} view{l.views === 1 ? "" : "s"}
                </span>
                <span className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" aria-label="Copy link" onClick={() => copy(l.url)}>
                    <Copy aria-hidden />
                  </Button>
                  {canShare ? (
                    <Button size="sm" variant="ghost" aria-label="Turn off link" onClick={() => run(() => revoke({ slug, id: l.id }), "Link turned off")}>
                      <Trash2 aria-hidden />
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
