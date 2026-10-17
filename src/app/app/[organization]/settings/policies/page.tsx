"use client";

import { useParams } from "next/navigation";
import { QueryBoundary } from "@/components/app/results/QueryBoundary";
import { PoliciesSettings } from "@/components/app/settings/PoliciesSettings";

export default function PoliciesSettingsPage() {
  const { organization } = useParams<{ organization: string }>();
  return (
    <QueryBoundary>
      <PoliciesSettings slug={organization} />
    </QueryBoundary>
  );
}
