import type { Metadata } from "next";
import { AccountsContent } from "./content";

export const metadata: Metadata = { title: "Users & accounts" };

export default function AccountsPage() {
  return <AccountsContent />;
}
