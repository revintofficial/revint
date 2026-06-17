import Link from "next/link";
import Image from "next/image";
import { SITE } from "@/lib/seo/metadata";

/**
 * SiteFooter — 5-column footer for the (site)/* surface.
 *
 * brand-assets §6 mandates the column shape (Product, Compare, For verticals,
 * Resources, Company) and §2.9 supplies the brand bio line.
 *
 * Sentence-case link labels — title case is humanizer H8.
 */

const COLUMNS: Array<{
  title: string;
  links: Array<{ href: string; label: string }>;
}> = [
  {
    title: "Product",
    links: [
      { href: "/manifesto", label: "Manifesto" },
      { href: "/pricing", label: "Pricing" },
      { href: "/demo", label: "Book a demo" },
      { href: "/integrations/hubspot", label: "HubSpot integration" },
      { href: "/integrations/smartlead", label: "Smartlead handoff" },
      { href: "/security", label: "Security" },
    ],
  },
  {
    title: "Compare",
    links: [
      { href: "/vs/apollo-clay-gong", label: "vs Apollo + Clay + Gong" },
      { href: "/vs/apollo", label: "vs Apollo" },
      { href: "/vs/clay", label: "vs Clay" },
      { href: "/vs/gong", label: "vs Gong" },
      { href: "/alternatives/apollo", label: "Apollo alternatives" },
      { href: "/alternatives/clay", label: "Clay alternatives" },
    ],
  },
  {
    title: "For verticals",
    links: [
      { href: "/for/field-service-saas", label: "Field service SaaS" },
      { href: "/for/restaurant-tech-saas", label: "Restaurant tech SaaS" },
      { href: "/for/dental-practice-software", label: "Dental software" },
      { href: "/for/agency", label: "Agencies" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/resources", label: "All reports" },
      {
        href: "/resources/2026-vertical-saas-gtm-benchmark",
        label: "2026 GTM benchmark",
      },
      {
        href: "/resources/apollo-bounce-rate-fix",
        label: "Apollo bounce-rate fix",
      },
      {
        href: "/resources/closed-loop-icp-refinement",
        label: "Closed-loop ICP refinement",
      },
      { href: "/glossary", label: "Glossary" },
      { href: "/tools", label: "Free tools" },
      { href: "/blog", label: "Blog" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/changelog", label: "Changelog" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-ink-3 bg-ink-0">
      <div className="site-container py-16">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <Link
              href="/"
              className="flex items-center gap-2"
              aria-label="Revint home"
            >
              <Image
                src="/logo.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span className="text-[18px] font-semibold tracking-tight text-paper-0">
                Revint
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-paper-2">
              The operational memory for vertical SaaS sales teams. Built for
              restaurant tech, field service, dental, beauty, and legal
              software vendors selling to local business.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/demo" className="site-btn-primary">
                Book a 20-min demo
              </Link>
              <Link href="/pricing" className="site-btn-secondary">
                See pricing
              </Link>
            </div>
          </div>

          <div className="grid gap-8 md:col-span-8 md:grid-cols-5">
            {COLUMNS.map((col) => (
              <div key={col.title} className="min-w-0">
                <div className="site-eyebrow pb-3">{col.title}</div>
                <ul className="grid gap-2">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="text-[13px] text-paper-2 transition-colors hover:text-paper-0"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-ink-3 pt-6 text-[12px] text-paper-3 md:flex-row md:items-center">
          <div>
            © {year} {SITE.legalName}. Apollo finds. Clay enriches. Gong
            records. We remember.
          </div>
          <div className="flex items-center gap-4">
            <a
              href={`mailto:${SITE.email}`}
              className="hover:text-paper-1"
            >
              {SITE.email}
            </a>
            {SITE.sameAs.slice(0, 3).map((s) => (
              <a
                key={s}
                href={s}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-paper-1"
              >
                {new URL(s).hostname.replace("www.", "")}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
