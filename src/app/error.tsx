"use client";

/**
 * M21 - root-level error boundary. Catches anything thrown during
 * rendering / data fetching for the entire app subtree (marketing,
 * public, auth) so the user sees a friendly recovery surface
 * instead of Next's default white error page. Logs the error and
 * digest server-side via the Web Vitals beacon path so we can grep
 * for production crashes without enabling Next's full report mode.
 *
 * Note: a separate `app/app/error.tsx` (below) handles the authed
 * product subtree so the product's chrome (sidebar, header)
 * doesn't get blown away on a localized failure.
 */
import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort error log; keep it small + sync so it doesn't
    // race the page unload.
    if (typeof window !== "undefined") {
      const payload = {
        scope: "app.global_error",
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
        // Beacon endpoint may not exist yet; the error is still
        // visible via React DevTools and the browser console.
      }
    }
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b0b0d",
        color: "#ededf0",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "440px",
          textAlign: "center",
          background: "#121214",
          border: "0.5px solid rgba(255,255,255,0.08)",
          borderRadius: "16px",
          padding: "32px 28px",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#a5b4fc",
            margin: "0 0 12px",
          }}
        >
          Something went wrong
        </p>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 600,
            margin: "0 0 12px",
            letterSpacing: "-0.015em",
          }}
        >
          We hit an unexpected error
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "rgba(237,237,240,0.6)",
            margin: "0 0 24px",
            lineHeight: 1.5,
          }}
        >
          The team has been notified. You can try again, or head back to the
          dashboard.
        </p>
        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
          }}
        >
          <button
            onClick={reset}
            style={{
              background: "#5e6ad2",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/"
            style={{
              background: "transparent",
              color: "#ededf0",
              border: "0.5px solid rgba(255,255,255,0.16)",
              borderRadius: "8px",
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 500,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Go home
          </Link>
        </div>
        {process.env.NODE_ENV !== "production" && error.digest && (
          <p
            style={{
              fontSize: "11px",
              color: "rgba(237,237,240,0.4)",
              margin: "20px 0 0",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            digest: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
