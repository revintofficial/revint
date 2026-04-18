"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Zap, Menu, X } from "lucide-react";

export function MarketingNav({ signedIn }: { signedIn: boolean }) {
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
        borderBottom: scrolled ? "0.5px solid rgba(255, 255, 255, 0.06)" : "0.5px solid transparent",
      }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6 h-14 flex items-center">
        <Link href="/" className="flex items-center gap-2 mr-8 group" aria-label="Lead Engine home">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
            style={{
              background: "linear-gradient(135deg, rgba(94, 106, 210, 0.28), rgba(139, 92, 246, 0.16))",
              border: "0.5px solid rgba(94, 106, 210, 0.32)",
            }}
          >
            <Zap className="w-3.5 h-3.5 text-[#8B95E8]" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Lead Engine</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-[13px]" aria-label="Marketing navigation">
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
              className="px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium text-white"
              style={{
                background: "linear-gradient(180deg, #4F5BD6, #3730A3)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px rgba(67,56,202,0.7), 0 6px 18px rgba(49,46,129,0.4)",
              }}
            >
              Open app →
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-block px-3 py-1.5 rounded-lg text-[12.5px] text-white/70 hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium text-white"
                style={{
                  background: "linear-gradient(180deg, #4F5BD6, #3730A3)",
                  boxShadow:
                    "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px rgba(67,56,202,0.7), 0 6px 18px rgba(49,46,129,0.4)",
                }}
              >
                Start free
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
