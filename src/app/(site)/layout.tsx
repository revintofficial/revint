import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { SiteAnalytics } from "@/components/site/analytics";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * Root layout for every login-pre marketing surface.
 *
 * What it does:
 *   - Applies the "operator instrument panel" body class so the whole
 *     subtree reads against --ink-* / --paper-* / --signal tokens instead
 *     of the legacy --leadac-* product palette.
 *   - Renders the global nav + footer that brand-assets §6 mandates.
 *   - Mounts SiteAnalytics once for the whole route group.
 *
 * Per-page metadata is set in each page.tsx via buildMetadata(). The
 * defaults below apply only when a child page omits its own metadata.
 */

export const metadata: Metadata = buildMetadata({
  path: "/",
  title: "LeadAC — we remember what closes for vertical SaaS sales teams",
  description:
    "Operational intelligence for vertical SaaS GTM teams selling to local business. Find the right local accounts, sync vertical context into HubSpot, learn from every won and lost deal.",
});

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="site-root min-h-screen bg-ink-0 text-paper-0">
      <SiteNav />
      <main id="main" className="min-h-[calc(100vh-4rem)]">
        {children}
      </main>
      <SiteFooter />
      <Suspense fallback={null}>
        <SiteAnalytics />
      </Suspense>
    </div>
  );
}
