import type { Metadata } from "next";
import { FeedbackContent } from "./content";

export const metadata: Metadata = { title: "Feedback & status" };

export default function FeedbackPage() {
  return <FeedbackContent />;
}
