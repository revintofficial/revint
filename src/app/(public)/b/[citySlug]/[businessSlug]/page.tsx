import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugify, extractIdSuffix } from "@/lib/slug";

/**
 * Public lead profile pages.
 *
 * URL: /b/[citySlug]/[businessSlug]
 * Example: /b/camden/ace-phone-repair-x9k2bv
 *
 * Only renders when:
 *  1. The lead's workspace has `publicProfilesEnabled = true`
 *  2. The lead has been audited (analyzeStatus = ANALYZED) so the page has
 *     real content rather than a placeholder
 *
 * Why this exists: ChatGPT, Perplexity, and increasingly Google answer "best
 * phone repair in Camden" by reading structured pages from the open web.
 * Lead Engine's audit data + Schema.org LocalBusiness markup makes us a
 * candidate source. Indirect SEO play, but cheap to ship.
 */

interface RouteParams {
  citySlug: string;
  businessSlug: string;
}

async function loadLead(params: RouteParams) {
  const idSuffix = extractIdSuffix(params.businessSlug);
  if (!idSuffix) return null;

  // Match the suffix against the trailing 6 chars of any lead id, scoped to
  // workspaces with public profiles enabled. We pull a small set then narrow
  // by exact slug match in JS (cuid endings aren't unique across workspaces,
  // but the (cuid + city + business) combo is enough for our purposes).
  const candidates = await prisma.lead.findMany({
    where: {
      analyzeStatus: "ANALYZED",
      workspace: { publicProfilesEnabled: true },
    },
    include: {
      websiteAudit: true,
      salesOpportunity: true,
      googleReviews: { orderBy: { publishTime: "desc" }, take: 3 },
      workspace: { select: { name: true, slug: true } },
    },
    take: 50,
  });

  const match = candidates.find(
    (l) =>
      l.id.endsWith(idSuffix) &&
      slugify(l.borough || "unknown") === params.citySlug.toLowerCase()
  );

  return match ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const resolved = await params;
  const lead = await loadLead(resolved);
  if (!lead) {
    return { title: "Business not found" };
  }
  const city = lead.borough || "London";
  return {
    title: `${lead.businessName} - ${city}`,
    description:
      lead.salesOpportunity?.whyGoodTarget?.slice(0, 160) ||
      `${lead.businessName} in ${city}. Website audit, services, and contact info.`,
    robots: { index: true, follow: true },
    openGraph: {
      title: `${lead.businessName} - ${city}`,
      type: "website",
    },
  };
}

export default async function PublicLeadProfile({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const resolved = await params;
  const lead = await loadLead(resolved);
  if (!lead) notFound();

  const audit = lead.websiteAudit;
  const opp = lead.salesOpportunity;
  const reviews = lead.googleReviews;
  const city = lead.borough || "London";

  // Schema.org LocalBusiness JSON-LD. Stripped down because we don't want to
  // claim opening hours we don't actually have; only ship facts the audit
  // verified.
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: lead.businessName,
    address: {
      "@type": "PostalAddress",
      streetAddress: lead.formattedAddress,
      addressLocality: city,
    },
    ...(lead.phone ? { telephone: lead.phone } : {}),
    ...(lead.websiteUrl ? { url: lead.websiteUrl } : {}),
    ...(lead.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: lead.rating,
            reviewCount: lead.reviewCount ?? 0,
          },
        }
      : {}),
  };

  return (
    <div style={pageStyles.body}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div style={pageStyles.wrap}>
        <p style={pageStyles.lede}>{city}</p>
        <h1 style={pageStyles.title}>{lead.businessName}</h1>
        <p style={pageStyles.address}>{lead.formattedAddress}</p>

        <div style={pageStyles.metaRow}>
          {lead.phone && (
            <a href={`tel:${lead.phone}`} style={pageStyles.metaLink}>
              {lead.phone}
            </a>
          )}
          {lead.websiteUrl && (
            <a
              href={lead.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={pageStyles.metaLink}
            >
              {lead.websiteUrl}
            </a>
          )}
          {lead.rating && (
            <span style={pageStyles.metaPlain}>
              {lead.rating.toFixed(1)} ({lead.reviewCount ?? 0} reviews)
            </span>
          )}
        </div>

        {opp?.whyGoodTarget && (
          <section style={pageStyles.section}>
            <h2 style={pageStyles.h2}>About {lead.businessName}</h2>
            <p style={pageStyles.body2}>{opp.whyGoodTarget}</p>
          </section>
        )}

        {audit && (
          <section style={pageStyles.section}>
            <h2 style={pageStyles.h2}>Website snapshot</h2>
            <ul style={pageStyles.list}>
              {audit.loadTimeMs !== null && (
                <li>Mobile load time: {(audit.loadTimeMs / 1000).toFixed(1)}s</li>
              )}
              <li>HTTPS: {audit.https ? "yes" : "no"}</li>
              <li>Mobile-friendly: {audit.mobileFriendlyGuess ? "yes" : "no"}</li>
              <li>
                Online booking:{" "}
                {audit.hasBookingSystem
                  ? audit.bookingProvider || "yes"
                  : "no"}
              </li>
            </ul>
          </section>
        )}

        {reviews.length > 0 && (
          <section style={pageStyles.section}>
            <h2 style={pageStyles.h2}>What people say</h2>
            {reviews.map((r) => (
              <div key={r.id} style={pageStyles.review}>
                <p style={pageStyles.reviewMeta}>
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)} &middot; {r.relativeTime}
                </p>
                {r.text && <p style={pageStyles.body2}>{r.text}</p>}
              </div>
            ))}
          </section>
        )}

        <p style={pageStyles.footer}>
          Profile compiled by {lead.workspace.name} via Lead Engine.
        </p>
      </div>
    </div>
  );
}

const pageStyles = {
  body: {
    background: "#0b0b0d",
    color: "#ededf0",
    minHeight: "100vh",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif',
    lineHeight: 1.6,
  } as const,
  wrap: { maxWidth: 720, margin: "0 auto", padding: "48px 20px 96px" } as const,
  lede: {
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
    color: "#a5b4fc",
    fontWeight: 600,
    margin: "0 0 12px",
  } as const,
  title: {
    fontSize: 36,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    margin: "0 0 8px",
  } as const,
  address: {
    color: "rgba(237,237,240,0.55)",
    fontSize: 15,
    margin: "0 0 16px",
  } as const,
  metaRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 16,
    fontSize: 14,
    margin: "0 0 36px",
  } as const,
  metaLink: { color: "#a5b4fc", textDecoration: "none" } as const,
  metaPlain: { color: "rgba(237,237,240,0.55)" } as const,
  section: {
    marginBottom: 32,
    padding: "24px 28px",
    background: "#121214",
    border: "0.5px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
  } as const,
  h2: { fontSize: 18, fontWeight: 600, margin: "0 0 12px" } as const,
  body2: { fontSize: 15, margin: "0 0 12px", color: "#ededf0" } as const,
  list: { margin: 0, paddingLeft: 22, fontSize: 15 } as const,
  review: { padding: "12px 0", borderTop: "0.5px solid rgba(255,255,255,0.06)" } as const,
  reviewMeta: { fontSize: 12, color: "rgba(237,237,240,0.55)", margin: "0 0 6px" } as const,
  footer: {
    marginTop: 48,
    paddingTop: 20,
    borderTop: "0.5px solid rgba(255,255,255,0.08)",
    color: "rgba(237,237,240,0.55)",
    fontSize: 12,
    textAlign: "center" as const,
  } as const,
};
