"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/#platform", label: "Platform" },
  { href: "/vs/apollo-clay-gong", label: "Compare" },
  { href: "/#waitlist", label: "Waitlist" },
  { href: "/#faq", label: "FAQ" },
];

export function MarketingNav({
  signedIn,
  hidePublicAuth = false,
}: {
  signedIn: boolean;
  /** Hide Log in / Start free — direct URLs still work */
  hidePublicAuth?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(0, 0, 0, 0.6)" : "transparent",
        backdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none",
        borderBottom: scrolled
          ? "0.5px solid rgba(255, 255, 255, 0.06)"
          : "0.5px solid transparent",
      }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6 h-14 flex items-center">
        <Link href="/" className="flex items-center mr-8 group" aria-label="Revint home">
          <Image
            src="/logo.png"
            alt="Revint"
            width={36}
            height={36}
            priority
            className="w-9 h-9 object-contain transition-transform group-hover:scale-105"
          />
        </Link>

        <nav
          className="hidden md:flex items-center gap-6 text-[13px]"
          aria-label="Marketing navigation"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-white/60 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <Link
              href="/app/dashboard"
              className="inline-flex items-center gap-1.5 pl-3.5 pr-1 py-1 rounded-full text-[12.5px] font-medium text-white"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid hsl(var(--revint-h) var(--revint-s) 68% / 0.28)",
                boxShadow: "0 6px 18px hsl(var(--revint-h) var(--revint-s) 42% / 0.25)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
              }}
            >
              Open app
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--revint-h) var(--revint-s) 60%), hsl(var(--revint-h) var(--revint-s) 42%))",
                  boxShadow: "0 4px 10px hsl(var(--revint-h) var(--revint-s) 42% / 0.45)",
                }}
                aria-hidden
              >
                →
              </span>
            </Link>
          ) : hidePublicAuth ? null : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-block px-3 py-1.5 rounded-full text-[12.5px] text-white/70 hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold text-[#0F0A1F]"
                style={{
                  background: "rgba(255,255,255,0.94)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  boxShadow:
                    "0 1px 0 rgba(255,255,255,0.9) inset, 0 8px 22px hsl(var(--revint-h) var(--revint-s) 42% / 0.28)",
                }}
              >
                Book a walkthrough
                <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </Link>
            </>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden ml-1 p-1.5 rounded-md text-white/70 hover:text-white"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          className="md:hidden border-t"
          style={{
            background: "rgba(0,0,0,0.92)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <nav className="px-5 py-4 flex flex-col gap-3 text-[14px]">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-white/70 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            {!hidePublicAuth && (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="text-white/70 hover:text-white sm:hidden"
              >
                Log in
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
