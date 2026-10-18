"use client";

import { AdminFrame } from "@/components/app/admin/AdminFrame";
import { EngineLab } from "@/components/app/admin/EngineLab";

export default function OpsEnginePage() {
  return <AdminFrame>{() => <EngineLab />}</AdminFrame>;
}
