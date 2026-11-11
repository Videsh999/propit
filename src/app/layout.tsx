import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { SITE_URL } from "@/lib/site-url";
import { Providers } from "@/components/providers";
import { ScrollRestoration } from "@/components/nav/scroll-restoration";
import { Navbar } from "@/components/nav/navbar";
import { Footer } from "@/components/nav/footer";
import { CommandPalette } from "@/components/search/command-palette";
import { AssistantRail } from "@/components/ai/assistant-rail";

/**
 * One family for everything, the way Apple does it.
 *
 * SF Pro is not licensed for the web, so this is Inter — the substitute it was
 * more or less drawn to be, and the one that holds up at both 76px display and
 * 11px tabular figures. It is exposed as `--font-inter` rather than
 * `--font-sans` because the stylesheet's `@theme` layer already owns that name
 * — pointing it at itself would be circular and silently drop the family.
 * Headings differ from body by weight and tracking now, not by family.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: "PropIT — Find where your life fits",
    template: "%s · PropIT",
  },
  description:
    "A map-first way to find a home in Hyderabad. Tell PropIT the places that matter — your office, your child's school — and it finds the homes between them.",
  openGraph: {
    title: "PropIT — Find where your life fits",
    description:
      "Map-first property discovery for Hyderabad. Anchors, livable zones and an assistant that actually moves the map.",
    type: "website",
    siteName: "PropIT",
    /* The lockup, not the app icon: a link preview is a wide card, and a
       rounded-square icon letterboxes badly in one. */
    images: [{ url: "/brand/propit-logo.png", width: 1254, height: 1254, alt: "PropIT" }],
  },
  twitter: { card: "summary_large_image", images: ["/brand/propit-logo.png"] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F4EC" },
    { media: "(prefers-color-scheme: dark)", color: "#16221C" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <NuqsAdapter>
          <Providers>
            <ScrollRestoration />
            <Suspense fallback={<div className="h-[72px] border-b border-line" />}>
              <Navbar />
            </Suspense>
            {children}
            <Footer />
            <CommandPalette />
            <AssistantRail />
          </Providers>
        </NuqsAdapter>
      </body>
    </html>
  );
}
