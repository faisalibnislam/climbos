"use client";

import type { Id } from "@convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { AdminAccountDetail } from "@/components/app/admin/AdminAccountDetail";
import { AdminFrame } from "@/components/app/admin/AdminFrame";

export default function OpsAccountPage() {
  const { id } = useParams<{ id: string }>();
  return <AdminFrame>{(me) => <AdminAccountDetail accountId={id as Id<"accounts">} me={me} />}</AdminFrame>;
}
