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
    seo.push(check("seo", "Website exists", "fail", "critical",
      "The business needs a website. Build a modern, mobile-friendly site."));

    const allChecks = [...seo];
    return {
      seo, performance, security, accessibility, ux, pwa, form,
      summary: buildSummary(allChecks),
    };
  }

  // ===== SEO CHECKS =====
  seo.push(check("seo", "Site is reachable", boolStatus(features.reachable), "critical",
    "Site must be reachable and return 200 OK."));

  seo.push(check("seo", "Title tag present", boolStatus(!!features.title), "critical",
    "Every page should have a unique <title> tag (50-60 characters)."));

  seo.push(check("seo", "Meta description present", boolStatus(!!features.metaDescription), "critical",
    "Every page should have a 150-160 character meta description."));

  seo.push(check("seo", "H1 heading present", boolStatus(!!features.h1), "critical",
    "Every page should have a single H1 heading."));

  seo.push(check("seo", "Open Graph tags", boolStatus(features.hasOpenGraph), "important",
    "Add og:title, og:description, and og:image (1200x630) tags."));

  seo.push(check("seo", "Twitter Cards", boolStatus(features.hasTwitterCards), "nice_to_have",
    "Add twitter:card, twitter:title, and twitter:description tags."));

  seo.push(check("seo", "Schema.org structured data", boolStatus(features.structuredDataPresent), "important",
    "Add schema.org types such as Organization, LocalBusiness, or Service."));

  const hasLocalBusiness = features.schemaTypes.some(
    (t) => t === "LocalBusiness" || t === "Organization"
  );
  seo.push(check("seo", "LocalBusiness/Organization schema", boolStatus(hasLocalBusiness), "important",
    "Local businesses should include LocalBusiness or Organization schema markup."));

  seo.push(check("seo", "Canonical URL", "unknown", "important",
    "Every page should declare a canonical URL to prevent duplicate content."));

  // ===== PERFORMANCE CHECKS =====
  const loadOk = features.loadTimeMs !== null && features.loadTimeMs < 3000;
  performance.push(check("performance", "Page load time < 3s",
    features.loadTimeMs !== null ? boolStatus(loadOk) : "unknown", "critical",
    `Page loaded in ${features.loadTimeMs ?? "?"}ms. Target < 2500ms (LCP).`));

  performance.push(check("performance", "HTTPS enabled", boolStatus(features.https), "critical",
    "HTTPS should be enforced with an HTTP -> HTTPS redirect."));

  performance.push(check("performance", "Responsive images", boolStatus(features.hasResponsiveImages), "important",
    "Use srcset and sizes attributes to serve images appropriate for each device."));

  performance.push(check("performance", "Font display swap", boolStatus(features.hasFontDisplay), "important",
    "Use font-display: swap to avoid FOUT during font loading."));

  const lazyIssue = features.performanceHints.some((h) => h.includes("lazy loading"));
  performance.push(check("performance", "Lazy loading enabled", boolStatus(!lazyIssue), "important",
    "Use loading='lazy' for offscreen images."));

  const preloadIssue = features.performanceHints.some((h) => h.includes("preload"));
  performance.push(check("performance", "Preload hints", boolStatus(!preloadIssue), "nice_to_have",
    "Use <link rel='preload'> for critical resources."));

  const renderBlockIssue = features.performanceHints.some((h) => h.includes("render-blocking"));
  performance.push(check("performance", "Render-blocking resources minimized", boolStatus(!renderBlockIssue), "important",
    "Reduce render-blocking CSS/JS and inline critical CSS."));

  // ===== SECURITY CHECKS =====
  security.push(check("security", "HTTPS", boolStatus(features.https), "critical",
    "An SSL certificate should be installed and all traffic should go over HTTPS."));

  security.push(check("security", "Content-Security-Policy (CSP)",
    boolStatus(features.securityHeaders.hasCSP), "important",
    "Define a CSP header with rules for script-src, style-src, and img-src."));

  security.push(check("security", "X-Frame-Options",
    boolStatus(features.securityHeaders.hasXFrameOptions), "important",
    "X-Frame-Options: DENY - protect against clickjacking attacks."));

  security.push(check("security", "X-Content-Type-Options",
    boolStatus(features.securityHeaders.hasXContentTypeOptions), "important",
    "X-Content-Type-Options: nosniff - block MIME type sniffing."));

  security.push(check("security", "Referrer-Policy",
    boolStatus(features.securityHeaders.hasReferrerPolicy), "important",
    "Define Referrer-Policy: origin-when-cross-origin."));

  security.push(check("security", "Strict-Transport-Security (HSTS)",
    boolStatus(features.securityHeaders.hasHSTS), "important",
    "Use an HSTS header to make HTTPS enforcement persistent."));

  security.push(check("security", "Permissions-Policy",
    boolStatus(features.securityHeaders.hasPermissionsPolicy), "nice_to_have",
    "Use Permissions-Policy to restrict camera, microphone, and geolocation access."));

  // ===== ACCESSIBILITY CHECKS =====
  const noA11yIssues = features.accessibilityIssues.length === 0;
  accessibility.push(check("accessibility", "Overall accessibility", boolStatus(noA11yIssues), "critical",
    features.accessibilityIssues.length > 0
      ? `Issues detected: ${features.accessibilityIssues.join("; ")}`
      : "Basic accessibility checks passed."));

  const noMissingAlt = !features.accessibilityIssues.some((i) => i.includes("alt"));
  accessibility.push(check("accessibility", "Image alt text", boolStatus(noMissingAlt), "critical",
    "All images should have meaningful alt text; decorative images should use alt=''."));

  const noMissingLabel = !features.accessibilityIssues.some((i) => i.includes("label"));
  accessibility.push(check("accessibility", "Form label association", boolStatus(noMissingLabel), "critical",
    "Every form input should be associated with a label (for/id or aria-label)."));

  const noHeadingIssue = !features.accessibilityIssues.some((i) => i.includes("h1"));
  accessibility.push(check("accessibility", "Heading hierarchy", boolStatus(noHeadingIssue), "important",
    "Heading hierarchy should be correct (single H1, H1 > H2 > H3 order)."));

  const noLangIssue = !features.accessibilityIssues.some((i) => i.includes("lang"));
  accessibility.push(check("accessibility", "HTML lang attribute", boolStatus(noLangIssue), "important",
    "Declare the page language with <html lang='en'>."));

  const noSemanticIssue = !features.accessibilityIssues.some((i) => i.includes("semantic"));
  accessibility.push(check("accessibility", "Semantic HTML", boolStatus(noSemanticIssue), "important",
    "Use semantic elements such as <header>, <nav>, <main>, <footer>, and <article>."));

  // ===== UX CHECKS =====
  ux.push(check("ux", "Mobile friendly", boolStatus(features.mobileFriendlyGuess), "critical",
    "Ensure mobile friendliness with a viewport meta tag and responsive design."));

  ux.push(check("ux", "Favicon", boolStatus(features.hasFavicon), "important",
    "Provide favicon sizes: 16x16, 32x32, 180x180 (iOS), and 512x512 (Android)."));

  ux.push(check("ux", "Contact form", boolStatus(features.hasContactForm), "critical",
    "Include a contact form with email, phone, and message fields."));

  ux.push(check("ux", "WhatsApp integration", boolStatus(features.hasWhatsappLink), "important",
    "Add a WhatsApp contact link (wa.me/number)."));

  ux.push(check("ux", "Online booking system", boolStatus(features.hasBookingSystem), "important",
    "Integrate an online booking or reservation system."));

  ux.push(check("ux", "CTA (Call-to-Action) links", boolStatus(features.ctaLinks.length > 0), "critical",
    "Provide clear CTA buttons such as 'Contact Us', 'Get a Quote', or 'Book Now'."));

  ux.push(check("ux", "Navigation structure", boolStatus(features.navItems.length >= 3), "critical",
    "A clear navigation menu should include at least Home, Services, and Contact."));

  // ===== PWA CHECKS =====
  pwa.push(check("pwa", "Web App Manifest", boolStatus(features.hasManifest), "nice_to_have",
    "Add a manifest.json with PWA features (name, icons, start_url, display)."));

  pwa.push(check("pwa", "Service Worker", boolStatus(features.hasServiceWorker), "nice_to_have",
    "Add a service worker for offline support and a caching strategy."));

  // ===== FORM CHECKS =====
  form.push(check("form", "Contact form present", boolStatus(features.hasContactForm), "critical",
    "The business should have a contact form (name, email, phone, message)."));

  form.push(check("form", "Privacy / GDPR compliance", "unknown", "critical",
    "Forms should include a privacy/GDPR consent checkbox and a link to the privacy policy."));

  form.push(check("form", "Spam protection (honeypot/captcha)", "unknown", "important",
    "Add bot protection via a honeypot field or reCAPTCHA."));

  // ===== ANALYTICS =====
  seo.push(check("seo", "Google Analytics / Tag Manager", boolStatus(features.hasGoogleAnalytics), "critical",
    "Integrate GA4 or GTM with pageview and event tracking."));

  seo.push(check("seo", "Cookie consent banner", boolStatus(features.hasCookieConsent), "important",
    "Add a GDPR-compliant cookie consent banner."));

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
  lines.push(`## Audit summary: ${result.summary.passed}/${result.summary.totalChecks - result.summary.unknown} passed (${result.summary.scorePercent}%)\n`);

  const categories: { key: keyof Omit<AuditChecklistResult, "summary">; label: string }[] = [
    { key: "seo", label: "SEO and Metadata" },
    { key: "performance", label: "Performance" },
    { key: "security", label: "Security" },
    { key: "accessibility", label: "Accessibility" },
    { key: "ux", label: "User Experience (UX)" },
    { key: "pwa", label: "PWA" },
    { key: "form", label: "Form Management" },
  ];

  for (const { key, label } of categories) {
    const checks = result[key];
    if (checks.length === 0) continue;

    const passCount = checks.filter((c) => c.status === "pass").length;
    lines.push(`### ${label} (${passCount}/${checks.length})`);
    for (const c of checks) {
      const icon = c.status === "pass" ? "[PASS]" : c.status === "fail" ? "[FAIL]" : "[UNKNOWN]";
      const pri = c.priority === "critical" ? "(CRITICAL)" : c.priority === "important" ? "(IMPORTANT)" : "(NICE TO HAVE)";
      lines.push(`${icon} ${pri} ${c.item}`);
      if (c.status !== "pass") {
        lines.push(`  -> Recommendation: ${c.recommendation}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
