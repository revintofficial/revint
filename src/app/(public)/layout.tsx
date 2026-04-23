import Link from "next/link";

/**
 * Shared layout for the public directory — /b/*, /cities/*, /niches/*, and
 * competitor comparison pages. The design intentionally contrasts with the
 * marketing shell: plain typography, minimal chrome, heavy cross-linking.
 * The goal is density and bot-friendliness, not conversion.
 */
export default function PublicDirectoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#0b0b0d",
        color: "#ededf0",
        minHeight: "100vh",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif',
        lineHeight: 1.6,
      }}
    >
      <header
        style={{
          borderBottom: "0.5px solid rgba(255,255,255,0.08)",
          padding: "16px 20px",
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              color: "#ffffff",
              fontWeight: 700,
              textDecoration: "none",
              fontSize: 15,
              letterSpacing: "-0.01em",
            }}
          >
            Leadac AI
          </Link>
          <nav
            style={{
              display: "flex",
              gap: 20,
              fontSize: 13,
              color: "rgba(237,237,240,0.6)",
            }}
          >
            <Link
              href="/cities"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              Cities
            </Link>
            <Link
              href="/niches"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              Niches
            </Link>
            <Link
              href="/alternatives"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              Alternatives
            </Link>
            <Link
              href="/compare"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              Compare
            </Link>
            <Link
              href="/blog"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              Blog
            </Link>
          </nav>
          <div style={{ marginLeft: "auto" }}>
            <Link
              href="/signup"
              style={{
                fontSize: 13,
                color: "#A5B4FC",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Start free →
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer
        style={{
          borderTop: "0.5px solid rgba(255,255,255,0.08)",
          padding: "24px 20px 48px",
          marginTop: 64,
          fontSize: 12,
          color: "rgba(237,237,240,0.5)",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p>
            Business profiles compiled by Leadac AI from public Google Maps
            data. Not affiliated with the businesses listed.
          </p>
          <p style={{ marginTop: 8 }}>
            <Link
              href="/legal/privacy"
              style={{ color: "inherit", marginRight: 12 }}
            >
              Privacy
            </Link>
            <Link
              href="/legal/terms"
              style={{ color: "inherit", marginRight: 12 }}
            >
              Terms
            </Link>
            <Link href="/" style={{ color: "inherit" }}>
              Home
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
