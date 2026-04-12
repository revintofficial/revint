import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lead Engine - Phone Repair Sales Dashboard",
  description: "Discover, analyze and convert phone repair shop leads in London",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-zinc-50 text-zinc-900">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}

function Sidebar() {
  return (
    <aside className="w-64 bg-zinc-900 text-zinc-100 flex flex-col shrink-0 sticky top-0 h-screen overflow-y-auto">
      <div className="p-6 border-b border-zinc-800">
        <h1 className="text-xl font-bold tracking-tight">Lead Engine</h1>
        <p className="text-xs text-zinc-400 mt-1">Phone Repair Sales</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        <SidebarLink href="/" label="Dashboard" />
        <SidebarLink href="/leads" label="Leads" />
        <SidebarLink href="/campaigns" label="Campaigns" />
        <SidebarLink href="/watchlist" label="Watchlist" />
        <SidebarLink href="/pipeline" label="Sales Pipeline" />
        <SidebarLink href="/discovery" label="Discovery" />
      </nav>
      <div className="p-4 border-t border-zinc-800 text-xs text-zinc-500">
        Greenwich, London
      </div>
    </aside>
  );
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-zinc-800 transition-colors"
    >
      {label}
    </a>
  );
}
