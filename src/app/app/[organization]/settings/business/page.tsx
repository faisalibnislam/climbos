"use client";

import { useParams } from "next/navigation";
import { BusinessGoalSettings } from "@/components/app/settings/BusinessGoalSettings";

/** Settings → Business & goal: goal, budget, review day, business details and a research refresh. */
export default function BusinessSettingsPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  return <BusinessGoalSettings slug={slug} />;
}
