"use client";

/**
 * M21 - product-subtree error boundary. Scoped to /app/* so a
 * localized failure (e.g. one bad lead detail page, a Prisma
 * timeout in the AI Workers panel) doesn't blow away the whole
 * sidebar/header chrome and the user can recover with a single
 * click. The root-level error.tsx remains the catch-all for
 * marketing / public routes.
 */
import { useEffect } from "react";
import Link from "next/link";

export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const payload = {
        scope: "app.product_error",
        message: error.message,
        digest: error.digest ?? null,
        path: window.location.pathname,
      };
      try {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon?.("/api/client-errors", blob);
      } catch {
        // The beacon endpoint may not be wired yet; the error
        // remains visible in the browser console.
      }
    }
  }, [error]);

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10">
      <div className="max-w-md mx-auto rounded-2xl border border-white/8 bg-card-dark p-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.12em] text-leadac-300 mb-3">
          Something went wrong
        </p>
        <h1 className="text-xl font-semibold mb-2 tracking-tight">
          We couldn&rsquo;t load this view
        </h1>
        <p className="text-sm text-foreground-muted mb-5 leading-relaxed">
          The team has been notified. You can retry, or jump back to your
          dashboard.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition"
          >
            Try again
          </button>
          <Link
            href="/app/dashboard"
            className="rounded-lg border border-white/16 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/5 transition"
          >
            Dashboard
          </Link>
        </div>
        {process.env.NODE_ENV !== "production" && error.digest && (
          <p className="text-[10px] text-foreground-muted/60 mt-4 font-mono">
            digest: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
