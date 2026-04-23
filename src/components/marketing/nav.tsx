"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { Menu, X, ChevronDown } from "lucide-react";

const FOR_LINKS = [
  { href: "/for/agencies", label: "B2B outbound agencies", desc: "Fresh leads, no Apollo" },
  { href: "/for/specialists", label: "Vertical specialists", desc: "Klaviyo, Webflow, GHL" },
  { href: "/for/smma", label: "New SMMA owners", desc: "Your first 5 clients" },
  { href: "/for/walk-in-web-agencies", label: "Walk-in web agencies", desc: "Tablet, mockup, close" },
];

export function MarketingNav({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [forOpen, setForOpen] = useState(false);
  const forRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (forRef.current && !forRef.current.contains(e.target as Node)) {
        setForOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(0, 0, 0, 0.6)" : "transparent",
        backdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none",
        borderBottom: scrolled ? "0.5px solid rgba(255, 255, 255, 0.06)" : "0.5px solid transparent",
      }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6 h-14 flex items-center">
        <Link href="/" className="flex items-center mr-8 group" aria-label="Leadac AI home">
          <Image
            src="/logo.png"
            alt="Leadac AI"
            width={44}
            height={44}
            priority
            className="w-11 h-11 object-contain transition-transform group-hover:scale-105"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-[13px]" aria-label="Marketing navigation">
          <div className="relative" ref={forRef}>
            <button
              onClick={() => setForOpen(!forOpen)}
              className="flex items-center gap-1 text-white/60 hover:text-white transition-colors"
              aria-expanded={forOpen}
              aria-haspopup="menu"
            >
              For
              <ChevronDown
                className="w-3.5 h-3.5 transition-transform"
                style={{ transform: forOpen ? "rotate(180deg)" : "rotate(0)" }}
              />
            </button>
            {forOpen && (
              <div
                role="menu"
                className="absolute top-full left-0 mt-2 w-[280px] rounded-xl py-2"
                style={{
                  background: "rgba(20, 20, 22, 0.95)",
                  backdropFilter: "saturate(180%) blur(20px)",
                  WebkitBackdropFilter: "saturate(180%) blur(20px)",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
                }}
              >
                {FOR_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setForOpen(false)}
                    className="block px-4 py-2.5 hover:bg-white/[0.04] transition-colors"
                    role="menuitem"
                  >
                    <div className="text-[13.5px] font-medium text-white">{link.label}</div>
                    <div className="text-[11.5px] text-white/45 mt-0.5">{link.desc}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link href="/#how" className="text-white/60 hover:text-white transition-colors">
            How it works
          </Link>
          <Link href="/#features" className="text-white/60 hover:text-white transition-colors">
            Features
          </Link>
          <Link href="/pricing" className="text-white/60 hover:text-white transition-colors">
            Pricing
          </Link>
          <Link href="/#faq" className="text-white/60 hover:text-white transition-colors">
            FAQ
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <Link
              href="/app/dashboard"
              className="inline-flex items-center gap-1.5 pl-3.5 pr-1 py-1 rounded-full text-[12.5px] font-medium text-white"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(199, 120, 255, 0.28)",
                boxShadow: "0 6px 18px rgba(124,58,237,0.25)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
              }}
            >
              Open app
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white"
                style={{
                  background:
                    "linear-gradient(135deg, #A875FF, #7C3AED)",
                  boxShadow: "0 4px 10px rgba(124,58,237,0.45)",
                }}
                aria-hidden
              >
                →
              </span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-block px-3 py-1.5 rounded-full text-[12.5px] text-white/70 hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 pl-3.5 pr-1 py-1 rounded-full text-[12.5px] font-semibold text-[#0F0A1F]"
                style={{
                  background: "rgba(255,255,255,0.94)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  boxShadow:
                    "0 1px 0 rgba(255,255,255,0.9) inset, 0 8px 22px rgba(124,58,237,0.35)",
                }}
              >
                Start free
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, #A875FF, #7C3AED)",
                    boxShadow: "0 4px 10px rgba(124,58,237,0.45)",
                  }}
                  aria-hidden
                >
                  →
                </span>
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
            <div className="border-b border-white/5 pb-3 mb-1">
              <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-white/35 mb-2">
                For
              </p>
              {FOR_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block py-1.5 text-white/70 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <Link href="/#how" onClick={() => setMobileOpen(false)} className="text-white/70 hover:text-white">
              How it works
            </Link>
            <Link href="/#features" onClick={() => setMobileOpen(false)} className="text-white/70 hover:text-white">
              Features
            </Link>
            <Link href="/pricing" onClick={() => setMobileOpen(false)} className="text-white/70 hover:text-white">
              Pricing
            </Link>
            <Link href="/#faq" onClick={() => setMobileOpen(false)} className="text-white/70 hover:text-white">
              FAQ
            </Link>
            <Link href="/login" onClick={() => setMobileOpen(false)} className="text-white/70 hover:text-white sm:hidden">
              Log in
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
