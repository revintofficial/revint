/**
 * M21 - root-level 404 page. Renders for any URL that doesn't match
 * a marketing / public / app route. The product subtree has its
 * own narrower not-found.tsx so authed users keep their nav chrome.
 */
import Link from "next/link";

export const metadata = {
  title: "Not found — Revint",
  robots: { index: false, follow: false },
};

export default function NotFound() {
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
          404
        </p>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 600,
            margin: "0 0 12px",
            letterSpacing: "-0.015em",
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "rgba(237,237,240,0.6)",
            margin: "0 0 24px",
            lineHeight: 1.5,
          }}
        >
          The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            background: "#5e6ad2",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px 18px",
            fontSize: "14px",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
