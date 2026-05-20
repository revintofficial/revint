/**
 * Kuyumcu-specific landing-page renderer (luxury + traditional).
 *
 * Why a separate renderer from `leadac-showcase.ts`?
 *   Berkay (sektör satışçısı) feedback'i şu: jenerik showcase template'i
 *   sürücü kursu / phone-repair / kuyumcu hepsi için aynı silüeti
 *   üretiyor — "hep aynı site, asırı basit" diye geri geldi. Kuyumcu
 *   nişinde ersandiamond / butik kuyumcu seviyesinde bir tasarım için
 *   tipografi (serif), hero kompozisyonu (full-bleed editorial vs warm
 *   vitrin split), renk dengesi ve section ritmi farklı olmalı.
 *
 *   Generic renderer'a koşullu branch koymak yerine ayrı dosya açmak
 *   iki nedenden tercih edildi: (1) kuyumcu-spesifik section tipleri
 *   (collection_grid, certifications, atelier, gold_price) Phase 2'de
 *   eklenecek, ayrı dosya bunları temiz tutar; (2) jenerik renderer'a
 *   regresyon riski sıfır — kuyumcu lead'i bu dosyaya, diğer her şey
 *   `renderLeadacShowcase`'e gider.
 *
 * Variants:
 *   - "luxury"      → dark editorial, Cormorant Garamond serif, full-
 *                     bleed 21/9 hero with photo overlay, gold accent
 *                     line, "Tiffany/Cartier" minimal-luxe ritmi.
 *                     Hedef: kuyumcu-luxury (pırlanta / butik / Pro 18k).
 *   - "traditional" → light warm, Vollkorn serif headlines, 2-col warm
 *                     split hero with vitrin fotoğrafı + canlı gram
 *                     placeholder, kapalıçarşı esnaf hissi.
 *                     Hedef: kuyumcu-traditional ve sınıflanmamış
 *                     kuyumcu (Başlangıç 9k).
 *
 * Same security model as `leadac-showcase.ts`:
 *   - HTML-escape every dynamic string (`escapeHtml`)
 *   - Validate hex colors (`sanitizeHex`)
 *   - Validate photo URLs via CDN allowlist (`pickSafePhotoUrl`)
 *   - Phone/WhatsApp encoded through `encodeTelHref` / `encodeWhatsappHref`
 *
 * Page-weight discipline matches the showcase target (~60-75KB total —
 * a bit higher than `leadac-showcase` because the editorial layout
 * spends more on CSS).
 */

import type {
  WebsiteMockupSections,
  WebsiteMockupTestimonial,
  WebsiteMockupCourse,
  WebsiteMockupCollectionGrid,
  WebsiteMockupCertifications,
  WebsiteMockupAtelier,
  WebsiteMockupGoldPrice,
} from "@/lib/prompts/website-mockup-prompt";
import type { WorkspaceBranding } from "@/lib/branding";
import type { NicheImagery } from "@/lib/niches/theme";
import {
  escapeHtml,
  sanitizeHex,
  hexWithAlpha,
  encodeTelHref,
  encodeWhatsappHref,
  withWhatsappMessage,
  pickSafePhotoUrl,
  buildMapsEmbedUrl,
} from "./_shared";

export type KuyumcuVariant = "luxury" | "traditional";

export interface KuyumcuShowcaseRenderInput {
  businessName: string;
  formattedAddress: string;
  borough: string | null;
  phone: string | null;
  websiteUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  googleMapsUri: string | null;
  sections: WebsiteMockupSections;
  imagery?: NicheImagery | null;
  /**
   * Optional second-stop hex for the hero gradient. Niche pack supplies
   * a `secondaryHex` — luxury gets onyx (#1c1917), traditional gets
   * cream (#fef3c7).
   */
  secondaryHex?: string | null;
  workspaceName?: string;
  branding?: WorkspaceBranding | null;
  showLeadacCredit?: boolean;
  lang: string; // "tr" | "en"
  /**
   * Niche label for the `<title>` suffix (e.g. "Kuyumcular (tümü)").
   * Renderer drops it when null and falls back to neutral phrasing.
   */
  nicheLabel?: string | null;
  /**
   * Most-specific niche slug. Drives variant resolution AND per-niche
   * section-label overrides (kuyumcu-luxury vs kuyumcu-traditional).
   */
  nicheSlug?: string | null;
  /** Parent slug for fallback label resolution. */
  nicheParentSlug?: string | null;
  /**
   * Track variant. When omitted the renderer derives it from
   * `nicheSlug`: `kuyumcu-luxury` → "luxury", everything else
   * (including "kuyumcu", "kuyumcu-traditional") → "traditional".
   * Phase 2+ caller-side variant pinning supported for A/B testing.
   */
  variant?: KuyumcuVariant;
  /**
   * Real business / storefront / product photos from `Lead.photoUrls`
   * (populated by APIFY_GMAPS_DEEP — Phase 3). When present, used
   * before the Unsplash niche imagery for hero + gallery + atelier
   * accent. Empty / missing → silent fallback to the Unsplash pool.
   */
  leadPhotoUrls?: string[] | null;
}

export function renderKuyumcuShowcase(input: KuyumcuShowcaseRenderInput): string {
  const lang = input.lang === "tr" ? "tr" : "en";
  const variant: KuyumcuVariant =
    input.variant ?? (input.nicheSlug === "kuyumcu-luxury" ? "luxury" : "traditional");
  const labels = resolveLabels(lang, variant);

  const s = input.sections;
  const theme = s.theme;

  // Variant-specific palette baseline. The niche pack already feeds
  // sensible colors via `getNicheTheme()`; we layer variant-defaults
  // on top so callers that emit an "incomplete" theme (legacy v1 row,
  // generic fallback) still get a kuyumcu-correct page.
  const isLuxury = variant === "luxury";
  const variantDefaults = isLuxury
    ? {
        bg: "#0a0a0c",
        text: "#f5efe2",
        muted: "rgba(245,239,226,0.62)",
        panel: "rgba(20,18,16,0.72)",
        border: "rgba(212,175,55,0.18)",
        primary: "#d4af37",
        accent: "#fbbf24",
        secondary: "#1c1917",
        gold: "#d4af37",
      }
    : {
        bg: "#fbf7f0",
        text: "#1c1410",
        muted: "rgba(28,20,16,0.62)",
        panel: "rgba(255,253,247,0.86)",
        border: "rgba(180,83,9,0.18)",
        primary: "#b45309",
        accent: "#d4af37",
        secondary: "#fef3c7",
        gold: "#b45309",
      };

  const primary = sanitizeHex(theme.primary_hex) ?? variantDefaults.primary;
  const accent = sanitizeHex(theme.accent_hex) ?? variantDefaults.accent;
  const secondary = sanitizeHex(input.secondaryHex ?? null) ?? variantDefaults.secondary;

  // AGENCY-tier reseller branding override (same precedence as
  // leadac-showcase). Workspace primary / accent win over the niche
  // palette so the agency's brand identity reads first.
  const brand = input.branding;
  const finalPrimary = brand?.primaryColor
    ? (sanitizeHex(brand.primaryColor) ?? primary)
    : primary;
  const finalAccent = brand?.accentColor
    ? (sanitizeHex(brand.accentColor) ?? accent)
    : accent;

  // Imagery resolution. Hero anchors the fold; gallery populates the
  // 5-tile editorial lookbook; one gallery tile doubles as the
  // atelier accent.
  //
  // Phase 3 — real photos first, Unsplash fallback second. This is
  // the highest-leverage change for kuyumcu mockups: a Google Places
  // vitrin photo on the hero immediately communicates "this is YOUR
  // store" instead of "this is a stock luxury jewelry shot".
  const safeLeadPhotos = (input.leadPhotoUrls ?? [])
    .map((u) => pickSafePhotoUrl(u))
    .filter((u): u is string => Boolean(u));
  const stockHero = pickSafePhotoUrl(input.imagery?.hero?.[0] ?? null);
  const stockHeroSecondary = pickSafePhotoUrl(input.imagery?.hero?.[1] ?? null);
  const stockGallery = (input.imagery?.gallery ?? [])
    .map((u) => pickSafePhotoUrl(u))
    .filter((u): u is string => Boolean(u));

  const heroPhotoUrl = safeLeadPhotos[0] ?? stockHero;
  // Gallery pool prefers lead photos #2-6, then fills with stock.
  // Dedup so a single-photo lead doesn't show the same shot in hero
  // + gallery #1. Target 5-6 tiles because the kuyumcu lookbook
  // grid is 1 feature + 4 smaller.
  const gallerySeen = new Set<string>();
  if (heroPhotoUrl) gallerySeen.add(heroPhotoUrl);
  const galleryPool: string[] = [];
  for (const p of [...safeLeadPhotos.slice(1), ...stockGallery]) {
    if (gallerySeen.has(p)) continue;
    gallerySeen.add(p);
    galleryPool.push(p);
    if (galleryPool.length >= 6) break;
  }
  const galleryPhotoUrls = galleryPool;
  // Atelier accent: a lead photo that isn't the hero, otherwise the
  // first gallery tile, otherwise the secondary stock hero. The
  // luxury variant's full-bleed hero already eats the primary photo
  // so we want a *different* shot in the atelier block.
  const aboutAccentPhotoUrl =
    safeLeadPhotos[1] ?? galleryPhotoUrls[0] ?? stockHeroSecondary ?? heroPhotoUrl;

  const footerText =
    brand?.footerText ||
    (input.workspaceName
      ? `${escapeHtml(input.workspaceName)} tarafından hazırlandı`
      : labels.drafted_by);
  const showCredit = input.showLeadacCredit !== false && !brand?.hideLeadacCredit;
  const safeLogoUrl = brand?.logoUrl ? escapeHtml(brand.logoUrl) : null;

  // Caller-supplied business identity — always escaped.
  const name = escapeHtml(input.businessName);
  const addr = escapeHtml(input.formattedAddress);
  const borough = input.borough ? escapeHtml(input.borough) : null;
  const phoneDisplay = input.phone ? escapeHtml(input.phone) : null;
  const phoneHref = input.phone ? encodeTelHref(input.phone) : null;
  const waBaseHref = input.phone ? encodeWhatsappHref(input.phone) : null;
  const mapsHref = input.googleMapsUri ? escapeHtml(input.googleMapsUri) : null;

  const hero = s.hero;
  const trust = hero.trust_line ?? buildTrustLine(input.rating, input.reviewCount, lang);
  const heroStatChips = (hero.stat_strip ?? []).slice(0, 3);

  // Testimonials: prefer v2 array; fall back to v1 single (back-compat).
  const testimonialList: WebsiteMockupTestimonial[] =
    s.testimonials && s.testimonials.length > 0
      ? s.testimonials.slice(0, 3)
      : s.testimonial
        ? [s.testimonial]
        : [];

  // Courses: clamp to 3, ensure at most one is_popular.
  const coursesRaw = (s.courses ?? []).slice(0, 3);
  let seenPopular = false;
  const courses: WebsiteMockupCourse[] = coursesRaw.map((c) => {
    if (c.is_popular && !seenPopular) {
      seenPopular = true;
      return c;
    }
    return { ...c, is_popular: false };
  });

  const stats = (s.stats ?? []).slice(0, 4);
  const features = (s.features ?? []).slice(0, 4);
  const trustPoints = (s.trust_points ?? []).slice(0, 3);
  const faqs = (s.faqs ?? []).slice(0, 6);
  const booking = s.booking_widget ?? null;
  const contact = s.contact_form ?? null;
  const aboutInstructors = (s.about.instructors ?? []).slice(0, 3);
  const mapEmbedUrl = buildMapsEmbedUrl(s.map?.iframe_query ?? null);

  const bookingDayLabels = booking
    ? [booking.slot_label_today, booking.slot_label_tomorrow, booking.slot_label_day3]
    : [];

  // JSON-LD LocalBusiness (same shape as leadac-showcase).
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JewelryStore",
    name: input.businessName,
    address: {
      "@type": "PostalAddress",
      streetAddress: input.formattedAddress,
    },
  };
  if (input.phone) jsonLd.telephone = input.phone;
  if (input.websiteUrl) jsonLd.url = input.websiteUrl;
  if (input.rating && input.reviewCount && input.reviewCount > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: input.rating,
      reviewCount: input.reviewCount,
    };
  }
  const jsonLdStr = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  const nicheLabel = input.nicheLabel ? escapeHtml(input.nicheLabel) : null;
  const pageTitle = nicheLabel ? `${name} — ${nicheLabel}` : name;

  // Font stack: serif headlines, sans-serif body. Loaded from Google
  // Fonts CDN — single `<link>` per variant. The serif gives the page
  // its mücevher / editorial cachet that the all-sans showcase lacked.
  //   - Luxury: Cormorant Garamond (Cartier / Tiffany feel) + Inter
  //   - Traditional: Vollkorn (warm bookish serif) + Plus Jakarta Sans
  const fontLink = isLuxury
    ? `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />`
    : `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Vollkorn:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />`;

  const serifFamily = isLuxury
    ? `"Cormorant Garamond", "Playfair Display", Georgia, serif`
    : `"Vollkorn", Georgia, "Times New Roman", serif`;
  const bodyFamily = isLuxury
    ? `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    : `"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<meta name="format-detection" content="telephone=yes" />
<meta name="theme-color" content="${finalPrimary}" />
<title>${pageTitle}</title>
<meta name="description" content="${escapeHtml(hero.subline)}" />
<meta property="og:title" content="${name}" />
<meta property="og:description" content="${escapeHtml(hero.subline)}" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${name}" />
<meta name="twitter:description" content="${escapeHtml(hero.subline)}" />
${fontLink}
<script type="application/ld+json">${jsonLdStr}</script>
<style>
  :root {
    --bg: ${variantDefaults.bg};
    --text: ${variantDefaults.text};
    --muted: ${variantDefaults.muted};
    --panel: ${variantDefaults.panel};
    --border: ${variantDefaults.border};
    --primary: ${finalPrimary};
    --accent: ${finalAccent};
    --secondary: ${secondary};
    --gold: ${variantDefaults.gold};
    --gold-line: ${hexWithAlpha(finalAccent, 0.6)};
    --gold-soft: ${hexWithAlpha(finalAccent, 0.14)};
    --serif: ${serifFamily};
    --sans: ${bodyFamily};
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: var(--bg); color: var(--text);
    font-family: var(--sans);
    line-height: 1.6; -webkit-font-smoothing: antialiased;
    scroll-behavior: smooth;
  }
  a { color: inherit; }
  img { max-width: 100%; display: block; }
  .wrap { max-width: 1120px; margin: 0 auto; padding: 0 28px; }
  .wrap-narrow { max-width: 880px; margin: 0 auto; padding: 0 28px; }

  h1, h2, h3, .display { font-family: var(--serif); font-weight: ${isLuxury ? 500 : 600}; letter-spacing: ${isLuxury ? "-0.005em" : "-0.012em"}; }

  /* ----- background mesh ----- */
  body::before {
    content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background:
      radial-gradient(58% 48% at 14% 10%, ${hexWithAlpha(finalAccent, isLuxury ? 0.14 : 0.18)} 0%, transparent 62%),
      radial-gradient(46% 44% at 86% 18%, ${hexWithAlpha(finalPrimary, isLuxury ? 0.12 : 0.14)} 0%, transparent 62%),
      radial-gradient(40% 40% at 50% 100%, ${hexWithAlpha(secondary, isLuxury ? 0.22 : 0.32)} 0%, transparent 62%),
      var(--bg);
  }

  /* ----- nav ----- */
  header.nav {
    position: sticky; top: 0; z-index: 40;
    backdrop-filter: blur(18px);
    background: ${hexWithAlpha(variantDefaults.bg, 0.7)};
    border-bottom: 1px solid var(--border);
  }
  .nav-inner {
    display: flex; justify-content: space-between; align-items: center;
    padding: 16px 28px; max-width: 1200px; margin: 0 auto; gap: 16px;
  }
  .nav-brand {
    font-family: var(--serif); font-weight: ${isLuxury ? 600 : 700};
    font-size: ${isLuxury ? 22 : 20}px; letter-spacing: ${isLuxury ? "0.04em" : "-0.005em"};
    text-decoration: none; color: var(--text);
    display: inline-flex; align-items: center; gap: 10px;
    ${isLuxury ? "text-transform: uppercase;" : ""}
  }
  .nav-brand img { max-height: 32px; }
  .nav-links {
    display: flex; gap: 22px;
    font-size: 13px; letter-spacing: 0.04em;
    text-transform: uppercase; font-weight: 500;
  }
  .nav-links a {
    color: var(--muted); text-decoration: none;
    transition: color 160ms ease;
  }
  .nav-links a:hover { color: var(--text); }
  @media (max-width: 820px) { .nav-links { display: none; } }
  .nav-ctas { display: flex; gap: 10px; align-items: center; }
  .nav-cta-tel {
    background: var(--primary); color: ${isLuxury ? "#0a0a0c" : "#fff"};
    padding: 10px 18px; border-radius: ${isLuxury ? 2 : 999}px;
    text-decoration: none; font-size: 13px; font-weight: 600;
    letter-spacing: ${isLuxury ? "0.06em" : "-0.005em"};
    ${isLuxury ? "text-transform: uppercase;" : ""}
    transition: transform 120ms ease;
  }
  .nav-cta-tel:hover { transform: translateY(-1px); }
  .nav-cta-wa {
    background: transparent; color: var(--text);
    padding: 9px 16px; border-radius: ${isLuxury ? 2 : 999}px;
    border: 1px solid var(--border); font-size: 13px; font-weight: 500;
    text-decoration: none; letter-spacing: 0.04em;
  }
  @media (max-width: 640px) { .nav-cta-wa { display: none; } }

  /* ----- hero ----- */
  ${
    isLuxury
      ? `
  section.hero {
    position: relative; min-height: 640px; padding: 0;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .hero-photo-bleed {
    position: absolute; inset: 0;
    background-color: ${hexWithAlpha(finalPrimary, 0.22)};
    background-size: cover; background-position: center;
  }
  .hero-photo-bleed::after {
    content: ""; position: absolute; inset: 0;
    background:
      linear-gradient(180deg, ${hexWithAlpha(variantDefaults.bg, 0.35)} 0%, ${hexWithAlpha(variantDefaults.bg, 0.92)} 100%),
      radial-gradient(60% 60% at 50% 100%, ${hexWithAlpha(finalAccent, 0.22)} 0%, transparent 65%);
  }
  .hero-inner {
    position: relative; z-index: 2;
    max-width: 880px; padding: 120px 28px 80px;
    text-align: center;
  }
  .lede {
    font-family: var(--sans); font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.32em;
    color: var(--accent); font-weight: 500;
    margin-bottom: 24px;
  }
  h1.hero-title {
    font-size: clamp(40px, 6.4vw, 76px);
    font-weight: 500; line-height: 1.06; letter-spacing: -0.008em;
    margin: 0 0 18px;
  }
  .hero-rule {
    width: 88px; height: 1px; background: var(--gold-line);
    margin: 22px auto 26px;
  }
  .hero-sub {
    font-family: var(--sans); font-size: clamp(15px, 1.4vw, 18px);
    color: var(--muted); max-width: 580px; margin: 0 auto 36px;
    font-weight: 400;
  }
  .hero-ctas { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
  .trust { margin-top: 28px; font-size: 12px; color: var(--muted); letter-spacing: 0.06em; display: inline-flex; align-items: center; gap: 10px; }
  .stars { color: ${finalAccent}; font-size: 14px; letter-spacing: 1px; }
  .hero-chips { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 40px; justify-content: center; }
  .chip {
    border: 1px solid var(--border);
    padding: 14px 22px; min-width: 130px; text-align: center;
    background: ${hexWithAlpha(variantDefaults.bg, 0.4)};
    backdrop-filter: blur(10px);
  }
  .chip-v { font-family: var(--serif); font-size: 28px; font-weight: 500; letter-spacing: -0.01em; color: var(--accent); }
  .chip-l { font-family: var(--sans); font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--muted); margin-top: 4px; }
  `
      : `
  section.hero { padding: 96px 0 64px; }
  .hero-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 56px; align-items: center; }
  .lede {
    font-family: var(--sans); font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.2em;
    color: var(--primary); font-weight: 600;
    margin-bottom: 16px; display: inline-flex; align-items: center; gap: 10px;
  }
  .lede::after { content: ""; width: 32px; height: 1px; background: var(--gold-line); display: inline-block; }
  h1.hero-title {
    font-size: clamp(38px, 5.4vw, 62px);
    font-weight: 600; line-height: 1.04; letter-spacing: -0.015em;
    margin: 0 0 20px;
  }
  .hero-sub { font-family: var(--sans); font-size: clamp(16px, 1.6vw, 19px); color: var(--muted); max-width: 540px; margin: 0 0 32px; }
  .hero-ctas { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
  .trust { margin-top: 26px; font-size: 13.5px; color: var(--muted); display: inline-flex; align-items: center; gap: 10px; }
  .stars { letter-spacing: -1px; color: ${finalAccent}; font-size: 16px; }
  .hero-chips { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 32px; }
  .chip {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 14px; padding: 12px 16px; min-width: 110px;
  }
  .chip-v { font-family: var(--serif); font-size: 22px; font-weight: 600; letter-spacing: -0.012em; }
  .chip-l { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-top: 3px; }
  .hero-photo {
    position: relative; width: 100%; aspect-ratio: 4 / 5; border-radius: 4px;
    overflow: hidden;
    background-color: ${hexWithAlpha(finalPrimary, 0.15)};
    background-size: cover; background-position: center;
    box-shadow: 0 30px 80px -40px ${hexWithAlpha(finalPrimary, 0.4)};
  }
  .hero-photo::before {
    content: ""; position: absolute; inset: 0;
    border: 1px solid var(--gold-line);
    transform: translate(14px, 14px);
    pointer-events: none;
  }
  .hero-photo::after {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(160deg, transparent 60%, ${hexWithAlpha(finalPrimary, 0.18)} 100%);
    pointer-events: none;
  }
  @media (max-width: 820px) {
    .hero-grid { grid-template-columns: 1fr; gap: 36px; }
    .hero-photo { aspect-ratio: 4 / 3; }
    .hero-photo::before { transform: translate(8px, 8px); }
    section.hero { padding: 64px 0 40px; }
  }
  `
  }

  /* ----- gold price strip ----- */
  .gold-strip {
    background: ${isLuxury ? hexWithAlpha("#000000", 0.4) : hexWithAlpha("#ffffff", 0.7)};
    border-top: 1px solid var(--gold-line);
    border-bottom: 1px solid var(--gold-line);
    padding: 18px 28px; text-align: center;
  }
  .gold-strip-inner {
    max-width: 1120px; margin: 0 auto;
    display: flex; align-items: center; justify-content: center;
    gap: 18px; flex-wrap: wrap;
  }
  .gold-label {
    font-family: var(--sans); font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.24em;
    color: var(--muted); font-weight: 600;
  }
  .gold-value {
    font-family: var(--serif); font-size: 22px; font-weight: 600;
    color: var(--accent); letter-spacing: -0.01em;
  }
  .gold-cta {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent; border: 1px solid var(--gold-line);
    color: var(--text); padding: 8px 16px; border-radius: ${isLuxury ? 2 : 999}px;
    text-decoration: none; font-size: 12px; font-weight: 600;
    letter-spacing: 0.06em; ${isLuxury ? "text-transform: uppercase;" : ""}
    transition: background 160ms ease;
  }
  .gold-cta:hover { background: var(--gold-soft); }

  /* ----- section base ----- */
  section.block { padding: ${isLuxury ? 96 : 80}px 0; position: relative; }
  .section-eyebrow {
    font-family: var(--sans); font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.28em;
    color: var(--accent); font-weight: 600;
    margin-bottom: 14px;
    display: inline-flex; align-items: center; gap: 12px;
  }
  .section-eyebrow::before {
    content: ""; width: 28px; height: 1px; background: var(--gold-line); display: inline-block;
  }
  .section-title {
    font-family: var(--serif); font-size: clamp(28px, 3.8vw, 44px);
    font-weight: ${isLuxury ? 500 : 600}; line-height: 1.08;
    letter-spacing: -0.012em; margin: 0 0 18px; max-width: 720px;
  }
  .section-sub { font-family: var(--sans); color: var(--muted); margin: 0 0 40px; max-width: 640px; font-size: 16px; }

  .btn-primary {
    background: var(--primary);
    color: ${isLuxury ? "#0a0a0c" : "#fff"};
    padding: 15px 28px; border-radius: ${isLuxury ? 2 : 999}px;
    text-decoration: none; font-family: var(--sans);
    font-size: 14px; font-weight: 600;
    letter-spacing: ${isLuxury ? "0.1em" : "-0.005em"};
    ${isLuxury ? "text-transform: uppercase;" : ""}
    display: inline-flex; align-items: center; gap: 10px;
    transition: transform 120ms ease, background 120ms ease;
    border: none; cursor: pointer;
  }
  .btn-primary:hover { transform: translateY(-1px); }
  .btn-secondary {
    background: transparent; color: var(--text);
    padding: 14px 24px; border-radius: ${isLuxury ? 2 : 999}px;
    text-decoration: none; font-family: var(--sans);
    font-size: 14px; font-weight: 500;
    letter-spacing: ${isLuxury ? "0.1em" : "-0.005em"};
    ${isLuxury ? "text-transform: uppercase;" : ""}
    border: 1px solid var(--gold-line);
    display: inline-flex; align-items: center; gap: 10px;
    transition: background 160ms ease;
  }
  .btn-secondary:hover { background: var(--gold-soft); }

  /* ----- stats ----- */
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .stat-card {
    padding: 32px 28px;
    border-right: 1px solid var(--border);
  }
  .stat-card:last-child { border-right: none; }
  .stat-v { font-family: var(--serif); font-size: 38px; font-weight: ${isLuxury ? 500 : 600}; letter-spacing: -0.02em; color: var(--accent); }
  .stat-l { color: var(--muted); font-size: 13px; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.1em; }
  @media (max-width: 720px) { .stat-card { border-right: none; border-bottom: 1px solid var(--border); } .stat-card:last-child { border-bottom: none; } }

  /* ----- process ----- */
  .process-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 28px; }
  .process-card { position: relative; padding-top: 24px; }
  .process-card::before { content: ""; position: absolute; top: 0; left: 0; width: 36px; height: 1px; background: var(--gold-line); }
  .process-num { font-family: var(--serif); font-size: 13px; font-weight: 600; color: var(--accent); letter-spacing: 0.16em; margin-bottom: 14px; }
  .process-card h3 { font-family: var(--serif); margin: 0 0 10px; font-size: 22px; font-weight: ${isLuxury ? 500 : 600}; letter-spacing: -0.01em; }
  .process-card p { margin: 0; color: var(--muted); font-size: 14.5px; }

  /* ----- collection / courses ----- */
  .collection-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; }
  .collection-card {
    background: var(--panel);
    border: 1px solid var(--border);
    padding: 36px 28px;
    position: relative; display: flex; flex-direction: column;
    transition: border-color 200ms ease, transform 200ms ease;
  }
  .collection-card:hover { border-color: var(--gold-line); transform: translateY(-3px); }
  .collection-card.popular { border-color: var(--gold-line); box-shadow: 0 30px 80px -40px ${hexWithAlpha(finalAccent, 0.5)}; }
  .collection-card.popular .badge {
    position: absolute; top: -1px; right: -1px;
    background: var(--accent); color: ${isLuxury ? "#0a0a0c" : "#1c1410"};
    padding: 6px 14px; font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.16em;
  }
  .collection-icon {
    width: 48px; height: 48px; border-radius: ${isLuxury ? 2 : 12}px;
    background: var(--gold-soft); color: var(--accent);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 22px;
  }
  .collection-card h3 { font-family: var(--serif); margin: 0 0 10px; font-size: 24px; font-weight: ${isLuxury ? 500 : 600}; letter-spacing: -0.012em; }
  .collection-card .price { font-family: var(--serif); font-size: 16px; font-weight: 500; color: var(--accent); margin: 6px 0 4px; letter-spacing: 0.01em; }
  .collection-card .duration { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 18px; }
  .collection-card .body { color: var(--muted); font-size: 14.5px; margin: 0 0 22px; }
  .collection-card ul { list-style: none; padding: 0; margin: 0 0 26px; flex-grow: 1; }
  .collection-card ul li { font-size: 13.5px; color: var(--text); padding: 6px 0; padding-left: 24px; position: relative; }
  .collection-card ul li::before { content: ""; position: absolute; left: 0; top: 12px; width: 14px; height: 1px; background: var(--gold-line); }

  /* ----- trust / certifications ----- */
  .trust-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0; border-top: 1px solid var(--border); }
  .trust-card {
    padding: 36px 28px;
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    position: relative;
  }
  .trust-card:last-child { border-right: none; }
  @media (max-width: 720px) { .trust-card { border-right: none; } }
  .trust-num { font-family: var(--serif); font-size: 13px; font-weight: 600; color: var(--accent); margin-bottom: 18px; letter-spacing: 0.16em; }
  .trust-card h3 { font-family: var(--serif); margin: 0 0 12px; font-size: 22px; font-weight: ${isLuxury ? 500 : 600}; letter-spacing: -0.01em; }
  .trust-card p { margin: 0; color: var(--muted); font-size: 14.5px; }

  /* ----- gallery (lookbook) ----- */
  .gallery-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    grid-template-rows: repeat(2, 1fr);
    gap: 16px;
    height: 640px;
  }
  .gallery-tile {
    position: relative; overflow: hidden;
    background-color: var(--panel);
    background-size: cover; background-position: center;
    transition: transform 0.5s ease;
  }
  .gallery-tile:nth-child(1) { grid-row: span 2; }
  .gallery-tile:hover { transform: scale(1.02); }
  .gallery-tile::after {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.6) 100%);
  }
  .gallery-cap {
    position: absolute; left: 24px; bottom: 22px; right: 24px;
    color: #fff; font-family: var(--serif); font-size: 18px; font-weight: 500;
    letter-spacing: -0.005em;
    text-shadow: 0 2px 8px rgba(0,0,0,0.5);
  }
  @media (max-width: 820px) {
    .gallery-grid { grid-template-columns: 1fr 1fr; grid-template-rows: 280px 200px 200px; height: auto; }
    .gallery-tile:nth-child(1) { grid-column: span 2; grid-row: span 1; }
  }

  /* ----- testimonials ----- */
  .testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 28px; }
  .review-card {
    background: var(--panel);
    border: 1px solid var(--border);
    padding: 32px 28px;
    position: relative;
  }
  .review-card::before {
    content: "\u201C";
    position: absolute; top: 12px; right: 24px;
    font-family: var(--serif); font-size: 64px; line-height: 1;
    color: var(--gold-line);
  }
  .review-card .stars { font-size: 16px; margin-bottom: 14px; display: block; color: var(--accent); letter-spacing: 1px; }
  .review-card p { margin: 0 0 16px; font-family: var(--serif); font-size: 18px; font-weight: 400; font-style: italic; line-height: 1.5; }
  .review-card .who { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.16em; font-family: var(--sans); }

  /* ----- faq ----- */
  .faq-list { display: flex; flex-direction: column; max-width: 820px; }
  details.faq {
    border-bottom: 1px solid var(--border);
    padding: 24px 0;
  }
  details.faq:first-child { border-top: 1px solid var(--border); }
  details.faq summary {
    cursor: pointer; list-style: none;
    display: flex; justify-content: space-between; align-items: center;
    gap: 16px;
    font-family: var(--serif); font-weight: ${isLuxury ? 500 : 600};
    font-size: 19px; letter-spacing: -0.005em;
  }
  details.faq summary::-webkit-details-marker { display: none; }
  details.faq summary::after {
    content: "+"; font-family: var(--serif); font-size: 28px; line-height: 1;
    color: var(--accent); transition: transform 240ms ease;
    width: 28px; text-align: center; flex-shrink: 0;
  }
  details.faq[open] summary::after { transform: rotate(45deg); }
  details.faq .faq-a { margin: 14px 0 0; color: var(--muted); font-size: 15px; line-height: 1.7; max-width: 720px; }

  /* ----- booking ----- */
  .booking-card {
    background: var(--panel);
    border: 1px solid var(--gold-line);
    padding: 48px 36px;
  }
  .booking-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 24px; }
  .booking-col h4 {
    font-family: var(--sans); margin: 0 0 14px; font-size: 11px;
    font-weight: 600; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.16em; text-align: center;
  }
  .booking-slot {
    display: block;
    background: ${hexWithAlpha(variantDefaults.text, 0.04)};
    border: 1px solid var(--border);
    padding: 12px 0; font-family: var(--serif);
    font-size: 16px; font-weight: 500;
    text-decoration: none; color: var(--text); text-align: center;
    margin-bottom: 10px;
    transition: background 160ms ease, border-color 160ms ease;
  }
  .booking-slot:hover { background: var(--gold-soft); border-color: var(--gold-line); }
  .booking-note { margin: 20px 0 0; font-size: 12px; color: var(--muted); text-align: center; letter-spacing: 0.04em; }
  @media (max-width: 640px) { .booking-cols { grid-template-columns: 1fr; } }

  /* ----- about / atelier ----- */
  .about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
  .about-panel p {
    margin: 0; font-family: var(--serif);
    font-size: 20px; font-weight: ${isLuxury ? 400 : 500};
    line-height: 1.65; letter-spacing: -0.005em;
  }
  .atelier-years {
    display: flex; align-items: baseline; gap: 14px;
    margin-bottom: 24px; padding-bottom: 20px;
    border-bottom: 1px solid var(--gold-line);
  }
  .atelier-years-num {
    font-family: var(--serif); font-size: clamp(48px, 6vw, 72px);
    font-weight: ${isLuxury ? 500 : 600}; line-height: 1;
    color: var(--accent); letter-spacing: -0.025em;
  }
  .atelier-years-l {
    font-family: var(--sans); font-size: 12px;
    text-transform: uppercase; letter-spacing: 0.18em;
    color: var(--muted); font-weight: 600;
  }
  .about-photo {
    position: relative; width: 100%; aspect-ratio: 4 / 5;
    overflow: hidden;
    background-size: cover; background-position: center;
  }
  .about-photo::before {
    content: ""; position: absolute; inset: 0;
    border: 1px solid var(--gold-line);
    transform: translate(14px, 14px);
    pointer-events: none;
  }
  .instructors-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-top: 32px; }
  .instructor-card {
    padding: 18px 0;
    border-top: 1px solid var(--border);
    display: flex; gap: 14px; align-items: center;
  }
  .instructor-avatar {
    width: 44px; height: 44px; border-radius: 50%;
    background: var(--gold-soft); color: var(--accent);
    font-family: var(--serif); font-weight: 600;
    display: flex; align-items: center; justify-content: center;
  }
  .instructor-meta { font-size: 14px; }
  .instructor-meta strong { display: block; font-family: var(--serif); font-weight: ${isLuxury ? 500 : 600}; font-size: 16px; }
  .instructor-meta span { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; }
  @media (max-width: 820px) { .about-grid { grid-template-columns: 1fr; gap: 32px; } }

  /* ----- map ----- */
  .map-frame { width: 100%; height: 420px; border: 1px solid var(--border); }

  /* ----- contact ----- */
  .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: start; }
  .contact-form {
    background: var(--panel);
    border: 1px solid var(--border);
    padding: 36px 32px;
  }
  .contact-form label {
    display: block; font-family: var(--sans); font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.16em;
    color: var(--muted); margin-bottom: 8px; font-weight: 600;
  }
  .contact-form input, .contact-form select, .contact-form textarea {
    width: 100%;
    background: ${hexWithAlpha(variantDefaults.text, 0.03)};
    color: var(--text);
    border: 1px solid var(--border);
    padding: 13px 16px;
    font-size: 15px;
    margin-bottom: 18px;
    font-family: var(--sans);
  }
  .contact-form input:focus, .contact-form textarea:focus { outline: none; border-color: var(--gold-line); }
  .contact-form textarea { min-height: 112px; resize: vertical; }
  .contact-form .submit { width: 100%; margin-top: 8px; }
  .contact-form .privacy { font-size: 11.5px; color: var(--muted); margin-top: 14px; text-align: center; letter-spacing: 0.04em; }
  .contact-info { font-family: var(--sans); font-size: 15px; color: var(--muted); display: flex; flex-direction: column; gap: 14px; padding-top: 12px; }
  .contact-info strong { font-family: var(--serif); font-size: 24px; color: var(--text); font-weight: ${isLuxury ? 500 : 600}; }
  .contact-info a { color: var(--text); text-decoration: none; border-bottom: 1px solid var(--gold-line); }
  @media (max-width: 820px) { .contact-grid { grid-template-columns: 1fr; gap: 32px; } }

  /* ----- cta_final ----- */
  section.cta-final-block { padding: ${isLuxury ? 120 : 96}px 0; }
  .cta-final {
    background: ${
      isLuxury
        ? `linear-gradient(135deg, ${hexWithAlpha(finalPrimary, 0.18)} 0%, ${hexWithAlpha(secondary, 0.4)} 100%)`
        : `linear-gradient(135deg, ${hexWithAlpha(finalPrimary, 0.9)} 0%, ${hexWithAlpha(finalAccent, 0.85)} 100%)`
    };
    color: ${isLuxury ? "var(--text)" : "#fff"};
    border: 1px solid var(--gold-line);
    padding: 64px 40px; text-align: center;
  }
  .cta-final h2 { font-family: var(--serif); font-size: clamp(28px, 4vw, 44px); font-weight: ${isLuxury ? 500 : 600}; letter-spacing: -0.015em; margin: 0 0 14px; }
  .cta-final p { font-family: var(--sans); margin: 0 0 28px; opacity: 0.85; font-size: 16px; max-width: 560px; margin-left: auto; margin-right: auto; }
  .cta-final .hero-ctas { justify-content: center; }
  .cta-final .btn-primary { background: ${isLuxury ? "var(--accent)" : "#fff"}; color: ${isLuxury ? "#0a0a0c" : finalPrimary}; }
  .cta-final .btn-secondary { color: ${isLuxury ? "var(--text)" : "#fff"}; border-color: ${isLuxury ? "var(--gold-line)" : "rgba(255,255,255,0.5)"}; }

  /* ----- footer ----- */
  footer.footer {
    padding: 48px 28px 64px;
    border-top: 1px solid var(--border);
    color: var(--muted); font-size: 12.5px;
    text-align: center; letter-spacing: 0.04em;
  }
  footer.footer a { color: var(--accent); text-decoration: none; }

  /* ----- mobile polish ----- */
  @media (max-width: 640px) {
    section.block { padding: 56px 0; }
    .wrap, .wrap-narrow { padding: 0 22px; }
    .cta-final { padding: 40px 24px; }
  }
</style>
</head>
<body>
${renderNav({ name, safeLogoUrl, phoneHref, waBaseHref, labels, isLuxury })}

<main id="top">

${renderBody({
  variant,
  sectionOrder: s.section_order,
  builders: {
    hero: () =>
      renderHero({
        variant,
        borough,
        labels,
        hero,
        trust,
        heroStatChips,
        heroPhotoUrl,
        name,
        phoneHref,
        waBaseHref,
        mapsHref,
      }),
    gold_price: () => renderGoldPriceStrip(s.gold_price ?? null, waBaseHref, labels, isLuxury),
    collection_grid: () =>
      s.collection_grid && s.collection_grid.categories.length > 0
        ? renderCollectionGridFromSpec(s.collection_grid, labels, waBaseHref)
        : renderCollectionBlock(courses, labels, waBaseHref, isLuxury),
    // Generic course block alias — when Gemini emits "courses" in
    // section_order instead of "collection_grid" we still want a
    // visible block. Same fallback chain.
    courses: () =>
      s.collection_grid && s.collection_grid.categories.length > 0
        ? renderCollectionGridFromSpec(s.collection_grid, labels, waBaseHref)
        : renderCollectionBlock(courses, labels, waBaseHref, isLuxury),
    process: () => renderProcessBlock(features, labels),
    // "trust" key → certifications when available, generic trust
    // points otherwise. Same fallback chain as the visual override.
    trust: () =>
      s.certifications && s.certifications.items.length > 0
        ? renderCertificationsBlock(s.certifications, labels)
        : renderTrustBlock(trustPoints, labels),
    certifications: () =>
      s.certifications && s.certifications.items.length > 0
        ? renderCertificationsBlock(s.certifications, labels)
        : renderTrustBlock(trustPoints, labels),
    gallery: () => renderGalleryBlock(galleryPhotoUrls, labels, input.businessName),
    stats: () => renderStatsBlock(stats, labels),
    testimonials: () => renderTestimonialsBlock(testimonialList, labels),
    atelier: () =>
      s.atelier
        ? renderAtelierBlock(s.atelier, aboutAccentPhotoUrl, aboutInstructors, input.businessName, labels, isLuxury)
        : renderAboutBlock(s.about.paragraph, aboutInstructors, aboutAccentPhotoUrl, input.businessName, labels),
    about: () =>
      s.atelier
        ? renderAtelierBlock(s.atelier, aboutAccentPhotoUrl, aboutInstructors, input.businessName, labels, isLuxury)
        : renderAboutBlock(s.about.paragraph, aboutInstructors, aboutAccentPhotoUrl, input.businessName, labels),
    booking: () => renderBookingBlock(booking, waBaseHref, bookingDayLabels, labels),
    faq: () => renderFaqBlock(faqs, labels),
    map: () => renderMapBlock(mapEmbedUrl, labels),
    contact: () => renderContactBlock(contact, waBaseHref, name, phoneDisplay, addr, labels),
    cta: () => renderCtaFinal(s.cta_final, phoneHref, waBaseHref, labels),
    cta_final: () => renderCtaFinal(s.cta_final, phoneHref, waBaseHref, labels),
  },
})}

</main>

<footer class="footer">
  ${footerText}${showCredit ? ` · <a href="https://leadac.ai" target="_blank" rel="noopener">leadac.ai</a>` : ""}
</footer>

</body>
</html>`;
}

// ============================================================
// Body composer — section_order driven
// ============================================================

/**
 * Per-track default section order. Gemini's `section_order` array
 * wins when populated; this is the floor. Two tracks get different
 * defaults because the visual rhythm priorities differ:
 *
 *   - Luxury: hero → gold_price → collection (vitrin) → atelier
 *     (master story) → certifications (sertifika) → testimonials
 *     (sosyal kanıt) → gallery (lookbook) → process → faq →
 *     booking → about → map → contact → cta.
 *     Reason: luxury butik prospect'i ürün × güvence × ustanın
 *     hikayesini önce görmek istiyor; randevu en sonda.
 *
 *   - Traditional: hero → gold_price → collection → trust (hurda
 *     flow + güvence) → testimonials → gallery → process → atelier
 *     → stats → faq → booking → map → contact → cta.
 *     Reason: mahalle kuyumcu için gram fiyatı + hurda flow + sosyal
 *     kanıt önce, vitrin sonra. Pricing/trust early, story late.
 *
 * Items without a registered renderer are silently dropped (so an
 * old `section_order` entry like "v1_pricing" doesn't error the
 * page).
 */
const DEFAULT_SECTION_ORDER_LUXURY = [
  "hero",
  "gold_price",
  "collection_grid",
  "atelier",
  "certifications",
  "testimonials",
  "gallery",
  "process",
  "faq",
  "booking",
  "about",
  "map",
  "contact",
  "cta_final",
];

const DEFAULT_SECTION_ORDER_TRADITIONAL = [
  "hero",
  "gold_price",
  "collection_grid",
  "trust",
  "testimonials",
  "gallery",
  "process",
  "atelier",
  "stats",
  "faq",
  "booking",
  "map",
  "contact",
  "cta_final",
];

export function getKuyumcuDefaultSectionOrder(variant: KuyumcuVariant): string[] {
  return variant === "luxury"
    ? [...DEFAULT_SECTION_ORDER_LUXURY]
    : [...DEFAULT_SECTION_ORDER_TRADITIONAL];
}

function renderBody(args: {
  variant: KuyumcuVariant;
  sectionOrder: string[] | undefined;
  builders: Record<string, () => string>;
}): string {
  const { variant, sectionOrder, builders } = args;
  // Honor Gemini's order only when it's substantially complete
  // (≥10 entries vs the 14-item default). Legacy v2 rows that
  // carry a 4-entry stub from the original "we never used this"
  // field fall back to the variant default — they render every
  // kuyumcu section in the curated order instead of silently
  // dropping FAQ / booking / atelier.
  const order =
    Array.isArray(sectionOrder) && sectionOrder.length >= 10
      ? sectionOrder
      : variant === "luxury"
        ? DEFAULT_SECTION_ORDER_LUXURY
        : DEFAULT_SECTION_ORDER_TRADITIONAL;

  // nav / footer / "site navigation"-meaningful tokens are filtered
  // here because the outer template already places them. This lets
  // Gemini emit the v2-default `["nav", "hero", ...]` array without
  // double-rendering nav.
  const SKIP_TOKENS = new Set(["nav", "footer"]);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of order) {
    if (SKIP_TOKENS.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const build = builders[key];
    if (!build) continue;
    out.push(build());
  }
  return out.join("\n");
}

// ============================================================
// Section renderers
// ============================================================

function renderNav(args: {
  name: string;
  safeLogoUrl: string | null;
  phoneHref: string | null;
  waBaseHref: string | null;
  labels: KuyumcuLabels;
  isLuxury: boolean;
}): string {
  const { name, safeLogoUrl, phoneHref, waBaseHref, labels } = args;
  return `<header class="nav">
  <div class="nav-inner">
    <a class="nav-brand" href="#top">
      ${safeLogoUrl ? `<img src="${safeLogoUrl}" alt="" />` : ""}
      <span>${name}</span>
    </a>
    <nav class="nav-links" aria-label="primary">
      <a href="#collection">${escapeHtml(labels.nav_collection)}</a>
      <a href="#atelier">${escapeHtml(labels.nav_atelier)}</a>
      <a href="#booking">${escapeHtml(labels.nav_appointment)}</a>
      <a href="#contact">${escapeHtml(labels.nav_contact)}</a>
    </nav>
    <div class="nav-ctas">
      ${waBaseHref ? `<a class="nav-cta-wa" href="${waBaseHref}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
      ${phoneHref ? `<a class="nav-cta-tel" href="${phoneHref}">${escapeHtml(labels.call_now)}</a>` : ""}
    </div>
  </div>
</header>`;
}

function renderHero(args: {
  variant: KuyumcuVariant;
  borough: string | null;
  labels: KuyumcuLabels;
  hero: WebsiteMockupSections["hero"];
  trust: string | null;
  heroStatChips: { value: string; label: string }[];
  heroPhotoUrl: string | null;
  name: string;
  phoneHref: string | null;
  waBaseHref: string | null;
  mapsHref: string | null;
}): string {
  const {
    variant,
    borough,
    labels,
    hero,
    trust,
    heroStatChips,
    heroPhotoUrl,
    name,
    phoneHref,
    waBaseHref,
    mapsHref,
  } = args;

  const ctaSecondary =
    hero.cta_secondary_text && hero.cta_secondary_text.trim()
      ? hero.cta_secondary_text
      : labels.message_us;

  const chipsHtml = heroStatChips.length
    ? `<div class="hero-chips">${heroStatChips
        .map(
          (c) => `<div class="chip">
        <div class="chip-v">${escapeHtml(c.value)}</div>
        <div class="chip-l">${escapeHtml(c.label)}</div>
      </div>`,
        )
        .join("")}</div>`
    : "";

  const ctasHtml = `<div class="hero-ctas">
    ${phoneHref ? `<a class="btn-primary" href="${phoneHref}">${escapeHtml(hero.cta_primary_text)}</a>` : ""}
    ${waBaseHref ? `<a class="btn-secondary" href="${waBaseHref}" target="_blank" rel="noopener">${escapeHtml(ctaSecondary)}</a>` : ""}
    ${mapsHref ? `<a class="btn-secondary" href="${mapsHref}" target="_blank" rel="noopener">${escapeHtml(labels.get_directions)}</a>` : ""}
  </div>`;

  if (variant === "luxury") {
    // Full-bleed editorial: photo fills the section, gradient overlay
    // pulls the headline forward, gold rule under it sets the
    // "atelier/boutique" tone. Center-aligned for Tiffany / Cartier
    // feel; CTAs share row.
    return `<section class="hero">
  ${
    heroPhotoUrl
      ? `<div class="hero-photo-bleed" role="img" aria-label="${name}" style="background-image:url('${heroPhotoUrl}')"></div>`
      : `<div class="hero-photo-bleed" aria-hidden="true"></div>`
  }
  <div class="hero-inner">
    <p class="lede">${borough ? `${escapeHtml(borough)} — ` : ""}${escapeHtml(labels.open_for)}</p>
    <h1 class="hero-title">${escapeHtml(hero.headline)}</h1>
    <div class="hero-rule" aria-hidden="true"></div>
    <p class="hero-sub">${escapeHtml(hero.subline)}</p>
    ${ctasHtml}
    ${trust ? `<div class="trust"><span class="stars">★★★★★</span> ${escapeHtml(trust)}</div>` : ""}
    ${chipsHtml}
  </div>
</section>`;
  }

  // Traditional: warm 2-col split — copy on the left, framed vitrin
  // photo on the right. Gold rule next to the lede pill. The serif
  // headline + Vollkorn body pair reads "kapalıçarşı / esnaf butiği"
  // without falling into the dark luxury idiom that doesn't fit a
  // mahalle kuyumcusu's voice.
  return `<section class="hero">
  <div class="wrap">
    <div class="hero-grid">
      <div>
        <p class="lede">${borough ? `${escapeHtml(borough)} — ` : ""}${escapeHtml(labels.open_for)}</p>
        <h1 class="hero-title">${escapeHtml(hero.headline)}</h1>
        <p class="hero-sub">${escapeHtml(hero.subline)}</p>
        ${ctasHtml}
        ${trust ? `<div class="trust"><span class="stars">★★★★★</span> ${escapeHtml(trust)}</div>` : ""}
        ${chipsHtml}
      </div>
      ${
        heroPhotoUrl
          ? `<div class="hero-photo" role="img" aria-label="${name}" style="background-image:url('${heroPhotoUrl}')"></div>`
          : `<div class="hero-photo" aria-hidden="true"></div>`
      }
    </div>
  </div>
</section>`;
}

/**
 * Live gram-altın strip. Phase 1/2 ships a placeholder (`—` value +
 * "WhatsApp'tan güncel fiyat" CTA) so the layout, palette, and
 * positioning are already in place; Phase 4 wires the actual live
 * price feed by replacing the `<!-- GOLD_PRICE_VALUE -->` marker at
 * serve time in `/m/[slug]` route handler.
 *
 * The marker is the contract between renderer and route handler —
 * keep the comment string stable, don't refactor it to a template
 * literal, and don't add whitespace inside the angle brackets.
 *
 * Prompt-driven copy: when Gemini emits `gold_price.caption` /
 * `whatsapp_cta` we prefer those (richer per-niche voice); otherwise
 * we fall back to the localised label dict. The `show:false` toggle
 * suppresses the strip entirely (covers the rare case where a luxury
 * atelier wants to hide gram fiyat to keep editorial purity).
 */
function renderGoldPriceStrip(
  spec: WebsiteMockupGoldPrice | null,
  waBaseHref: string | null,
  labels: KuyumcuLabels,
  _isLuxury: boolean,
): string {
  // No WhatsApp wired? The CTA is the whole point of the strip — skip
  // entirely rather than showing a dead pill.
  if (!waBaseHref) return "";
  // Schema toggle wins over default-on behaviour. When the kuyumcu
  // worker omits the spec (legacy v2 rows) we still render the strip
  // because gram altın is the killer Berkay-paket feature.
  if (spec && spec.show === false) return "";

  const captionText = spec?.caption?.trim() ? spec.caption : labels.gold_label;
  const ctaText = spec?.whatsapp_cta?.trim() ? spec.whatsapp_cta : labels.gold_cta;
  const waHref = withWhatsappMessage(waBaseHref, labels.gold_wa_message);

  return `<div class="gold-strip">
  <div class="gold-strip-inner">
    <span class="gold-label">${escapeHtml(captionText)}</span>
    <span class="gold-value" data-gold-price><!-- GOLD_PRICE_VALUE -->—</span>
    <a class="gold-cta" href="${waHref}" target="_blank" rel="noopener">${escapeHtml(ctaText)}</a>
  </div>
</div>`;
}

/**
 * Collection grid from the dedicated `collection_grid` schema (v3).
 * Same visual treatment as `renderCollectionBlock` but driven by
 * pure-kuyumcu data instead of repurposed course cards. Each card
 * routes to a WhatsApp message pre-filled with the category subject
 * so the prospect lands in chat already in context.
 */
function renderCollectionGridFromSpec(
  spec: WebsiteMockupCollectionGrid,
  labels: KuyumcuLabels,
  waBaseHref: string | null,
): string {
  if (spec.categories.length === 0) return "";
  const eyebrow = spec.eyebrow?.trim() ? spec.eyebrow : labels.collection_eyebrow;
  const title = spec.title?.trim() ? spec.title : labels.collection_title;
  return `<section class="block" id="collection">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(title)}</h2>
    <div class="collection-grid">
      ${spec.categories
        .slice(0, 6)
        .map((c) => {
          const ctaLabel = c.cta_label?.trim() ? c.cta_label : labels.collection_cta;
          const waSubject = c.wa_prefix?.trim()
            ? `${c.wa_prefix} ${c.label}`
            : `${labels.collection_wa_prefix} ${c.label}`;
          const href = waBaseHref
            ? withWhatsappMessage(waBaseHref, waSubject)
            : "#contact";
          const targetAttr = waBaseHref ? ` target="_blank" rel="noopener"` : "";
          return `<div class="collection-card">
        <div class="collection-icon" aria-hidden="true">${pickIcon(c.icon_hint)}</div>
        <h3>${escapeHtml(c.label)}</h3>
        <p class="body">${escapeHtml(c.blurb)}</p>
        <a class="btn-secondary" href="${href}"${targetAttr}>${escapeHtml(ctaLabel)}</a>
      </div>`;
        })
        .join("")}
    </div>
  </div>
</section>`;
}

/**
 * Certifications block — sertifika / has ayar / esnaf odası rozetleri.
 * Replaces the generic trust block on kuyumcu pages because the
 * "güvence" vocabulary is what pırlanta + alyans alıcısı arar.
 */
function renderCertificationsBlock(
  spec: WebsiteMockupCertifications,
  labels: KuyumcuLabels,
): string {
  if (spec.items.length === 0) return "";
  const eyebrow = spec.eyebrow?.trim() ? spec.eyebrow : labels.trust_eyebrow;
  const title = spec.title?.trim() ? spec.title : labels.trust_title;
  const items = spec.items.slice(0, 4);
  return `<section class="block">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(title)}</h2>
    <div class="trust-grid">
      ${items
        .map(
          (it, i) => `<div class="trust-card">
        <div class="trust-num">${String(i + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}</div>
        <div class="collection-icon" aria-hidden="true" style="margin-bottom:16px">${pickIcon(it.icon_hint ?? "certificate")}</div>
        <h3>${escapeHtml(it.name)}</h3>
        <p>${escapeHtml(it.body)}</p>
      </div>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
}

/**
 * Atölye / usta block — when Gemini emits the `atelier` section we
 * replace the generic `about` block with this richer composition:
 * usta'nın deneyimi büyük serif sayı olarak, ısmarlama paragrafı,
 * optional master_name + master_role credit. Photo composition still
 * uses the gallery accent slot.
 */
function renderAtelierBlock(
  spec: WebsiteMockupAtelier,
  accentPhotoUrl: string | null,
  fallbackInstructors: { name: string; role: string }[],
  businessName: string,
  labels: KuyumcuLabels,
  _isLuxury: boolean,
): string {
  if (!spec.paragraph && !spec.master_name) return "";

  const eyebrow = spec.eyebrow?.trim() ? spec.eyebrow : labels.about_eyebrow;
  const title = spec.title?.trim() ? spec.title : labels.about_title;

  // Big serif years callout when grounded; otherwise we render a
  // master_name credit card or fall back to the instructors grid.
  const yearsCallout =
    spec.years_experience !== null && spec.years_experience !== undefined
      ? `<div class="atelier-years">
          <span class="atelier-years-num">${spec.years_experience}+</span>
          <span class="atelier-years-l">${escapeHtml(labels.atelier_years_label)}</span>
        </div>`
      : "";

  const masterCard =
    spec.master_name && spec.master_name.trim()
      ? `<div class="instructor-card">
          <div class="instructor-avatar">${escapeHtml(
            spec.master_name
              .split(/\s+/)
              .filter(Boolean)
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase(),
          )}</div>
          <div class="instructor-meta">
            <strong>${escapeHtml(spec.master_name)}</strong>
            <span>${escapeHtml(spec.master_role ?? labels.atelier_master_role_default)}</span>
          </div>
        </div>`
      : "";

  const instructorsHtml =
    !masterCard && fallbackInstructors.length > 0
      ? `<div class="instructors-grid">
          ${fallbackInstructors
            .map((i) => {
              const initials = (i.name || "?")
                .split(/\s+/)
                .filter(Boolean)
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return `<div class="instructor-card">
              <div class="instructor-avatar">${escapeHtml(initials)}</div>
              <div class="instructor-meta">
                <strong>${escapeHtml(i.name)}</strong>
                <span>${escapeHtml(i.role)}</span>
              </div>
            </div>`;
            })
            .join("")}
        </div>`
      : "";

  const photoHtml = accentPhotoUrl
    ? `<div class="about-photo" role="img" aria-label="${escapeHtml(businessName)}" style="background-image:url('${accentPhotoUrl}')"></div>`
    : "";

  const gridStyle = accentPhotoUrl ? "" : ' style="grid-template-columns:1fr"';

  return `<section class="block" id="atelier">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(title)}</h2>
    <div class="about-grid"${gridStyle}>
      <div class="about-panel">
        ${yearsCallout}
        <p>${escapeHtml(spec.paragraph)}</p>
        ${masterCard ? `<div class="instructors-grid">${masterCard}</div>` : instructorsHtml}
      </div>
      ${photoHtml}
    </div>
  </div>
</section>`;
}

/**
 * Collection grid — Phase 1 still maps over `courses` because the
 * dedicated `collection_grid` schema lands in Phase 2. The visual
 * treatment is already kuyumcu-correct (gold rule items, hairline
 * border accent, serif card title) so the upgrade to a true
 * collection schema in Phase 2 is just a data swap.
 */
function renderCollectionBlock(
  courses: WebsiteMockupCourse[],
  labels: KuyumcuLabels,
  waBaseHref: string | null,
  _isLuxury: boolean,
): string {
  if (courses.length === 0) return "";
  return `<section class="block" id="collection">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(labels.collection_eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(labels.collection_title)}</h2>
    <div class="collection-grid">
      ${courses
        .map(
          (c) => `<div class="collection-card${c.is_popular ? " popular" : ""}">
        ${c.is_popular ? `<span class="badge">${escapeHtml(labels.popular_badge)}</span>` : ""}
        <div class="collection-icon" aria-hidden="true">${pickIcon(c.icon_hint)}</div>
        <h3>${escapeHtml(c.title)}</h3>
        <div class="price">${escapeHtml(c.price_label)}</div>
        ${c.duration ? `<div class="duration">${escapeHtml(c.duration)}</div>` : `<div class="duration">&nbsp;</div>`}
        <p class="body">${escapeHtml(c.body)}</p>
        <ul>
          ${(c.feature_list ?? [])
            .slice(0, 6)
            .map((f) => `<li>${escapeHtml(f)}</li>`)
            .join("")}
        </ul>
        ${
          waBaseHref
            ? `<a class="btn-secondary" href="${withWhatsappMessage(
                waBaseHref,
                `${labels.collection_wa_prefix} ${c.title}`,
              )}" target="_blank" rel="noopener">${escapeHtml(labels.collection_cta)}</a>`
            : `<a class="btn-secondary" href="#contact">${escapeHtml(labels.collection_cta)}</a>`
        }
      </div>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
}

function renderProcessBlock(
  features: { title: string; body: string; icon_hint: string }[],
  labels: KuyumcuLabels,
): string {
  if (features.length === 0) return "";
  return `<section class="block">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(labels.process_eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(labels.process_title)}</h2>
    <div class="process-grid">
      ${features
        .map(
          (f, i) => `<div class="process-card">
        <div class="process-num">${String(i + 1).padStart(2, "0")} — ${escapeHtml(labels.process_step)}</div>
        <h3>${escapeHtml(f.title)}</h3>
        <p>${escapeHtml(f.body)}</p>
      </div>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
}

function renderTrustBlock(
  points: { title: string; body: string }[],
  labels: KuyumcuLabels,
): string {
  if (points.length === 0) return "";
  return `<section class="block">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(labels.trust_eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(labels.trust_title)}</h2>
    <div class="trust-grid">
      ${points
        .map(
          (p, i) => `<div class="trust-card">
        <div class="trust-num">${String(i + 1).padStart(2, "0")} / ${String(points.length).padStart(2, "0")}</div>
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(p.body)}</p>
      </div>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
}

function renderGalleryBlock(
  photoUrls: string[],
  labels: KuyumcuLabels,
  businessName: string,
): string {
  if (photoUrls.length === 0) return "";
  // Editorial lookbook grid: first tile is the 2x1 "feature" piece,
  // remaining tiles fan out in a 2x2. Gallery caps map 1:1 to the
  // label.gallery_captions slot until we exhaust them; the renderer
  // re-uses the last caption for any overflow tiles.
  const captions = labels.gallery_captions ?? [];
  // The CSS grid template assumes up to 5 tiles (1 feature + 4
  // smaller). Cap here so a 6th gallery entry doesn't blow the
  // layout.
  const tiles = photoUrls.slice(0, 5);
  return `<section class="block">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(labels.gallery_eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(labels.gallery_title)}</h2>
    <div class="gallery-grid">
      ${tiles
        .map((url, i) => {
          const cap = captions[i] ?? captions[captions.length - 1] ?? "";
          return `<div class="gallery-tile" role="img" aria-label="${escapeHtml(businessName)}" style="background-image:url('${url}')">
        ${cap ? `<div class="gallery-cap">${escapeHtml(cap)}</div>` : ""}
      </div>`;
        })
        .join("")}
    </div>
  </div>
</section>`;
}

function renderStatsBlock(
  stats: { value: string; label: string; icon_hint: string }[],
  labels: KuyumcuLabels,
): string {
  if (stats.length === 0) return "";
  return `<section class="block">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(labels.numbers)}</div>
    <h2 class="section-title">${escapeHtml(labels.stats_title)}</h2>
    <div class="stats-grid">
      ${stats
        .map(
          (s) => `<div class="stat-card">
        <div class="stat-v">${escapeHtml(s.value)}</div>
        <div class="stat-l">${escapeHtml(s.label)}</div>
      </div>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
}

function renderTestimonialsBlock(
  ts: WebsiteMockupTestimonial[],
  labels: KuyumcuLabels,
): string {
  if (ts.length === 0) return "";
  return `<section class="block">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(labels.reviews_eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(labels.reviews_title)}</h2>
    <div class="testimonials-grid">
      ${ts
        .map((t) => {
          const rating =
            typeof t.rating === "number" ? Math.max(0, Math.min(5, Math.round(t.rating))) : null;
          const starsHtml =
            rating !== null
              ? `<span class="stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span>`
              : "";
          return `<div class="review-card">
        ${starsHtml}
        <p>${escapeHtml(t.body)}</p>
        <div class="who">— ${escapeHtml(t.attribution)}</div>
      </div>`;
        })
        .join("")}
    </div>
  </div>
</section>`;
}

function renderFaqBlock(
  faqs: { question: string; answer: string }[],
  labels: KuyumcuLabels,
): string {
  if (faqs.length === 0) return "";
  return `<section class="block">
  <div class="wrap-narrow">
    <div class="section-eyebrow">${escapeHtml(labels.faq_eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(labels.faq_title)}</h2>
    <div class="faq-list">
      ${faqs
        .map(
          (q, i) => `<details class="faq"${i === 0 ? " open" : ""}>
        <summary>${escapeHtml(q.question)}</summary>
        <p class="faq-a">${escapeHtml(q.answer)}</p>
      </details>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
}

function renderBookingBlock(
  booking: WebsiteMockupSections["booking_widget"],
  waBaseHref: string | null,
  dayLabels: string[],
  labels: KuyumcuLabels,
): string {
  if (!booking || !waBaseHref) return "";
  const slots = (booking.time_slots ?? []).slice(0, 5);
  if (slots.length === 0) return "";

  return `<section class="block" id="booking">
  <div class="wrap">
    <div class="booking-card">
      <div class="section-eyebrow">${escapeHtml(labels.booking_eyebrow)}</div>
      <h2 class="section-title" style="margin-bottom:8px">${escapeHtml(booking.title)}</h2>
      <p class="section-sub" style="margin-bottom:10px">${escapeHtml(booking.subtitle)}</p>
      <div class="booking-cols">
        ${dayLabels
          .map((day, dayIdx) => {
            const dayEsc = escapeHtml(day);
            return `<div class="booking-col">
          <h4>${dayEsc}</h4>
          ${slots
            .map((slot) => {
              const msg = `${labels.booking_message_prefix} ${day} ${slot} ${labels.booking_message_suffix}`;
              const href = withWhatsappMessage(waBaseHref, msg);
              const slotEsc = escapeHtml(slot);
              return `<a class="booking-slot" href="${href}" target="_blank" rel="noopener" data-day="${dayIdx}">${slotEsc}</a>`;
            })
            .join("")}
        </div>`;
          })
          .join("")}
      </div>
      <p class="booking-note">${escapeHtml(labels.booking_note)}</p>
    </div>
  </div>
</section>`;
}

function renderAboutBlock(
  paragraph: string,
  instructors: { name: string; role: string }[],
  accentPhotoUrl: string | null,
  businessName: string,
  labels: KuyumcuLabels,
): string {
  if (!paragraph && instructors.length === 0 && !accentPhotoUrl) return "";

  const instructorsHtml = instructors.length
    ? `<div class="instructors-grid">
        ${instructors
          .map((i) => {
            const initials = (i.name || "?")
              .split(/\s+/)
              .filter(Boolean)
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return `<div class="instructor-card">
          <div class="instructor-avatar">${escapeHtml(initials)}</div>
          <div class="instructor-meta">
            <strong>${escapeHtml(i.name)}</strong>
            <span>${escapeHtml(i.role)}</span>
          </div>
        </div>`;
          })
          .join("")}
      </div>`
    : "";

  const photoHtml = accentPhotoUrl
    ? `<div class="about-photo" role="img" aria-label="${escapeHtml(businessName)}" style="background-image:url('${accentPhotoUrl}')"></div>`
    : "";

  // When there's no photo, collapse to a single-column to avoid the
  // dangling empty cell.
  const gridStyle = accentPhotoUrl ? "" : ' style="grid-template-columns:1fr"';

  return `<section class="block" id="atelier">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(labels.about_eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(labels.about_title)}</h2>
    <div class="about-grid"${gridStyle}>
      <div class="about-panel">
        <p>${escapeHtml(paragraph)}</p>
        ${instructorsHtml}
      </div>
      ${photoHtml}
    </div>
  </div>
</section>`;
}

function renderMapBlock(embedUrl: string | null, labels: KuyumcuLabels): string {
  if (!embedUrl) return "";
  return `<section class="block">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(labels.map_eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(labels.map_title)}</h2>
    <iframe class="map-frame" src="${escapeHtml(embedUrl)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="${escapeHtml(labels.map_title)}"></iframe>
  </div>
</section>`;
}

function renderContactBlock(
  contact: WebsiteMockupSections["contact_form"],
  waBaseHref: string | null,
  name: string,
  phoneDisplay: string | null,
  addr: string,
  labels: KuyumcuLabels,
): string {
  if (!contact) return "";
  if (!waBaseHref) {
    return `<section class="block" id="contact">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(labels.contact_eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(contact.title)}</h2>
    <p class="section-sub">${escapeHtml(contact.subtitle)}</p>
    <div class="contact-info">
      <strong>${name}</strong>
      ${phoneDisplay ? `<span>${escapeHtml(labels.phone)}: ${phoneDisplay}</span>` : ""}
      <span>${addr}</span>
    </div>
  </div>
</section>`;
  }
  return `<section class="block" id="contact">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(labels.contact_eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(contact.title)}</h2>
    <p class="section-sub">${escapeHtml(contact.subtitle)}</p>
    <div class="contact-grid">
      <form class="contact-form" action="${waBaseHref}" method="GET" target="_blank" rel="noopener">
        <label for="cf-name">${escapeHtml(contact.name_label)}</label>
        <input id="cf-name" name="name" type="text" autocomplete="name" />
        <label for="cf-phone">${escapeHtml(contact.phone_label)}</label>
        <input id="cf-phone" name="phone" type="tel" autocomplete="tel" />
        <label for="cf-class">${escapeHtml(contact.class_label)}</label>
        <input id="cf-class" name="class" type="text" />
        <label for="cf-msg">${escapeHtml(contact.message_label)}</label>
        <textarea id="cf-msg" name="text" placeholder="${escapeHtml(labels.contact_placeholder)}"></textarea>
        <button class="btn-primary submit" type="submit">${escapeHtml(contact.submit_text)}</button>
        <p class="privacy">${escapeHtml(contact.privacy_note)}</p>
      </form>
      <div class="contact-info">
        <strong>${name}</strong>
        ${phoneDisplay ? `<span>${escapeHtml(labels.phone)}: ${phoneDisplay}</span>` : ""}
        <span>${addr}</span>
      </div>
    </div>
  </div>
</section>`;
}

function renderCtaFinal(
  cta: WebsiteMockupSections["cta_final"],
  phoneHref: string | null,
  waBaseHref: string | null,
  labels: KuyumcuLabels,
): string {
  return `<section class="cta-final-block">
  <div class="wrap-narrow">
    <div class="cta-final">
      <h2>${escapeHtml(cta.headline)}</h2>
      ${cta.subline ? `<p>${escapeHtml(cta.subline)}</p>` : ""}
      <div class="hero-ctas">
        ${phoneHref ? `<a class="btn-primary" href="${phoneHref}">${escapeHtml(cta.button_text)}</a>` : ""}
        ${waBaseHref ? `<a class="btn-secondary" href="${waBaseHref}" target="_blank" rel="noopener">${escapeHtml(cta.secondary_button_text ?? labels.message_us)}</a>` : ""}
      </div>
    </div>
  </div>
</section>`;
}

// ============================================================
// Icons
// ============================================================

function pickIcon(hint: string | undefined | null): string {
  const key = (hint ?? "").toLowerCase();
  return ICONS[key] ?? ICONS.gem;
}

function svgIcon(d: string): string {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

// Kuyumcu icon set leans into jewelry-shaped glyphs (gem, ring,
// diamond, chain). Fallback to `gem` keeps a kuyumcu-correct
// silhouette even when Gemini emits an unmapped `icon_hint`.
const ICONS: Record<string, string> = {
  gem: svgIcon("M6 3h12l4 6-10 12L2 9zM6 3l4 6M18 3l-4 6M2 9h20"),
  diamond: svgIcon("M12 2l5 7-5 13-5-13z M7 9h10"),
  ring: svgIcon("M12 8a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM9 8l3-5 3 5"),
  necklace: svgIcon("M4 4c2 6 6 8 8 8s6-2 8-8M12 12v4 M10 17h4l-2 4z"),
  chain: svgIcon("M9 7a3 3 0 1 0 0 6h2M15 17a3 3 0 1 0 0-6h-2M9 10h6M9 14h6"),
  earring: svgIcon("M12 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4M12 8v3 M12 11a4 4 0 0 0 0 8 4 4 0 0 0 0-8z"),
  certificate: svgIcon("M5 4h14v14H5zM5 4l-2 2v14l2 2h14l2-2V6l-2-2 M9 12l2 2 4-4"),
  shield: svgIcon("M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z"),
  check: svgIcon("M5 13l4 4L19 7"),
  star: svgIcon("M12 3l2.9 6.3 6.9.6-5.2 4.7 1.6 6.8L12 18l-6.2 3.4 1.6-6.8-5.2-4.7 6.9-.6z"),
  scale: svgIcon("M12 3v18M3 7l9-4 9 4M7 7l-3 8a3 3 0 0 0 6 0zM17 7l-3 8a3 3 0 0 0 6 0z"),
  watch: svgIcon("M9 4h6v3a5 5 0 0 1 0 10v3H9v-3a5 5 0 0 1 0-10z M12 9v4l2 2"),
  bag: svgIcon("M5 8h14l-1 12H6zM9 8V5a3 3 0 0 1 6 0v3"),
  award: svgIcon("M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM9 14l-2 7 5-3 5 3-2-7"),
  heart: svgIcon("M12 21s-8-4.5-8-11a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 6.5-8 11-8 11z"),
  phone: svgIcon("M22 16v3a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2h3l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2z"),
  whatsapp: svgIcon("M21 12a9 9 0 1 1-3.5-7.1L21 3l-1 4 1 1a9 9 0 0 1 0 4z"),
  pin: svgIcon("M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"),
  calendar: svgIcon("M3 5h18v16H3zM3 9h18M8 3v4M16 3v4"),
};

// ============================================================
// Labels
// ============================================================

type KuyumcuLabels = {
  call_now: string;
  message_us: string;
  get_directions: string;
  open_for: string;
  drafted_by: string;
  nav_collection: string;
  nav_atelier: string;
  nav_appointment: string;
  nav_contact: string;
  numbers: string;
  stats_title: string;
  process_eyebrow: string;
  process_title: string;
  process_step: string;
  collection_eyebrow: string;
  collection_title: string;
  collection_cta: string;
  collection_wa_prefix: string;
  popular_badge: string;
  trust_eyebrow: string;
  trust_title: string;
  reviews_eyebrow: string;
  reviews_title: string;
  faq_eyebrow: string;
  faq_title: string;
  booking_eyebrow: string;
  booking_note: string;
  booking_message_prefix: string;
  booking_message_suffix: string;
  about_eyebrow: string;
  about_title: string;
  map_eyebrow: string;
  map_title: string;
  contact_eyebrow: string;
  contact_placeholder: string;
  phone: string;
  gallery_eyebrow: string;
  gallery_title: string;
  gallery_captions: string[];
  gold_label: string;
  gold_cta: string;
  gold_wa_message: string;
  atelier_years_label: string;
  atelier_master_role_default: string;
};

const BASE_LABELS: Record<"tr" | "en", KuyumcuLabels> = {
  tr: {
    call_now: "Hemen Ara",
    message_us: "WhatsApp",
    get_directions: "Yol Tarifi",
    open_for: "Vitrinden teslime",
    drafted_by: "Leadac AI tarafından hazırlandı",
    nav_collection: "Koleksiyon",
    nav_atelier: "Atölye",
    nav_appointment: "Randevu",
    nav_contact: "İletişim",
    numbers: "Rakamlarla",
    stats_title: "Bizi öne çıkaran",
    process_eyebrow: "Süreç",
    process_title: "Vitrinden teslime giden yol",
    process_step: "Adım",
    collection_eyebrow: "Koleksiyon",
    collection_title: "Vitrinden seçmeler",
    collection_cta: "WhatsApp'tan sor",
    collection_wa_prefix: "Selam, bu ürün hakkında bilgi alabilir miyim:",
    popular_badge: "Öne Çıkan",
    trust_eyebrow: "Güvence",
    trust_title: "Neden bize güveniliyor",
    reviews_eyebrow: "Müşterilerimiz",
    reviews_title: "Müşterilerimiz anlatıyor",
    faq_eyebrow: "S.S.S.",
    faq_title: "Sıkça sorulanlar",
    booking_eyebrow: "Randevu",
    booking_note: "Saatlere tıklayınca WhatsApp uygulamanız hazır mesajla açılır.",
    booking_message_prefix: "Selam,",
    booking_message_suffix: "için randevu istiyorum.",
    about_eyebrow: "Atölyemiz",
    about_title: "Atölyemiz ve uzman ekibimiz",
    map_eyebrow: "Konum",
    map_title: "Bizi buradan ziyaret edin",
    contact_eyebrow: "İletişim",
    contact_placeholder:
      "Hangi ürün veya hizmetle ilgileniyorsunuz? (alyans, hurda altın, tamir, pırlanta…)",
    phone: "Telefon",
    gallery_eyebrow: "Galeri",
    gallery_title: "Vitrinimizden ve atölyemizden",
    gallery_captions: ["Vitrinden", "Atölyemizden", "Koleksiyondan", "Atölye detay", "Detay"],
    gold_label: "Anlık gram altın",
    gold_cta: "Güncel fiyat için WhatsApp",
    gold_wa_message: "Selam, bugünkü gram altın ve hurda altın alış fiyatınızı öğrenebilir miyim?",
    atelier_years_label: "Yıllık tecrübe",
    atelier_master_role_default: "Baş usta",
  },
  en: {
    call_now: "Call now",
    message_us: "WhatsApp",
    get_directions: "Get directions",
    open_for: "From window to hand-over",
    drafted_by: "Drafted by Leadac AI",
    nav_collection: "Collection",
    nav_atelier: "Atelier",
    nav_appointment: "Appointment",
    nav_contact: "Contact",
    numbers: "In numbers",
    stats_title: "What sets us apart",
    process_eyebrow: "Process",
    process_title: "From window to hand-over",
    process_step: "Step",
    collection_eyebrow: "Collection",
    collection_title: "From our window",
    collection_cta: "Ask on WhatsApp",
    collection_wa_prefix: "Hi, could I have more info on this piece:",
    popular_badge: "Featured",
    trust_eyebrow: "Assurance",
    trust_title: "Why customers trust us",
    reviews_eyebrow: "Our customers",
    reviews_title: "What customers say",
    faq_eyebrow: "FAQ",
    faq_title: "Frequently asked",
    booking_eyebrow: "Appointment",
    booking_note: "Tap a time and WhatsApp opens with your message pre-filled.",
    booking_message_prefix: "Hi,",
    booking_message_suffix: "— I'd like to book this slot.",
    about_eyebrow: "Atelier",
    about_title: "Our atelier and master craftsmen",
    map_eyebrow: "Find us",
    map_title: "Visit us here",
    contact_eyebrow: "Contact",
    contact_placeholder: "Which piece or service are you interested in?",
    phone: "Phone",
    gallery_eyebrow: "Lookbook",
    gallery_title: "From the store and atelier",
    gallery_captions: ["At the window", "In the atelier", "Editorial", "Detail", "From the collection"],
    gold_label: "Live gold (gram)",
    gold_cta: "Get today's price on WhatsApp",
    gold_wa_message: "Hi, could you share today's gram-gold and scrap-gold prices?",
    atelier_years_label: "Years of craft",
    atelier_master_role_default: "Master jeweller",
  },
};

const NICHE_LABEL_OVERRIDES: Record<
  string,
  { tr?: Partial<KuyumcuLabels>; en?: Partial<KuyumcuLabels> }
> = {
  "kuyumcu-luxury": {
    tr: {
      open_for: "Editorial koleksiyon",
      collection_eyebrow: "Editorial",
      collection_title: "Bu sezonun seçkisi",
      gallery_eyebrow: "Editorial",
      gallery_title: "Koleksiyondan kareler",
      reviews_title: "Müşterilerimiz anlatıyor",
      about_title: "Atölyemiz ve master kuyumcularımız",
      gallery_captions: ["Editorial", "Atölyeden", "Koleksiyondan", "Detay", "Üretim"],
    },
    en: {
      open_for: "Editorial collection",
      collection_eyebrow: "Editorial",
      collection_title: "This season's edit",
      gallery_eyebrow: "Editorial",
      gallery_title: "From the collection",
      about_title: "Our atelier and master jewellers",
      gallery_captions: ["Editorial", "In the atelier", "From the collection", "Detail", "Workshop"],
    },
  },
  "kuyumcu-traditional": {
    tr: {
      open_for: "Vitrinden teslime",
      collection_title: "Vitrinden seçmeler",
      gallery_eyebrow: "Galeri",
      gallery_title: "Vitrinimizden ve atölyemizden",
      gallery_captions: ["Vitrinden", "Atölyemizden", "Koleksiyondan", "Detay", "Hurda altın"],
    },
    en: {
      open_for: "From the window",
      collection_title: "From our window",
      gallery_eyebrow: "Gallery",
      gallery_title: "From our store",
      gallery_captions: ["At the window", "In the atelier", "From our collection", "Detail", "Scrap-gold service"],
    },
  },
};

function resolveLabels(lang: "tr" | "en", variant: KuyumcuVariant): KuyumcuLabels {
  const base = BASE_LABELS[lang];
  // Variant maps deterministically to the corresponding niche slug
  // for label-override lookup: "luxury" → kuyumcu-luxury,
  // "traditional" → kuyumcu-traditional.
  const slug = variant === "luxury" ? "kuyumcu-luxury" : "kuyumcu-traditional";
  const override = NICHE_LABEL_OVERRIDES[slug]?.[lang] ?? {};
  return { ...base, ...override };
}

function buildTrustLine(
  rating: number | null,
  reviewCount: number | null,
  lang: string,
): string | null {
  if (!rating || !reviewCount) return null;
  if (lang === "tr") {
    return `${rating.toFixed(1)} · ${reviewCount} Google yorumu`;
  }
  return `${rating.toFixed(1)} · ${reviewCount} Google reviews`;
}
