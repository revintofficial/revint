import Link from "next/link";
import {
  CheckSquare,
  Megaphone,
  Sparkles,
  Bell,
  CreditCard,
  Users as UsersIcon,
  Building2,
  ChevronRight,
  BarChart3,
  Mail,
  Palette,
  Workflow,
  Tag,
  User as UserIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Phone "More" tab — the catch-all for secondary destinations not in the
 * 5-tab bottom navigation. On tablet and desktop the sidebar handles all of
 * these, so we redirect to /app/dashboard there to avoid a dead-end page.
 *
 * Design: native-app "Settings"-style pushed list. Sections are grouped
 * (Plan / Manage / Account) with chevrons and 56pt rows.
 */
type Row = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  description?: string;
  adminOnly?: boolean;
};

type Section = {
  title: string;
  rows: Row[];
};

const SECTIONS: Section[] = [
  {
    title: "Plan",
    rows: [
      {
        href: "/app/todos",
        label: "Tasks",
        icon: CheckSquare,
        description: "Your team's todo board",
      },
      {
        href: "/app/campaigns",
        label: "Campaigns",
        icon: Megaphone,
        description: "Saved segments and outreach campaigns",
      },
    ],
  },
  {
    title: "Insights",
    rows: [
      {
        href: "/app/seo",
        label: "SEO",
        icon: BarChart3,
        description: "Search & vitals telemetry",
      },
    ],
  },
  {
    title: "Settings",
    rows: [
      {
        href: "/app/settings/account",
        label: "Account",
        icon: UserIcon,
        description: "Your profile",
      },
      {
        href: "/app/settings/workspace",
        label: "Workspace",
        icon: Building2,
        description: "Workspace name, slug, country",
      },
      {
        href: "/app/settings/offer",
        label: "My Offer",
        icon: Sparkles,
        description: "What you sell — used by AI for pitches",
        adminOnly: true,
      },
      {
        href: "/app/settings/packages",
        label: "Service Packages",
        icon: Tag,
        description: "Pricing tiers and what's included",
        adminOnly: true,
      },
      {
        href: "/app/settings/lead-pipeline",
        label: "Lead Pipeline",
        icon: Workflow,
        description: "Automation chain for new leads",
        adminOnly: true,
      },
      {
        href: "/app/settings/email-accounts",
        label: "Email accounts",
        icon: Mail,
        description: "Connect inboxes for outreach",
      },
      {
        href: "/app/settings/branding",
        label: "Branding",
        icon: Palette,
        description: "Workspace branding and colors",
        adminOnly: true,
      },
      {
        href: "/app/settings/team",
        label: "Team",
        icon: UsersIcon,
        description: "Members, roles and invites",
        adminOnly: true,
      },
      {
        href: "/app/settings/billing",
        label: "Billing",
        icon: CreditCard,
        description: "Plan, usage and invoices",
        adminOnly: true,
      },
    ],
  },
];

export default async function MorePage() {
  const { role } = await requireUser();

  // The "More" tab is conceptually phone-only; on tablet+ the sidebar already
  // exposes everything. We don't redirect server-side because the user might
  // resize after navigation — instead we render with a CSS hint and a link
  // back to the dashboard for non-phone visitors. This keeps URLs stable.

  const isAdmin = role === "OWNER" || role === "ADMIN";

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 pb-12 max-w-2xl space-y-4 sm:space-y-5 md:space-y-6">
      {/* Hint banner — only meaningful on tablet/desktop where the sidebar
          duplicates everything in this list. Phone users see it as their
          primary navigation. */}
      <div
        className="hidden md:flex rounded-xl px-4 py-3 items-center gap-3"
        style={{
          background: "hsl(0 0% 100% / 0.04)",
          border: "0.5px solid hsl(0 0% 100% / 0.08)",
        }}
      >
        <Bell className="w-4 h-4" style={{ color: "var(--leadac-text-3)" }} />
        <p className="text-[13px]" style={{ color: "var(--leadac-text-2)" }}>
          On larger screens you can use the sidebar. This list is optimised for phones.
        </p>
      </div>

      <PageHeader title="More" />

      <div className="space-y-6">
        {SECTIONS.map((section) => {
          const visibleRows = section.rows.filter(
            (r) => !r.adminOnly || isAdmin,
          );
          if (visibleRows.length === 0) return null;
          return (
            <section key={section.title}>
              <h2
                className="text-[11px] font-semibold uppercase tracking-wider mb-2 px-1"
                style={{ color: "var(--leadac-muted)" }}
              >
                {section.title}
              </h2>
              <ul
                role="list"
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "hsl(0 0% 100% / 0.04)",
                  border: "0.5px solid hsl(0 0% 100% / 0.06)",
                }}
              >
                {visibleRows.map((row, idx) => (
                  <li
                    key={row.href}
                    style={{
                      borderTop:
                        idx === 0
                          ? "none"
                          : "0.5px solid hsl(0 0% 100% / 0.04)",
                    }}
                  >
                    <Link
                      href={row.href}
                      className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 active:bg-white/10 focus-visible:outline-2 focus-visible:outline-(--leadac-500) focus-visible:-outline-offset-2"
                      style={{ minHeight: "var(--touch-target-large)" }}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background:
                            "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.12)",
                          color: "var(--leadac-300)",
                        }}
                      >
                        <row.icon className="w-4.5 h-4.5" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-medium truncate"
                          style={{
                            color: "var(--leadac-text-1)",
                            fontSize: "var(--text-callout)",
                          }}
                        >
                          {row.label}
                        </div>
                        {row.description && (
                          <div
                            className="truncate mt-0.5"
                            style={{
                              color: "var(--leadac-text-3)",
                              fontSize: "var(--text-footnote)",
                            }}
                          >
                            {row.description}
                          </div>
                        )}
                      </div>
                      <ChevronRight
                        className="w-4 h-4 shrink-0"
                        style={{ color: "var(--leadac-muted)" }}
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
