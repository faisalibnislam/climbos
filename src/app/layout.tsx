import type { Metadata, Viewport } from "next";
import { Geist_Mono, Hanken_Grotesk, Inter } from "next/font/google";
import localFont from "next/font/local";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import "./globals.css";

// Inter for the product UI (dense, legible SaaS type); Reckless Neue, our serif, for page titles, big numbers
// and marketing headlines.
const sans = Inter({ variable: "--font-sans-ui", subsets: ["latin"], display: "swap" });
// Hanken Grotesk: the body/UI font in the Signal theme (owner choice, 2026-10-19).
const hanken = Hanken_Grotesk({ variable: "--font-hanken-ui", subsets: ["latin"], display: "swap" });
const recklessNeue = localFont({
  variable: "--font-display-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
  src: [
    { path: "./fonts/reckless/RecklessNeue-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/reckless/RecklessNeue-RegularItalic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/reckless/RecklessNeue-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/reckless/RecklessNeue-MediumItalic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/reckless/RecklessNeue-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/reckless/RecklessNeue-SemiBoldItalic.woff2", weight: "600", style: "italic" },
  ],
});
const mono = Geist_Mono({ variable: "--font-mono-ui", subsets: ["latin"], display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://climbos.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ClimbOS — your AI growth team",
    template: "%s · ClimbOS",
  },
  description:
    "Tell ClimbOS your business goal. Ten coordinated AI specialists research your business, build a growth plan, create the work and measure what happens — with your approval at every step.",
  openGraph: {
    title: "ClimbOS — your AI growth team",
    description: "Tell us your goal. ClimbOS plans it, creates it and measures it — you approve what goes live.",
    url: siteUrl,
    siteName: "ClimbOS",
    type: "website",
  },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "ClimbOS", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f5f6f8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" className={`${sans.variable} ${hanken.variable} ${mono.variable} ${recklessNeue.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col">
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <ConvexClientProvider>
            <PostHogProvider>{children}</PostHogProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
