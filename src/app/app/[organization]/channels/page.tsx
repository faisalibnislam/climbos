"use client";

import { useParams } from "next/navigation";
import { ChannelScorecard } from "@/components/app/plan/ChannelScorecard";
import { PageHeader } from "@/components/app/results/QueryBoundary";

/** Channels: every channel ClimbOS checked for this business, ranked, with "Make it happen". */
export default function ChannelsPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader section="channels" title="Channels" />
      <ChannelScorecard slug={slug} />
    </div>
  );
}
