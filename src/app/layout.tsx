import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { PWARegister } from "@/components/app/pwa-register";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Leadac AI — Find local businesses that need a new website",
  description:
    "Discover local businesses with weak or missing websites, get AI-powered pitches, and close web design deals.",
  manifest: "/manifest.json",
  applicationName: "Leadac AI",
  appleWebApp: {
    capable: true,
    title: "Leadac AI",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

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
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full text-white antialiased font-sans">
        {children}
        <Toaster />
        <PWARegister />
      </body>
    </html>
  );
}
