/**
 * leadac-hero-v1 template renderer.
 *
 * Produces a single standalone HTML document - no React, no JS bundle,
 * all CSS inline. Loads in under 1s on 3G; the document is what the
 * cold-email recipient taps from their phone, so page-weight discipline
 * is non-negotiable.
 *
 * Aesthetic: matches Leadac's marketing site (dark bg, glass panels,
 * single-accent gradient, crisp typography, 16px radius, 0.5px
 * borders). The accent and primary colors come from Gemini as part
 * of the theme object so each niche gets a different palette without
 * us having to hand-author 10 templates.
 *
 * Security: every piece of Gemini-produced text runs through
 * `escapeHtml` before it hits the document. Business identity
 * fields (name, phone, address) come from the caller, not Gemini,
 * so those are single-escape too. No raw HTML pass-through. No
 * `<script>`, no `<iframe>`, no third-party asset loads.
 */

import type { WebsiteMockupSections } from "@/lib/prompts/website-mockup-prompt";
import type { WorkspaceBranding } from "@/lib/branding";

export interface LeadacHeroRenderInput {
  businessName: string;
  formattedAddress: string;
  borough: string | null;
  phone: string | null;
  websiteUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  googleMapsUri: string | null;
  sections: WebsiteMockupSections;
  workspaceName?: string;
  branding?: WorkspaceBranding | null;
  showLeadacCredit?: boolean;
  lang?: string;
}

export function renderLeadacHero(input: LeadacHeroRenderInput): string {
  const s = input.sections;
  const theme = s.theme;
  const isLight = theme.mode === "light";
  const bg = isLight ? "#f8f7f4" : "#0b0b0d";
  const panel = isLight ? "rgba(255,255,255,0.8)" : "#121214";
  const text = isLight ? "#111114" : "#ededf0";
  const muted = isLight ? "rgba(17,17,20,0.55)" : "rgba(237,237,240,0.55)";
  const border = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
  const accent = sanitizeHex(theme.accent_hex) ?? "#a5b4fc";
  const primary = sanitizeHex(theme.primary_hex) ?? "#5e6ad2";

  const brand = input.branding;
  const footerText =
    brand?.footerText ||
    (input.workspaceName ? `Drafted by ${escapeHtml(input.workspaceName)}` : "Drafted by Leadac AI");
  const showCredit = input.showLeadacCredit !== false && !brand?.hideLeadacCredit;
  const safeLogoUrl = brand?.logoUrl ? escapeHtml(brand.logoUrl) : null;

  const name = escapeHtml(input.businessName);
  const addr = escapeHtml(input.formattedAddress);
  const borough = input.borough ? escapeHtml(input.borough) : null;
  const phoneDisplay = input.phone ? escapeHtml(input.phone) : null;
  const phoneHref = input.phone ? encodeTelHref(input.phone) : null;
  const waHref = input.phone ? encodeWhatsappHref(input.phone) : null;
  const mapsHref = input.googleMapsUri ? escapeHtml(input.googleMapsUri) : null;

  const hero = s.hero;
  const trust = hero.trust_line ?? buildTrustLine(input.rating, input.reviewCount, input.lang);

  const lang = input.lang === "tr" ? "tr" : "en";
  const labels = LABELS[lang];

  const servicesHtml = s.services.slice(0, 6).map((svc) => renderServiceCard(svc, { accent, border, panel, muted, text })).join("\n");

  const testimonial = s.testimonial;
  const testimonialHtml = testimonial
    ? renderTestimonial(testimonial, { accent, border, panel, muted, text })
    : "";

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<meta name="format-detection" content="telephone=yes" />
<title>${name} - ${escapeHtml(hero.headline)}</title>
<meta property="og:title" content="${name}" />
<meta property="og:description" content="${escapeHtml(hero.subline)}" />
<meta property="og:type" content="website" />
<style>
  :root {
    --bg: ${bg};
    --panel: ${panel};
    --text: ${text};
    --muted: ${muted};
    --accent: ${accent};
    --primary: ${primary};
    --border: ${border};
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif; line-height: 1.6; -webkit-font-smoothing: antialiased; }
  a { color: inherit; }
  .hero-bg {
    background:
      radial-gradient(60% 50% at 20% 10%, ${hexWithAlpha(accent, 0.18)} 0%, transparent 60%),
      radial-gradient(40% 40% at 80% 30%, ${hexWithAlpha(primary, 0.12)} 0%, transparent 60%),
      var(--bg);
  }
  .wrap { max-width: 960px; margin: 0 auto; padding: 0 20px; }
  header.nav { position: sticky; top: 0; z-index: 20; backdrop-filter: blur(12px); background: ${hexWithAlpha(bg, 0.6)}; border-bottom: 0.5px solid var(--border); }
  .nav-inner { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; max-width: 960px; margin: 0 auto; gap: 12px; }
  .nav-brand { font-weight: 700; font-size: 17px; letter-spacing: -0.015em; text-decoration: none; color: var(--text); }
  .nav-cta { background: var(--primary); color: #fff; padding: 8px 16px; border-radius: 999px; text-decoration: none; font-size: 13px; font-weight: 600; letter-spacing: -0.005em; transition: transform 120ms ease; }
  .nav-cta:hover { transform: translateY(-1px); }

  section.hero { padding: 72px 0 56px; }
  .lede { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--accent); font-weight: 600; margin-bottom: 14px; }
  h1.hero-title { font-size: clamp(32px, 5vw, 52px); font-weight: 700; letter-spacing: -0.025em; line-height: 1.08; margin: 0 0 16px; max-width: 800px; }
  .hero-sub { font-size: clamp(16px, 2vw, 19px); color: var(--muted); max-width: 640px; margin: 0 0 28px; }
  .hero-ctas { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .btn-primary { background: var(--primary); color: #fff; padding: 14px 24px; border-radius: 999px; text-decoration: none; font-size: 15px; font-weight: 600; letter-spacing: -0.005em; display: inline-flex; align-items: center; gap: 8px; transition: transform 120ms ease, background 120ms ease; border: none; cursor: pointer; }
  .btn-primary:hover { transform: translateY(-1px); }
  .btn-secondary { background: transparent; color: var(--text); padding: 13px 22px; border-radius: 999px; text-decoration: none; font-size: 15px; font-weight: 500; border: 0.5px solid var(--border); display: inline-flex; align-items: center; gap: 8px; transition: background 120ms ease; }
  .btn-secondary:hover { background: ${hexWithAlpha(text, 0.04)}; }
  .trust { margin-top: 24px; font-size: 13px; color: var(--muted); display: inline-flex; align-items: center; gap: 8px; }
  .stars { letter-spacing: -1px; color: #f5a623; font-size: 15px; }

  section.services { padding: 48px 0; }
  .section-title { font-size: clamp(22px, 3vw, 30px); font-weight: 700; letter-spacing: -0.02em; margin: 0 0 28px; }
  .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
  .svc-card { background: var(--panel); border: 0.5px solid var(--border); border-radius: 16px; padding: 22px; }
  .svc-icon { width: 36px; height: 36px; border-radius: 10px; background: ${hexWithAlpha(accent, 0.12)}; color: var(--accent); display: flex; align-items: center; justify-content: center; margin-bottom: 14px; font-size: 18px; }
  .svc-title { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 6px; }
  .svc-body { font-size: 14px; color: var(--muted); margin: 0; }

  section.social { padding: 48px 0; }
  .quote { background: var(--panel); border: 0.5px solid var(--border); border-radius: 20px; padding: 32px; max-width: 720px; margin: 0 auto; text-align: center; }
  .quote p { font-size: 19px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.5; margin: 0 0 16px; }
  .quote .who { font-size: 14px; color: var(--muted); }

  section.about { padding: 48px 0; }
  .about-panel { background: var(--panel); border: 0.5px solid var(--border); border-radius: 20px; padding: 32px; }
  .about-panel p { font-size: 16px; color: var(--muted); margin: 0; max-width: 640px; line-height: 1.65; }

  section.contact { padding: 48px 0 72px; }
  .contact-panel { background: var(--panel); border: 0.5px solid var(--border); border-radius: 20px; padding: 40px; text-align: center; }
  .contact-panel h2 { font-size: clamp(22px, 3vw, 30px); font-weight: 700; letter-spacing: -0.02em; margin: 0 0 10px; }
  .contact-panel p { color: var(--muted); margin: 0 0 22px; }
  .contact-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 18px; }
  .info-chip { padding: 9px 16px; border-radius: 999px; border: 0.5px solid var(--border); font-size: 13px; color: var(--muted); text-decoration: none; display: inline-flex; align-items: center; gap: 8px; }
  .info-chip:hover { background: ${hexWithAlpha(text, 0.04)}; }

  footer.footer { padding: 28px 20px 48px; border-top: 0.5px solid var(--border); color: var(--muted); font-size: 12px; text-align: center; }
  footer.footer a { color: var(--accent); text-decoration: none; }

  @media (max-width: 640px) {
    .hero-title { line-height: 1.1; }
    .contact-panel { padding: 28px 20px; }
  }
</style>
</head>
<body class="hero-bg">
<header class="nav">
  <div class="nav-inner">
    <a class="nav-brand" href="#top">${safeLogoUrl ? `<img src="${safeLogoUrl}" alt="" style="max-height:28px;vertical-align:middle;margin-right:8px" />` : ""}${name}</a>
    ${phoneHref ? `<a class="nav-cta" href="${phoneHref}">${escapeHtml(labels.call_now)}</a>` : ""}
  </div>
</header>

<main id="top">

<section class="hero">
  <div class="wrap">
    <p class="lede">${borough ? borough + " · " : ""}${escapeHtml(labels.open_for)}</p>
    <h1 class="hero-title">${escapeHtml(hero.headline)}</h1>
    <p class="hero-sub">${escapeHtml(hero.subline)}</p>
    <div class="hero-ctas">
      ${phoneHref ? `<a class="btn-primary" href="${phoneHref}">${escapeHtml(hero.cta_primary_text)}</a>` : ""}
      ${waHref ? `<a class="btn-secondary" href="${waHref}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
      ${mapsHref ? `<a class="btn-secondary" href="${mapsHref}" target="_blank" rel="noopener">${escapeHtml(labels.get_directions)}</a>` : ""}
    </div>
    ${trust ? `<div class="trust">${escapeHtml(trust)}</div>` : ""}
  </div>
</section>

${s.services.length ? `
<section class="services">
  <div class="wrap">
    <h2 class="section-title">${escapeHtml(labels.services)}</h2>
    <div class="services-grid">
      ${servicesHtml}
    </div>
  </div>
</section>
` : ""}

${testimonialHtml ? `
<section class="social">
  <div class="wrap">
    ${testimonialHtml}
  </div>
</section>
` : ""}

${s.about?.paragraph ? `
<section class="about">
  <div class="wrap">
    <h2 class="section-title">${escapeHtml(labels.about)}</h2>
    <div class="about-panel">
      <p>${escapeHtml(s.about.paragraph)}</p>
    </div>
  </div>
</section>
` : ""}

<section class="contact">
  <div class="wrap">
    <div class="contact-panel">
      <h2>${escapeHtml(s.cta_final.headline)}</h2>
      <p>${escapeHtml(labels.response_promise)}</p>
      <div class="hero-ctas" style="justify-content:center">
        ${phoneHref ? `<a class="btn-primary" href="${phoneHref}">${escapeHtml(s.cta_final.button_text)}</a>` : ""}
        ${waHref ? `<a class="btn-secondary" href="${waHref}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
      </div>
      <div class="contact-row">
        ${phoneDisplay ? `<span class="info-chip">${escapeHtml(labels.phone)}: ${phoneDisplay}</span>` : ""}
        <span class="info-chip">${addr}</span>
        ${mapsHref ? `<a class="info-chip" href="${mapsHref}" target="_blank" rel="noopener">${escapeHtml(labels.map)}</a>` : ""}
      </div>
    </div>
  </div>
</section>

</main>

<footer class="footer">
  ${footerText}${showCredit ? ` · <a href="https://leadac.ai" target="_blank" rel="noopener">leadac.ai</a>` : ""}
</footer>

</body>
</html>`;
}

function renderServiceCard(
  svc: { title: string; body: string; icon_hint: string },
  _theme: { accent: string; border: string; panel: string; muted: string; text: string },
): string {
  const icon = ICONS[svc.icon_hint] ?? ICONS.star;
  return `<div class="svc-card">
    <div class="svc-icon" aria-hidden="true">${icon}</div>
    <h3 class="svc-title">${escapeHtml(svc.title)}</h3>
    <p class="svc-body">${escapeHtml(svc.body)}</p>
  </div>`;
}

function renderTestimonial(
  t: { body: string; attribution: string; rating: number },
  _theme: { accent: string; border: string; panel: string; muted: string; text: string },
): string {
  const stars = "★".repeat(Math.max(0, Math.min(5, Math.round(t.rating)))) + "☆".repeat(5 - Math.max(0, Math.min(5, Math.round(t.rating))));
  return `<div class="quote">
    <div class="stars" style="margin-bottom:14px">${stars}</div>
    <p>"${escapeHtml(t.body)}"</p>
    <div class="who">- ${escapeHtml(t.attribution)}</div>
  </div>`;
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
};

function svgIcon(d: string): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

const LABELS: Record<string, {
  services: string; about: string; call_now: string; get_directions: string; open_for: string; response_promise: string; phone: string; map: string;
}> = {
  tr: {
    services: "Hizmetler",
    about: "Hakkimizda",
    call_now: "Simdi Ara",
    get_directions: "Yol Tarifi",
    open_for: "Hizmet veriyoruz",
    response_promise: "Telefon, WhatsApp veya yerinde - 30 dakika icinde donuyoruz.",
    phone: "Telefon",
    map: "Haritada ac",
  },
  en: {
    services: "Services",
    about: "About",
    call_now: "Call now",
    get_directions: "Get directions",
    open_for: "Serving your area",
    response_promise: "Call, WhatsApp or message - we reply within 30 minutes.",
    phone: "Phone",
    map: "Open in map",
  },
};

function buildTrustLine(
  rating: number | null,
  reviewCount: number | null,
  lang?: string,
): string | null {
  if (!rating || !reviewCount) return null;
  const prefix = lang === "tr" ? "Google'da" : "on Google";
  return `${rating.toFixed(1)}★ ${prefix} · ${reviewCount} ${lang === "tr" ? "yorum" : "reviews"}`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeHex(input: string | undefined | null): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(trimmed)) return null;
  return trimmed;
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = sanitizeHex(hex) ?? "#000000";
  const full = h.length === 4
    ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
    : h;
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function encodeTelHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

function encodeWhatsappHref(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}
