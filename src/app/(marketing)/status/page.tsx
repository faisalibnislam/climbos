import type { Metadata } from "next";
import { StatusBoard } from "@/components/marketing/StatusBoard";

export const metadata: Metadata = {
  title: "Status",
  description: "Live status of ClimbOS: AI work, background jobs, email delivery, publishing and billing.",
  alternates: { canonical: "/status" },
};

export default function StatusPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <StatusBoard />
    </main>
  );
}
