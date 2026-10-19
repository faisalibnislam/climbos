import type { Metadata } from "next";
import { BillingContent } from "./content";

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return <BillingContent />;
}
