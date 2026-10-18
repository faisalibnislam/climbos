import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import BioView from "./BioView";

/** Title, description and link-preview tags for shared link-in-bio pages (rendered on the server). */
export async function generateMetadata({ params }: PageProps<"/bio/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchQuery(api.bio.publicPage, { slug }).catch(() => null);
  if (!page) return { title: "Page not available", robots: { index: false } };
  const description = (page.bio || `Links from ${page.title}`).slice(0, 200);
  return { title: page.title, description, openGraph: { title: page.title, description, type: "profile" }, twitter: { card: "summary", title: page.title, description } };
}

export default function Page() {
  return <BioView />;
}
