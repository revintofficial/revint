import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockupRenderer } from "@/lib/mockups/templates";
import {
  CURRENT_TEMPLATE_IDS,
  KUYUMCU_LUXURY_TEMPLATE_ID,
  KUYUMCU_TRADITIONAL_TEMPLATE_ID,
  resolveMockupRenderer,
} from "@/lib/agent-workers/website-mockup";
import { parseBranding } from "@/lib/branding";
import type { WebsiteMockupSections } from "@/lib/prompts/website-mockup-prompt";
import { getVisualIdentityForLead, getNicheBySlug } from "@/lib/niches";
import {
  readGramGoldTRYCached,
  formatGramGoldTRY,
} from "@/lib/external/gold-price";

/**
 * Public mockup view route. Served as raw HTML (not React) because the page
 * needs to render fast on a phone the moment a cold-email recipient taps the
 * link, and the content is already a fully-baked document.
 *
 * Lookup order: WebsiteMockup (flagship landing-page artifact) first,
 * then legacy Mockup table (markdown website plans). Slugs across both
 * tables share a 36^10 keyspace so collision probability is negligible.
 *
 * No authentication. The slug is the only protection. Mockups default
 * to `isPublic: true`; workspaces can flip it off to take one offline
 * (returns 404).
 *
 * View counter: incremented every request. Fire-and-forget so link
 * preview bots and email scanners don't block the response.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Prefer the new WebsiteMockup table (flagship Website Mockup
  // Generator output) over the legacy Mockup table (markdown plans).
  const wm = await prisma.websiteMockup.findUnique({
    where: { slug },
    include: {
      lead: {
        include: {
          workspace: { select: { name: true, branding: true, plan: true, language: true } },
        },
      },
    },
  });

  if (wm) {
    if (!wm.isPublic) {
      return notFound();
    }
    if (wm.expiresAt && wm.expiresAt.getTime() < Date.now()) {
      return expired();
    }

    prisma.websiteMockup
      .update({ where: { id: wm.id }, data: { viewCount: { increment: 1 } } })
      .catch((err) => console.error("WebsiteMockup view counter failed:", err));

    // Prefer the cached HTML for instant response; re-render from
    // sections if cache is missing OR the cache was produced by an
    // older renderer template (templateId mismatch). Older
    // `leadac-hero-v1`, `leadac-showcase-v1`, and now also any
    // pre-kuyumcu-track rows that should be on `kuyumcu-traditional-v1`
    // hit this path — the row's sectionsJson is forward-compatible
    // (renderers fall back to safe defaults for any newer field), so
    // we just re-render with the niche-correct current renderer and
    // the user gets the up-to-date design without waiting for a
    // manual regen.
    const cacheIsCurrent = CURRENT_TEMPLATE_IDS.has(wm.templateId);
    // Resolve which renderer the lead SHOULD be on right now. If the
    // cached templateId doesn't match the resolved one (e.g. lead was
    // re-classified from generic to kuyumcu-luxury after the cache was
    // built) we also need to re-render.
    const resolved = resolveMockupRenderer({
      subNicheSlug: wm.lead.subNicheSlug ?? null,
      nicheSlug: wm.lead.nicheSlug ?? null,
    });
    const templateMatchesNiche = wm.templateId === resolved.templateId;
    let html = cacheIsCurrent && templateMatchesNiche ? wm.htmlCache : null;
    if (!html) {
      const branding = wm.lead.workspace.plan === "AGENCY"
        ? parseBranding(wm.lead.workspace.branding)
        : null;
      const visual = getVisualIdentityForLead({
        subNicheSlug: wm.lead.subNicheSlug ?? null,
        nicheSlug: wm.lead.nicheSlug ?? null,
        primaryType: wm.lead.primaryType ?? null,
        businessName: wm.lead.businessName,
      });
      const nichePack =
        (wm.lead.subNicheSlug ? getNicheBySlug(wm.lead.subNicheSlug) : null) ??
        (wm.lead.nicheSlug ? getNicheBySlug(wm.lead.nicheSlug) : null) ??
        null;
      html = resolved.render({
        businessName: wm.lead.businessName,
        formattedAddress: wm.lead.formattedAddress,
        borough: wm.lead.borough,
        phone: wm.lead.phone,
        websiteUrl: wm.lead.websiteUrl,
        rating: wm.lead.rating,
        reviewCount: wm.lead.reviewCount,
        googleMapsUri: wm.lead.googleMapsUri,
        sections: wm.sectionsJson as unknown as WebsiteMockupSections,
        imagery: visual.imagery,
        secondaryHex: visual.theme.secondaryHex ?? null,
        workspaceName: wm.lead.workspace.name,
        branding,
        lang: wm.lead.workspace.language ?? "en",
        nicheLabel: nichePack?.label ?? null,
        nicheSlug: nichePack?.slug ?? null,
        nicheParentSlug: nichePack?.parentSlug ?? null,
        leadPhotoUrls: wm.lead.photoUrls ?? [],
      });

      // Fire-and-forget: persist the freshly rendered HTML + bump
      // the templateId so we hit the cached path on the next view
      // instead of re-rendering on every request. Failure is
      // non-fatal — worst case the next view re-renders again.
      const freshHtml = html;
      prisma.websiteMockup
        .update({
          where: { id: wm.id },
          data: { htmlCache: freshHtml, templateId: resolved.templateId },
        })
        .catch((err) => console.error("WebsiteMockup cache refresh failed:", err));
    }

    // Phase 4 (kuyumcu-pro plan) — inject the live gram altın price
    // into the cached/rendered HTML. The renderer plants a
    // `<!-- GOLD_PRICE_VALUE -->—` marker inside the gold-strip
    // `<span>`. We replace the marker on every serve so cache stays
    // fresh without invalidating `htmlCache` whenever the price
    // ticks. Redis read fails open: marker stays as "—".
    //
    // Only kuyumcu templates carry the marker (generic showcase
    // doesn't render the strip), so we cheaply skip the Redis round
    // trip for non-kuyumcu serves.
    const isKuyumcuTemplate =
      resolved.templateId === KUYUMCU_LUXURY_TEMPLATE_ID ||
      resolved.templateId === KUYUMCU_TRADITIONAL_TEMPLATE_ID;
    if (isKuyumcuTemplate && html.includes("<!-- GOLD_PRICE_VALUE -->")) {
      const quote = await readGramGoldTRYCached();
      if (quote) {
        const lang = wm.lead.workspace.language === "tr" ? "tr" : "en";
        const formatted = formatGramGoldTRY(quote.buy, lang as "tr" | "en");
        // Replace marker + the placeholder "—" character that
        // immediately follows it. The renderer hard-codes the
        // marker + dash pair so we never accidentally double-replace.
        html = html.replace("<!-- GOLD_PRICE_VALUE -->—", formatted);
      }
      // No quote → leave marker + dash in place. The renderer's
      // CSS treats "—" as the rest-state placeholder.
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
        // Shorter cache — gram altın 5 dk'da değişebilir. Browser
        // 60s tutar, edge'de no-store; tarayıcı yeniden açtığında
        // güncel fiyatı görür.
        "Cache-Control": isKuyumcuTemplate
          ? "private, max-age=60"
          : "private, max-age=300",
      },
    });
  }

  // Legacy Mockup (markdown website plan) fallback.
  const mockup = await prisma.mockup.findUnique({
    where: { slug },
    include: {
      lead: {
        include: {
          workspace: { select: { name: true, branding: true, plan: true } },
        },
      },
    },
  });

  if (!mockup || !mockup.isPublic) {
    return notFound();
  }

  if (mockup.expiresAt && mockup.expiresAt.getTime() < Date.now()) {
    return expired();
  }

  prisma.mockup
    .update({
      where: { id: mockup.id },
      data: { viewCount: { increment: 1 } },
    })
    .catch((err) => {
      console.error("Mockup view counter failed:", err);
    });

  const render = getMockupRenderer(mockup.templateId);
  const branding = mockup.lead.workspace.plan === "AGENCY"
    ? parseBranding(mockup.lead.workspace.branding)
    : null;
  const html = render({
    businessName: mockup.lead.businessName,
    city: mockup.lead.borough,
    websiteUrl: mockup.lead.websiteUrl,
    planMarkdown: mockup.htmlContent,
    workspaceName: mockup.lead.workspace.name,
    branding,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "private, max-age=300",
    },
  });
}

function notFound(): NextResponse {
  return new NextResponse(notFoundHtml(), {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function expired(): NextResponse {
  return new NextResponse(expiredHtml(), {
    status: 410,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function notFoundHtml(): string {
  return baseShell(
    "Draft not found",
    "This draft has been removed by its owner or never existed.",
  );
}

function expiredHtml(): string {
  return baseShell(
    "Draft expired",
    "This draft has expired. Get in touch with whoever sent it for a fresh copy.",
  );
}

function baseShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<style>
  html,body{margin:0;padding:0;background:#0b0b0d;color:#ededf0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6;height:100%;display:flex;align-items:center;justify-content:center}
  .b{max-width:420px;padding:32px;text-align:center}
  h1{font-size:22px;font-weight:600;margin:0 0 8px;letter-spacing:-0.015em}
  p{color:rgba(237,237,240,0.55);margin:0 0 24px;font-size:14px}
  a{color:#a5b4fc;text-decoration:none;font-size:13px}
  a:hover{text-decoration:underline}
</style>
</head><body><div class="b"><h1>${title}</h1><p>${body}</p><a href="https://leadac.ai">leadac.ai</a></div></body></html>`;
}
