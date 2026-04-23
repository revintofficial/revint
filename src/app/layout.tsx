import type { Metadata, Viewport } from "next";
import { Inter, Oswald } from "next/font/google";
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

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = buildRootMetadata();

export const viewport: Viewport = {
  themeColor: "#5E6AD2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable} h-full`}>
      <body className="min-h-full text-white antialiased font-sans">
        <JsonLd data={organizationSchema()} id="ld-organization" />
        <JsonLd data={websiteSchema()} id="ld-website" />
        <JsonLd data={softwareApplicationSchema()} id="ld-software" />
        {children}
        <Toaster />
        <PWARegister />
        <WebVitalsReporter />
      </body>
    </html>
  );
}
