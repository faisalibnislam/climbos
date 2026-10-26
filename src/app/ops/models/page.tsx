"use client";

import { AdminFrame } from "@/components/app/admin/AdminFrame";
import { AdminModels } from "@/components/app/admin/AdminModels";

export default function OpsModelsPage() {
  return <AdminFrame>{(me) => <AdminModels me={me} />}</AdminFrame>;
}
