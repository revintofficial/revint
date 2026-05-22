"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SiteNav — top navigation for every (site)/* page.
 *
 * brand-assets §6 references the shape: Logo · Product · Compare · For · Resources · Pricing
 * + sign-in + "Book a 20-min demo". On scroll the bar gets a hairline border
 * so the page content reads as scrolling under it (instrument-panel feel).
 *
 * Server component would be cheaper but we need scroll-state + open-menu
 * state, so this is a client island. The footer + the rest of the layout
 * stay server-rendered.
 */

type DropdownItem = {
  href: string;
  label: string;
  description?: string;
};

type NavItem = {
  href?: string;
  label: string;
  items?: DropdownItem[];
};

const NAV: NavItem[] = [
  {
    label: "Product",
    items: [
      {
        href: "/manifesto",
        label: "Manifesto",
        description: "Why operational memory beats conversation intelligence",
      },
      {
        href: "/integrations/hubspot",
        label: "HubSpot integration",
        description: "Pre-call brief inside the HubSpot card",
      },
      {
        href: "/integrations/smartlead",
        label: "Smartlead handoff",
        description: "Ready-to-send context for your sequencer",
      },
      {
        href: "/security",
        label: "Security",
        description: "Audit-grade outbound, data residency",
      },
    ],
  },
  {
    label: "Compare",
    items: [
      {
        href: "/vs/apollo-clay-gong",
        label: "vs Apollo + Clay + Gong",
        description: "Stack cost reframe",
      },
      { href: "/vs/apollo", label: "vs Apollo" },
      { href: "/vs/clay", label: "vs Clay" },
      { href: "/vs/gong", label: "vs Gong" },
    ],
  },
  {
    label: "For",
    items: [
      {
        href: "/for/field-service-saas",
        label: "Field service SaaS",
        description: "HVAC, plumbing, electrical software vendors",
      },
      {
        href: "/for/restaurant-tech-saas",
        label: "Restaurant tech SaaS",
        description: "Toast, OpenTable, Resy competitor vendors",
      },
      {
        href: "/for/dental-practice-software",
        label: "Dental software",
        description: "Multi-location practice management vendors",
      },
    ],
  },
  {
    label: "Resources",
    items: [
      { href: "/resources", label: "Cornerstone reports" },
      {
        href: "/resources/2026-vertical-saas-gtm-benchmark",
        label: "2026 vertical SaaS GTM benchmark",
        description: "Free annual data report",
      },
      { href: "/glossary", label: "Glossary" },
      {
        href: "/tools",
        label: "Free tools",
        description: "Cost calculator, ramp estimator, signal checker",
      },
      { href: "/blog", label: "Blog" },
      { href: "/changelog", label: "Changelog" },
    ],
  },
  { href: "/pricing", label: "Pricing" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-colors duration-200",
        "bg-ink-0/85 backdrop-blur-md",
        scrolled && "border-b border-ink-3",
      )}
    >
      <div className="site-container flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="LeadAC home"
          >
            <Image
              src="/logo.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7"
              priority
            />
            <span className="text-[15px] font-semibold tracking-tight text-paper-0">
              LeadAC
            </span>
          </Link>

          <nav
            className="hidden items-center gap-1 md:flex"
            onMouseLeave={() => setOpen(null)}
          >
            {NAV.map((item) =>
              item.items ? (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => setOpen(item.label)}
                >
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-md px-3 py-1.5 text-[14px] text-paper-1 transition-colors hover:text-paper-0"
                    aria-haspopup="menu"
                    aria-expanded={open === item.label}
                  >
                    {item.label}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        open === item.label && "rotate-180",
                      )}
                    />
                  </button>
                  {open === item.label ? (
                    <div className="absolute left-0 top-full pt-2">
                      <div className="min-w-[280px] rounded-xl border border-ink-3 bg-ink-1 p-2 shadow-2xl">
                        {item.items.map((sub) => (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className="block rounded-md px-3 py-2 transition-colors hover:bg-ink-2"
                            onClick={() => setOpen(null)}
                          >
                            <div className="text-[14px] text-paper-0">
                              {sub.label}
                            </div>
                            {sub.description ? (
                              <div className="text-[12px] text-paper-2">
                                {sub.description}
                              </div>
                            ) : null}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Link
                  key={item.label}
                  href={item.href!}
                  className="rounded-md px-3 py-1.5 text-[14px] text-paper-1 transition-colors hover:text-paper-0"
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-md px-3 py-1.5 text-[14px] text-paper-1 transition-colors hover:text-paper-0"
          >
            Sign in
          </Link>
          <Link href="/demo" className="site-btn-primary">
            Book a 20-min demo
          </Link>
        </div>

        {/* Mobile trigger */}
        <button
          type="button"
          aria-label="Open menu"
          className="rounded-md p-2 text-paper-0 md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-ink-3 bg-ink-0 md:hidden">
          <div className="site-container py-4">
            {NAV.map((item) => (
              <div key={item.label} className="py-2">
                {item.items ? (
                  <>
                    <div className="site-eyebrow pb-2">{item.label}</div>
                    <div className="grid gap-1 pl-2">
                      {item.items.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className="block py-1.5 text-[14px] text-paper-1"
                          onClick={() => setMobileOpen(false)}
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  </>
                ) : (
                  <Link
                    href={item.href!}
                    className="block py-2 text-[14px] text-paper-0"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
            <div className="mt-4 flex flex-col gap-2 border-t border-ink-3 pt-4">
              <Link
                href="/login"
                className="site-btn-secondary justify-center"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
              <Link
                href="/demo"
                className="site-btn-primary justify-center"
                onClick={() => setMobileOpen(false)}
              >
                Book a 20-min demo
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
