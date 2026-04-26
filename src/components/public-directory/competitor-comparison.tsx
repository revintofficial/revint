import Link from "next/link";
import type { CompetitorProfile } from "@/content/competitors";
import { LEADAC_SELF } from "@/content/competitors";

/**
 * Dimension-by-dimension comparison between Leadac AI and one competitor.
 * Rendered as a real <table> (not a flex layout) so answer engines can
 * extract it cleanly.
 */
export function ScorecardTable({
  competitor,
}: {
  competitor: CompetitorProfile;
}) {
  const dims = [
    { key: "localDiscovery", label: "Local business discovery" },
    { key: "websiteAudit", label: "Per-lead website audit" },
    { key: "outreachAutomation", label: "Outreach automation" },
    { key: "dataFreshness", label: "Data freshness" },
    { key: "priceForAgencies", label: "Price for agencies" },
  ] as const;

  return (
    <table
      style={{
        width: "100%",
        marginTop: 24,
        borderCollapse: "collapse",
        fontSize: 14,
        background: "#121214",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <thead>
        <tr
          style={{
            background: "rgba(255,255,255,0.04)",
            textAlign: "left",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "rgba(237,237,240,0.65)",
          }}
        >
          <th style={{ padding: "12px 16px" }}>Dimension</th>
          <th style={{ padding: "12px 16px", color: "var(--leadac-300)" }}>
            {LEADAC_SELF.name}
          </th>
          <th style={{ padding: "12px 16px" }}>{competitor.name}</th>
        </tr>
      </thead>
      <tbody>
        {dims.map((d) => (
          <tr
            key={d.key}
            style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
          >
            <td style={{ padding: "12px 16px", color: "#ededf0" }}>
              {d.label}
            </td>
            <td style={{ padding: "12px 16px", color: "var(--leadac-300)" }}>
              {"★".repeat(LEADAC_SELF.scorecard[d.key])}
              <span style={{ color: "rgba(255,255,255,0.15)" }}>
                {"★".repeat(5 - LEADAC_SELF.scorecard[d.key])}
              </span>
            </td>
            <td style={{ padding: "12px 16px", color: "rgba(237,237,240,0.8)" }}>
              {"★".repeat(competitor.scorecard[d.key])}
              <span style={{ color: "rgba(255,255,255,0.15)" }}>
                {"★".repeat(5 - competitor.scorecard[d.key])}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PricingComparison({
  a,
  b,
}: {
  a: CompetitorProfile;
  b: CompetitorProfile;
}) {
  return (
    <table
      style={{
        width: "100%",
        marginTop: 24,
        borderCollapse: "collapse",
        fontSize: 14,
        background: "#121214",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <thead>
        <tr
          style={{
            background: "rgba(255,255,255,0.04)",
            textAlign: "left",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "rgba(237,237,240,0.65)",
          }}
        >
          <th style={{ padding: "12px 16px" }}>Plan tier</th>
          <th style={{ padding: "12px 16px", color: "var(--leadac-300)" }}>{a.name}</th>
          <th style={{ padding: "12px 16px" }}>{b.name}</th>
        </tr>
      </thead>
      <tbody>
        <tr style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
          <td style={{ padding: "12px 16px" }}>Entry</td>
          <td style={{ padding: "12px 16px", color: "var(--leadac-300)" }}>
            {a.pricing.entry}
          </td>
          <td style={{ padding: "12px 16px" }}>{b.pricing.entry}</td>
        </tr>
        <tr style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
          <td style={{ padding: "12px 16px" }}>Mid</td>
          <td style={{ padding: "12px 16px", color: "var(--leadac-300)" }}>
            {a.pricing.mid ?? "—"}
          </td>
          <td style={{ padding: "12px 16px" }}>{b.pricing.mid ?? "—"}</td>
        </tr>
        <tr style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
          <td style={{ padding: "12px 16px" }}>Enterprise</td>
          <td style={{ padding: "12px 16px", color: "var(--leadac-300)" }}>
            {a.pricing.enterprise ?? "—"}
          </td>
          <td style={{ padding: "12px 16px" }}>{b.pricing.enterprise ?? "—"}</td>
        </tr>
        <tr style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
          <td style={{ padding: "12px 16px" }}>Free trial</td>
          <td style={{ padding: "12px 16px", color: "var(--leadac-300)" }}>
            {a.pricing.freeTrial}
          </td>
          <td style={{ padding: "12px 16px" }}>{b.pricing.freeTrial}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function CitationsBlock({
  title,
  citations,
}: {
  title?: string;
  citations: Array<{ label: string; url: string; note?: string }>;
}) {
  if (citations.length === 0) return null;
  return (
    <section
      style={{
        marginTop: 40,
        padding: "20px 24px",
        background: "rgba(18,18,20,0.6)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
      }}
    >
      <h2
        style={{
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "rgba(237,237,240,0.7)",
          fontWeight: 600,
          margin: "0 0 14px",
        }}
      >
        {title || "Sources"}
      </h2>
      <ol style={{ paddingLeft: 20, margin: 0 }}>
        {citations.map((c) => (
          <li
            key={c.url}
            style={{
              fontSize: 13,
              color: "rgba(237,237,240,0.75)",
              marginBottom: 8,
            }}
          >
            <a
              href={c.url}
              target="_blank"
              rel="nofollow noopener"
              style={{ color: "var(--leadac-300)" }}
            >
              {c.label}
            </a>
            {c.note && (
              <span style={{ color: "rgba(237,237,240,0.5)" }}>
                {" "}
                — {c.note}
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function WhyReasons({ reasons }: { reasons: string[] }) {
  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: "24px 0",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {reasons.map((r, i) => (
        <li
          key={r}
          style={{
            padding: "14px 18px",
            background: "#121214",
            border: "0.5px solid rgba(165,180,252,0.15)",
            borderRadius: 10,
            fontSize: 15,
            color: "#ededf0",
            lineHeight: 1.55,
            display: "flex",
            gap: 14,
          }}
        >
          <span
            style={{
              color: "var(--leadac-300)",
              fontWeight: 700,
              fontSize: 14,
              minWidth: 20,
            }}
          >
            {i + 1}.
          </span>
          <span>{r}</span>
        </li>
      ))}
    </ul>
  );
}

export function CompetitorLinkGrid({
  exclude,
  basePath,
  competitors,
}: {
  exclude: string;
  basePath: "/alternatives" | "/vs";
  competitors: Array<{ slug: string; name: string }>;
}) {
  const filtered = competitors.filter((c) => c.slug !== exclude);
  return (
    <section
      style={{
        marginTop: 40,
        padding: "20px 24px",
        background: "rgba(18,18,20,0.6)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
      }}
    >
      <h2
        style={{
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "rgba(237,237,240,0.7)",
          fontWeight: 600,
          margin: "0 0 14px",
        }}
      >
        Other comparisons
      </h2>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 8,
        }}
      >
        {filtered.map((c) => (
          <li key={c.slug}>
            <Link
              href={`${basePath}/${c.slug}`}
              style={{
                color: "var(--leadac-300)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              {basePath === "/alternatives"
                ? `${c.name} alternative`
                : `Leadac vs ${c.name}`}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
