import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import LandingView from "./LandingView";

/** Title, description and link-preview tags for shared landing links (rendered on the server). */
export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchQuery(api.landing.publicPage, { slug }).catch(() => null);
  if (!page) return { title: "Page not available", robots: { index: false } };
  const title = `${page.content.headline} · ${page.name}`;
  const description = page.content.subhead.slice(0, 200);
  return { title, description, openGraph: { title, description, type: "website", siteName: page.name }, twitter: { card: "summary", title, description } };
}

export default function Page() {
  return <LandingView />;
}
