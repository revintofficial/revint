/**
 * leadac-showcase-v1 template renderer.
 *
 * Produces a single standalone HTML document - no React, no JS bundle,
 * all CSS inline. Loads in under ~2s on 3G; the document is what the
 * cold-email recipient taps from their phone, so page-weight discipline
 * is non-negotiable (target: ~50-65KB total).
 *
 * Aesthetic: matches the cinematic Leadac marketing site (dark bg,
 * glass panels, multi-gradient mesh, 16px radius, 0.5px borders).
 * The primary / accent / secondary palette comes from the niche pack
 * so two leads in the same vertical read as visually consistent.
 *
 * Sections (top-to-bottom):
 *   nav         — sticky brand + phone + WhatsApp CTAs
 *   hero        — multi-gradient mesh, title + dual CTA + stat chips +
 *                 hero photo panel
 *   stats       — 3-4 numeric KPI cards
 *   process     — 4 numbered process steps (Kayıt → Teorik → …)
 *   courses     — 1-3 priced cards (popular card scales + badge)
 *   trust       — 3 numbered trust columns
 *   testimonials— 2-3 review cards with star ratings
 *   faq         — 5-6 native <details> accordion (no JS)
 *   booking     — 3-day × 5-slot grid; each slot pre-fills WhatsApp
 *   about       — paragraph + optional instructor grid
 *   map         — Google Maps no-cookie embed iframe
 *   contact     — HTML form that posts to wa.me with the message pre-filled
 *   cta_final   — gradient banner + dual CTA
 *   footer      — address / phone / "drafted by ..." credit
 *
 * Security model (every Gemini-produced string is hostile):
 *   - HTML-escape every dynamic string (`escapeHtml`).
 *   - Validate hex colors against `^#[0-9a-fA-F]{3,6}$`.
 *   - Validate every photo URL against an https + CDN allowlist
 *     (`pickSafePhotoUrl`) before it lands in a `style="background-image:url('...')"`
 *     CSS context.
 *   - Phone strings funnel through `encodeTelHref` / `encodeWhatsappHref`
 *     so a `'` or `<` in a Google Places phone can't break out of the
 *     href attribute.
 *   - Map embed URL is built via `buildMapsEmbedUrl` which
 *     `encodeURIComponent`s the entire query.
 *
 * JSON-LD + meta:
 *   - `LocalBusiness` schema with name, address, telephone, optional
 *     aggregateRating + geo + openingHoursSpecification stubs (we don't
 *     yet have hours; renderer omits the field).
 *   - OpenGraph + Twitter Card meta.
 *   - theme-color meta = niche primaryHex.
 */

import type {
  WebsiteMockupSections,
  WebsiteMockupTestimonial,
  WebsiteMockupCourse,
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

export interface LeadacShowcaseRenderInput {
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
   * Optional second-stop hex for the hero gradient. Niche packs supply
   * a `secondaryHex` to deepen the visual identity. Falls back to
   * mixing primary + accent.
   */
  secondaryHex?: string | null;
  workspaceName?: string;
  branding?: WorkspaceBranding | null;
  showLeadacCredit?: boolean;
  lang: string; // "tr" | "en"
  /**
   * Optional niche label for the `<title>` tag suffix, e.g.
   * "Sürücü Kursu". When absent the renderer falls back to a
   * neutral phrasing.
   */
  nicheLabel?: string | null;
  /**
   * Most-specific niche slug (sub-niche if classified, else parent).
   * Drives per-vertical section-label overrides — e.g. a kuyumcu
   * lead reads "Vitrinden teslime giden yol" instead of the
   * default driving-school-flavoured "Kayıttan ehliyete giden yol",
   * and "Atölyemiz ve uzman ekibimiz" instead of "Ekibimiz ve
   * eğitmenlerimiz". Missing slug → base LABELS are used (which
   * are still TR/EN driving-school-leaning historically — kept
   * for back-compat with the Emirhan workspace).
   */
  nicheSlug?: string | null;
  /**
   * Parent niche slug for hybrid packs. When `nicheSlug` doesn't
   * have a per-niche override registered, the renderer falls back
   * to this slug (mirrors `getNicheTheme`'s child→parent fallback).
   * Example: `kuyumcu-luxury` lead with no luxury-specific override
   * inherits the `kuyumcu` parent's section labels.
   */
  nicheParentSlug?: string | null;
  /**
   * Real business / storefront / product photos from `Lead.photoUrls`
   * (populated by APIFY_GMAPS_DEEP — Phase 3 of the kuyumcu-pro plan).
   * When present, the renderer prefers these over the niche imagery
   * pack for hero + gallery + about-accent slots. Empty / missing →
   * silent fallback to the Unsplash stock pool, so non-kuyumcu
   * verticals and legacy leads keep working unchanged.
   *
   * URLs are double-validated: persisted ones already cleared the
   * Apify worker's host filter, but the renderer re-runs them through
   * `pickSafePhotoUrl` so a hand-edited or migrated row can't bypass
   * the CSS-context allowlist.
   */
  leadPhotoUrls?: string[] | null;
}

export function renderLeadacShowcase(input: LeadacShowcaseRenderInput): string {
  const s = input.sections;
  const lang = input.lang === "tr" ? "tr" : "en";
  const labels = resolveLabels(lang, input.nicheSlug ?? null, input.nicheParentSlug ?? null);

  const theme = s.theme;
  const isLight = theme.mode === "light";
  const bg = isLight ? "#f8f7f4" : "#0a0a0d";
  const panel = isLight ? "rgba(255,255,255,0.78)" : "rgba(18,18,22,0.78)";
  const text = isLight ? "#0f0f12" : "#ededf0";
  const muted = isLight ? "rgba(15,15,18,0.6)" : "rgba(237,237,240,0.62)";
  const border = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";

  const accent = sanitizeHex(theme.accent_hex) ?? "#a5b4fc";
  const primary = sanitizeHex(theme.primary_hex) ?? "#5e6ad2";
  const secondary = sanitizeHex(input.secondaryHex ?? null) ?? accent;

  // Imagery: hero[0] anchors the fold; gallery photos populate a
  // dedicated 3-up strip between trust and testimonials, plus an
  // accent tile inside the about section.
  //
  // Phase 3 (kuyumcu-pro plan) — when Apify has surfaced real
  // photos from Google Places into `Lead.photoUrls`, we prefer
  // them over Unsplash stock for hero + gallery. The first lead
  // photo anchors the hero; subsequent ones fill the 3-up gallery;
  // niche imagery fills any remaining slots so the page is never
  // photo-empty even when the lead has only 1-2 Google Places
  // photos.
  const safeLeadPhotos = (input.leadPhotoUrls ?? [])
    .map((u) => pickSafePhotoUrl(u))
    .filter((u): u is string => Boolean(u));
  const stockHero = pickSafePhotoUrl(input.imagery?.hero?.[0] ?? null);
  const stockGallery = (input.imagery?.gallery ?? [])
    .map((u) => pickSafePhotoUrl(u))
    .filter((u): u is string => Boolean(u));

  const heroPhotoUrl = safeLeadPhotos[0] ?? stockHero;
  // Build the gallery pool: real photos first, dedup, then fill with
  // stock to reach the target of 3. Dedup avoids "lead has 1 photo
  // → it shows up in both hero AND gallery[0]".
  const gallerySeen = new Set<string>();
  if (heroPhotoUrl) gallerySeen.add(heroPhotoUrl);
  const galleryPool: string[] = [];
  for (const p of [...safeLeadPhotos.slice(1), ...stockGallery]) {
    if (gallerySeen.has(p)) continue;
    gallerySeen.add(p);
    galleryPool.push(p);
    if (galleryPool.length >= 3) break;
  }
  const galleryPhotoUrls = galleryPool;
  const aboutAccentPhotoUrl =
    safeLeadPhotos[1] ?? galleryPhotoUrls[0] ?? pickSafePhotoUrl(input.imagery?.hero?.[1] ?? null);

  // Branding overrides for AGENCY-tier reseller. Same precedence rule
  // as legacy renderer: workspace primary / accent win over the niche
  // palette so the agency's brand identity reads first.
  const brand = input.branding;
  const finalPrimary = brand?.primaryColor
    ? (sanitizeHex(brand.primaryColor) ?? primary)
    : primary;
  const finalAccent = brand?.accentColor
    ? (sanitizeHex(brand.accentColor) ?? accent)
    : accent;
  const footerText =
    brand?.footerText ||
    (input.workspaceName ? `${escapeHtml(input.workspaceName)} tarafından hazırlandı` : labels.drafted_by);
  const showCredit = input.showLeadacCredit !== false && !brand?.hideLeadacCredit;
  const safeLogoUrl = brand?.logoUrl ? escapeHtml(brand.logoUrl) : null;

  // Caller-supplied business identity. Always HTML-escape — they come
  // from Google Places + workspace settings, but the renderer doesn't
  // care about the source; everything dynamic is suspect.
  const name = escapeHtml(input.businessName);
  const addr = escapeHtml(input.formattedAddress);
  const borough = input.borough ? escapeHtml(input.borough) : null;
  const phoneDisplay = input.phone ? escapeHtml(input.phone) : null;
  const phoneHref = input.phone ? encodeTelHref(input.phone) : null;
  const waBaseHref = input.phone ? encodeWhatsappHref(input.phone) : null;
  const mapsHref = input.googleMapsUri ? escapeHtml(input.googleMapsUri) : null;

  // Hero copy + trust line.
  const hero = s.hero;
  const trust = hero.trust_line ?? buildTrustLine(input.rating, input.reviewCount, lang);
  const heroStatChips = (hero.stat_strip ?? []).slice(0, 3);

  // Testimonials: prefer v2 array, fall back to v1 single.
  const testimonialList: WebsiteMockupTestimonial[] =
    s.testimonials && s.testimonials.length > 0
      ? s.testimonials.slice(0, 3)
      : s.testimonial
        ? [s.testimonial]
        : [];

  // Courses: clamp to 3, ensure at most one is_popular so the popular
  // styling isn't duplicated. We don't reorder — the prompt is asked to
  // emit them left-to-right; the popular card may sit in any position.
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

  // Booking-slot CTAs pre-fill WhatsApp with a localised message.
  const bookingDayLabels = booking
    ? [
        booking.slot_label_today,
        booking.slot_label_tomorrow,
        booking.slot_label_day3,
      ]
    : [];

  // JSON-LD for LocalBusiness. We attach aggregateRating only when we
  // have BOTH a rating and a non-zero reviewCount; partial data leads
  // to a Google Search Console warning.
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
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
  // Escape closing-script-tag sequences in JSON-LD per Google guidance.
  const jsonLdStr = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  const nicheLabel = input.nicheLabel ? escapeHtml(input.nicheLabel) : null;
  const pageTitle = nicheLabel ? `${name} — ${nicheLabel}` : name;

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
<script type="application/ld+json">${jsonLdStr}</script>
<style>
  :root {
    --bg: ${bg};
    --panel: ${panel};
    --text: ${text};
    --muted: ${muted};
    --accent: ${finalAccent};
    --primary: ${finalPrimary};
    --secondary: ${secondary};
    --border: ${border};
    --glass: ${hexWithAlpha(isLight ? "#ffffff" : "#0f0f12", 0.55)};
    --glass-strong: ${hexWithAlpha(isLight ? "#ffffff" : "#0f0f12", 0.7)};
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; line-height: 1.6; -webkit-font-smoothing: antialiased; scroll-behavior: smooth; }
  a { color: inherit; }
  img { max-width: 100%; display: block; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; }

  /* ----- mesh background ----- */
  body::before {
    content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background:
      radial-gradient(60% 50% at 18% 12%, ${hexWithAlpha(finalAccent, 0.22)} 0%, transparent 60%),
      radial-gradient(45% 45% at 82% 20%, ${hexWithAlpha(finalPrimary, 0.20)} 0%, transparent 60%),
      radial-gradient(45% 45% at 50% 100%, ${hexWithAlpha(secondary, 0.18)} 0%, transparent 60%),
      var(--bg);
  }

  /* ----- nav ----- */
  header.nav { position: sticky; top: 0; z-index: 40; backdrop-filter: blur(14px); background: ${hexWithAlpha(bg, 0.6)}; border-bottom: 0.5px solid var(--border); }
  .nav-inner { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; max-width: 1080px; margin: 0 auto; gap: 12px; }
  .nav-brand { font-weight: 700; font-size: 17px; letter-spacing: -0.015em; text-decoration: none; color: var(--text); display: inline-flex; align-items: center; gap: 8px; }
  .nav-brand img { max-height: 28px; }
  .nav-ctas { display: flex; gap: 8px; align-items: center; }
  .nav-cta-tel { background: var(--primary); color: #fff; padding: 9px 16px; border-radius: 999px; text-decoration: none; font-size: 13px; font-weight: 600; letter-spacing: -0.005em; transition: transform 120ms ease; }
  .nav-cta-tel:hover { transform: translateY(-1px); }
  .nav-cta-wa { background: transparent; color: var(--text); padding: 8px 14px; border-radius: 999px; border: 0.5px solid var(--border); font-size: 13px; font-weight: 500; text-decoration: none; }
  @media (max-width: 640px) { .nav-cta-wa { display: none; } }

  /* ----- hero ----- */
  section.hero { padding: 84px 0 56px; }
  .hero-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 40px; align-items: center; }
  .lede { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--accent); font-weight: 600; margin-bottom: 14px; }
  h1.hero-title { font-size: clamp(34px, 5.6vw, 56px); font-weight: 700; letter-spacing: -0.028em; line-height: 1.05; margin: 0 0 18px; }
  .hero-sub { font-size: clamp(16px, 1.8vw, 19px); color: var(--muted); max-width: 580px; margin: 0 0 30px; }
  .hero-ctas { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .btn-primary { background: var(--primary); color: #fff; padding: 14px 26px; border-radius: 999px; text-decoration: none; font-size: 15px; font-weight: 600; letter-spacing: -0.005em; display: inline-flex; align-items: center; gap: 8px; transition: transform 120ms ease, background 120ms ease; border: none; cursor: pointer; }
  .btn-primary:hover { transform: translateY(-1px); }
  .btn-secondary { background: transparent; color: var(--text); padding: 13px 22px; border-radius: 999px; text-decoration: none; font-size: 15px; font-weight: 500; border: 0.5px solid var(--border); display: inline-flex; align-items: center; gap: 8px; transition: background 120ms ease; }
  .btn-secondary:hover { background: ${hexWithAlpha(text, 0.04)}; }
  .trust { margin-top: 22px; font-size: 13px; color: var(--muted); display: inline-flex; align-items: center; gap: 8px; }
  .stars { letter-spacing: -1px; color: #f5a623; font-size: 15px; }
  .hero-chips { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 28px; }
  .chip { background: var(--glass); backdrop-filter: blur(12px); border: 0.5px solid var(--border); border-radius: 14px; padding: 10px 14px; min-width: 100px; }
  .chip-v { font-size: 19px; font-weight: 700; letter-spacing: -0.02em; }
  .chip-l { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-top: 2px; }
  .hero-photo {
    position: relative; width: 100%; aspect-ratio: 4 / 5; border-radius: 24px;
    overflow: hidden; border: 0.5px solid var(--border);
    background-color: ${hexWithAlpha(finalPrimary, 0.18)};
    background-size: cover; background-position: center;
  }
  .hero-photo::after {
    content: ""; position: absolute; inset: 0;
    background:
      linear-gradient(180deg, transparent 0%, ${hexWithAlpha(bg, 0.45)} 100%),
      radial-gradient(60% 60% at 30% 30%, ${hexWithAlpha(finalPrimary, 0.18)} 0%, transparent 75%),
      radial-gradient(60% 60% at 80% 80%, ${hexWithAlpha(secondary, 0.20)} 0%, transparent 70%);
    pointer-events: none;
  }
  @media (max-width: 760px) {
    .hero-grid { grid-template-columns: 1fr; gap: 28px; }
    .hero-photo { aspect-ratio: 16 / 11; }
    section.hero { padding: 56px 0 40px; }
  }

  /* ----- section base ----- */
  section.block { padding: 64px 0; }
  .section-eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--accent); font-weight: 600; margin-bottom: 10px; }
  .section-title { font-size: clamp(24px, 3.2vw, 34px); font-weight: 700; letter-spacing: -0.025em; margin: 0 0 14px; max-width: 640px; }
  .section-sub { color: var(--muted); margin: 0 0 32px; max-width: 620px; font-size: 16px; }

  /* ----- stats ----- */
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
  .stat-card { background: var(--glass); backdrop-filter: blur(18px); border: 0.5px solid var(--border); border-radius: 18px; padding: 24px; }
  .stat-card .icon { width: 36px; height: 36px; border-radius: 10px; background: ${hexWithAlpha(accent, 0.15)}; color: var(--accent); display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
  .stat-v { font-size: 28px; font-weight: 700; letter-spacing: -0.025em; }
  .stat-l { color: var(--muted); font-size: 13px; margin-top: 4px; }

  /* ----- process ----- */
  .process-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
  .process-card { background: var(--glass); border: 0.5px solid var(--border); border-radius: 18px; padding: 24px; position: relative; }
  .process-num { position: absolute; top: 18px; right: 22px; font-size: 36px; font-weight: 800; color: ${hexWithAlpha(finalAccent, 0.4)}; letter-spacing: -0.05em; }
  .process-card h3 { margin: 0 0 8px; font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
  .process-card p { margin: 0; color: var(--muted); font-size: 14px; }

  /* ----- courses ----- */
  .courses-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; align-items: stretch; }
  .course-card { background: var(--glass-strong); backdrop-filter: blur(20px); border: 0.5px solid var(--border); border-radius: 22px; padding: 28px; position: relative; display: flex; flex-direction: column; }
  .course-card.popular { transform: translateY(-6px); border-color: ${hexWithAlpha(finalAccent, 0.5)}; box-shadow: 0 18px 60px -28px ${hexWithAlpha(finalAccent, 0.5)}; }
  .course-card.popular .badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--accent); color: ${isLight ? "#0a0a0a" : "#0a0a0a"}; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
  .course-icon { width: 40px; height: 40px; border-radius: 12px; background: ${hexWithAlpha(finalPrimary, 0.18)}; color: var(--primary); display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
  .course-card h3 { margin: 0 0 6px; font-size: 19px; font-weight: 700; letter-spacing: -0.018em; }
  .course-card .price { font-size: 26px; font-weight: 700; letter-spacing: -0.028em; color: var(--accent); margin: 10px 0 4px; }
  .course-card .duration { color: var(--muted); font-size: 13px; margin-bottom: 18px; }
  .course-card .body { color: var(--muted); font-size: 14px; margin: 0 0 18px; }
  .course-card ul { list-style: none; padding: 0; margin: 0 0 22px; flex-grow: 1; }
  .course-card ul li { font-size: 13.5px; color: var(--text); padding: 6px 0; padding-left: 22px; position: relative; }
  .course-card ul li::before { content: "✓"; position: absolute; left: 0; color: var(--accent); font-weight: 700; }

  /* ----- trust ----- */
  .trust-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; }
  .trust-card { background: var(--glass); border: 0.5px solid var(--border); border-radius: 18px; padding: 28px; position: relative; }
  .trust-num { font-size: 13px; font-weight: 700; color: var(--accent); margin-bottom: 14px; letter-spacing: 0.08em; }
  .trust-card h3 { margin: 0 0 8px; font-size: 18px; font-weight: 600; letter-spacing: -0.01em; }
  .trust-card p { margin: 0; color: var(--muted); font-size: 14px; }

  /* ----- testimonials ----- */
  .testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
  .review-card { background: var(--glass); border: 0.5px solid var(--border); border-radius: 18px; padding: 24px; }
  .review-card .stars { font-size: 16px; margin-bottom: 10px; display: block; }
  .review-card p { margin: 0 0 12px; font-size: 15px; line-height: 1.5; }
  .review-card .who { font-size: 13px; color: var(--muted); }

  /* ----- faq ----- */
  .faq-list { display: flex; flex-direction: column; gap: 8px; max-width: 760px; }
  details.faq { background: var(--glass); border: 0.5px solid var(--border); border-radius: 14px; padding: 18px 22px; }
  details.faq summary { cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-weight: 600; font-size: 15.5px; }
  details.faq summary::-webkit-details-marker { display: none; }
  details.faq summary::after { content: "+"; font-size: 22px; line-height: 1; color: var(--accent); transition: transform 180ms ease; }
  details.faq[open] summary::after { transform: rotate(45deg); }
  details.faq[open] { padding-bottom: 22px; }
  details.faq .faq-a { margin: 12px 0 0; color: var(--muted); font-size: 14.5px; line-height: 1.65; }

  /* ----- booking ----- */
  .booking-card { background: var(--glass-strong); backdrop-filter: blur(20px); border: 0.5px solid var(--border); border-radius: 22px; padding: 32px; }
  .booking-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 18px; }
  .booking-col h4 { margin: 0 0 12px; font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; text-align: center; }
  .booking-slot { display: block; background: ${hexWithAlpha(text, 0.04)}; border: 0.5px solid var(--border); border-radius: 10px; padding: 10px 0; font-size: 14px; font-weight: 600; text-decoration: none; color: var(--text); text-align: center; margin-bottom: 8px; transition: transform 120ms ease, background 120ms ease, border-color 120ms ease; }
  .booking-slot:hover { transform: translateY(-1px); background: ${hexWithAlpha(finalAccent, 0.18)}; border-color: ${hexWithAlpha(finalAccent, 0.4)}; }
  .booking-note { margin: 16px 0 0; font-size: 12.5px; color: var(--muted); text-align: center; }
  @media (max-width: 600px) {
    .booking-cols { grid-template-columns: 1fr; }
  }

  /* ----- gallery ----- */
  .gallery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
  .gallery-tile {
    position: relative; aspect-ratio: 4 / 5; border-radius: 20px;
    overflow: hidden; border: 0.5px solid var(--border);
    background-color: var(--panel);
    background-size: cover; background-position: center;
    transition: transform 0.4s ease;
  }
  .gallery-tile:hover { transform: translateY(-2px); }
  .gallery-tile::after {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55) 100%);
  }
  .gallery-cap {
    position: absolute; left: 16px; bottom: 14px; right: 16px;
    color: #fff; font-size: 13.5px; font-weight: 600; letter-spacing: -0.005em;
    text-shadow: 0 1px 4px rgba(0,0,0,0.4);
  }
  @media (max-width: 760px) {
    .gallery-grid { grid-template-columns: 1fr 1fr; }
    .gallery-grid > :nth-child(3) { grid-column: span 2; aspect-ratio: 16 / 10; }
  }

  /* ----- about ----- */
  .about-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 32px; align-items: start; }
  .about-panel { background: var(--glass); border: 0.5px solid var(--border); border-radius: 18px; padding: 28px; }
  .about-panel p { margin: 0; color: var(--muted); font-size: 16px; line-height: 1.7; }
  .about-photo {
    position: relative; width: 100%; aspect-ratio: 4 / 5; border-radius: 18px;
    overflow: hidden; border: 0.5px solid var(--border);
    background-size: cover; background-position: center;
    min-height: 280px;
  }
  .about-photo::after {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.4) 100%);
  }
  .about-right { display: flex; flex-direction: column; gap: 16px; }
  .instructors-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
  .instructor-card { background: var(--glass); border: 0.5px solid var(--border); border-radius: 14px; padding: 16px 18px; display: flex; gap: 12px; align-items: center; }
  .instructor-avatar { width: 40px; height: 40px; border-radius: 50%; background: ${hexWithAlpha(finalAccent, 0.22)}; color: var(--accent); font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .instructor-meta { font-size: 14px; }
  .instructor-meta strong { display: block; font-weight: 600; }
  .instructor-meta span { color: var(--muted); font-size: 12.5px; }
  @media (max-width: 760px) {
    .about-grid { grid-template-columns: 1fr; }
  }

  /* ----- map ----- */
  .map-frame { width: 100%; height: 360px; border: 0.5px solid var(--border); border-radius: 18px; background: ${hexWithAlpha(text, 0.04)}; }

  /* ----- contact ----- */
  .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; align-items: start; }
  .contact-form { background: var(--glass-strong); backdrop-filter: blur(20px); border: 0.5px solid var(--border); border-radius: 20px; padding: 28px; }
  .contact-form label { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 6px; font-weight: 600; }
  .contact-form input, .contact-form select, .contact-form textarea { width: 100%; background: ${hexWithAlpha(text, 0.03)}; color: var(--text); border: 0.5px solid var(--border); border-radius: 10px; padding: 11px 14px; font-size: 14.5px; margin-bottom: 14px; font-family: inherit; }
  .contact-form textarea { min-height: 96px; resize: vertical; }
  .contact-form .submit { width: 100%; margin-top: 6px; }
  .contact-form .privacy { font-size: 12px; color: var(--muted); margin-top: 10px; text-align: center; }
  .contact-info { font-size: 14.5px; color: var(--muted); display: flex; flex-direction: column; gap: 12px; }
  .contact-info a { color: var(--text); text-decoration: none; border-bottom: 1px solid ${hexWithAlpha(finalAccent, 0.4)}; }
  @media (max-width: 760px) {
    .contact-grid { grid-template-columns: 1fr; }
  }

  /* ----- cta_final ----- */
  section.cta-final-block { padding: 64px 0 80px; }
  .cta-final {
    background: linear-gradient(135deg, ${hexWithAlpha(finalPrimary, 0.85)} 0%, ${hexWithAlpha(secondary, 0.85)} 100%);
    color: #fff;
    border-radius: 24px;
    padding: 48px 32px; text-align: center;
    border: 0.5px solid ${hexWithAlpha(finalAccent, 0.3)};
  }
  .cta-final h2 { font-size: clamp(26px, 3.4vw, 36px); font-weight: 700; letter-spacing: -0.025em; margin: 0 0 10px; }
  .cta-final p { margin: 0 0 22px; opacity: 0.85; font-size: 16px; }
  .cta-final .hero-ctas { justify-content: center; }
  .cta-final .btn-primary { background: #fff; color: ${finalPrimary}; }
  .cta-final .btn-secondary { color: #fff; border-color: rgba(255,255,255,0.4); }

  /* ----- footer ----- */
  footer.footer { padding: 32px 24px 56px; border-top: 0.5px solid var(--border); color: var(--muted); font-size: 13px; text-align: center; }
  footer.footer a { color: var(--accent); text-decoration: none; }

  /* ----- mobile polish ----- */
  @media (max-width: 640px) {
    section.block { padding: 48px 0; }
    .hero-title { line-height: 1.1; }
    .cta-final { padding: 32px 22px; }
  }
</style>
</head>
<body>
${renderNav({ name, safeLogoUrl, phoneHref, waBaseHref, labels })}

<main id="top">

${renderShowcaseBody({
  sectionOrder: s.section_order,
  builders: {
    hero: () =>
      renderHero({
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
    stats: () => renderStatsBlock(stats, labels),
    process: () => renderProcessBlock(features, labels),
    courses: () => renderCoursesBlock(courses, labels),
    trust: () => renderTrustBlock(trustPoints, labels),
    gallery: () => renderGalleryBlock(galleryPhotoUrls, labels, name),
    testimonials: () => renderTestimonialsBlock(testimonialList, labels),
    faq: () => renderFaqBlock(faqs, labels),
    booking: () => renderBookingBlock(booking, waBaseHref, bookingDayLabels, labels),
    about: () => renderAboutBlock(s.about.paragraph, aboutInstructors, aboutAccentPhotoUrl, name, labels),
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
 * Default section order for the generic showcase. Mirrors the v2
 * historical hard-coded order so legacy WebsiteMockup rows that
 * don't carry `section_order` keep rendering identically. When
 * Gemini emits a usable order array we honor it; otherwise we
 * fall back to this floor.
 */
const SHOWCASE_DEFAULT_SECTION_ORDER = [
  "hero",
  "stats",
  "process",
  "courses",
  "trust",
  "gallery",
  "testimonials",
  "faq",
  "booking",
  "about",
  "map",
  "contact",
  "cta_final",
];

function renderShowcaseBody(args: {
  sectionOrder: string[] | undefined;
  builders: Record<string, () => string>;
}): string {
  const { sectionOrder, builders } = args;
  // Honor Gemini's order only when it's substantially complete
  // (≥10 entries vs the 13-item default). Legacy v2 rows and test
  // fixtures with stub section_order arrays (e.g. just
  // ["hero","stats","process","courses"]) fall back to the default
  // floor so the renderer doesn't silently drop FAQ / booking /
  // contact / cta on rows authored before this refactor.
  const order =
    Array.isArray(sectionOrder) && sectionOrder.length >= 10
      ? sectionOrder
      : SHOWCASE_DEFAULT_SECTION_ORDER;

  // nav / footer / kuyumcu-only tokens are filtered. nav/footer are
  // rendered outside the body composer; kuyumcu-only tokens (gold_price,
  // collection_grid, certifications, atelier) silently no-op here so
  // Gemini's kuyumcu-flavored emit doesn't crash if it accidentally
  // routes to the generic renderer.
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
  labels: typeof LABELS["en"];
}): string {
  const { name, safeLogoUrl, phoneHref, waBaseHref, labels } = args;
  return `<header class="nav">
  <div class="nav-inner">
    <a class="nav-brand" href="#top">
      ${safeLogoUrl ? `<img src="${safeLogoUrl}" alt="" />` : ""}
      <span>${name}</span>
    </a>
    <div class="nav-ctas">
      ${waBaseHref ? `<a class="nav-cta-wa" href="${waBaseHref}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
      ${phoneHref ? `<a class="nav-cta-tel" href="${phoneHref}">${escapeHtml(labels.call_now)}</a>` : ""}
    </div>
  </div>
</header>`;
}

function renderHero(args: {
  borough: string | null;
  labels: typeof LABELS["en"];
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

  return `<section class="hero">
  <div class="wrap">
    <div class="hero-grid">
      <div>
        <p class="lede">${borough ? `${borough} · ` : ""}${escapeHtml(labels.open_for)}</p>
        <h1 class="hero-title">${escapeHtml(hero.headline)}</h1>
        <p class="hero-sub">${escapeHtml(hero.subline)}</p>
        <div class="hero-ctas">
          ${phoneHref ? `<a class="btn-primary" href="${phoneHref}">${escapeHtml(hero.cta_primary_text)}</a>` : ""}
          ${waBaseHref ? `<a class="btn-secondary" href="${waBaseHref}" target="_blank" rel="noopener">${escapeHtml(ctaSecondary)}</a>` : ""}
          ${mapsHref ? `<a class="btn-secondary" href="${mapsHref}" target="_blank" rel="noopener">${escapeHtml(labels.get_directions)}</a>` : ""}
        </div>
        ${trust ? `<div class="trust">${escapeHtml(trust)}</div>` : ""}
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

function renderStatsBlock(
  stats: { value: string; label: string; icon_hint: string }[],
  labels: typeof LABELS["en"],
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
        <div class="icon" aria-hidden="true">${pickIcon(s.icon_hint)}</div>
        <div class="stat-v">${escapeHtml(s.value)}</div>
        <div class="stat-l">${escapeHtml(s.label)}</div>
      </div>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
}

function renderProcessBlock(
  features: { title: string; body: string; icon_hint: string }[],
  labels: typeof LABELS["en"],
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
        <div class="process-num">${String(i + 1).padStart(2, "0")}</div>
        <h3>${escapeHtml(f.title)}</h3>
        <p>${escapeHtml(f.body)}</p>
      </div>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
}

function renderCoursesBlock(
  courses: WebsiteMockupCourse[],
  labels: typeof LABELS["en"],
): string {
  if (courses.length === 0) return "";
  return `<section class="block" id="courses">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(labels.courses_eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(labels.courses_title)}</h2>
    <div class="courses-grid">
      ${courses
        .map(
          (c) => `<div class="course-card${c.is_popular ? " popular" : ""}">
        ${c.is_popular ? `<span class="badge">${escapeHtml(labels.popular_badge)}</span>` : ""}
        <div class="course-icon" aria-hidden="true">${pickIcon(c.icon_hint)}</div>
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
        <a class="btn-primary" href="#contact">${escapeHtml(labels.contact_cta)}</a>
      </div>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
}

function renderTrustBlock(
  points: { title: string; body: string }[],
  labels: typeof LABELS["en"],
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
  labels: typeof LABELS["en"],
  businessName: string,
): string {
  if (photoUrls.length === 0) return "";
  // Caption rotation: niche-specific captions (e.g. kuyumcu → "Vitrinden",
  // "Atölyeden", "Koleksiyondan") fall through to a generic 3-slot
  // default. The captions ride on top of the photo with a subtle
  // gradient mask so the strip reads like a styled lookbook, not a
  // stock-photo dump.
  const captions = labels.gallery_captions ?? [];
  return `<section class="block">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(labels.gallery_eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(labels.gallery_title)}</h2>
    <div class="gallery-grid">
      ${photoUrls
        .map((url, i) => {
          const cap = captions[i] ?? captions[captions.length - 1] ?? "";
          return `<div class="gallery-tile" role="img" aria-label="${businessName}" style="background-image:url('${url}')">
        ${cap ? `<div class="gallery-cap">${escapeHtml(cap)}</div>` : ""}
      </div>`;
        })
        .join("")}
    </div>
  </div>
</section>`;
}

function renderTestimonialsBlock(
  ts: WebsiteMockupTestimonial[],
  labels: typeof LABELS["en"],
): string {
  if (ts.length === 0) return "";
  return `<section class="block">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(labels.reviews_eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(labels.reviews_title)}</h2>
    <div class="testimonials-grid">
      ${ts
        .map((t) => {
          const rating = typeof t.rating === "number" ? Math.max(0, Math.min(5, Math.round(t.rating))) : null;
          const starsHtml =
            rating !== null
              ? `<span class="stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span>`
              : "";
          return `<div class="review-card">
        ${starsHtml}
        <p>"${escapeHtml(t.body)}"</p>
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
  labels: typeof LABELS["en"],
): string {
  if (faqs.length === 0) return "";
  return `<section class="block">
  <div class="wrap">
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
  labels: typeof LABELS["en"],
): string {
  if (!booking || !waBaseHref) return "";
  const slots = (booking.time_slots ?? []).slice(0, 5);
  if (slots.length === 0) return "";

  return `<section class="block" id="booking">
  <div class="wrap">
    <div class="booking-card">
      <div class="section-eyebrow">${escapeHtml(labels.booking_eyebrow)}</div>
      <h2 class="section-title" style="margin-bottom:6px">${escapeHtml(booking.title)}</h2>
      <p class="section-sub" style="margin-bottom:8px">${escapeHtml(booking.subtitle)}</p>
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
  labels: typeof LABELS["en"],
): string {
  if (!paragraph && instructors.length === 0) return "";

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

  // Right column: photo + instructor grid stacked. If neither is
  // available we collapse the grid to a single-column layout so the
  // about paragraph spans full width instead of dangling beside an
  // empty cell.
  const hasRightContent = Boolean(accentPhotoUrl) || instructors.length > 0;
  const photoHtml = accentPhotoUrl
    ? `<div class="about-photo" role="img" aria-label="${businessName}" style="background-image:url('${accentPhotoUrl}')"></div>`
    : "";
  const gridStyle = hasRightContent ? "" : ' style="grid-template-columns:1fr"';

  return `<section class="block">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(labels.about_eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(labels.about_title)}</h2>
    <div class="about-grid"${gridStyle}>
      <div class="about-panel">
        <p>${escapeHtml(paragraph)}</p>
      </div>
      ${
        hasRightContent
          ? `<div class="about-right">${photoHtml}${instructorsHtml}</div>`
          : ""
      }
    </div>
  </div>
</section>`;
}

function renderMapBlock(embedUrl: string | null, labels: typeof LABELS["en"]): string {
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
  labels: typeof LABELS["en"],
): string {
  if (!contact) return "";
  // The form posts to wa.me via GET so the user lands in their
  // WhatsApp app with a pre-filled message. WhatsApp ignores fields
  // other than `text`, so we wire the `message` textarea name to
  // `text` and rely on the user's typed content to flow through.
  // If no phone is configured (workspace without a contact channel)
  // we omit the form entirely — submit-to-nowhere is worse UX than
  // simply showing the contact info chips.
  if (!waBaseHref) {
    return `<section class="block" id="contact">
  <div class="wrap">
    <div class="section-eyebrow">${escapeHtml(labels.contact_eyebrow)}</div>
    <h2 class="section-title">${escapeHtml(contact.title)}</h2>
    <p class="section-sub">${escapeHtml(contact.subtitle)}</p>
    <div class="contact-info">
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
  labels: typeof LABELS["en"],
): string {
  return `<section class="cta-final-block">
  <div class="wrap">
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
// Icons + labels
// ============================================================

function pickIcon(hint: string | undefined | null): string {
  const key = (hint ?? "").toLowerCase();
  return ICONS[key] ?? ICONS.star;
}

function svgIcon(d: string): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

const ICONS: Record<string, string> = {
  wrench: svgIcon("M14 7l-3 3 4 4 3-3 2 2c1-1 1-3 0-4l-6-6c-1-1-3-1-4 0l2 2zM6 14l4 4-5 5H3v-2l3-7z"),
  phone: svgIcon("M22 16v3a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2h3l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2z"),
  shield: svgIcon("M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z"),
  clock: svgIcon("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l4 2"),
  bolt: svgIcon("M13 3l-7 10h5l-1 8 7-10h-5z"),
  leaf: svgIcon("M20 4c-6 0-10 4-10 10l-2 2s8 4 14-4V4z"),
  home: svgIcon("M3 10l9-7 9 7v11h-6v-7h-6v7H3z"),
  star: svgIcon("M12 3l2.9 6.3 6.9.6-5.2 4.7 1.6 6.8L12 18l-6.2 3.4 1.6-6.8-5.2-4.7 6.9-.6z"),
  heart: svgIcon("M12 21s-8-4.5-8-11a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 6.5-8 11-8 11z"),
  tooth: svgIcon("M12 3c-3 0-5 2-5 4 0 2 1 4 1 6s-1 6 2 8c2 0 2-4 2-6s0 6 2 6c3-2 2-6 2-8s1-4 1-6c0-2-2-4-5-4z"),
  car: svgIcon("M5 17h14M5 17l1-5h12l1 5M5 17v2h2v-2M19 17v2h-2v-2M7 12l1-3h8l1 3"),
  road: svgIcon("M8 21l1-18h6l1 18M12 7v3M12 13v3"),
  certificate: svgIcon("M12 3l3 3 4 1 1 4 3 3-3 3-1 4-4 1-3 3-3-3-4-1-1-4-3-3 3-3 1-4 4-1z"),
  check: svgIcon("M5 13l4 4L19 7"),
  users: svgIcon("M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM3 21a9 9 0 0 1 18 0"),
  award: svgIcon("M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM9 14l-2 7 5-3 5 3-2-7"),
  calendar: svgIcon("M3 5h18v16H3zM3 9h18M8 3v4M16 3v4"),
  pin: svgIcon("M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"),
};

type Labels = {
  call_now: string;
  message_us: string;
  get_directions: string;
  open_for: string;
  drafted_by: string;
  numbers: string;
  stats_title: string;
  process_eyebrow: string;
  process_title: string;
  courses_eyebrow: string;
  courses_title: string;
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
  contact_cta: string;
  phone: string;
  gallery_eyebrow: string;
  gallery_title: string;
  gallery_captions: string[];
};

const LABELS: Record<string, Labels> = {
  tr: {
    call_now: "Hemen Ara",
    message_us: "WhatsApp'tan Yaz",
    get_directions: "Yol Tarifi",
    open_for: "Hizmet veriyoruz",
    drafted_by: "Leadac AI tarafından hazırlandı",
    numbers: "Rakamlarla",
    stats_title: "Neden bizi seçiyorlar",
    process_eyebrow: "Süreç",
    process_title: "Kayıttan ehliyete giden yol",
    courses_eyebrow: "Paketler",
    courses_title: "Sana en uygun kurs",
    popular_badge: "Popüler",
    trust_eyebrow: "Güven",
    trust_title: "Neden bize güveniyorlar",
    reviews_eyebrow: "Yorumlar",
    reviews_title: "Mezunlarımız anlatıyor",
    faq_eyebrow: "S.S.S.",
    faq_title: "Merak edilenler",
    booking_eyebrow: "Randevu",
    booking_note:
      "Saatlere tıklayınca WhatsApp uygulamanız hazır mesajla açılır.",
    booking_message_prefix: "Selam,",
    booking_message_suffix: "için randevu istiyorum.",
    about_eyebrow: "Hakkımızda",
    about_title: "Ekibimiz ve eğitmenlerimiz",
    map_eyebrow: "Konum",
    map_title: "Bizi buradan ziyaret edin",
    contact_eyebrow: "İletişim",
    contact_placeholder:
      "Hangi paketle ilgileniyorsunuz, ne zaman başlamak istiyorsunuz?",
    contact_cta: "İletişime Geç",
    phone: "Telefon",
    gallery_eyebrow: "Galeri",
    gallery_title: "Bizden kareler",
    gallery_captions: ["Mağazamızdan", "Hizmetimizden", "Galeri"],
  },
  en: {
    call_now: "Call now",
    message_us: "WhatsApp",
    get_directions: "Get directions",
    open_for: "Serving your area",
    drafted_by: "Drafted by Leadac AI",
    numbers: "In numbers",
    stats_title: "Why customers choose us",
    process_eyebrow: "Process",
    process_title: "How we work",
    courses_eyebrow: "Packages",
    courses_title: "Pick the package that fits you",
    popular_badge: "Popular",
    trust_eyebrow: "Trust",
    trust_title: "Why customers trust us",
    reviews_eyebrow: "Reviews",
    reviews_title: "What customers say",
    faq_eyebrow: "FAQ",
    faq_title: "Frequently asked",
    booking_eyebrow: "Book a slot",
    booking_note:
      "Tap a time and WhatsApp opens with your message pre-filled.",
    booking_message_prefix: "Hi,",
    booking_message_suffix: "— I'd like to book this slot.",
    about_eyebrow: "About",
    about_title: "Our team",
    map_eyebrow: "Find us",
    map_title: "Visit us here",
    contact_eyebrow: "Contact",
    contact_placeholder: "Which package are you interested in?",
    contact_cta: "Contact us",
    phone: "Phone",
    gallery_eyebrow: "Gallery",
    gallery_title: "Snapshots from us",
    gallery_captions: ["From our space", "Our work", "Gallery"],
  },
};

// Per-niche overrides for section labels. The base TR/EN dicts above
// are historically driving-school-flavoured ("Kayıttan ehliyete",
// "Mezunlarımız anlatıyor", "eğitmenlerimiz") because that was the
// first vertical shipped — we keep them as the fallback for the
// Emirhan workspace and any unclassified lead, but every other
// vertical needs to override the bits that read wrong. Resolution
// order in `resolveLabels`: child slug → parent slug → base.
const NICHE_LABEL_OVERRIDES: Record<
  string,
  { tr?: Partial<Labels>; en?: Partial<Labels> }
> = {
  kuyumcu: {
    tr: {
      stats_title: "Rakamlarla biz",
      process_title: "Vitrinden teslime giden yol",
      courses_eyebrow: "Koleksiyon",
      courses_title: "Size en uygun ürün",
      reviews_title: "Müşterilerimiz anlatıyor",
      about_title: "Atölyemiz ve uzman ekibimiz",
      contact_placeholder:
        "Hangi ürün veya hizmetle ilgileniyorsunuz? (alyans, hurda altın, tamir, pırlanta…)",
      gallery_eyebrow: "Galeri",
      gallery_title: "Vitrinimizden ve atölyemizden",
      gallery_captions: ["Vitrinden", "Atölyemizden", "Koleksiyondan"],
    },
    en: {
      process_title: "From window to hand-over",
      courses_eyebrow: "Collection",
      courses_title: "Find the right piece",
      about_title: "Our atelier and team",
      gallery_eyebrow: "Gallery",
      gallery_title: "From our store and atelier",
      gallery_captions: ["At the window", "In the atelier", "From the collection"],
    },
  },
  "kuyumcu-luxury": {
    tr: {
      courses_eyebrow: "Koleksiyon",
      courses_title: "Bu sezonun seçkisi",
      reviews_title: "Müşterilerimiz anlatıyor",
      about_title: "Atölyemiz ve uzman ekibimiz",
      gallery_eyebrow: "Editorial",
      gallery_title: "Koleksiyondan kareler",
      gallery_captions: ["Editorial", "Atölyeden", "Koleksiyondan"],
    },
    en: {
      courses_eyebrow: "Collection",
      courses_title: "This season's edit",
      gallery_eyebrow: "Editorial",
      gallery_title: "From the collection",
      gallery_captions: ["Editorial", "In the atelier", "From the collection"],
    },
  },
};

function resolveLabels(
  lang: "tr" | "en",
  nicheSlug: string | null,
  parentSlug: string | null,
): Labels {
  const base = LABELS[lang];
  const childOverride =
    nicheSlug && NICHE_LABEL_OVERRIDES[nicheSlug]?.[lang];
  const parentOverride =
    parentSlug && parentSlug !== nicheSlug
      ? NICHE_LABEL_OVERRIDES[parentSlug]?.[lang]
      : null;
  // Child wins over parent; parent fills any gap; base catches the rest.
  return {
    ...base,
    ...(parentOverride ?? {}),
    ...(childOverride ?? {}),
  };
}

function buildTrustLine(
  rating: number | null,
  reviewCount: number | null,
  lang: string,
): string | null {
  if (!rating || !reviewCount) return null;
  if (lang === "tr") {
    return `${rating.toFixed(1)}★ Google · ${reviewCount} yorum`;
  }
  return `${rating.toFixed(1)}★ on Google · ${reviewCount} reviews`;
}
