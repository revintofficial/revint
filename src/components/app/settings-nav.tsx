"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

interface SettingsTab {
  href: string;
  label: string;
  /**
   * Roles that are allowed to see/click this tab.
   * MEMBER is intentionally limited to "personal" surfaces:
   * Account (own profile) + a read-only Workspace summary +
   * Email accounts they own. Everything else (offer, packages,
   * pipeline rules, branding, team management, billing) is
   * organization-wide configuration and stays ADMIN/OWNER.
   *
   * Phase 1 deployment-redesign: prevents an SDR from
   * accidentally editing the workspace's offer or pipeline
   * rules during their first day on the floor.
   */
  allowedRoles: WorkspaceRole[];
}

const ALL_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "MEMBER"];
const ADMIN_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN"];

const TABS: SettingsTab[] = [
  { href: "/app/settings/account", label: "Account", allowedRoles: ALL_ROLES },
  { href: "/app/settings/workspace", label: "Workspace", allowedRoles: ALL_ROLES },
  { href: "/app/settings/offer", label: "My Offer", allowedRoles: ADMIN_ROLES },
  { href: "/app/settings/icp", label: "ICP", allowedRoles: ADMIN_ROLES },
  { href: "/app/settings/packages", label: "Packages", allowedRoles: ADMIN_ROLES },
  { href: "/app/settings/lead-pipeline", label: "Lead Pipeline", allowedRoles: ADMIN_ROLES },
  { href: "/app/settings/insight-performance", label: "Insights", allowedRoles: ADMIN_ROLES },
  { href: "/app/settings/email-accounts", label: "Email", allowedRoles: ALL_ROLES },
  { href: "/app/settings/integrations", label: "Integrations", allowedRoles: ADMIN_ROLES },
  { href: "/app/settings/branding", label: "Branding", allowedRoles: ADMIN_ROLES },
  { href: "/app/settings/team", label: "Team", allowedRoles: ADMIN_ROLES },
  { href: "/app/settings/billing", label: "Billing", allowedRoles: ADMIN_ROLES },
];

export function SettingsNav({ role }: { role: WorkspaceRole }) {
  const pathname = usePathname();
  const visibleTabs = TABS.filter((t) => t.allowedRoles.includes(role));
  return (
    <div className="-mx-4 sm:mx-0 overflow-x-auto scrollbar-hide">
      <nav
        className="inline-flex items-center gap-1 p-1 rounded-xl mx-4 sm:mx-0 whitespace-nowrap"
        style={{
          background: "hsl(var(--revint-h) var(--revint-ns) 11% / 0.5)",
          border: "0.5px solid hsl(0 0% 100% / 0.06)",
        }}
        aria-label="Settings sections"
      >
        {visibleTabs.map((t) => {
          const isActive = pathname === t.href || (pathname === "/app/settings" && t.href === "/app/settings/account");
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={isActive ? "page" : undefined}
              className="px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--revint-500) shrink-0"
              style={{
                background: isActive ? "hsl(var(--revint-h) var(--revint-s) 50% / 0.15)" : "transparent",
                color: isActive ? "white" : "var(--revint-text-2)",
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

/**
 * Resolve which settings paths a role is allowed to visit. Used by
 * server-side guards to redirect MEMBERs away from admin-only routes.
 */
export function isSettingsPathAllowedForRole(pathname: string, role: WorkspaceRole): boolean {
  const tab = TABS.find((t) => pathname.startsWith(t.href));
  if (!tab) return true;
  return tab.allowedRoles.includes(role);
}

export const SETTINGS_TABS = TABS;
