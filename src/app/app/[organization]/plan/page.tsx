"use client";

import { useParams } from "next/navigation";
import { GoalWorkspace } from "@/components/app/plan/GoalWorkspace";
import { SectionBoundary } from "@/components/app/content/shared";
import dynamic from "next/dynamic";
const PlanDetails = dynamic(() => import("./PlanDetails"));

export default function PlanPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  return <SectionBoundary pageHeading="Your goals" label="your goals"><GoalWorkspace slug={slug} details={<PlanDetails />} /></SectionBoundary>;
}
