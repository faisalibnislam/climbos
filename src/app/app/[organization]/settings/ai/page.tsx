"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, toast } from "@/components/ui";
import { AiModeChoice, type AiMode } from "@/components/app/AiModePicker";
import { errorMessage } from "@/components/app/errors";
import { LoadingBlock } from "@/components/app/results/QueryBoundary";
import { SettingsHeader } from "@/components/app/settings/SettingsNav";

/** The workspace's default Climb AI mode. Each plan, ad or weekly plan can still pick its own. */
export default function AiSettingsPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.workspace.aiMode, { slug });
  const save = useMutation(api.workspace.setAiMode);
  if (data === undefined) return <LoadingBlock label="Loading Climb AI settings" lines={3} />;
  const onChange = async (mode: AiMode) => {
    if (!data.canEdit) return;
    try {
      await save({ slug, mode });
      toast({ tone: "success", title: mode === "expert" ? "Expert is the default" : "Basic is the default" });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    }
  };
  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader title="Climb AI" intro="Choose the default depth for plans, insights, ads and the weekly plan. You can change it each time you start one." />
      <Card>
        <CardHeader>
          <CardTitle as="h2">Default mode</CardTitle>
          <CardDescription>Everything else (posts, emails, SEO, audits, finding customers, chat) always uses Basic.</CardDescription>
        </CardHeader>
        <CardContent>
          <AiModeChoice unlocked={data.expertUnlocked} costs={data.estimates.strategy} value={data.mode} onChange={onChange} label="Growth plan cost shown as an example" upgradeHref={`/app/${slug}/settings/billing`} />
          {!data.canEdit ? <p className="mt-3 text-xs text-ink-3">Only owners and admins can change this.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
