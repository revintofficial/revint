import { redirect } from "next/navigation";
import { getOptionalAdmin } from "@/lib/admin-auth";
import { UnauthorizedError } from "@/lib/auth";
import { AdminNav } from "@/components/admin/nav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * /admin shell — gates the entire route group via the
 * ADMIN_DASHBOARD_EMAILS allowlist. We deliberately do NOT mount
 * MarketingTracker here; founder behavior on the admin panel is
 * not what we want to forensically review.
 *
 * Behavior:
 *   - No session at all -> redirect to /login (so the founder lands
 *     on the auth page and bounces back through ?next=/admin).
 *   - Session but not allowlisted -> render an inline 403 panel
 *     instead of redirecting. Bouncing a teammate to /app makes
 *     them think they typed the wrong URL; better to be explicit.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await getOptionalAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect("/login?next=/admin");
    }
    throw err;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[var(--revint-bg)] text-[var(--revint-text-1)] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <div className="text-xs uppercase tracking-wider text-[var(--revint-text-3)]">
            403 · Forbidden
          </div>
          <h1 className="text-xl font-semibold">Admin dashboard access required</h1>
          <p className="text-sm text-[var(--revint-text-2)]">
            This panel is gated by the founder email allowlist. If you should
            have access, ask ops to add your email to{" "}
            <code className="text-[var(--revint-300)]">ADMIN_DASHBOARD_EMAILS</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--revint-bg)] text-[var(--revint-text-1)] flex">
      <AdminNav />
      <main className="flex-1 min-w-0">
        <div className="border-b border-[var(--revint-border)] bg-[var(--revint-surface)]/60 backdrop-blur sticky top-0 z-10">
          <div className="px-6 py-3 flex items-center justify-between text-xs">
            <div className="text-[var(--revint-text-3)]">
              Marketing forensics · first-party + PostHog replay
            </div>
            <div className="text-[var(--revint-text-3)]">
              {session.user.email}
            </div>
          </div>
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
