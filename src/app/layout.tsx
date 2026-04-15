import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "./app-shell";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lead Engine — Find clients who need your web design services",
  description: "Discover local businesses with weak or missing websites, get AI-powered pitches, and close web design deals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full text-white antialiased font-sans">
        <AppShell>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}
