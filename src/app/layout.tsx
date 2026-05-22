import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono, Oswald } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { PWARegister } from "@/components/app/pwa-register";
import {
  JsonLd,
  organizationSchema,
  websiteSchema,
  softwareApplicationSchema,
} from "@/components/seo/json-ld";
import { buildRootMetadata } from "@/lib/seo/metadata";
import { WebVitalsReporter } from "@/components/seo/web-vitals-reporter";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import { Suspense } from "react";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Inter Tight is the display + body face for the (site)/* marketing surface.
// We keep --font-inter (regular Inter) loaded for the auth-gated product
// surfaces under /app/* which were tuned for it.
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// JetBrains Mono powers every numeric value, signal name, and code block
// inside the (site)/* surface. Replaces the legacy `--font-inter-mono`.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Oswald stays loaded only because the legacy cinematic marketing surfaces
// reference it. The new site uses Inter Tight. Keep here until those routes
// are deleted in Wave 4.
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = buildRootMetadata();

export const viewport: Viewport = {
  themeColor: "var(--leadac-500)",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable} ${oswald.variable} h-full`}
    >
      <body className="min-h-full text-white antialiased font-sans">
        <JsonLd data={organizationSchema()} id="ld-organization" />
        <JsonLd data={websiteSchema()} id="ld-website" />
        <JsonLd data={softwareApplicationSchema()} id="ld-software" />
        {children}
        <Toaster />
        <PWARegister />
        <WebVitalsReporter />
        <Suspense fallback={null}>
          <PostHogProvider />
        </Suspense>
      </body>
    </html>
  );
}
