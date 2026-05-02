/**
 * M21 - product-subtree 404 page. Scoped to /app/* so authed users
 * who hit a non-existent lead / deal / settings page keep their
 * nav chrome and can navigate back without re-authenticating.
 */
import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10">
      <div className="max-w-md mx-auto rounded-2xl border border-white/8 bg-card-dark p-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.12em] text-leadac-300 mb-3">
          404
        </p>
        <h1 className="text-xl font-semibold mb-2 tracking-tight">
          Not found
        </h1>
        <p className="text-sm text-foreground-muted mb-5 leading-relaxed">
          The page you&rsquo;re looking for doesn&rsquo;t exist or you don&rsquo;t have access.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/app/dashboard"
            className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition"
          >
            Go to dashboard
          </Link>
          <Link
            href="/app/leads"
            className="rounded-lg border border-white/16 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/5 transition"
          >
            View leads
          </Link>
        </div>
      </div>
    </div>
  );
}
