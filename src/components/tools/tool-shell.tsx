import type { ReactNode } from "react";
import Link from "next/link";

export function ToolShell({
  eyebrow,
  title,
  intro,
  children,
  width = 760,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
  width?: number;
}) {
  return (
    <section
      style={{
        maxWidth: width,
        margin: "0 auto",
        padding: "72px 24px 96px",
        color: "rgba(237,237,240,0.88)",
        fontSize: 16,
        lineHeight: 1.65,
      }}
    >
      <nav
        aria-label="Breadcrumb"
        style={{
          fontSize: 13,
          color: "rgba(237,237,240,0.5)",
          margin: "0 0 24px",
        }}
      >
        <Link href="/tools" style={{ color: "inherit", textDecoration: "none" }}>
          ← Free tools
        </Link>
      </nav>
      <p
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "rgba(165,180,252,0.85)",
          margin: "0 0 12px",
          fontWeight: 700,
        }}
      >
        {eyebrow}
      </p>
      <h1
        style={{
          fontSize: 44,
          fontWeight: 800,
          color: "#ffffff",
          margin: "0 0 16px",
          letterSpacing: "-0.025em",
          lineHeight: 1.1,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: 17,
          color: "rgba(237,237,240,0.78)",
          margin: "0 0 32px",
          lineHeight: 1.6,
          maxWidth: 640,
        }}
      >
        {intro}
      </p>
      {children}
    </section>
  );
}
