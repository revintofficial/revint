"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/app/settings/account", label: "Account" },
  { href: "/app/settings/workspace", label: "Workspace" },
  { href: "/app/settings/offer", label: "My Offer" },
  { href: "/app/settings/email-accounts", label: "Email" },
  { href: "/app/settings/branding", label: "Branding" },
  { href: "/app/settings/team", label: "Team" },
  { href: "/app/settings/billing", label: "Billing" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <div className="-mx-4 sm:mx-0 overflow-x-auto scrollbar-hide">
      <nav
        className="inline-flex items-center gap-1 p-1 rounded-xl mx-4 sm:mx-0 whitespace-nowrap"
        style={{
          background: "rgba(28, 28, 30, 0.5)",
          border: "0.5px solid rgba(255, 255, 255, 0.06)",
        }}
        aria-label="Settings sections"
      >
        {TABS.map((t) => {
          const isActive = pathname === t.href || (pathname === "/app/settings" && t.href === "/app/settings/account");
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={isActive ? "page" : undefined}
              className="px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0A84FF] shrink-0"
              style={{
                background: isActive ? "rgba(10, 132, 255, 0.15)" : "transparent",
                color: isActive ? "white" : "rgba(235, 235, 245, 0.65)",
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
