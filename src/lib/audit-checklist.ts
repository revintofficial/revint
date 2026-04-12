import type { WebsiteFeatures, CheckResult, AuditChecklistResult } from "@/types";

function check(
  category: CheckResult["category"],
  item: string,
  status: CheckResult["status"],
  priority: CheckResult["priority"],
  recommendation: string
): CheckResult {
  return { category, item, status, priority, recommendation };
}

function boolStatus(val: boolean): "pass" | "fail" {
  return val ? "pass" : "fail";
}

export function runAuditChecklist(
  features: WebsiteFeatures | null,
  hasWebsite: boolean
): AuditChecklistResult {
  const seo: CheckResult[] = [];
  const performance: CheckResult[] = [];
  const security: CheckResult[] = [];
  const accessibility: CheckResult[] = [];
  const ux: CheckResult[] = [];
  const pwa: CheckResult[] = [];
  const form: CheckResult[] = [];

  if (!hasWebsite || !features) {
    seo.push(check("seo", "Web sitesi mevcut", "fail", "critical",
      "Isletmenin bir web sitesine ihtiyaci var. Modern, mobil uyumlu bir site olusturulmali."));

    const allChecks = [...seo];
    return {
      seo, performance, security, accessibility, ux, pwa, form,
      summary: buildSummary(allChecks),
    };
  }

  // ===== SEO CHECKS =====
  seo.push(check("seo", "Site erisime acik", boolStatus(features.reachable), "critical",
    "Site erisime acik olmali, 200 OK donmeli."));

  seo.push(check("seo", "Title tag mevcut", boolStatus(!!features.title), "critical",
    "Her sayfanin benzersiz bir <title> tagi olmali (50-60 karakter)."));

  seo.push(check("seo", "Meta description mevcut", boolStatus(!!features.metaDescription), "critical",
    "Her sayfanin 150-160 karakter arasi meta description'i olmali."));

  seo.push(check("seo", "H1 baslik mevcut", boolStatus(!!features.h1), "critical",
    "Her sayfada tek bir H1 basligi olmali."));

  seo.push(check("seo", "Open Graph taglari", boolStatus(features.hasOpenGraph), "important",
    "og:title, og:description, og:image (1200x630) taglari eklenmeli."));

  seo.push(check("seo", "Twitter Cards", boolStatus(features.hasTwitterCards), "nice_to_have",
    "twitter:card, twitter:title, twitter:description taglari eklenmeli."));

  seo.push(check("seo", "Schema.org structured data", boolStatus(features.structuredDataPresent), "important",
    "Organization, LocalBusiness, Service gibi schema.org tipleri eklenmeli."));

  const hasLocalBusiness = features.schemaTypes.some(
    (t) => t === "LocalBusiness" || t === "Organization"
  );
  seo.push(check("seo", "LocalBusiness/Organization schema", boolStatus(hasLocalBusiness), "important",
    "Yerel isletme icin LocalBusiness veya Organization schema markup eklenmeli."));

  seo.push(check("seo", "Canonical URL", "unknown", "important",
    "Her sayfanin canonical URL'i tanimlanmali, duplicate content engellenmeli."));

  // ===== PERFORMANCE CHECKS =====
  const loadOk = features.loadTimeMs !== null && features.loadTimeMs < 3000;
  performance.push(check("performance", "Sayfa yukleme suresi < 3sn",
    features.loadTimeMs !== null ? boolStatus(loadOk) : "unknown", "critical",
    `Sayfa ${features.loadTimeMs ?? "?"}ms'de yuklendi. Hedef < 2500ms (LCP).`));

  performance.push(check("performance", "HTTPS aktif", boolStatus(features.https), "critical",
    "HTTPS zorunlu olmali, HTTP -> HTTPS yonlendirmesi yapilmali."));

  performance.push(check("performance", "Responsive gorseller", boolStatus(features.hasResponsiveImages), "important",
    "srcset ve sizes attribute'lari ile farkli cihazlara uygun gorseller sunulmali."));

  performance.push(check("performance", "Font display swap", boolStatus(features.hasFontDisplay), "important",
    "Font yukleme sirasinda FOUT onlemek icin font-display: swap kullanilmali."));

  const lazyIssue = features.performanceHints.some((h) => h.includes("lazy loading"));
  performance.push(check("performance", "Lazy loading aktif", boolStatus(!lazyIssue), "important",
    "Ekran disi gorseller icin loading='lazy' kullanilmali."));

  const preloadIssue = features.performanceHints.some((h) => h.includes("preload"));
  performance.push(check("performance", "Preload ipuclari", boolStatus(!preloadIssue), "nice_to_have",
    "Kritik kaynaklar icin <link rel='preload'> kullanilmali."));

  const renderBlockIssue = features.performanceHints.some((h) => h.includes("render-blocking"));
  performance.push(check("performance", "Render-blocking kaynaklar minimize", boolStatus(!renderBlockIssue), "important",
    "Render-blocking CSS/JS sayisi azaltilmali, kritik CSS inline edilmeli."));

  // ===== SECURITY CHECKS =====
  security.push(check("security", "HTTPS", boolStatus(features.https), "critical",
    "SSL sertifikasi yuklu olmali, tum trafik HTTPS uzerinden olmali."));

  security.push(check("security", "Content-Security-Policy (CSP)",
    boolStatus(features.securityHeaders.hasCSP), "important",
    "CSP header tanimlanmali: script-src, style-src, img-src kurallari."));

  security.push(check("security", "X-Frame-Options",
    boolStatus(features.securityHeaders.hasXFrameOptions), "important",
    "X-Frame-Options: DENY - Clickjacking saldirilarindan korunma."));

  security.push(check("security", "X-Content-Type-Options",
    boolStatus(features.securityHeaders.hasXContentTypeOptions), "important",
    "X-Content-Type-Options: nosniff - MIME type sniffing engelleme."));

  security.push(check("security", "Referrer-Policy",
    boolStatus(features.securityHeaders.hasReferrerPolicy), "important",
    "Referrer-Policy: origin-when-cross-origin tanimlanmali."));

  security.push(check("security", "Strict-Transport-Security (HSTS)",
    boolStatus(features.securityHeaders.hasHSTS), "important",
    "HSTS header ile HTTPS zorunlulugu kalici hale getirilmeli."));

  security.push(check("security", "Permissions-Policy",
    boolStatus(features.securityHeaders.hasPermissionsPolicy), "nice_to_have",
    "Permissions-Policy ile camera, microphone, geolocation izinleri kisitlanmali."));

  // ===== ACCESSIBILITY CHECKS =====
  const noA11yIssues = features.accessibilityIssues.length === 0;
  accessibility.push(check("accessibility", "Genel erisilebilirlik", boolStatus(noA11yIssues), "critical",
    features.accessibilityIssues.length > 0
      ? `Tespit edilen sorunlar: ${features.accessibilityIssues.join("; ")}`
      : "Temel erisilebilirlik kontrolleri basarili."));

  const noMissingAlt = !features.accessibilityIssues.some((i) => i.includes("alt"));
  accessibility.push(check("accessibility", "Gorsel alt textleri", boolStatus(noMissingAlt), "critical",
    "Tum gorsellerin anlamli alt text'leri olmali, dekoratif gorseller alt='' olmali."));

  const noMissingLabel = !features.accessibilityIssues.some((i) => i.includes("label"));
  accessibility.push(check("accessibility", "Form label iliskilendirmesi", boolStatus(noMissingLabel), "critical",
    "Her form input bir label ile iliskilendirilmeli (for/id veya aria-label)."));

  const noHeadingIssue = !features.accessibilityIssues.some((i) => i.includes("h1"));
  accessibility.push(check("accessibility", "Baslik hiyerarsisi", boolStatus(noHeadingIssue), "important",
    "Sayfa baslik hiyerarsisi dogru olmali (tek H1, H1>H2>H3 sirasi)."));

  const noLangIssue = !features.accessibilityIssues.some((i) => i.includes("lang"));
  accessibility.push(check("accessibility", "HTML lang attribute", boolStatus(noLangIssue), "important",
    "<html lang='tr'> ile sayfanin dili belirtilmeli."));

  const noSemanticIssue = !features.accessibilityIssues.some((i) => i.includes("semantic"));
  accessibility.push(check("accessibility", "Semantik HTML kullanimi", boolStatus(noSemanticIssue), "important",
    "<header>, <nav>, <main>, <footer>, <article> gibi semantik elementler kullanilmali."));

  // ===== UX CHECKS =====
  ux.push(check("ux", "Mobil uyumluluk", boolStatus(features.mobileFriendlyGuess), "critical",
    "Viewport meta tag ve responsive tasarim ile mobil uyumluluk saglanmali."));

  ux.push(check("ux", "Favicon", boolStatus(features.hasFavicon), "important",
    "16x16, 32x32, 180x180 (iOS) ve 512x512 (Android) favicon boyutlari olmali."));

  ux.push(check("ux", "Contact form", boolStatus(features.hasContactForm), "critical",
    "Iletisim formu olmali - email, telefon, mesaj alanlari."));

  ux.push(check("ux", "WhatsApp entegrasyonu", boolStatus(features.hasWhatsappLink), "important",
    "WhatsApp iletisim linki eklenmeli (wa.me/numara)."));

  ux.push(check("ux", "Online randevu sistemi", boolStatus(features.hasBookingSystem), "important",
    "Online randevu/rezervasyon sistemi entegre edilmeli."));

  ux.push(check("ux", "CTA (Call-to-Action) linkleri", boolStatus(features.ctaLinks.length > 0), "critical",
    "Belirgin CTA butonlari olmali: 'Iletisime Gec', 'Teklif Al', 'Randevu Al'."));

  ux.push(check("ux", "Navigasyon yapisi", boolStatus(features.navItems.length >= 3), "critical",
    "Anlasilir navigasyon menusunde en az Ana Sayfa, Hizmetler, Iletisim olmali."));

  // ===== PWA CHECKS =====
  pwa.push(check("pwa", "Web App Manifest", boolStatus(features.hasManifest), "nice_to_have",
    "manifest.json ile PWA ozellikleri eklenmeli (name, icons, start_url, display)."));

  pwa.push(check("pwa", "Service Worker", boolStatus(features.hasServiceWorker), "nice_to_have",
    "Service worker ile offline destek ve cache stratejisi eklenmeli."));

  // ===== FORM CHECKS =====
  form.push(check("form", "Iletisim formu mevcut", boolStatus(features.hasContactForm), "critical",
    "Isletme icin iletisim formu olmali (ad, email, telefon, mesaj)."));

  form.push(check("form", "KVKK/GDPR uyumluluk", "unknown", "critical",
    "Form'da KVKK onay checkbox'i ve aydinlatma metni linki olmali."));

  form.push(check("form", "Spam korumasi (honeypot/captcha)", "unknown", "important",
    "Honeypot field veya reCAPTCHA ile bot korumasi eklenmeli."));

  // ===== ANALYTICS =====
  seo.push(check("seo", "Google Analytics / Tag Manager", boolStatus(features.hasGoogleAnalytics), "critical",
    "GA4 veya GTM entegre edilmeli, sayfa goruntulenme ve event tracking yapilmali."));

  seo.push(check("seo", "Cookie consent banner", boolStatus(features.hasCookieConsent), "important",
    "GDPR/KVKK uyumlu cookie consent banner eklenmeli."));

  const allChecks = [
    ...seo, ...performance, ...security,
    ...accessibility, ...ux, ...pwa, ...form,
  ];

  return {
    seo, performance, security, accessibility, ux, pwa, form,
    summary: buildSummary(allChecks),
  };
}

function buildSummary(checks: CheckResult[]) {
  const totalChecks = checks.length;
  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const unknown = checks.filter((c) => c.status === "unknown").length;
  const scorable = totalChecks - unknown;
  const scorePercent = scorable > 0 ? Math.round((passed / scorable) * 100) : 0;

  return { totalChecks, passed, failed, unknown, scorePercent };
}

export function formatChecklistForPrompt(result: AuditChecklistResult): string {
  const lines: string[] = [];
  lines.push(`## Audit Sonuc Ozeti: ${result.summary.passed}/${result.summary.totalChecks - result.summary.unknown} basarili (${result.summary.scorePercent}%)\n`);

  const categories: { key: keyof Omit<AuditChecklistResult, "summary">; label: string }[] = [
    { key: "seo", label: "SEO ve Metadata" },
    { key: "performance", label: "Performans" },
    { key: "security", label: "Guvenlik" },
    { key: "accessibility", label: "Erisilebilirlik" },
    { key: "ux", label: "Kullanici Deneyimi (UX)" },
    { key: "pwa", label: "PWA" },
    { key: "form", label: "Form Yonetimi" },
  ];

  for (const { key, label } of categories) {
    const checks = result[key];
    if (checks.length === 0) continue;

    const passCount = checks.filter((c) => c.status === "pass").length;
    lines.push(`### ${label} (${passCount}/${checks.length})`);
    for (const c of checks) {
      const icon = c.status === "pass" ? "[BASARILI]" : c.status === "fail" ? "[BASARISIZ]" : "[BILINMIYOR]";
      const pri = c.priority === "critical" ? "(KRITIK)" : c.priority === "important" ? "(ONEMLI)" : "(IYI OLUR)";
      lines.push(`${icon} ${pri} ${c.item}`);
      if (c.status !== "pass") {
        lines.push(`  -> Oneri: ${c.recommendation}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
