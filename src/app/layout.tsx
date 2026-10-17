import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import "./globals.css";

const sans = Geist({ variable: "--font-sans-ui", subsets: ["latin"], display: "swap" });
const mono = Geist_Mono({ variable: "--font-mono-ui", subsets: ["latin"], display: "swap" });
const display = Fraunces({
  variable: "--font-display-serif",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "opsz"],
});

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
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#fbfaf6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable} h-full antialiased`}>
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
