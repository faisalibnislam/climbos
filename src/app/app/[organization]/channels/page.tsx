"use client";

import { useParams } from "next/navigation";
import { PlatformPreparation } from "@/components/app/plan/PlatformPreparation";
import { ChannelScorecard } from "@/components/app/plan/ChannelScorecard";
import { PageHeader } from "@/components/app/results/QueryBoundary";

/** Channels: every channel ClimbOS checked for this business, ranked, with "Make it happen". */
export default function ChannelsPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader section="channels" title="Where to find customers" intro="The choices in your plan, and other options to explore." />
      <ChannelScorecard slug={slug} />
      <details className="rounded-lg border border-line p-4"><summary className="min-h-11 cursor-pointer text-sm font-medium">Prepare a platform you have chosen</summary><p className="my-3 text-sm text-ink-2">Use this only after deciding it fits your buyers. These saved briefs help you prepare a manual launch or profile; they are not channel recommendations.</p><div className="space-y-3"><PlatformPreparation slug={slug} kind="product_hunt" /><PlatformPreparation slug={slug} kind="google_business" /><PlatformPreparation slug={slug} kind="g2" /></div></details>
    </div>
  );
}
